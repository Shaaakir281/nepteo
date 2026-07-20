# Suivi du projet — journal des agents

> **Règle pour tout agent (Claude Code, Cowork, autre) travaillant sur ce repo :**
> 1. Lire ce fichier + `CLAUDE.md` avant de coder.
> 2. À la fin de ta session : ajouter une entrée en haut de l'« Historique des sessions » (date, ce qui a été fait, décisions prises, ce qui reste), et mettre à jour « État actuel » si besoin.
> 3. Ne jamais construire en avance des phases suivantes (voir docs/ROADMAP.md). Vérifier `npm run typecheck` + `npm run build` avant de conclure.

> **Kit de test prêt** : `docs/TESTS.md` (procédure complète connecteurs + parcours Phase 2) et `docs/tests/prospects-test.csv` (fausse base). **Tests en cours (2026-07-20 soir)** : app OAuth Google « Nepteo (dev) » créée par Fathi (écran de consentement configuré, email testeur ajouté après un 403 access_denied, ID client + secret dans `.env.local`). Tests LLM avec **clé OpenAI** (`LLM_MODEL*=openai:gpt-5.4` en env — pas encore de clé Anthropic). Reste à dérouler : connexion Sheets → sync → analyse → décisions, puis Notion. En prod : 1 seule app Google/Notion pour tous les clients (validation Google à passer avant lancement — voir TESTS.md § production).

## État actuel (2026-07-20)

**Phase 1 — Fondations : socle terminé.** Il reste le premier connecteur réel (bloqué par le choix du client pilote, voir DECISIONS.md).

Fonctionnel et vérifié (build vert, testé en local par Fathi) :

- **Auth** : signup/login/confirmation email (`app/(auth)`, `app/auth/confirm`), sessions SSR rafraîchies dans `proxy.ts` (Next 16 — pas de middleware.ts), onboarding création d'organisation.
- **Cockpit** : shell sidebar fidèle aux maquettes (`app/(cockpit)/_components/`), vues **Aujourd'hui** (KPIs en attente + journal réel), **Entreprise** (mémoire : activité, zone, canaux, ton, objectifs max 2, offres structurées), **Connecteurs** (catalogue complet, demandes journalisées), **Journal** (filtres, pagination, groupé par jour).
- **DB** : `supabase/migrations/0001_init.sql` — organizations, memberships (5 rôles), company_memory, connectors, actions, journal (append-only par trigger), RLS par organisation. Écritures via `createAdminClient()` + entrée journal systématique.
- **LLM** : `lib/llm.ts` — attribution **par tâche** (`LLM_TASKS`, `getModelForTask`), 3 niveaux light/standard/premium, 4 fournisseurs (anthropic/openai/google/mistral), overrides env `LLM_TASK_*`. Test : `/api/llm/status`.
- **Infra** : Dockerfile standalone, CI GitHub Actions (lint+typecheck+build), deploy.yml → Azure Container Apps (infra Azure PAS encore créée — ACR/RG/App à provisionner, deploy échoue normalement).

Environnement : Supabase projet `hrqnzorapjnosjphftur` (migration exécutée), repo GitHub `Shaaakir281/nepteo`, dev local port 3001 (3000 pris par Langfuse), Node 20 local (passer à 22 recommandé).

## Prochaines étapes (dans l'ordre)

**Décidé (2026-07-19) : premiers connecteurs = Google Sheets + Notion, lecture seule.** Plan pour la prochaine session :

