# Suivi du projet — journal des agents

> **Règle pour tout agent (Claude Code, Cowork, autre) travaillant sur ce repo :**
> 1. Lire ce fichier + `CLAUDE.md` avant de coder.
> 2. À la fin de ta session : ajouter une entrée en haut de l'« Historique des sessions » (date, ce qui a été fait, décisions prises, ce qui reste), et mettre à jour « État actuel » si besoin.
> 3. Ne jamais construire en avance des phases suivantes (voir docs/ROADMAP.md). Vérifier `npm run typecheck` + `npm run build` avant de conclure.

## État actuel (2026-07-19)

**Phase 1 — Fondations : socle terminé.** Il reste le premier connecteur réel (bloqué par le choix du client pilote, voir DECISIONS.md).

Fonctionnel et vérifié (build vert, testé en local par Fathi) :

- **Auth** : signup/login/confirmation email (`app/(auth)`, `app/auth/confirm`), sessions SSR rafraîchies dans `proxy.ts` (Next 16 — pas de middleware.ts), onboarding création d'organisation.
- **Cockpit** : shell sidebar fidèle aux maquettes (`app/(cockpit)/_components/`), vues **Aujourd'hui** (KPIs en attente + journal réel), **Entreprise** (mémoire : activité, zone, canaux, ton, objectifs max 2, offres structurées), **Connecteurs** (catalogue complet, demandes journalisées), **Journal** (filtres, pagination, groupé par jour).
- **DB** : `supabase/migrations/0001_init.sql` — organizations, memberships (5 rôles), company_memory, connectors, actions, journal (append-only par trigger), RLS par organisation. Écritures via `createAdminClient()` + entrée journal systématique.
- **LLM** : `lib/llm.ts` — attribution **par tâche** (`LLM_TASKS`, `getModelForTask`), 3 niveaux light/standard/premium, 4 fournisseurs (anthropic/openai/google/mistral), overrides env `LLM_TASK_*`. Test : `/api/llm/status`.
- **Infra** : Dockerfile standalone, CI GitHub Actions (lint+typecheck+build), deploy.yml → Azure Container Apps (infra Azure PAS encore créée — ACR/RG/App à provisionner, deploy échoue normalement).

Environnement : Supabase projet `hrqnzorapjnosjphftur` (migration exécutée), repo GitHub `Shaaakir281/nepteo`, dev local port 3001 (3000 pris par Langfuse), Node 20 local (passer à 22 recommandé).

## Prochaines étapes (dans l'ordre)

1. **Décision client pilote avec Charly** → détermine le premier connecteur à construire (voir demandes dans la table `connectors`).
2. Premier connecteur en lecture réelle + sync (choisir la file de jobs : pg-boss vs BullMQ, DECISIONS #3).
3. Brancher Langfuse (OTel sur les tâches `LLM_TASKS`) avant les premières features IA.
4. Porte Phase 1 → Phase 2 : données du pilote affichées juste, tous les jours.

## Pièges connus

- `middleware.ts` serait **silencieusement ignoré** — toute logique de garde va dans `proxy.ts`.
- Clés Supabase au nouveau format `sb_publishable_`/`sb_secret_` (drop-in dans les vars `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`).
- Lien de confirmation email Supabase arrive en `?code=` (PKCE) — géré dans `app/auth/confirm/route.ts`, ne pas « simplifier ».
- La table `journal` refuse UPDATE/DELETE (trigger) — c'est voulu.
- Design : ne rien inventer, copier les patterns de `docs/maquettes/` (tokens dans `globals.css`).

## Historique des sessions

### 2026-07-19 — Claude (Cowork) — session fondation
- Squelette Next 16 + Supabase + docs (CLAUDE.md, ARCHITECTURE, ROADMAP, DECISIONS).
- Docker + CI/CD GitHub Actions → Azure Container Apps (décision hébergement actée).
- Auth complète + onboarding org + RLS + journal ; premier commit et push GitHub.
- Refonte UI complète depuis les maquettes validées (tokens, sidebar, vue Entreprise structurée).
- Refactor en composants courts (règle : 1 composant/fichier, `components/ui/` + `_components/`).
- Vues Connecteurs (demandes journalisées) et Journal (filtres/pagination).
- Couche LLM par tâche + route de statut ; décision Langfuse actée.
- Reste à la charge de Fathi : `npm install` (nouvelles deps IA), passage Node 22, infra Azure, décision pilote avec Charly.
