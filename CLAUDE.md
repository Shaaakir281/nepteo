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
- IA : Vercel AI SDK multi-fournisseurs (Anthropic par défaut, OpenAI et autres en test), modèles via env — couche à construire dans `lib/llm.ts`
- Zod pour la validation des entrées/sorties
- File de jobs async : à trancher (voir docs/DECISIONS.md)

## Commandes

```bash
npm run dev        # serveur de dev
npm run build      # build production
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
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

- **Source de vérité UI : `docs/maquettes/`** (cockpit + onboarding validés). Toute nouvelle vue doit reprendre leurs patterns.
- Tokens dans `app/globals.css` (violet #5a4fe0, ink #191731, tint, line…) exposés en classes Tailwind (`text-ink`, `bg-tint`, `border-line-soft`, `shadow-card`…).
- Typo : Inter (corps) + Instrument Sans (titres, `font-display`). Rayons 18/13/10 px.
- Textes produit : simples, français, sans jargon — expliquer les termes marketing (« Un prospect est… »).

## Auth (en place)

- Session Supabase SSR rafraîchie dans `proxy.ts` ; routes publiques : `/login`, `/signup`, `/auth/*`, `/api/*` (auth propre).
- Écritures sensibles via `createAdminClient()` (service-role, serveur uniquement) + entrée `journal` systématique.
- Flux : signup → confirmation email (`/auth/confirm`) → `/onboarding` (création organisation, rôle admin) → `/`.

## Conventions

- UI et textes produit en **français** ; code, identifiants et commits en anglais.
- **Fichiers courts** : un composant par fichier. UI partagée dans `components/ui/`, icônes dans `components/icons.tsx`, composants propres à une vue dans son dossier `_components/`. Pas de fichier > ~200 lignes sans bonne raison.
- Métriques privilégiées : vente et revenu (pas les métriques de vanité).
- Chaque action proposée porte : constat, raison, données utilisées, impact estimé, confiance, risque.
- Toute mutation passe par le serveur (route handler / server action) et écrit au journal.

## Phase actuelle

**Phase 1 — Fondations (lecture seule)** : auth, schéma DB, premier connecteur en lecture, journal. Voir docs/ROADMAP.md. Ne pas construire en avance des phases suivantes.