1. **Migration `0002_prospects.sql`** : table `prospects` (organization_id, connector_id, external_id, name, email, company, stage, source, raw jsonb, synced_at) + `unique(connector_id, external_id)` (idempotence du sync) + RLS par organisation.
2. **Chiffrement des tokens** : helper AES-256-GCM (`lib/crypto.ts`) avec `CONNECTOR_TOKEN_ENCRYPTION_KEY`, stockage dans `connectors.encrypted_credentials`. Jamais de token en clair.
3. **OAuth Google** (`app/api/connectors/google_sheets/…`) : scopes `spreadsheets.readonly` + `drive.file` minimum ; l'utilisateur choisit ensuite le classeur + mapping colonnes simple (nom/email/entreprise/statut).
4. **OAuth Notion** (integration publique) : l'utilisateur choisit sa base contacts ; mapping propriétés → champs prospects.
5. **Sync** : route de sync manuelle d'abord (« Synchroniser maintenant », journalisée `connector_synced`), cron ensuite — trancher pg-boss vs BullMQ (DECISIONS #2) à ce moment-là.
6. **UI** : cartes Google Sheets/Notion passent à « Connecté · synchronisé il y a X » (pattern maquette), vue Prospects (Phase 2) branchée dessus.
7. Brancher **Langfuse** (OTel sur `LLM_TASKS`) avant les premières features IA.
8. Porte Phase 1 → Phase 2 : données du pilote affichées juste, tous les jours.
9. Client pilote : toujours à confirmer avec Charly (la décision connecteurs n'en dépend plus).

## Pièges connus

- `middleware.ts` serait **silencieusement ignoré** — toute logique de garde va dans `proxy.ts`.
- Clés Supabase au nouveau format `sb_publishable_`/`sb_secret_` (drop-in dans les vars `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`).
- Lien de confirmation email Supabase arrive en `?code=` (PKCE) — géré dans `app/auth/confirm/route.ts`, ne pas « simplifier ».
- La table `journal` refuse UPDATE/DELETE (trigger) — c'est voulu.
- Design : ne rien inventer, copier les patterns de `docs/maquettes/` (tokens dans `globals.css`).

## Historique des sessions

### 2026-07-20 — Claude (Cowork) — début Phase 2 (recommandations)
- CLAUDE.md : phase actuelle → **Phase 2** (proposer sans exécuter ; exécution = Phase 3).
- **Vue Prospects** (`/prospects`, nav activée) : liste + répartition par statut, états vides guidant vers les connecteurs.
- **Moteur d'analyse v1** (`lib/analysis.ts`) : règles sur les prospects (emails manquants, plus gros groupe par statut → relance), habillage de la raison par LLM (`recommend_action`) avec **repli silencieux sur templates si pas de clé API**, dédupe par `kind`, insert `actions` status=proposed + journal `action_proposed` (acteur agent).
- **File de validation** sur Aujourd'hui (`_components/validation-queue.tsx`) : constat/raison/impact/confiance/risque/sources, boutons Valider/Reporter/Refuser (`decideAction` — statut + `decided_by` + journal, AUCUNE exécution), bouton « Analyser mes données maintenant » (`runAnalysisNow`).
- Vérif : tsc OK, compile OK (sandbox lent, phases post-compile déjà validées aux builds précédents).
- À tester par Fathi ce soir avec une vraie feuille : connecter → synchroniser → analyser → valider une action → vérifier le journal.
- Suite : intégrer l'analyse au cron quotidien (après sync), tiroir de raisonnement complet (maquette), Langfuse, vue Prospects kanban/funnel fidèle maquette.

### 2026-07-20 — Claude (Cowork) — sync automatique quotidienne
- Logique de sync extraite dans `lib/connectors/sync.ts` (réutilisée par l'action manuelle et le cron).
- Route `/api/cron/sync` (Bearer `CRON_SECRET`) : sync toutes orgs, acteur **agent** au journal (`mode: auto`), échecs journalisés `connector_sync_failed`.
- Workflow `.github/workflows/sync-cron.yml` : quotidien 05:00 UTC + déclenchement manuel ; inactif tant que la variable repo `APP_URL` n'est pas définie (déploiement Azure requis).
- Décision actée : pas de file de jobs en Phase 1 (route cron suffit) — pg-boss réévalué plus tard.
- Reste : env `CRON_SECRET` (local + Container App), variables GitHub `APP_URL` + secret `CRON_SECRET` au moment du déploiement.

### 2026-07-20 — Claude (Cowork) — connecteurs Google Sheets + Notion
- Migration `0002_prospects.sql` (table prospects + RLS — **à exécuter dans Supabase**).
- `lib/crypto.ts` (AES-256-GCM), `lib/connectors/{common,store,google-sheets,notion}.ts`.
- Routes OAuth authorize/callback ×2 (state CSRF en cookie, jetons chiffrés, journal `connector_connected`).
- Page `/connecteurs/[provider]` : config (URL classeur / choix base Notion), sync manuelle journalisée (`connector_synced`, upsert idempotent sur `connector_id+external_id`), aperçu 5 prospects, déconnexion (purge des jetons).
- Cartes Sheets/Notion → vrai bouton Connecter (OAuth) / Gérer.
- Reste : Fathi doit créer les apps OAuth (Google Cloud + Notion), remplir les env, exécuter la migration, générer `CONNECTOR_TOKEN_ENCRYPTION_KEY`. Puis : cron de sync (décision pg-boss/BullMQ), vue Prospects (Phase 2), Langfuse.

### 2026-07-19 — Claude (Cowork) — session fondation
- Squelette Next 16 + Supabase + docs (CLAUDE.md, ARCHITECTURE, ROADMAP, DECISIONS).
- Docker + CI/CD GitHub Actions → Azure Container Apps (décision hébergement actée).
- Auth complète + onboarding org + RLS + journal ; premier commit et push GitHub.
- Refonte UI complète depuis les maquettes validées (tokens, sidebar, vue Entreprise structurée).
- Refactor en composants courts (règle : 1 composant/fichier, `components/ui/` + `_components/`).
- Vues Connecteurs (demandes journalisées) et Journal (filtres/pagination).
- Couche LLM par tâche + route de statut ; décision Langfuse actée.
- Reste à la charge de Fathi : `npm install` (nouvelles deps IA), passage Node 22, infra Azure, décision pilote avec Charly.
