# Suivi du projet — journal des agents

> **Règle pour tout agent (Claude Code, Cowork, autre) travaillant sur ce repo :**
> 1. Lire ce fichier + `CLAUDE.md` avant de coder.
> 2. À la fin de ta session : ajouter une entrée en haut de l'« Historique des sessions » (date, ce qui a été fait, décisions prises, ce qui reste), et mettre à jour « État actuel » si besoin.
> 3. Ne jamais construire en avance des phases suivantes (voir docs/ROADMAP.md). Vérifier `npm run typecheck` + `npm run build` avant de conclure.

> **Kit de test prêt** : `docs/TESTS.md` (procédure complète connecteurs + parcours Phase 2) et `docs/tests/prospects-test.csv` (fausse base). **Tests en cours (2026-07-20 soir)** : app OAuth Google « Nepteo (dev) » créée par Fathi (écran de consentement configuré, email testeur ajouté après un 403 access_denied, ID client + secret dans `.env.local`). Tests LLM avec **clé OpenAI** (`LLM_MODEL*=openai:gpt-5.4` en env — pas encore de clé Anthropic). Reste à dérouler : connexion Sheets → sync → analyse → décisions, puis Notion. En prod : 1 seule app Google/Notion pour tous les clients (validation Google à passer avant lancement — voir TESTS.md § production).

## État actuel (2026-07-22)

**Phase 2 — Recommandations : bien avancée.** L'agent lit les données réelles, détecte et propose ; il n'exécute **jamais** (exécution = Phase 3).

Fonctionnel (build vert en local par Fathi ; `tsc` + `npm test` verts dans le sandbox) :

