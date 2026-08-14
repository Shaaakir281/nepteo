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
- Tokens dans `app/globals.css` (bleu #2d5ba7, ink #1c1713, cerise #8a232d, tint, line…) exposés en classes Tailwind (`text-ink`, `bg-tint`, `border-line-soft`, `shadow-card`…).
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

**Priorité immédiate : boucle Campagnes réelle et mesurable.** CAMP-0/1/2,
CONN-0/1, META-READ, META-METRICS et le parcours pilote Meta sont déployés sans
écriture Ads. La lecture `ads_read` alimente une photographie quotidienne
atomique dans `ad_metrics` et garde les résultats Meta séparés des outcomes
aval. G1 reste ouvert jusqu'au rapprochement d'un échantillon Meta autorisé non
vide. BUDGET-RESULTS peut avancer pendant cette recette, mais G2 reste ouvert
jusqu'à la même comparaison réelle. META-RECOMMEND, META-PAUSE, Google Ads,
Salesforce, LinkedIn et C7 ne sont pas les prochaines implémentations.

Au 2026-08-14, Supabase production est attesté à `app_schema_version = 30` et
Azure sert `nepteo-prod--0000036`. Le staging partagé, auparavant divergent en
`0029/0030`, a été réconcilié sans écrasement puis porté sur la chaîne canonique
`0029_meta_metrics` → `0030_meta_ads_pilot_access` →
`0031_connector_foundation` → `0032_connector_conflict_http`, avec readiness 32.
Les migrations restent manuelles et staging doit toujours précéder production.
Le lot BUDGET-RESULTS est explicitement autorisé jusqu'au commit, à la PR, à la
fusion, à la migration production et au déploiement, sans appel Meta ni secret.

Le mode sûr reste inchangé : propositions et validations humaines ne confèrent
aucun droit d'envoi ou de mutation fournisseur. Aucun CAC ni ROAS réel sans
conversion/revenu aval rapproché et vérifiable ; une action déclarée par Meta
reste `provider_reported`. La télémétrie LLM peut mesurer la technique, mais ne
doit enregistrer ni prompts ni réponses par défaut.
