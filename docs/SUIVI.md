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

### 2026-07-21 — Claude (Cowork) — Langfuse + analyse au cron + UI (tiroir & kanban) + boucle de feedback
- **Revue tests §3 (priorité 1)** : chemin décision vérifié, aucun correctif nécessaire. `decideAction` (`app/(cockpit)/actions.ts`) écrit bien `action_approved`/`action_rejected` acteur **user** + `decided_by`/`decided_at`, aucune exécution. Cron `/api/cron/sync` : acteur **agent**, `connector_synced` payload `mode: auto` (déjà en place via `syncConnectorRow`). Notion (`lib/connectors/notion.ts` + routes authorize/callback + page config) relu : OAuth (Basic auth, state CSRF cookie `oauth_state_notion`), mapping propriétés robuste (title/email/select/status par type + regex FR/EN). **Rien à corriger** — reste à Fathi de faire l'OAuth Notion réel (guide dans le message de session).
- **Langfuse (priorité 2)** : `lib/llm.ts` → `telemetryForTask(task)` (`functionId` = nom de tâche → « traces par tâche nommée »). Branché en `experimental_telemetry` sur `generateText` dans `lib/analysis.ts` (`recommend_action`) et `app/api/llm/status/route.ts` (ping). `lib/observability.ts` + `instrumentation.ts` : hook d'activation Langfuse **si** clés + paquets présents, sinon no-op (imports dynamiques à specifier variable → build vert sans les paquets). **Activation par Fathi** : `npm i @vercel/otel langfuse-vercel` + env `LANGFUSE_*` (cf. TESTS.md §4).
  - ⚠️ **Correction v7** : l'AI SDK v7 a changé l'API de télémétrie — `TelemetrySettings` n'existe plus (d'où une erreur `tsc` TS2305 restée latente, cf. « Vérif »), `TelemetryOptions` **retire `metadata`** (v3/v4) et conserve `isEnabled`/`functionId`. Helper corrigé : plus de `metadata`, regroupement par `functionId`. **À valider par Fathi au moment de l'activation** : que le couple `langfuse-vercel` ↔ `ai@7` émette bien les spans attendus (l'API ayant bougé, l'exportateur OTel peut nécessiter la voie « intégration » v7).
- **Analyse au cron quotidien (priorité 2)** : `/api/cron/sync` lance `runAnalysis` sur chaque organisation synchronisée après la sync ; journal `analysis_run` acteur **agent** (`mode: auto`) + `action_proposed` (déjà agent). Réponse JSON enrichie (`analyzed`).
- **UI fidèle aux maquettes (priorité 3)** :
  - `_components/validation-queue.tsx` réécrit en client component avec **tiroir de raisonnement** latéral (veil + aside coulissant, maquette `.drawer`) : sections Constat / Pourquoi / Données utilisées / Impact + encart confiance & risque, boutons Valider/Reporter/Refuser dans le tiroir.
  - Vue **Prospects** en **funnel + kanban** : `prospects/_components/prospects-board.tsx` (colonnes par statut, cartes prospect, funnel = répartition réelle par statut). `prospects/page.tsx` regroupe par statut, ordonne par effectif. Données réelles uniquement (pas de métriques inventées).
