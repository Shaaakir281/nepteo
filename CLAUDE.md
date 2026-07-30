# Nepteo — Agent Marketing / Cockpit Growth

Copilote marketing IA pour PME, solopreneurs et petites équipes. L'agent comprend l'activité de l'entreprise, connecte ses outils, analyse les données, recommande des actions et en exécute certaines sous validation humaine.

## Positionnement

- Cible : utilisateurs avec culture marketing basique à intermédiaire (à l'aise avec leads, CAC, ROAS, funnel, nurturing — pas des media buyers).
- Entre « outil pour marketeur expert » et « outil grand public » — cette tension guide toutes les décisions de feature et de copy.
- **Règle vocabulaire** : lexique marketing standard conservé tel quel ; jargon d'initié plateforme (Andromeda routing, PSM scoring…) coupé ou glosé brièvement.

## Philosophie d'autonomie

- L'agent prépare et propose tout, validation en 1 clic.
- Exécution directe autorisée uniquement pour les actions réversibles à faible risque.
- Actions engageantes (lancement campagne payante, envoi de masse) : validation obligatoire.
- Slider d'autonomie configurable par client.
- L'autonomie doit être *visible* dans l'interface : l'agent travaille, il ne fait pas que suggérer.

## Architecture — non négociable

1. **Idempotence** : écriture dans le journal AVANT tout envoi/exécution, avec `idempotency_key`.
2. **Garde-fous côté serveur** (plafonds, seuils, validations) — jamais uniquement en UI.
3. **Chiffrement des tokens OAuth** et conformité RGPD dès le jour 1 (hébergement EU).

## Stack

- Next.js 16 (App Router, TypeScript strict) + Tailwind 4
- Supabase (Postgres + Auth + RLS, hébergement EU)
- IA : Vercel AI SDK multi-fournisseurs — `lib/llm.ts`, `getModel("light" | "standard" | "premium")`, modèles par env (`LLM_MODEL*`, format `provider:model`). Test : GET/POST `/api/llm/status`.
- Recherche web (hors `lib/llm.ts` — chercher ≠ rédiger) : **deux fournisseurs** derrière `lib/research/provider.ts`, `fetch` natif, aucune dépendance. OpenAI `web_search` (Responses API, modèle par défaut surchargeable via `RESEARCH_OPENAI_MODEL`) ou Perplexity Agent API. `RESEARCH_PROVIDER` (`openai` | `perplexity`) tranche ; à défaut, le premier fournisseur dont la clé existe ; aucune clé ⇒ recherche désactivée proprement. Toujours passer par `runResearch` : cache de réponse réservé aux résultats `status = ok`, réservation atomique du quota quotidien sérialisée avec la pause, puis journal AVANT l'appel externe. Les appels forcés ou échoués après claim consomment le quota.
- Zod pour la validation des entrées/sorties
- Jobs : sync par route de cron au volume actuel ; outbound futur via outbox PostgreSQL + claim atomique + worker borné (pas de boucle synchrone, pas de Redis sans besoin mesuré).

## Commandes

```bash
npm run dev        # serveur de dev
npm run build      # build production
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # contrats purs, RLS/migrations et orchestration
```

## Structure

```
app/            (auth) login/signup · (cockpit) shell sidebar + pages / et /entreprise · onboarding · auth/confirm
lib/            clients supabase (client, server, admin, proxy), claude, memory (sections + options), types
proxy.ts        protection des routes + refresh session (Next 16 : remplace middleware.ts)
supabase/       migrations SQL
docs/           architecture, roadmap, décisions, maquettes HTML
```

## Design

- **Référence visuelle : `docs/maquettes/`** pour les tokens et patterns. Ces maquettes sont historiques ; la navigation fonctionnelle à cinq entrées est définie dans `docs/DECISIONS.md` et le code livré fait foi.
- Tokens dans `app/globals.css` (violet #5a4fe0, ink #191731, tint, line…) exposés en classes Tailwind (`text-ink`, `bg-tint`, `border-line-soft`, `shadow-card`…).
- Typo : Inter (corps) + Instrument Sans (titres, `font-display`). Rayons 18/13/10 px.
- Textes produit : simples, français, **concis**. On s'adresse à des entrepreneurs : **ne pas définir** le lexique marketing standard (prospect, lead, funnel, relance…). Ne gloser brièvement que le jargon d'initié réellement obscur (cf. « Règle vocabulaire »). Pas de sous-titres explicatifs à rallonge.

## Auth (en place)

- Session Supabase SSR rafraîchie dans `proxy.ts` ; routes publiques : `/login`, `/signup`, `/auth/*`, `/api/*` (auth propre).
- Écritures sensibles via `createAdminClient()` (service-role, serveur uniquement) + entrée `journal` systématique.
- Flux : signup → confirmation email (`/auth/confirm`) → `/onboarding` (création organisation, rôle admin) → `/`.
- Capacités centralisées dans `lib/auth/roles.ts` : admin/marketing/direction éditent, voient les finances et gèrent les campagnes ; lecture voit les finances sans mutation ; commercial n'a aucune de ces capacités. Un rôle inconnu est refusé. `0015`, puis le rattrapage additif `0019`, imposent aussi la frontière côté RLS et privilèges de colonnes : aucun contenu libre/dérivé pour le commercial, seulement les colonnes prospects expurgées, le nom de l'organisation et les métadonnées non sensibles des connecteurs CRM/fichiers. `organizations.activity`, `connectors.config` et `connectors.encrypted_credentials` restent côté service role.

## Conventions

- UI et textes produit en **français** ; code, identifiants et commits en anglais.
- **Fichiers courts** : un composant par fichier. UI partagée dans `components/ui/`, icônes dans `components/icons.tsx`, composants propres à une vue dans son dossier `_components/`. Pas de fichier > ~200 lignes sans bonne raison.
- Métriques privilégiées : vente et revenu (pas les métriques de vanité).
- Chaque action proposée porte : constat, raison, données utilisées, impact estimé, confiance, risque.
- Toute mutation passe par le serveur (route handler / server action) et écrit au journal.
- Le mode démo est réservé à l'admin d'une organisation de test vide au moment du premier chargement. Cette vacuité est une précondition de seed, pas l'état normal de la vitrine : le scénario fictif reste ensuite volontairement chargé, identifiable et réinitialisable pendant les tests commanditaires. Respecter le préflight, les marqueurs/scopes démo, le verrou distribué et le nettoyage sélectif ; ne jamais reconnaître ou supprimer une ligne réelle par ressemblance. Tester OAuth/RLS dans des organisations séparées. Ne jamais reprendre automatiquement un `__demo_lock` ancien : sans fencing, une récupération doit être manuelle et vérifier que le propriétaire ne travaille plus.
- Les décisions, réglages d'exécution, claims et finalisations passent par les RPC transactionnelles de `0018`. Ne pas contourner ces frontières ni effacer/réutiliser automatiquement un claim ambigu : retourner une reprise requise.
- `/api/health` ne touche pas la base. `/api/ready` vérifie Supabase et `app_schema_version`. Depuis `0016`, chaque nouvelle migration de schéma doit faire progresser ce marqueur et rester alignée avec `REQUIRED_SCHEMA_VERSION` et le workflow de déploiement.

## Suivi inter-agents

**Obligatoire : lire `docs/SUIVI.md` avant de coder, et y consigner ta session à la fin** (entrée datée : fait / décisions / reste à faire).

## Phase actuelle

**Phase 3A déployée ; porte terrain de la phase 2 encore ouverte.** Les fondations permettent à l'agent de détecter, proposer et préparer. **Étape A = mode sûr** : une action validée prépare les messages dans `outbox_messages` (statut `prepared`), **AUCUN envoi externe**. R1A/C9A, R1B et R2 sont en production : preuve terrain structurée et déclarative dans `value_events`, cohortes de relance figées à l'approbation, Top 5 explicable dans « Aujourd'hui » et play dormant supervisé. L'ordre opérationnel reste défini dans `docs/projets/roadmap-valeur-commanditaires.md` : finir R0 sur fixtures dédiées, mener le pilote, puis envisager un connecteur ou C7 seulement si leurs gates sont franchis.

Au 2026-07-30, les migrations `0012` à `0020` sont appliquées à Supabase production et `app_schema_version = 20`. Elles couvrent le temps dans la relance, la mono-organisation bêta, les écritures mémoire au service role, la frontière financière par rôle, la readiness, le quota de recherche atomique, les transitions d'action transactionnelles, le rattrapage additif des privilèges/RLS, les événements de valeur append-only et les snapshots immuables des cibles. L'isolation démo protège aussi les mutations réelles avec le même verrou distribué. Azure sert l'image `5d03f109e9d06c456781d72c2c0b5ab13eca1a4c`, révision `nepteo-prod--0000006`. Les migrations restent manuelles et doivent toujours précéder le code qui les exige.

Le prochain connecteur de contexte, s'il est justifié par les tests **et explicitement choisi par Fathi**, est **Google Workspace/Gmail ou Microsoft 365, jamais les deux dans le même cycle**, d'abord en lecture seule et avec données minimisées. Un envoi manuel déclaré n'est jamais un statut fournisseur `sent`. Avant C7 restent notamment à fermer la suppression-list, le quota/claim global atomique de l'outbox, les états ambigus et la chaîne outbound complète ; aucun envoi externe sans validation explicite de Fathi. La télémétrie LLM peut mesurer la technique, mais ne doit enregistrer ni prompts ni réponses par défaut.