- **Socle Phase 1** (Auth, Cockpit shell, DB + RLS, couche LLM par tâche, Infra/CI) : inchangé, cf. sessions précédentes.
- **Connecteurs (lecture seule)** : Google Sheets **et Notion testés** (24 prospects lus chacun ; mapping Notion par type de propriété + mots-clés, **OK du premier coup, aucun correctif**). OAuth chiffré (AES-256-GCM), sync manuelle + **cron quotidien** (`/api/cron/sync`, acteur agent, `mode: auto`). Table `prospects` (migration 0002, idempotence `connector_id+external_id`). **Dédup à l'affichage** par email dans la vue Prospects (`lib/dedupe-prospects.ts`, lecture seule) — deux connecteurs sur la même base ne comptent plus double.
- **Correspondance de colonnes configurable** (2026-07-22) : écran dans la config connecteur qui relie colonnes/propriétés aux 4 champs Nepteo (`FieldMapping` dans `common.ts`, persisté dans `config.field_mapping`, appliqué au sync Sheets+Notion, **détection auto en défaut**). À valider par Fathi dans l'app.
- **Moteur d'analyse** (`lib/analysis-rules.ts` + `lib/analysis.ts`) : 6 règles sur données réelles (emails manquants, relance du plus gros statut, **relancer en priorité** = joignables + statut actif, sans-statut, doublons d'email, entreprise manquante ≥ 40 %), habillage LLM avec repli templates. Tests `node:test` (`npm test`, 13/13, **Node ≥ 22**).
- **Cockpit Phase 2** : file de validation avec **tiroir de raisonnement** (Aujourd'hui), **Décisions récentes** (Reporter/Reprendre + historique validées/refusées), vue **Prospects funnel + kanban** avec **repère de priorité** par carte (statut + complétude, sans score inventé).
- **Observabilité** : `telemetryForTask` (`functionId` par tâche, champ `telemetry` de l'AI SDK 7) + hook Langfuse **v7** (`lib/observability.ts` = `NodeSDK` + `LangfuseSpanProcessor` + `registerTelemetry(LangfuseVercelAiSdkIntegration)`) — **activé et validé** (2026-07-22, trace `recommend_action` reçue, `gen_ai.agent.name = recommend_action`, tokens/coût OK). Paquets `@langfuse/otel` + `@langfuse/vercel-ai-sdk` + `@opentelemetry/sdk-node` **installés et dans `package.json`** ; dev sur **Node 22.23.1** ✓.

Environnement : Supabase `hrqnzorapjnosjphftur`, repo GitHub `Shaaakir281/nepteo` (branche `main`), dev local **port 3001 figé dans le script** (`next dev -p 3001`), **Node 22.23.1 local ✓** (clé Anthropic présente ; mais overrides `LLM_MODEL*=openai:gpt-5.4` encore actifs → tourne sur OpenAI). Infra Azure toujours pas provisionnée.

## Prochaines étapes (dans l'ordre)

1. **Fathi (manuel)** : ~~connecter Notion~~ **fait**. `npm test` **28/28 (Node 22)**. Reste : `npm run build` (Windows) pour le check final, dérouler le parcours §3 dans l'app (3 propositions + badges de priorité + dédup), et **tester le nouvel écran de correspondance de colonnes** (config connecteur → bloc « Correspondance des colonnes » → pré-remplissage auto, corriger un champ, Enregistrer, resync). ~~Backlog : écran de correspondance de colonnes~~ **construit (2026-07-22)**.
2. ~~Activer Langfuse~~ **fait et validé (2026-07-22)** : paquets installés, clés en place, trace `recommend_action` reçue dans Langfuse. Optionnel plus tard : enrichir les traces (`propagateAttributes`/`observe`) pour grouper par org/client, et confirmer que le mojibake d'accents est bien limité à l'export CSV (pas l'UI).
3. ~~Priorisation des prospects (Phase 2)~~ — **fait (2026-07-21)** : signal transparent (statut + complétude) dans le kanban + proposition « relancer en priorité », sans score inventé. Reste à Fathi : le voir dans le parcours §3 (désormais **3 propositions**) et confirmer les badges kanban.
4. **Porte Phase 2** : ≥ 1 recommandation pertinente/semaine jugée utile par le pilote (ROADMAP). Client pilote toujours à confirmer avec Charly.
5. **Ne pas anticiper la Phase 3** (exécution réelle + garde-fous serveur).

## Pièges connus

- `middleware.ts` serait **silencieusement ignoré** — toute logique de garde va dans `proxy.ts`.
- Clés Supabase au nouveau format `sb_publishable_`/`sb_secret_` (drop-in dans les vars `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`).
- Lien de confirmation email Supabase arrive en `?code=` (PKCE) — géré dans `app/auth/confirm/route.ts`, ne pas « simplifier ».
- La table `journal` refuse UPDATE/DELETE (trigger) — c'est voulu.
- Design : ne rien inventer, copier les patterns de `docs/maquettes/` (tokens dans `globals.css`).
- **Copie produit** : ne PAS définir le lexique marketing standard (prospect, lead, funnel…). CLAUDE.md corrigé en ce sens (retour de Fathi 2026-07-21).
- **Vérif tsc dans le sandbox Cowork** : le sandbox tue les process longs (~44 s) et laisse un log **vide** → « log vide » ≠ « vert ». Ne conclure au vert que sur un `tsc` **terminé** (exit 0 explicite) ; au besoin `pkill node` puis relancer sur sandbox non contendu. `next build` non exécutable (SWC win32 only) → build côté Fathi. `npm test` requiert **Node ≥ 22**.

## Historique des sessions

### 2026-07-22 — Claude (Cowork) — édition en ligne du brouillon
- **Demande Fathi** : pouvoir retoucher directement le message de l'agent (au-delà de Copier/Régénérer). Reste Phase 2 (édite un brouillon, n'envoie rien).
- **`app/(cockpit)/actions.ts`** : `saveDraftEdit(id, subject, body)` → valide (objet non vide, corps ≥ 10), vérifie `canEdit` + kind relance, persiste dans `payload.draft`, journalise `draft_edited` (acteur **user**). Libellé ajouté à `lib/journal.ts`.
- **UI** (`_components/validation-queue.tsx`, `DraftSection`) : bouton **Modifier** → champs Objet (input) + Message (textarea) éditables, **Enregistrer** (désactivé si vide) / **Annuler**. Rappel de garder `{prénom}`. Reprise de la main humaine sur le message de l'agent.
- **Vérif** : `tsc` ciblé **exit 0 (~12 s)** ; `npm test` **35/35** (UI + action, pas de nouvelle logique pure).
- **Note future (échangé avec Fathi)** : (1) perso par notes prospect = déjà stockées dans `prospects.raw` → évolution = brouillon **par prospect** (injecter ses notes au prompt), pas encore fait ; (2) substitution `{prénom}` au vrai prénom = **Phase 3** (étape d'envoi du futur connecteur d'emailing, avec garde-fous + journal avant envoi). Le socle est posé (nom conservé par prospect, placeholder standardisé).

### 2026-07-22 — Claude (Cowork) — waouh démo, lever 3 : autonomie visible (analyse animée)
- **Objectif** : rendre le passage d'analyse **tangible** — l'agent travaille par étapes, il ne fait pas qu'afficher une liste (exigence CLAUDE.md « l'autonomie doit être visible »).
- **`app/(cockpit)/actions.ts`** : `runAnalysisNow` (redirect) → **`analyzeNow()`** qui **retourne** `{ ok, created }` (plus de redirect) — appelable depuis le client.
- **`_components/analysis-runner.tsx`** (client) : bouton qui déroule 3 étapes cadencées (« Lecture de vos données… », « Analyse des signaux du funnel… », « Rédaction des propositions… », ~800 ms chacune) **en parallèle** de l'analyse réelle (`Promise.all([analyzeNow(), minDelay])`), spinner, puis `router.refresh()` (propositions + briefing rechargés). Deux variantes : `primary` (état vide) et `link` (pied de file). Honnête : la cadence rend l'attente lisible, l'analyse est réelle.
- **`_components/validation-queue.tsx`** : les 2 `<form action={runAnalysisNow}>` remplacés par `<AnalysisRunner>` ; import nettoyé.
- **Vérif** : `tsc` ciblé **exit 0 (~22 s)** ; `npm test` **35/35** (pas de nouvelle logique pure — UI + action à retour).
- **Bilan démo (3 leviers livrés)** : brouillons prêts à envoyer + briefing langage naturel + analyse animée. Tout **Phase 2** (l'agent prépare/résume/travaille, n'exécute rien). Côté Fathi : migration 0003, `git push`, `npm run build`, puis dérouler la démo (Analyser → étapes animées → briefing + propositions → ouvrir une relance → message rédigé, Copier/Régénérer).

### 2026-07-22 — Claude (Cowork) — waouh démo, lever 2 : briefing en langage naturel
- **Objectif** : bandeau « Le point de l'agent » en tête d'« Aujourd'hui » — 2-3 phrases résumant l'état du funnel, **ancrées sur des chiffres réels** (aucune invention). Insight lecture seule, Phase 2.
- **Migration `0003_briefings.sql`** : table `briefings` (une ligne par org, `content` texte + `stats` jsonb + `created_at`), RLS `select` via `is_member`, écriture service-role seulement. **À exécuter dans Supabase (Fathi).**
- **Stats pures** dans `lib/analysis-rules.ts` : `computeFunnelStats` + `FunnelStats`/`BriefingProspect` — réutilise `prospectPriority` (source unique « prêt à relancer »). ⚠️ **Piège node:test reconfirmé** : un **import de valeur** relatif entre `.ts` (`./analysis-rules`) casse le type-stripping (`ERR_MODULE_NOT_FOUND`), alors qu'un `import type` passe (effacé). D'où : stats mises **dans** analysis-rules (avec prospectPriority), et `templateBriefing` gardé dans `lib/briefing-stats.ts` avec un simple `import type { FunnelStats }`.
- **`lib/briefing.ts`** (orchestration) : `refreshBriefing(admin, orgId, actorId)` lit prospects → `computeFunnelStats` → habillage LLM tâche `weekly_report` (`withLlmTrace`, repli `templateBriefing`) → **upsert** `briefings` (une par org). **Ne lève pas** (un briefing raté ne casse pas l'analyse).
- **Hook** : `runAnalysis` appelle `refreshBriefing` **avant** le early-return findings → le briefing se rafraîchit à chaque analyse (manuelle ou cron), même sans proposition.
- **UI** : bandeau dégradé tint→blanc sur `app/(cockpit)/page.tsx` (lecture `briefings` via client user/RLS), date de mise à jour, mention « à partir de vos données réelles ».
- **Tests** : `tests/briefing-stats.test.mjs` (4 : stats prioritaires/sans-email/sans-statut/top statut + base vide + repli sans invention). **35/35**.
- **Vérif** : `tsc` ciblé **exit 0 en 12,6 s** ; `npm test` **35/35**.
- **Reste (démo)** : lever 3 = autonomie visible (animation d'analyse). Côté Fathi : **exécuter la migration 0003 dans Supabase**, `git push`, `npm run build`, puis lancer une analyse → voir le bandeau se remplir.

### 2026-07-22 — Claude (Cowork) — waouh démo, lever 1 : brouillons prêts à envoyer
- **Objectif** (démo à l'associé) : sur les propositions de relance, l'agent joint le **message déjà rédigé** (objet + corps, placeholder `{prénom}`), personnalisé depuis la mémoire entreprise + le statut visé. **Reste Phase 2 : l'agent prépare, il n'envoie rien.** Frontière nette avec la Phase 3 (envoi réel).
- **`lib/draft-template.ts`** (pur, **sans import `@/`**, testable node:test) : `isRelanceKind`, `memoText`, `templateRelance` (gabarit de repli déterministe), `parseDraft` (découpe « Objet: …\n\n corps »). ⚠️ **Piège reconfirmé** : un `.ts` importé par un test ne doit **pas** contenir d'import alias `@/…` (node ne résout pas l'alias → `ERR_MODULE_NOT_FOUND`). D'où la séparation pur/orchestration (même schéma que `analysis-rules.ts` vs `analysis.ts`).
- **`lib/draft.ts`** (orchestration) : `draftRelance({ orgId, actorId, ctx, stage })` → tâche LLM `draft_email` (déjà dans `LLM_TASKS`), `withLlmTrace` (groupé par org), **repli silencieux** sur `templateRelance` sans clé/erreur/format inattendu. Réexporte `isRelanceKind`/`Draft`.
- **`app/(cockpit)/actions.ts`** : `draftForAction(id, regenerate?)` → **valeur de retour** (`DraftResult`), appelée directement depuis le tiroir. Vérifie `canEdit` + kind relance, **idempotent** (réutilise `payload.draft` sauf `regenerate`), stocke dans `actions.payload.draft` (**jsonb existant, aucune migration**), journalise `draft_prepared` (acteur agent). Libellé ajouté à `lib/journal.ts`.
- **UI** (`_components/validation-queue.tsx`) : section « Message prêt à envoyer » dans le tiroir, **auto-génération à l'ouverture** pour les kinds relance (`relaunch_priority`, `relaunch_stage_*`), boutons **Copier** / **Régénérer**, mention « préparé par l'agent — rien n'est envoyé ». `QueueAction` gagne `kind` (ajouté au `select` de `page.tsx`). Prédicat `isRelance` **inliné** côté client (éviter de bundler `ai`/`@/` via lib/draft).
- **Décision** : brouillon généré **à l'ouverture du tiroir** (pas à l'analyse) — plus rapide en démo, moins coûteux, pas de brouillon périmé ; caché ensuite dans `payload.draft`.
- **Tests** : `tests/draft.test.mjs` (3, parties pures : `isRelanceKind`, `templateRelance` avec/sans statut+activité). **31/31**.
- **Vérif** : `tsc` ciblé **exit 0 en 19,6 s** ; `npm test` **31/31**. `next build` côté Fathi.
- **Reste (démo)** : lever 2 = briefing en langage naturel (à venir) ; lever 3 = autonomie visible (animation). Côté Fathi : `git push` + `npm run build`, puis ouvrir une proposition de relance dans « Aujourd'hui » → voir le message se rédiger, Copier/Régénérer.

### 2026-07-22 — Claude (Cowork) — traces Langfuse enrichies par org (multi-tenant)
- **Objectif** (optionnel §2 acté au tour précédent) : grouper les traces LLM par organisation dans Langfuse, pour préparer le multi-tenant.
- **API réelle vérifiée** (pas devinée) : les paquets installés sont `@langfuse/core`, `@langfuse/otel`, `@langfuse/vercel-ai-sdk` (**pas** `@langfuse/tracing`). `@langfuse/core` exporte **`propagateAttributes(params, fn)`** avec `params: { userId?, sessionId?, metadata?: Record<string,string> }` — rattache des attributs de trace à tous les spans créés dans `fn`.
- **`lib/observability.ts`** : nouveau helper **`withLlmTrace({ orgId, userId?, task? }, fn)`**. Charge `propagateAttributes` par **import dynamique** (spécificateur en variable → build vert sans le paquet), **no-op** si clés Langfuse ou paquet absents. Mappe `sessionId = orgId` (regroupement par client), `userId` (coût/perf par utilisateur), `metadata.org_id` + `metadata.task` (filtres).
- **`lib/analysis.ts`** : la boucle d'habillage LLM (`recommend_action`) est enveloppée dans `withLlmTrace({ orgId, userId: actorId, task: "recommend_action" }, …)`. La lecture mémoire (DB) reste hors trace. `telemetry`/`functionId` inchangés.
- **Décision** : voie `propagateAttributes` (sessionId=org) plutôt qu'un span racine manuel (`startActiveObservation`) — plus léger, suffit à porter les attributs de trace sur les spans de l'AI SDK. `userId` reste vide tant que `actorId` est null (cron auto) — normal.
- **Vérif** : `tsc` ciblé **exit 0 en 22,7 s** (paquet présent ; import dynamique donc non résolu au build de toute façon). `npm test` **28/28**. `next build` côté Fathi.
- **Reste à Fathi** : après activation des clés + une analyse, vérifier dans Langfuse que la trace `recommend_action` porte bien `sessionId` = l'org (et `userId` si déclenchée par un utilisateur). Confirmer en passant que le mojibake d'accents reste limité à l'export CSV (pas l'UI).

### 2026-07-22 — Claude (Cowork) — écran de correspondance de colonnes (backlog acté)
- **Objectif** : lever la rigidité de la détection auto avant le multi-client (cf. DECISIONS 2026-07). Le client relie ses colonnes/propriétés aux 4 champs Nepteo (`name`, `email`, `company`, `stage`). **Lecture seule / Phase 2**, schéma `prospects` interne inchangé, `raw` conserve tout l'original.
- **Backend** (`feat` 1er commit) :
  - `lib/connectors/common.ts` : type `FieldMapping` (`Partial<Record<ProspectField, string|null>>`) + `PROSPECT_FIELDS`. `null` = « champ absent de ma base » (choix explicite), **absence de mapping = détection auto** (défaut).
  - Sheets (`google-sheets.ts`) : `readSheet` (extraction méta+valeurs), `listSheetColumns` (UI), `autoDetectSheetMapping(headers)` (regex d'origine, renvoie des **noms** d'en-tête), `fetchSheetProspects(token, id, mapping?)` — résout par nom d'en-tête, repli auto.
  - Notion (`notion.ts`) : `listNotionProperties` (GET `/databases/{id}` → clé+type), `autoDetectNotionMapping(props)` (type+regex d'origine), `readProp` (valeur selon type), `fetchNotionProspects(token, db, mapping?)` — schéma dérivé de la 1ʳᵉ page, repli auto.
  - `sync.ts` : lit `config.field_mapping` et le passe aux `fetch*`. Idempotence/journal inchangés.
  - Tests : `tests/connectors-mapping.test.mjs` (11 nouveaux, `global.fetch` mocké) — parité auto-détection (non-régression) + mapping explicite sur en-têtes/propriétés exotiques (« Structure », « Pipeline »). **28/28**.
- **UI** (`feat` 2e commit) :
  - `app/(cockpit)/connecteurs/[provider]/_components/column-mapping.tsx` : 4 `<select>` (Nom/Email/Entreprise/Statut), option « — (aucune) » → `null`, valeurs pré-remplies = mapping enregistré **ou** détection auto (le client voit ce que Nepteo a deviné et corrige). Champ caché `provider`.
  - `page.tsx` : bloc « Correspondance des colonnes » entre Configuration et Synchronisation, visible seulement si source configurée. Charge les colonnes via token frais (Sheets) / `listNotionProperties` (Notion, déchiffrement admin serveur).
  - Action `saveFieldMapping` (`actions.ts`) : construit le mapping (chaîne vide → `null`), passe par `saveConfig` (journal `connector_configured`, redirect `?saved=1`).
- **Décisions** : (1) mapping explicite **prime toujours**, l'auto n'est que défaut/pré-remplissage ; (2) écran dans la config connecteur seulement, **pas** encore dans l'onboarding (cohérent « backlog Phase 2/onboarding ») ; (3) parité stricte de l'auto-détection préservée — une propriété Notion `select` nommée « Pipeline » n'est **pas** auto-détectée (clé hors regex) → c'est justement le cas que le mapping explicite couvre.
- **Vérif** : `npm test` **28/28 exit 0** (Node 22.22). `tsc` ciblé (lib+app+components, hors `.next`, `tsconfig.check.json` temporaire supprimé après) **terminé exit 0 en 37 s** (⚠️ 1ʳᵉ tentative coupée à 44 s = faux vide ; relance après `pkill node` = vrai vert). `next build` + parcours réel **côté Fathi (Windows)**.
- **Reste à Fathi** : `npm run build` (Windows) ; dérouler dans l'app : connecter Sheets/Notion → bloc « Correspondance des colonnes » → vérifier pré-remplissage auto, changer un champ, Enregistrer, resynchroniser, contrôler que les prospects reflètent le mapping. Tester un cas d'en-tête exotique (colonne « Structure » reliée à Entreprise).

### 2026-07-22 — Claude (Cowork) — Langfuse validé en réel
- **Trace reçue par Fathi** : `invoke_agent gpt-5.4` → span `step 1` → generation `chat gpt-5.4`, avec `gen_ai.agent.name = recommend_action` (le `functionId` remonte bien), usage 75/48 tokens, coût capturé. **L'intégration v7 fonctionne.**
- **Suites (même jour)** : (1) **résolu** — Node **22.23.1**, port dev **figé à 3001** (`next dev -p 3001`), paquets Langfuse ajoutés à `package.json` (commit `chore`) ; (2) `traceName`/`userId`/`sessionId` vides — normal sans `propagateAttributes`/`observe` ; à enrichir plus tard pour le multi-tenant (grouper par org/client) ; (3) le modèle est encore **`openai:gpt-5.4`** (overrides `LLM_MODEL*` actifs) malgré la clé Anthropic présente — retirer les 3 lignes `LLM_MODEL*` pour repasser sur Claude ; (4) mojibake d'accents dans l'export CSV Langfuse = double-encodage à l'export/observabilité, pas un bug applicatif (le modèle a répondu avec de vrais accents) — à confirmer dans l'UI Langfuse.

### 2026-07-21 — Claude (Cowork) — Langfuse remis à jour pour l'AI SDK 7
- **Vérifié dans la doc Langfuse + les types de `ai@7.0.31`** : v7 est passé à une télémétrie **par intégrations** (`registerTelemetry(...)`, exporté par `ai`), et `experimental_telemetry` est **`@deprecated` → utiliser `telemetry`** (même forme `{ isEnabled, functionId }`, `TelemetryOptions`). L'ancienne voie `@vercel/otel` + `LangfuseExporter` (`langfuse-vercel`) ne capte plus les spans v7 — soupçon du SUIVI confirmé.
- **`lib/observability.ts` réécrit** : `new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] }).start()` (`@langfuse/otel`) puis `registerTelemetry(new LangfuseVercelAiSdkIntegration())` (`@langfuse/vercel-ai-sdk`). Imports **dynamiques** (spécificateur en variable) → build vert **sans** les paquets ; no-op sans clés. `instrumentation.ts` inchangé (délègue à `registerObservability`).
- **Appels migrés** `experimental_telemetry` → `telemetry` : `lib/analysis.ts` (`recommend_action`) et `app/api/llm/status/route.ts` (ping) ; doc de `telemetryForTask` mise à jour.
- **Env** : dans le nouveau SDK la base URL est **`LANGFUSE_BASE_URL`** (underscore), pas `LANGFUSE_BASEURL`. `TESTS.md §4` corrigé (paquets, env, branchement, validation `LANGFUSE_LOG_LEVEL=DEBUG`).
- **Activation par Fathi** : `npm i @langfuse/otel @langfuse/vercel-ai-sdk @opentelemetry/sdk-node` (Node ≥ 22) + clés `LANGFUSE_*` → une analyse (§3.2) doit produire une trace `recommend_action` dans Langfuse.
- **Vérif** : `tsc` ciblé **exit 0 sans les paquets Langfuse installés** (imports dynamiques). `npm test` inchangé (**17/17**). `next build` côté Fathi (Windows).
- **Reste** : Fathi — `npm i` Langfuse + clés + confirmer les spans ; parcours §3 dans l'app.

### 2026-07-21 — Claude (Cowork) — Notion connecté + dédup affichage + décision mapping
- **Notion réel connecté par Fathi** : 24 prospects lus, base « prospects-test.csv », noms/emails/entreprises corrects. Le connecteur (OAuth Basic auth, state cookie, mapping par type + regex FR/EN) a tenu **sans aucun correctif**. Guide pas-à-pas fourni (types de propriétés Email/Select, redirect URI `:3001`, partage de la base à l'OAuth).
- **Dédup à l'affichage** (`lib/dedupe-prospects.ts`, pur, **lecture seule**) : regroupe par email normalisé (casse/espaces), complète les champs vides depuis les doublons, **garde les lignes sans email** (non dédupliquables), ne mute jamais l'entrée. Branché dans `prospects/page.tsx` **avant** le regroupement (funnel/kanban/priorité comptent des personnes uniques) + compteur « N doublons d'email masqués ». **Pourquoi** : deux connecteurs sur la même base = lignes en double (upsert `connector_id+external_id`). La **fusion réelle** reste une proposition de l'agent (`dedupe_emails`) → exécution Phase 3. Tests : +4 (**17/17**).
- **Décision actée — correspondance de colonnes configurable** (`docs/DECISIONS.md`) : au-delà de la détection auto (mots-clés d'en-tête Sheets, type + mots-clés de propriété Notion), un écran de mapping laissera chaque client relier ses colonnes aux champs Nepteo. Rappel clarifié pour Fathi : le SQL `0002_prospects.sql` crée le schéma **interne** de Nepteo (une fois, jamais côté client) ; les clients gardent leurs propres intitulés, tout l'original est conservé dans `raw`. Backlog Phase 2/onboarding.
- **Vérif** : `npm test` **17/17, exit 0** ; `tsc` ciblé (lib+app+components, hors `.next`) **exit 0**. `next build` + `tsc` complet côté Fathi (Windows).
- **Reste** : Langfuse (objectif 2) ; parcours §3 dans l'app côté Fathi.

### 2026-07-21 — Claude (Cowork) — priorisation des prospects (Phase 2)
- **Signal de priorité transparent** (`lib/analysis-rules.ts`) : `prospectPriority` + `isTerminalStage`, dérivés UNIQUEMENT du **statut + complétude** (email, entreprise). Trois tiers : `priority` (À relancer en priorité = joignable ET statut actif), `incomplete` (email ou statut manquant), `paused` (statut terminal : client/gagné/perdu/désabonné…, détecté sans accents ni casse). **Aucun score inventé** (ni activité ni engagement — indisponibles). Fonction définie dans analysis-rules.ts pour une **source unique** partagée avec le kanban.
- **Proposition « relancer en priorité »** (règle 2 bis, `kind: relaunch_priority`) : joignables + statut actif, seuil ≥ 2, confiance 0,75, risque faible. Distincte de la règle 2 (« plus gros groupe ») : shortlist transversale des contacts prêts. Propose, **n'exécute rien** (Phase 2). CSV de test → 15/24.
- **Kanban** (`prospects/_components/prospects-board.tsx`) : badge de priorité par carte (survol = raison en clair), résumé par tier en tête du funnel, tri « prioritaires d'abord » dans chaque colonne, légende de transparence. Tokens maquette (violet/ambre/neutre) ; **pas** de « Score NN » (la maquette en montre mais suppose de l'engagement qu'on n'a pas). `page.tsx` inchangé (server component).
- **Tests** : `analysis-rules.test.mjs` passe de « exactement 2 » à **3 propositions** (+ assertions `relaunch_priority` 15/24) et gagne 5 tests unitaires `prospectPriority`/`isTerminalStage`. `TESTS.md §3` mis à jour (3 propositions + repère kanban + boucle Reporter/Reprendre).
- **Décision produit (Fathi)** : « relancer en priorité » = **nouvelle proposition + signal kanban** (→ 3 propositions au test), plutôt que fondre dans la règle 2 ou rester en affichage seul. Redondance possible règle 2 / `relaunch_priority` sur petite base : acceptée, à réévaluer si bruit.
- **Vérif** : `npm test` **13/13, exit 0** (Node 22.22). `tsc` : le programme complet (avec `.next/types` générés) dépasse le plafond **45 s** du sandbox → **check ciblé** (config stricte réelle, `lib`+`app`+`components`, hors `.next`) **terminé exit 0 en 25 s** ; `tsc` complet + `next build` restent **côté Fathi (Windows)**. eslint > 45 s dans le sandbox → revue de diff manuelle (aucun import/variable inutilisé). ⚠️ **Sandbox Cowork** : chaque appel bash = sandbox neuf (jobs bg non conservés → inutile de lancer `tsc` en arrière-plan) ; `rm` bloqué sauf permission Cowork (a laissé un `.git/index.lock` traînant, nettoyé après autorisation).
- **Reste** : Fathi — OAuth Notion réel (§2), parcours §3 dans l'app (voir les 3 propositions + badges), Langfuse (`npm i @vercel/otel langfuse-vercel` + clés + valider les spans `ai@7`), `npm run build`.

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
- **Copie / convention** : sous-titre Prospects allégé (suppression de la définition « un prospect est… ») suite retour Fathi. Ligne Design de **CLAUDE.md corrigée** : ne plus définir le lexique marketing standard (alignée sur la « Règle vocabulaire »).
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