- **Suite de tests du moteur d'analyse (zéro dépendance)** : `tests/analysis-rules.test.mjs` couvre `buildFindings` via `node:test` (intégré) — base vide, réplique fidèle du CSV de test (24 prospects → **exactement 2 propositions**, 5 emails manquants + relance « Nouveau » ×9), seuils (relance ≥ 2, entreprise manquante ≥ 40 % & base ≥ 5), sans-statut (déclenche sauf si tous sans statut), doublons d'email insensibles à la casse, cohérence des champs. Script `npm test` (`node --test`, auto-découverte). **8/8 verts** exécutés dans le sandbox (Node 22.22). ⚠️ **Requiert Node ≥ 22** (type-stripping du `.ts` importé, sans build ni dépendance) — Fathi est en Node 20 en local (passage à 22 déjà recommandé). Hors périmètre `tsc` (fichier `.mjs`, non listé dans `include`).
- **Moteur d'analyse enrichi (Phase 2 — « anomalies, comparaisons » de la ROADMAP)** : règles extraites dans `lib/analysis-rules.ts` (`buildFindings`), `analysis.ts` réduit à l'orchestration (dédupe + habillage LLM + insert + journal). 3 règles ajoutées, toutes calculées sur des champs réels (aucune métrique inventée) : **classer les prospects sans statut**, **doublons d'email**, **entreprise manquante en volume (≥ 40 %)**. Règle « diversifier les sources » **écartée volontairement** : `source` = le connecteur (Sheets/Notion), pas le canal d'acquisition → serait un faux signal. Sur `prospects-test.csv` (statuts complets, pas de doublon, entreprises renseignées) ces 3 règles ne se déclenchent pas → le test §3 reste **2 propositions** (additif, non régressif).
- **Boucle de feedback visible (Phase 2)** : « Reporter » ne perd plus l'action (avant : `postponed` = disparaît comme un refus). `resumeAction` (`app/(cockpit)/actions.ts`) remet une action reportée en `proposed` (journal `action_resumed`, acteur user), sans migration. Nouveau composant `_components/decisions-history.tsx` (« Décisions récentes » sur Aujourd'hui) : liste validées/refusées/**reportées** avec badge + date, bouton **Reprendre** sur les reportées. Requête `actions` status ∈ {approved,rejected,postponed} triée par `decided_at`. Sert la porte Phase 2 (visibilité de l'utilité des recommandations). Libellé `action_resumed` ajouté à `lib/journal.ts`.
- **Vérif** : `tsc --noEmit` **vert et fiable** (exit 0, sandbox propre après `pkill node` — voir piège ci-dessous), **8/8 tests** verts. ⚠️ **Piège découvert** : mes premiers « verts » tsc de la session étaient des **faux positifs** — le sandbox tuait tsc à ~44 s et laissait un log 0 octet interprété à tort comme « aucune erreur ». Une vraie erreur `TS2305` (`TelemetrySettings`) est ainsi restée cachée jusqu'à un run tsc complet sur sandbox non contendu. **Leçon** : ne conclure au vert que sur un tsc qui s'est terminé (exit 0 explicite), jamais sur un log vide. `eslint` sur les fichiers touchés : diffs relus à la main (aucun import/variable inutilisé, patterns identiques à l'existant déjà lint-clean) ; run automatique non bouclé (sandbox instable). `next build` non exécutable ici (SWC win32) → **à lancer par Fathi sous Windows**.
- **Reste** : Fathi — OAuth Notion réel (§2), tests §3/§3.5 dans l'app, `npm i` Langfuse + clés (+ valider l'émission des spans avec `ai@7`), `npm run build`. Ensuite : autres features IA (tracées), garde-fous Phase 3 (plus tard).

### 2026-07-20 — Claude (Cowork) — robustesse LLM OpenAI (tests §3)
- **Contexte tests Fathi** : connexion Google Sheets OK (24 prospects chargés), Notion pas encore fait (non bloquant), clé OpenAI (`openai:gpt-5.4`) posée dans `.env.local`.
- **Piège identifié** : sur les modèles à raisonnement (famille gpt-5 / o-series), les *reasoning tokens* sont décomptés du budget de sortie. Un `maxOutputTokens` trop bas → texte **vide** → l'habillage LLM retombait silencieusement sur les templates (et le ping `/api/llm/status` renvoyait vide). Symptôme : « la clé OpenAI est posée mais ça ne change rien ».
- **Correctifs** :
  - `lib/analysis.ts` : `maxOutputTokens` 160 → **500** (marge raisonnement) ; le `catch` du repli logue désormais `console.warn` (distinguer « pas de clé » d'une vraie erreur API pendant les tests, sans changer le repli gracieux).
  - `app/api/llm/status/route.ts` (POST ping) : `maxOutputTokens` 8 → **64**.
- **Vérif** : `tsc --noEmit` vert (projet complet) ; `next build` → « Compiled successfully in 24.0s » puis phase TypeScript. Sandbox se recrée aux timeouts (perte /tmp + jobs bg) → phases post-compile non recapturées, mais inchangées par ces edits (littéraux + log).
- **À faire par Fathi** : relancer `npm run dev`, refaire §3 (Analyser mes données → 2 propositions), vérifier que la *raison* d'au moins une action est bien reformulée par le LLM (≠ template) ; si repli, regarder la console dev pour la cause (`[analysis] habillage LLM ignoré…`). Tester aussi le ping admin : `Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/llm/status" -Body '{"task":"recommend_action"}' -ContentType "application/json"` → doit renvoyer `ok:true` + `response: OK`.
- **Suite** : connexion Notion (§2) quand tu veux ; puis Langfuse.

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
