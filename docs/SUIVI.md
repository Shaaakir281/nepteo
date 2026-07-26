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

Environnement : Supabase `hrqnzorapjnosjphftur`, repo GitHub `Shaaakir281/nepteo` (branche `main`), dev local **port 3001 figé dans le script** (`next dev -p 3001`), **Node 22.23.1 local ✓**. Infra Azure provisionnée le 2026-07-26 dans `francecentral` : resource group `nepteo-prod-rg`, ACR `nepteoacr27de3b`, Container App `nepteo-prod`. GitHub `production` + OIDC créés ; premier déploiement applicatif encore à lancer.

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
- **Recherche web (OpenAI ou Perplexity)** : appel **facturé**. Toujours passer par `runResearch` (garde-fous + journal + cache) — ne jamais appeler `askPerplexity` / `askOpenAiSearch` / `askResearch` directement depuis une action. Les échecs sont mis en cache **volontairement** (une clé invalide ne doit pas boucler).
- **Chez OpenAI, une requête ≠ une recherche facturée** : le modèle peut enchaîner plusieurs `web_search_call` dans un même appel, à ~1 centime pièce. `MAX_RESEARCH_PER_DAY` compte des appels `runResearch`, **pas** des recherches. Deux conséquences : `reasoning.effort` reste à `"low"` dans `lib/research/openai-search.ts` (ne pas monter sans revoir les plafonds), et le nombre réel est écrit au journal (`searches`). Ne pas « simplifier » l'un ou l'autre.
- **Deux parseurs de recherche, volontairement séparés** : `parseResearchResponse` (Perplexity) et `parseOpenAiSearchResponse` (OpenAI). Les deux formes se ressemblent assez (`output[]`, `type: "message"`, `content[].text`) pour qu'un parseur « unifié » extraie le texte OpenAI **mais perde ses sources**, silencieusement. Un test garde cette étanchéité — ne pas les fusionner.
- **`researchConfigured()` vit dans `lib/research/provider.ts`**, pas dans `perplexity.ts` (déménagé le 26/07, sans ré-export : deux chemins pour la même question = dette).
- **Fichiers purs testés par node:test** : aucun import, même relatif, y compris vers `lib/memory.ts`. Quand une logique pure a besoin de constantes d'ailleurs (options de mémoire), on les **injecte en paramètre** (cf. `profile-rules.ts`).
- **`headCacheNode in null` après une déconnexion** : le cache du routeur client gardait l'arbre du cockpit ; la requête RSC suivante était redirigée vers `/login` par `proxy.ts` et l'arbre devenait nul. Corrigé par `revalidatePath("/", "layout")` **avant** le `redirect` dans `login` et `logout` (`app/(auth)/actions.ts`). Toute action qui change de session doit purger le cache.
- **Vérif tsc dans le sandbox Cowork** : le sandbox tue les process longs (~44 s) et laisse un log **vide** → « log vide » ≠ « vert ». Ne conclure au vert que sur un `tsc` **terminé** (exit 0 explicite) ; au besoin `pkill node` puis relancer sur sandbox non contendu. `next build` non exécutable (SWC win32 only) → build côté Fathi. `npm test` requiert **Node ≥ 22**. Mesure du 25/07 (C1) : `tsc --noEmit` complet passe en **~42 s** → lancer avec `timeout 43`, pas 40 ; `eslint` et `git status`, eux, **ne bouclent pas** sur le montage Windows.
- **`.git/index.lock` qui reste après un `git status` dans le sandbox Cowork** : ce n'est **pas** un agent tué (hypothèse de C6, infirmée le 26/07). Le sandbox ne peut pas supprimer un fichier sur le montage Windows tant que la suppression n'est pas autorisée côté Cowork ; `git` crée le lock, échoue à l'effacer, et tout commit ultérieur est bloqué. Remède : autoriser la suppression pour le dossier, puis `rm -f .git/index.lock`.
- **Mode démonstration et vraie fiche entreprise** : charger un scénario **écrase** `company_memory` + `organizations.name`/`activity`. La fiche d'origine est mise à l'abri dans la section réservée **`__demo_backup`** (voir `lib/demo/memory-backup.ts`) et rendue au retrait. `readMemory` masque les sections préfixées `__` : ne pas contourner ce filtre, et ne pas ajouter `__demo_backup` à `MEMORY_SECTIONS` — ce n'est pas une section de produit.
- **Libellés de journal d'événements disparus** (`lib/journal.ts`) : quand un geste est retiré du produit, **garder son libellé**. La table `journal` refuse UPDATE/DELETE (trigger volontaire) — les entrées passées existent toujours et doivent rester lisibles. Cas vécu : `ads_demo_loaded` / `revenue_demo_loaded` conservés après C1.
- **Fichiers purs vs I/O** : `lib/memory.ts` est pur (zéro import) ; la lecture Supabase de la mémoire vit à côté, dans **`lib/memory-store.ts`** (`readMemory(client, sections?, orgId?)`). Ne pas les refusionner.
- **Coût de la recherche web OpenAI** : le prix affiché (10 $ / 1 000 appels d'outil) n'est **que la moitié de la facture** — les *search content tokens* sont facturés au tarif du modèle et dominent le total (~0,06 $ par recherche avec `gpt-5.5`). Toujours chiffrer les deux parts, et se rappeler que `MAX_RESEARCH_PER_DAY` compte des appels `runResearch`, **pas** des `web_search_call`.

## Historique des sessions

### 2026-07-26 (12) — Codex — **Azure provisionné et GitHub Actions relié par OIDC**

**Cible confirmée** : compte `fathimetalsi@gmail.com`, tenant `10dc421f-ab69-471c-8d9c-9e52a35e60b9`, souscription `Abonnement 1` (`22045923-e995-4df0-8001-27de3b66290f`). L’ancien abonnement `Cabinet-DrAbdelkader-Prod` reste mémorisé dans la CLI mais n’est plus la cible par défaut et n’a reçu aucune modification.

**GitHub** : environnement `production` créé sur `Shaaakir281/nepteo`, approbateur requis `Shaaakir281`, branche autorisée `main`. Les variables d’infrastructure et applicatives ont été ajoutées ; les secrets Azure/Supabase/OpenAI/OAuth/Langfuse présents dans `.env.local` ont été importés sans affichage. Modèles fixés à `openai:gpt-5.4`, recherche fixée à `openai`.

**Azure** : après un `what-if` limité à six créations, Bicep déployé avec succès dans `nepteo-prod-rg` / `francecentral` : ACR Basic `nepteoacr27de3b` (admin désactivé), identité managée dédiée + `AcrPull`, Log Analytics, Container Apps Environment et Container App `nepteo-prod`. URL bootstrap : `https://nepteo-prod.bravedune-81efb6a5.francecentral.azurecontainerapps.io`.

**OIDC** : App Registration `github-nepteo-production`, client ID `39de0077-29f0-450f-8855-40e714f71d67`, aucun mot de passe. Federated Credential limitée à `repo:Shaaakir281/nepteo:environment:production`. Rôles : `Container Apps Contributor` sur le resource group et `Container Registry Tasks Contributor` sur l’ACR.

**Correctif avant publication** : la vérification de région du workflow normalise désormais `France Central` et `francecentral`, car les deux CLI Azure ne rendent pas la même forme.

**Reste** : publier la branche de préparation, fusionner après revue, lancer manuellement le workflow avec l’ID de souscription confirmé, approuver `production`, régler Supabase Site URL + redirect URL sur le FQDN final, puis dérouler le smoke test complet. Le cron reste désactivé.

### 2026-07-26 (11) — Claude (Cowork) — **B1 « La démonstration ne doit jamais détruire la vraie fiche »** (hors roadmap, docs/projets/demo-isolation.md)

**Défaut corrigé, relevé à l'usage par Fathi** : `loadDemoScenario` écrasait `company_memory` (les 8 sections) **et** `organizations.name` / `activity` avec l'identité du scénario, tandis que `clearDemoData` ne restaurait rien — son commentaire disait « sans toucher à la mémoire ». Qui essayait une entreprise fictive **perdait sa fiche entreprise définitivement**. Ordre de mission écrit avant de coder : `docs/projets/demo-isolation.md`. Aucune migration, aucune dépendance, aucune table, aucune variable d'env.

**1. Sauvegarde / restauration.** Section réservée **`__demo_backup`** dans `company_memory` — convention de stockage, **pas** une section de produit : `MEMORY_SECTIONS` et `lib/memory.ts` sont **intacts** (interdit respecté), et `company_memory.section` est un `text` sans contrainte de check (confirmé migration 0001), donc **aucune migration**. `backupMemoryOnce` copie les sections réelles + les deux champs d'onboarding **avant** le premier `seedMemory` ; `restoreMemory` réécrit les sections d'origine, supprime celles que le scénario a ajoutées, rend nom et activité, puis retire la sauvegarde.

**2. Enchaîner les scénarios ne casse rien** : la sauvegarde n'est écrite **que si aucune n'existe**. A → B → retirer ⇒ fiche d'origine, jamais A. Un test pur garde la moitié « relecture » de cette propriété.

**3. Doublons de connecteur `demo`** : `demoConnectorIds` remplace les deux `.maybeSingle()`, traite **tous** les connecteurs du provider (prospects de chacun supprimés), n'en garde qu'un (le plus ancien) et nettoie les autres. **Honnêteté sur ce point** : `connectors` porte `unique (organization_id, provider)` (0001, l. 47) — le doublon est **impossible en base aujourd'hui**, ce défaut était donc théorique et le nettoyage est un no-op. Corrigé quand même : `.maybeSingle()` sur une recherche non unique par nature est un piège qui ne se voit pas si la contrainte saute un jour.

**4. Plus de suppression muette** : `ensureOk(error, quoi)` sur les 3 `delete` de `resetCockpitState`, les prospects, `ad_metrics`, `revenue_events`, les connecteurs en double, et sur les écritures de `seedMemory` (une identité de scénario à moitié écrite après une sauvegarde réussie serait pire que pas de démo du tout). `clearDemoAction` écrit **`demo_scenario_clear_failed`** au journal (nouveau libellé dans `lib/journal.ts` — la table refuse UPDATE/DELETE, un libellé se garde pour toujours) et revalide quand même, le retrait ayant pu aboutir en partie. Le panneau affiche un message **propre au retrait** : « des données de démonstration sont peut-être encore là, et votre fiche entreprise n'a pas été restaurée » — pas le « Réessayez » du chargement.

**5. Étanchéité de la sauvegarde — filtrée à la source.** `readMemory` (`lib/memory-store.ts`) écarte les sections réservées (préfixe `__`). C'est **un seul endroit** plutôt que trois écrans à surveiller. Vérifié sur les trois chemins du piège : `/entreprise` (`identity-panel.tsx` boucle sur `Object.entries(memCtx)` → n'aurait rien affiché, mais la sauvegarde entrait dans l'objet), `/` et `/plan` (`diagnosticInputFromMemory`, qui lit des clés nommées). Grep de contrôle sur `company_memory` : les autres lectures directes sont **toutes** filtrées par section (`readOffers`, `persist`) — aucune fuite. Qui a besoin de la sauvegarde la lit dans `lib/demo/memory-backup.ts`.

**6. Avertissement dans le panneau** (`demo-panel.tsx`) : une ligne avant les trois cartes — « Votre fiche entreprise sera remplacée le temps de la démonstration, puis restaurée quand vous retirerez les données. » **Phrase ajoutée, panneau non réorganisé** : C5 et C6 ne sont pas rouverts.

**Décisions de mise en œuvre**

1. **Nom et activité de l'organisation sont sauvegardés aussi**, dans le même objet de sauvegarde. `seedMemory` les écrase, et le critère d'acceptation parle d'une « fiche remplie, même minimale : les **2 champs d'onboarding** » — or ces deux champs *sont* `organizations.name` et `activity` (`app/onboarding/actions.ts`). Sans eux, « revenue à l'identique » aurait été faux : l'utilisateur serait resté « Menuiserie Duval ». Aucune table ni colonne en plus : c'est une clé de l'objet JSON déjà stocké.
2. **Sauvegarde bloquante, restauration bloquante.** Si la sauvegarde échoue, le chargement échoue (mieux vaut une démo qui ne démarre pas qu'une fiche perdue). Si la sauvegarde est illisible, la restauration **refuse** au lieu de restaurer à moitié — l'écran le dit, le journal le garde. La sauvegarde n'est supprimée qu'**en dernier** : tant qu'elle est là, un nouveau retrait peut réessayer.
3. **`lib/demo/seed.ts` a été scindé** : il atteignait **452 lignes** en cours de route (règle 16 : ~200). Trois fichiers désormais — `memory-backup-rules.ts` (**pur**, zéro import, testé), `memory-backup.ts` (I/O de la fiche, 140 l.), `db.ts` (24 l. : le type `Admin` et `ensureOk`, partagés — sans lui `seed.ts` et `memory-backup.ts` se seraient importés mutuellement). `seed.ts` retombe à **317 lignes**, toujours au-dessus du repère mais **en dessous de son état de départ élargi**, et chaque fichier a un seul rôle.
4. **Aucun nouvel événement de journal pour le succès** : `demo_scenario_cleared` porte simplement `payload: { restored }`. Un libellé de journal est irréversible, on n'en crée que pour ce qui manquait vraiment (l'échec).

**Écart de périmètre signalé (règle 2)** : `entreprise/_components/connectors-panel.tsx` est modifié d'**une ligne de commentaire** (`ensureDemoConnector` → `prepareDemoConnector`, la fonction ayant été renommée). Aucun changement de rendu.

**Tests** : +9 dans `tests/demo-memory-backup.test.mjs` — section réservée, sauvegarde (sections + 2 champs d'onboarding), la sauvegarde ne se sauvegarde pas elle-même, fiche vide (sauvegarde vide mais exploitable → les 8 sections du scénario partent au retrait), plan de restauration complet (réécritures + suppressions, la sauvegarde jamais dans les suppressions), **A puis B rend bien la fiche d'origine** après aller-retour jsonb, sauvegarde illisible refusée, sauvegarde partielle tolérée sans invention, pas de doublon dans les suppressions. **Total : 136 → 145.**

**Vérif** : `npm test` **145/145, exit 0 — deux fois** ; `npx tsc --noEmit` **complet, exit 0 explicite — trois fois** (dont une après le découpage). `npx eslint` **non concluant dans le sandbox** : deux passages tués à 42-43 s (`exit 124`), aucune sortie — même symptôme que la session C6, à passer côté Fathi avec le build.

**⚠️ Le mystère du `.git/index.lock` est résolu — ce n'était pas un agent tué.** La session C6 avait conclu à un `git` interrompu et Fathi avait décidé de ne pas y toucher. En réalité : **le sandbox Cowork ne peut pas supprimer de fichier sur le montage Windows tant que la suppression n'est pas autorisée** (`rm` → « Operation not permitted »). Or `git status` **crée** `index.lock` puis tente de l'effacer : il le crée, échoue à le retirer, et laisse un lock qui bloque tous les commits suivants. Le lock « inexpliqué » de C6 est très probablement celui-là. **Remède** : autoriser la suppression de fichiers pour le dossier côté Cowork, puis `rm -f .git/index.lock`. Fait cette session — le commit B1 est passé. À retenir pour les prochaines sessions : ce n'est pas un autre agent, c'est le montage.

**Constats hors périmètre (notés, PAS corrigés)** :
- **L'arbre porte du travail non commité d'une autre session** (Codex, entrée n°10 : `deploy.yml`, `infra/`, `scripts/`, `.env.example`, `README.md`, `docs/DEPLOIEMENT-AZURE.md`, plus des corrections ESLint dans `prospect-drafts.tsx`, `validation-queue.tsx`, `(cockpit)/actions.ts`, `coach-bubble.tsx`). Le commit B1 ne porte **que ses 11 fichiers** — `git add` nominatif, **jamais `git add -A`**. `docs/SUIVI.md` reste volontairement **hors du commit** : il contient déjà l'entrée Codex.
- Le repo n'était donc **pas propre avant de lancer** (§0 de la roadmap). Signalé, pas arbitré ici.
- `CLAUDE.md` § Structure ne mentionne toujours ni les onglets ni la nav à 5 (relevé par C4, C5, C6) — toujours hors périmètre.

**Reste (Fathi)** :
1. **Commiter `docs/SUIVI.md`** (il porte l'entrée Codex n°10 **et** celle-ci) et le reste du chantier Codex, une fois celui-ci revu.
2. **`git push`** — les commits locaux s'accumulent (dix à ce jour, plus B1).
3. `npm run lint` et `npm run build` en local (non concluants / impossibles dans le sandbox).
4. **Parcours d'acceptation, dans cet ordre** : remplir la fiche (au moins nom + activité, idéalement une ou deux sections) → charger le scénario A → vérifier que `/entreprise?onglet=identite` montre bien l'identité du scénario → charger le scénario B → **« Retirer les données de démonstration »** → la fiche d'origine doit être revenue **à l'identique**, nom de l'entreprise compris, et **pas** celle du scénario A.
5. **Vérifier qu'aucune ligne parasite n'apparaît** dans `/entreprise`, sur `/` et sur `/plan` (redirigé vers `/`) après un retrait — la section `__demo_backup` ne doit se voir nulle part. Elle est de toute façon supprimée au retrait ; le contrôle intéressant se fait **pendant** la démo, scénario chargé.
6. **Contrôle SQL facultatif** (Supabase) pendant un scénario chargé : `select section from company_memory where organization_id = '…'` doit montrer les 8 sections **plus** `__demo_backup` ; après retrait, ni l'un ni l'autre en trop.
7. **Si un retrait échoue**, l'écran le dit désormais et `/journal` porte « Retrait des données de démonstration échoué ».

### 2026-07-26 (10) — Codex — **Préparation du déploiement Azure avec verrou compte/tenant/souscription**

**Résultat** : le dépôt est prêt pour un premier déploiement manuel Docker → ACR → Azure Container Apps en région UE, sans aucune création ni modification Azure pendant cette session. Le seul compte visible dans la CLI locale a été explicitement déclaré incorrect par Fathi : il n’a pas été utilisé.

**Sécurité de cible** : `.github/workflows/deploy.yml` ne se déclenche plus automatiquement sur `main` pour le premier passage. Il exige `workflow_dispatch`, la saisie manuelle de l’ID de souscription et l’environnement GitHub `production`, puis compare l’ID saisi à `AZURE_SUBSCRIPTION_ID`. Après login OIDC, il revalide souscription, tenant et région, et toutes les commandes Azure reçoivent `--subscription`. `scripts/azure/verify-target.ps1` fournit le même contrôle en lecture seule côté poste.

**Infrastructure et runtime** : `infra/azure/main.bicep` crée ACR Basic sans compte admin, une identité managée dédiée + `AcrPull`, Log Analytics, un Container Apps Environment et la Container App (port 3000, HTTPS, scale-to-zero). Le workflow construit une image immuable taguée par SHA avec Node 22, place les secrets dans Container Apps, remplace les variables runtime, puis teste `/api/health`. Les variables requises/optionnelles (Supabase, LLM, recherche, OAuth, Langfuse et `LLM_TASK_*`) sont validées avant mutation ; les paires OAuth/Langfuse incomplètes, modèle sans clé fournisseur et clé de chiffrement invalide bloquent le job.

**Documentation** : `docs/DEPLOIEMENT-AZURE.md` décrit le choix explicite du compte, le `what-if` Bicep, OIDC GitHub, les rôles minimaux, toutes les variables/secrets, les URLs Supabase Auth/OAuth et le smoke test inscription → confirmation → onboarding → scénario démo → analyse → `GET /api/llm/status`. `.env.example` et `README.md` ont été alignés (Node ≥ 22).

**Blocage CI préexistant corrigé** : quatre erreurs ESLint `react-hooks/set-state-in-effect` dans les brouillons et la bulle coach, plus un import inutilisé. Les chargements initiaux passent désormais par les callbacks asynchrones ; les sections dépendant d’une action sont remontées avec `key={active.id}`. Aucun comportement métier ni envoi externe ajouté.

**Vérifications** : `npm test` **136/136**, `npm run lint` **exit 0**, `npm run typecheck` **exit 0**, `npm run build` **exit 0** ; Bicep compile ; workflow validé par `actionlint` ; syntaxe PowerShell et YAML valides ; `git diff --check` propre. Docker Desktop n’était pas démarré, donc l’image Docker n’a pas été construite localement ; le build Next.js standalone inclus dans l’image est vert.

**Reste (Fathi + Codex)** : connecter le bon compte Azure et confirmer à l’écran `compte + tenant + souscription` ; choisir les noms/région ; exécuter le `what-if`, puis seulement le provisioning ; créer l’identité OIDC et l’environnement GitHub `production` ; régler Supabase Site URL/redirect URL ; lancer le workflow manuel et dérouler le smoke test complet. Le cron reste optionnel.

### 2026-07-26 (9) — Claude (Cowork) — **Correctif C5 : le panneau démo disparaissait après chargement d'un scénario**

**Régression signalée par Fathi**, dans le périmètre C5 (session précédente). `entreprise/_components/connectors-panel.tsx` cachait le panneau démo dès qu'**un** `connectors.status = 'connected'` existait — or `ensureDemoConnector` (`lib/demo/seed.ts`) crée justement un connecteur `provider="demo"` **status `connected`** au premier scénario chargé. Résultat : le panneau se cachait lui-même juste après avoir servi, impossible de changer de scénario ou de retirer les données de démo sans quitter l'onglet Connecteurs — exactement le parcours que GUIDE-TEST.md demande de montrer à Charly.

**Correctif** : `DEMO_PROVIDER` (`lib/demo/seed.ts`, déjà une constante locale) **exporté** — un seul endroit qui connaît le nom du connecteur de démo. `hasConnected` dans `connectors-panel.tsx` exclut désormais ce provider : `r.status === "connected" && r.provider !== DEMO_PROVIDER`. Aucune chaîne `"demo"` réécrite en dur côté UI.

**Vérifié par lecture** (pas d'accès à une vraie base dans le sandbox) : `clearDemoData` ne supprime pas la ligne `connectors` du provider `demo` (seulement prospects/ad_metrics/revenue_events) — sans conséquence pour ce correctif, puisque `hasConnected` l'exclut de toute façon que le connecteur démo traîne ou non après un `clearDemoAction`. Le panneau reste donc visible dans les trois temps du parcours : après chargement d'un scénario, après changement de scénario, après retrait des données — tant qu'aucun **vrai** connecteur (Google Sheets, Notion…) n'est branché.

**Tests** : aucun changement de règle pure, `DEMO_PROVIDER` n'est référencé par aucun test. **Total inchangé : 136/136.**

**Vérif** : `npm test` **136/136, exit 0** ; `npx tsc --noEmit` **complet, exit 0 explicite — deux fois** (sandbox anormalement lent cette session : plusieurs passages à 40+ s avant de repasser sous les ~20-27 s habituels ; un `tsconfig` temporaire réduit à la fermeture transitive des fichiers touchés a servi de confiance intermédiaire pendant les tentatives, supprimé ensuite) ; `npm run lint` exit 0.

**Reste (Fathi)** : `git push` ; dérouler le parcours démo dans l'app (charger un scénario → le panneau « Pas d'outil à brancher ? » reste visible → en charger un autre → « Retirer les données de démonstration » → panneau toujours là) ; le reste des points « Reste (Fathi) » de la session C5 (§7) et C6 (§8) tiennent toujours.

### 2026-07-26 (8) — Claude (Cowork) — **C6 « La mémoire en trois blocs »** (roadmap-beta, phase B)

**But atteint** : les sept lignes de `entreprise/_components/identity-card.tsx` sont regroupées sous **trois intertitres** — **Ce que je vends** (Activité, Zone) · **Comment je parle** (Ton, Philosophie) · **Ce que je fais déjà** (Canaux actuels, Communication, Objectifs). **Un seul fichier touché.** Aucune migration, aucune dépendance, `lib/memory.ts` et `entreprise/actions.ts` **non touchés**.

**Invariant préservé — la sauvegarde reste PAR SECTION** : `MemGroup` est un simple `<section>` de présentation posé *autour* des `MemRow`. Chaque ligne garde son `<form action={save…}>` et son action serveur ; aucun formulaire n'a été fusionné ni imbriqué (un `<form>` dans un `<form>` aurait été exactement la faute à ne pas commettre). Une section vide ne peut donc toujours pas écraser l'existant — `applyIdentity` reste valide. Diff vérifié à `git diff -w` : hors les trois intertitres, seuls des **déplacements de blocs** apparaissent, aucun changement de props ni de champ.

**Décisions de mise en œuvre**

1. **`MemGroup` vit dans `identity-card.tsx`**, pas dans un fichier à part : le périmètre annoncé de la session était ce seul fichier (chantier parallélisable avec C5, qui travaillait dans le même arbre). Composant local de 20 lignes, sans état, utilisé une seule fois — s'il sert ailleurs un jour, il ira dans `_components/`.
2. **Seul « Canaux actuels » change de place** dans l'ordre du fichier (il passe après Philosophie, dans le 3e bloc). L'ordre interne de chaque bloc est celui d'avant, comme demandé.
3. **« Offres » n'est pas dans la carte.** La roadmap range « offres » dans « Ce que je vends », mais cette section est rendue par **`OffersCard`**, une carte distincte affichée juste en dessous par `identity-panel.tsx` — hors périmètre, donc **non déplacée**. Pour que le bloc ne mente pas, son sous-titre le dit : « Vos offres sont juste en dessous, dans leur propre carte. » Les huit sections de mémoire restent donc éditables individuellement : sept ici, `offres` dans sa carte.
4. **Style** : intertitre sur fond `bg-tint-soft` (token existant), `font-display`, sous-titre `text-muted` ; `border-t border-line-soft first:border-t-0` déplacé au niveau de la `<section>` — d'où des séparateurs qui tombent juste entre blocs comme entre lignes. Aucune couleur en dur.

**Tests** : **aucun changement** — présentation seule, aucune règle pure touchée. **Total inchangé : 136/136.**

**Vérif** : `npm test` **136/136, exit 0** ; `npx tsc --noEmit` **complet, exit 0 explicite — deux fois** (premier passage `124`, cache froid : conforme à la recette notée par C4). `npx eslint` sur le fichier : **non concluant dans le sandbox** — deux passages tués à 44 s (`exit 124`), aucune sortie. Non bloquant (le mandat demande test + tsc), mais à passer côté Fathi avec le build.

**Écart de périmètre signalé (règle 2)** : le fichier fait désormais **~290 lignes** (268 avant), au-dessus du repère « ~200 lignes » de la règle 16. Le découper supposait de créer des fichiers hors du périmètre annoncé pendant qu'un autre agent travaillait dans le même arbre — **pas fait**. Découpage naturel s'il faut y revenir : un fichier par bloc (`identity-sales.tsx`, `identity-voice.tsx`, `identity-doing.tsx`), `identity-card.tsx` ne gardant que la `Card` et les trois `MemGroup`.

**Constats hors périmètre (notés, PAS corrigés)** :
- **⚠️ C6 N'EST PAS COMMITÉ — `.git/index.lock` bloquait le dépôt.** Le lock (fichier vide, 16h58) était encore là 23 minutes plus tard, sans nouveau commit depuis C4 : très probablement un `git` de l'agent C5 tué en cours de route. **Décision de Fathi, prise en séance : ne pas y toucher** — supprimer le lock d'un autre agent risquait de corrompre son index. Le travail C6 est donc **dans l'arbre, non commité** (voir Reste (Fathi) n°1).
- **Session partagée avec l'agent C5** : `docs/SUIVI.md` et `docs/projets/roadmap-beta.md` contiennent déjà l'entrée C5 non commitée. Ces deux fichiers ne doivent **pas** entrer dans le commit C6 (ils y embarqueraient le chantier C5 — règle « un chantier = un commit »). Le commit C6 ne porte qu'un fichier : `app/(cockpit)/entreprise/_components/identity-card.tsx`.
- `CLAUDE.md` § Structure ne mentionne toujours ni les onglets ni la nav à 5 (relevé par C4 puis C5) — toujours pas fait, toujours hors périmètre.

**Reste (Fathi)** :
1. **Débloquer git puis commiter C6.** Une fois C5 terminé et le lock disparu (ou supprimé sciemment : `del .git\index.lock`) :
   `git add "app/(cockpit)/entreprise/_components/identity-card.tsx"` puis `git commit -m "C6: group company memory rows into three blocks"`. **Ne pas faire `git add -A`** — l'arbre contient aussi le chantier C5.
2. **Contrôle visuel** : `/entreprise?onglet=identite` → trois intertitres dans la carte « Identité & activité », sept lignes dans le bon bloc, « Vos offres » toujours en carte séparée dessous.
3. **Contrôle de l'invariant** : renseigner Philosophie, enregistrer, puis modifier **Ton** et enregistrer → la philosophie doit être intacte (et inversement).
4. `npm run lint` et `npm run build` en local (non concluants / impossibles dans le sandbox).
5. **Commiter les docs partagées** (`docs/SUIVI.md`, `docs/projets/roadmap-beta.md`) une fois le chantier C5 revu — elles portent les entrées des deux sessions.
6. **`git push`** — les commits locaux s'accumulent (huit à ce jour, plus C5 et C6 à venir).

### 2026-07-26 (7) — Claude (Cowork) — **C5 « L'autonomie en un réglage »** (roadmap-beta, phase B)

**But atteint** : l'onglet Agent tient désormais en **deux notions** — un curseur à trois crans (Propose seulement · Prépare · Envoie, ce dernier désactivé avec badge « Bientôt ») + le bouton d'arrêt. Les deux autres blocs qui y vivaient ont déménagé : « Mode démonstration » vers l'état vide de l'onglet Connecteurs, « Envois préparés » en tête de `/journal`. Aucune migration, aucune dépendance. `lib/execution-rules.ts`, `lib/execution.ts` et le modèle `autonomy_level` (`suggest|prepare` en base) **intacts**.

**1. Curseur à trois crans** (`agent/_components/autonomy-selector.tsx`) : les deux options actives reprennent exactement `setAutonomyLevel` — non modifié, toujours borné à `["suggest","prepare"]` côté serveur dans `agent/actions.ts`, non touché. Le troisième cran est un `<div aria-disabled>` sans `onClick`, purement visuel : il porte le texte de l'ancienne carte « Mode d'exécution » (« Enverra réellement les messages préparés… »), qui disparaît donc sans perdre l'information — exactement ce que demandait le chantier.

**2. Onglet Agent réduit** (`entreprise/_components/agent-panel.tsx`) : deux `Section` seulement (Niveau d'autonomie, Bouton d'arrêt). La note de plafonds (`MAX_PER_RUN`/`MAX_PER_DAY`, importés de `lib/execution-rules.ts` en lecture seule, comme avant) devient une ligne sous le curseur au lieu d'une carte à deux stats. Les requêtes `outbox_messages` et les imports `DemoPanel`/`DEMO_SCENARIOS` sont retirés — ce contenu vit ailleurs maintenant.

**3. Mode démonstration → Connecteurs** (`entreprise/_components/connectors-panel.tsx`) : nouvelle section conditionnelle `!hasConnected` (aucune ligne `connectors.status = 'connected'`), titrée « Pas d'outil à brancher ? » / « Essayez avec une entreprise fictive… », qui embarque le **même** `DemoPanel` (composant non modifié) juste après le bandeau d'info, avant le catalogue. Elle s'efface d'elle-même dès qu'un connecteur réel est branché.

**4. Envois préparés → Journal** (`journal/_components/prepared-outbox.tsx`, nouveau composant serveur, branché en tête de `journal/page.tsx` avant les filtres) : reprend telle quelle la requête et le rendu de l'ancienne section (mêmes badges de statut, même format de date) — aucune logique changée, seulement déplacée.

**5. Trois liens « Essayer avec une entreprise fictive »** pointaient vers `/entreprise?onglet=agent`, endroit où le mode démo n'est plus visible — corrigés vers `/entreprise?onglet=connecteurs` (`page.tsx` accueil, `campagnes/page.tsx` état vide, `validation-queue.tsx` état vide de la file). Repérés par grep systématique de `onglet=agent` sur tout le repo, pas seulement les fichiers évidents — ce sont exactement le genre de CTA qui casse silencieusement un déplacement de section.

**6. Bulle et guide** : bulle `agent` (`components/ui/coach-bubble.tsx`) ne mentionne plus le chargement d'un scénario (qui n'est plus sur cet onglet), mentionne le 3e cran à la place. `docs/demo/GUIDE-TEST.md` mis à jour : Mise en route §5 (pointe vers Connecteurs), section « Mon entreprise → Agent » (deux choses à essayer, pas trois, avec renvoi vers Journal pour les envois préparés), section « Mon entreprise → Identité » (mentionne que Connecteurs porte désormais aussi le mode démo).

**Écart signalé (règle 2)** : contrairement à d'autres chantiers, la roadmap ne listait pas explicitement les fichiers autorisés pour C5 — traité comme périmètre implicite tout fichier nécessaire pour que le déplacement soit cohérent de bout en bout (les 3 liens CTA, la bulle, le guide), plutôt que déplacer les blocs et laisser des renvois orphelins vers un onglet qui n'a plus l'info.

**Non touché, conformément aux interdits** : `lib/execution-rules.ts`, `lib/execution.ts`, `agent/actions.ts` (`LEVELS = ["suggest","prepare"]` intact), aucune migration. `DemoPanel` et `ExecutionSwitch` réutilisés sans dupliquer — un seul `ExecutionSwitch` (`_components/execution-switch.tsx`), importé à la fois par l'accueil et par l'onglet Agent, comme avant.

**Constat hors périmètre (noté, pas corrigé)** : `CLAUDE.md` § Structure décrit toujours `(cockpit) shell sidebar + pages / et /entreprise` sans mentionner les onglets ni la nav à 5 (relevé par C4). La note de C4 anticipait que « C5 le fera pour la partie autonomie » — mais le mandat de C5 ne mentionne pas `CLAUDE.md`, et sa section « Philosophie d'autonomie » (« Slider d'autonomie configurable par client ») reste juste telle quelle sans changement. Laissé pour un chantier qui touche légitimement `CLAUDE.md`.

**Tests** : aucun changement — aucune règle pure touchée par ce chantier. **Total inchangé : 136/136.**

**Vérif** : `npm test` **136/136, exit 0** ; `npx tsc --noEmit` **complet, exit 0 explicite — deux fois** ; `npm run lint` exit 0.

**⚠️ Trouvé en cours de session, pas de moi** : `entreprise/_components/identity-card.tsx` portait déjà, **non commité**, un début de C6 (regroupement en trois blocs — `MemGroup`, « Ce que je vends »…) au moment où j'ai lu l'arbre de travail. C6 est bien marqué « parallélisable avec C5 » (fichiers disjoints), donc pas d'interdit technique — mais §0 dit aussi « une seule session à la fois ». Je n'ai **pas touché** ce fichier (retiré de l'index avant mon commit avec `git restore --staged`, changement intact dans l'arbre) : si une autre session C6 est réellement en cours, mon commit C5 ne la gêne pas (fichiers disjoints, confirmé) ; sinon, ce brouillon attend simplement d'être repris ou commité.

**Reste (Fathi)** :
1. **`git push`** — huit commits locaux (docs session 5, C1, cadrage R1, C2, C3, R1, C4, C5).
2. `npm run build` (SWC Windows).
3. **Parcours de contrôle** : `/entreprise?onglet=agent` → curseur à 3 crans (le 3e grisé, non cliquable, badge « Bientôt ») + note de plafonds sous le curseur + bouton d'arrêt, rien d'autre. `/entreprise?onglet=connecteurs` sans connecteur branché → section « Pas d'outil à brancher ? » avec les 3 scénarios visibles ; brancher un connecteur → la section disparaît. `/journal` → « Envois préparés » en tête de page (visible même sans message, avec le texte d'état vide).
4. Vérifier que les 3 CTA « Essayer avec une entreprise fictive » (accueil, `/campagnes` vide, file de validation vide) ramènent bien sur l'onglet Connecteurs et non plus Agent.
5. Décision ouverte, non tranchée ici : rafraîchir `CLAUDE.md` § Structure pour qu'il mentionne les onglets et la nav à 5 (relevé par C4, toujours pas fait — hors périmètre listé de C5 malgré la note qui le suggérait).

### 2026-07-26 (6) — Claude (Cowork) — **C4 « Structure cible : nav à 5, un seul endroit pour les propositions »** (roadmap-beta, phase B)

**But atteint** : neuf entrées de navigation deviennent **cinq** (`Aujourd'hui · Prospects · Campagnes · Mon entreprise · Journal`), et l'agent ne parle plus que depuis Aujourd'hui. **Aucun moteur pur modifié** (`lib/plan.ts`, `lib/diagnostic.ts`, `analysis-rules.ts` intacts), **aucune route supprimée** — toutes redirigent. Aucune migration, aucune dépendance, aucune variable d'env.

**1. Recensement d'abord (étape 1 du chantier, avant toute modification)** — la liste complète, pour mémoire :
- **Nav** : `sidebar.tsx` (2 groupes, 9 entrées) + le texte de la carte « mode sûr » qui nommait « Agent & garde-fous ».
- **`href`** : `campagnes/page.tsx` → `/agent` ; `page.tsx` → `/agent` ; `prospects/page.tsx` → `/connecteurs` ; `starter-diagnostic.tsx` → `/connecteurs` ; `validation-queue.tsx` → `/agent` ; `connecteurs/[provider]/page.tsx` → `/connecteurs` (fil d'Ariane).
- **`ctaHref` (`lib/plan.ts`)** : `/campagnes` ×3, `/` ×2, `/contenu` ×1 — **toutes restent valides**, `/contenu` étant conservée. Rien à changer dans le moteur, et la liste blanche de `tests/plan.test.mjs` reste juste.
- **Redirects serveur** : `agent/actions.ts` (`redirect("/agent")`, `revalidatePath("/agent")`, et la liste `revalidateCockpit` qui citait `/agent` et `/plan`) ; `connecteurs/actions.ts` (`?error=`, `?saved=<provider>`) ; `connecteurs/[provider]/actions.ts` (4 × `redirect("/connecteurs")`) ; **4 route handlers OAuth** (`google_sheets` et `notion`, `authorize` + `callback`).
- **Bulles** : `today`, `prospects`, `campagnes`, `contenu`, `plan` (×2), `agent`, `entreprise`.
- **Guide** : `docs/demo/GUIDE-TEST.md` §Mise en route 4–5, §4, §5, §6, §7.

**2. « Mon entreprise » à trois onglets.** `entreprise/page.tsx` ne fait plus que l'authentification, l'en-tête et l'aiguillage ; les contenus vivent dans `entreprise/_components/{identity,connectors,agent}-panel.tsx` (composants **serveur asynchrones**, chacun fait ses propres lectures → un seul onglet interrogé à la fois) + `entreprise-tabs.tsx` (`resolveTab`, valeur inconnue ⇒ Identité). `AutonomySelector`, `DemoPanel` et `ConnectorCard` sont **importés depuis leur dossier d'origine**, pas déplacés : moins de churn, et `/connecteurs/<provider>` continue d'utiliser le même composant.

**3. Redirects.** `/plan` → `/` en **permanent** (`permanentRedirect`) : C2 a installé le diagnostic sur `/`, aucun écran n'est perdu. `/connecteurs` et `/agent` → onglet correspondant en **temporaire** (`redirect`) — un 308 mis en cache par les navigateurs rendrait un éventuel retour arrière pénible, et C4 est un amendement à valider avec Charly. `/connecteurs` **conserve ses `searchParams`** au passage (un retour OAuth en `?error=` ne doit pas se perdre).

**4. Aujourd'hui.** Nouveau `_components/plan-banner.tsx` (serveur asynchrone) : intro + budget de `buildMarketingPlan` + les **3 premiers mouvements condensés** avec leurs CTA. Rendu **seulement s'il y a des données** — sans données, le diagnostic de départ tient déjà le rôle et un plan chiffré serait creux (c'est exactement la branche qu'avait `/plan`).

**Décisions de mise en œuvre** :
- **Le bandeau de cap est placé APRÈS les KPIs, juste avant « À valider »** (la roadmap listait les blocs sans en figer l'ordre). Deux raisons : « Le point de l'agent » et le cap partagent le même dégradé, adjacents ils se confondaient ; et le cap gagne à précéder immédiatement la file qu'il alimente. Il porte une mention explicite « des conseils, pas des actions à valider : rien ne s'exécute d'ici » — c'est la distinction que le chantier demandait de ne pas perdre.
- **Un bouton « Idées de contenu » ajouté sur `/campagnes`** (en-tête, à côté de « Nouvelle campagne ») : la roadmap le prévoyait, et sans lui `/contenu` n'aurait plus qu'un seul point d'entrée.
- **Les actions serveur pointent directement sur `/entreprise?onglet=…`**, pas sur la redirection : un `redirect("/connecteurs?saved=notion")` aurait fait un aller-retour de plus pour rien.
- **La bulle `plan` est supprimée** (son écran n'existe plus) et un commentaire dans `coach-bubble.tsx` interdit de rouvrir une bulle sans écran. La bulle `entreprise` est réécrite pour les trois onglets ; la bulle `today` mentionne désormais la distinction cap / à valider. `agent` inchangée, réaffichée sur son onglet.

**Tests** : **aucun changement** — `tests/plan.test.mjs` vérifie que chaque `ctaHref` est dans `["/", "/campagnes", "/contenu"]`, et les trois routes existent toujours. **Total inchangé : 136.**

**Vérif** : `npm test` **136/136, exit 0** (deux fois) ; `npx tsc --noEmit` **complet, exit 0 explicite**, plus un passage `exit 0` sur un `tsconfig` réduit à `app/**` + `components/**` (fichier temporaire **supprimé**).

**Constat sur l'outillage (hors périmètre, mais il m'a coûté ~15 minutes — à retenir)** : **les processus lancés en arrière-plan (`nohup`, `&`) ne survivent PAS d'un appel bash à l'autre** — chaque appel a son propre espace de PID. Pire, `pgrep -f "tsc --noEmit"` **matche sa propre ligne de commande** et répond donc toujours « ça tourne ». Les deux combinés font croire à un `tsc` interminable alors qu'il était mort depuis le premier appel. **Recette qui marche** : lancer `tsc` **en premier plan** avec `timeout 41` dans un seul appel, et relancer si `EXIT=124` (le premier passage réchauffe le cache : 124 puis 0 chez moi). Pour surveiller un process, écrire un motif qui ne se matche pas lui-même (`'tsc[ ]--noEmi[t]'`) — sinon `pkill` **tue son propre shell** (exit 143, vécu). Rappel confirmé : `rm` est refusé sur le montage tant que la suppression n'est pas autorisée côté Cowork.

**Constats hors périmètre (notés, PAS corrigés)** :
- `docs/projets/simplification.md` et `docs/projets/onboarding-ia.md` citent encore l'ancienne arborescence (`/plan`, `/connecteurs`, `/agent` comme écrans). Documents historiques — pas réécrits.
- `CLAUDE.md` § Structure décrit `(cockpit) shell sidebar + pages / et /entreprise` : formulation restée juste par chance, mais elle ne mentionne ni les onglets ni la nav à 5. À rafraîchir lors d'un chantier qui touche légitimement `CLAUDE.md` (C5 le fera pour la partie autonomie).
- **C5 dépend de ce chantier et devient plus simple** : la carte « Mode d'exécution » et « Envois préparés » qu'il doit déplacer sont maintenant dans `entreprise/_components/agent-panel.tsx`, un seul fichier.

**Reste (Fathi)** :
1. **`git push`** — sept commits locaux (docs session 5, C1, cadrage R1, C2, C3, R1, C4).
2. `npm run build` (SWC Windows) — c'est le vrai filet pour un chantier de navigation.
3. **Parcours de contrôle des redirections**, à taper à la main dans la barre d'adresse : `/plan` → `/` ; `/contenu` → **s'ouvre normalement** (route vivante, juste retirée du menu) ; `/connecteurs` → onglet Connecteurs ; `/agent` → onglet Agent ; `/connecteurs/google_sheets` → fiche de l'outil, dont le « ← Tous les connecteurs » revient sur l'onglet.
4. **Parcours démo** : `/entreprise` → onglet Agent → charger un scénario → revenir sur `/` : le **bandeau « Cap du mois »** doit apparaître sous les KPIs, au-dessus de « À valider », avec 3 mouvements et leurs CTA. Base vide → pas de bandeau, le diagnostic de départ à la place.
5. **Le point à trancher avec Charly n'a pas disparu** : l'ADR est consigné comme **amendement à la maquette V2 décidé sans lui**. Le point 2 de l'ordre du jour de la démo reste entier — la nav est maintenant montrable en vrai plutôt que sur papier.
6. Vérifier qu'un « Connecter » sur un outil non ouvert revient bien sur l'onglet Connecteurs avec son bandeau de confirmation (`?onglet=connecteurs&saved=<provider>`).

### 2026-07-26 (5) — Claude (Cowork) — relecture de R1 : correction du chiffrage + `.env.example`

Passe de contrôle sur le commit `579fcfb` (R1), **sans toucher au code livré**.

**Vérifié et conforme** : 13 fichiers, tous dans la liste autorisée (§8 de l'ordre de mission) ; `package.json` **intact** (aucune dépendance) ; aucune migration ; les 4 points d'import de `researchConfigured` traités (3 déplacés vers `provider.ts`, plus `/api/llm/status` qui passe à la forme `{ provider, openai, perplexity }`). Le refus de repli silencieux quand `RESEARCH_PROVIDER` est explicite mais sans clé est le bon comportement.

**⚠️ Correction — le coût annoncé par R1 était sous-estimé d'environ 6×.** L'entrée précédente conclut « ~1 centime par recherche » en ne retenant que les 10 $/1 000 appels d'outil. La page tarifaire ajoute **« + Search content tokens billed at model rates »**, et c'est cette part qui domine. Avec `gpt-5.5` (**2,50 $/M en entrée, 15 $/M en sortie**), une recherche qui injecte ~15 k tokens de contexte web coûte en ordre de grandeur :

| Poste | Coût |
|---|---|
| Appel d'outil | 0,01 $ |
| Tokens de contenu web (~15 k en entrée) | ~0,04 $ |
| Tokens de sortie (~800) | ~0,01 $ |
| **Total par recherche** | **~0,06 $** |

Donc `MAX_RESEARCH_PER_DAY = 30` plafonne autour de **1,50–2 €/jour et par organisation** si `searches = 1` — pas 0,30 €. Et toujours ×10 si une requête enchaîne dix `web_search_call`. La conclusion de R1 reste juste (relever `searches` sur un appel réel est le geste décisif), seul l'ordre de grandeur change.

**Piste à tester : `gpt-5.5` est probablement un défaut trop cher.** La doc le désigne pour la recherche *agentique* et la deep research, mais la grille tarifaire dit « Web search (**all models**) » : l'outil n'impose pas ce modèle. Or ici l'agent **collecte des faits sourcés**, il ne rédige pas (c'est `LLM_TASKS` qui rédige). `gpt-5.4` est à moitié prix (1,25 $/7,50 $), `gpt-5.4-mini` à 0,375 $/2,25 $. `RESEARCH_OPENAI_MODEL` rend l'essai gratuit : même recherche sur les deux, comparer la qualité du texte et le **nombre de sources**. Contrainte : garder un modèle **raisonnant**, `reasoning.effort` étant figé à `"low"` dans `openai-search.ts` (sinon rejet API → `http_400` propre au journal).

**Fait** : `.env.example` documente enfin `RESEARCH_PROVIDER` et `RESEARCH_OPENAI_MODEL` (R1 les avait signalés sans les faire — à raison, le fichier était hors de sa liste autorisée), avec l'avertissement de coût ci-dessus. Le bloc Perplexity devient un bloc « Recherche web » à deux fournisseurs.

**Reste (Fathi)** : inchangé par rapport à R1 — `git push`, `npm run build`, et surtout **relever `searches` dans `research_succeeded`** après un vrai parcours d'onboarding. Ajouter à ce test : comparer `gpt-5.5` et `gpt-5.4` sur la même entreprise.

### 2026-07-26 (4) — Claude (Cowork) — **R1 « La recherche web sans compte Perplexity »** (docs/projets/recherche-web-openai.md)

**But atteint** : la recherche web fonctionne avec la clé OpenAI déjà en place. **Perplexity n'a pas bougé** — deux fournisseurs coexistent, `RESEARCH_PROVIDER` tranche. Aucune migration, aucune dépendance npm, aucune table.

**Doc OpenAI revérifiée le jour même** (pas de code de mémoire) :
- `web_search` sur la Responses API, **modèle recommandé pour cette intégration : `gpt-5.5`** (défaut en dur, surchargeable par `RESEARCH_OPENAI_MODEL`). `gpt-4o*-search-preview` confirmés **arrêtés depuis le 2026-07-23** ; `web_search_preview` legacy (ni `filters`, ni `return_token_budget`).
- **Tarification des outils intégrés : 10 $ / 1 000 appels d'outil** + les *search content tokens* facturés au tarif du modèle. Soit **~1 centime par recherche**, et le décompte se fait **par `web_search_call`, pas par requête**.
- `search_context_size` va **dans l'objet outil** ; `reasoning.effort` au niveau racine. `minimal` n'est pas supporté avec `web_search`.

**1. Parseur dédié** (`lib/research/research-rules.ts`, **additif seulement**) : `parseOpenAiSearchResponse` lit les items `message` (texte + annotations `url_citation`) puis les items `web_search_call` (`action.sources[]`, chaînes nues tolérées). **Les citations passent avant la liste exhaustive** : ce sont les sources qui portent la réponse, et `MAX_SOURCES` tronque le reste. `pushSource` et `MAX_ANSWER_CHARS` réutilisés. `parseResearchResponse` **non modifié**. Ajouts : `openaiSearchContext` (`company_profile` → `medium`, `prospect_company` → `low`) et `countWebSearchCalls`.

**2. Adaptateur** `lib/research/openai-search.ts` (nouveau) : `POST /v1/responses`, `fetch` natif, timeout 45 s, `cache: "no-store"`, ne lève jamais, **statut seul** en cas d'erreur HTTP, même vocabulaire de `reason` que Perplexity (`no_key`, `empty_query`, `empty_answer`, `timeout`, `network_error`). `include: ["web_search_call.action.sources"]`, `store: false`, `return_token_budget` laissé au défaut.

**3. Sélecteur** `lib/research/provider.ts` (nouveau) : `researchProvider()`, `researchConfigured()` (**déménagé** de `perplexity.ts`, **aucun ré-export de compatibilité**), `askResearch({ kind, query })`. Les **4 imports** ont été suivis : `lib/research/research.ts`, `app/onboarding/actions.ts`, `app/onboarding/identite/page.tsx`, `app/api/llm/status/route.ts` — grep de contrôle : plus aucun import de `researchConfigured` depuis `perplexity.ts`.

**4. Branchement** (`lib/research/research.ts`) : **une seule substitution** (`askPerplexity` → `askResearch`) + le fournisseur dans les payloads du journal. Ordre cache → garde-fous → journal AVANT → appel → upsert, plafonds, mise en cache des échecs : **inchangés**. Aucun nouvel événement de journal.

**5. Observabilité** : `GET /api/llm/status` → `research: { provider, openai, perplexity }` (présence des clés, jamais leur valeur ; `provider: null` = recherche désactivée).

**Décisions de mise en œuvre (les trois sont dans DECISIONS.md)** :
- **`reasoning: { effort: "low" }` en dur.** C'est LE garde-fou de coût. `search_context_size` borne le contexte injecté, **pas le nombre de recherches** : seul un effort bas empêche la recherche agentique d'enchaîner les `web_search_call`. Commentaire d'avertissement dans le fichier : ne pas monter cette valeur sans revoir les plafonds serveur.
- **Le nombre de recherches facturées finit au journal** (`searches` dans `research_succeeded`). Le chantier demandait de mesurer ce nombre ou de dire qu'il n'est pas maîtrisable. Réponse honnête : il est **bornable mais pas garanti** par l'API — donc on le **mesure en production** plutôt que de laisser `MAX_RESEARCH_PER_DAY` (qui compte des appels `runResearch`) faire croire à une protection budgétaire qu'il n'offre plus. **Le chiffre sur un appel réel reste à relever par Fathi** (voir « Reste »), le sandbox n'a pas de clé.
- **`RESEARCH_PROVIDER` explicite sans clé ⇒ `null`, pas de repli** sur l'autre fournisseur. Dépenser chez un fournisseur non choisi est pire qu'une recherche désactivée — et ça satisfait le critère « `RESEARCH_PROVIDER=perplexity` sans clé ⇒ `no_key`, aucun écran cassé ».

**Écarts au périmètre, signalés (règle 2)** :
- **Le fichier de tests s'appelle `tests/research-rules.test.mjs`**, pas `tests/research.test.mjs` comme l'annonçait le §8 du chantier. C'est bien le fichier de la recherche, aucun autre n'a été touché.
- **`countWebSearchCalls` est un troisième export** ajouté à `research-rules.ts` (le §8 n'en annonçait que deux). Il est **pur** et sans lui le critère d'acceptation n°8 (« nombre de `web_search_call` mesuré et consigné ») est intenable en production.
- **`.env.example` n'a PAS été touché** (hors liste du §8) : il documente `PERPLEXITY_API_KEY` et `PERPLEXITY_PRESET` mais **ignore `RESEARCH_PROVIDER` et `RESEARCH_OPENAI_MODEL`**. Deux lignes à ajouter quand tu veux — c'est le seul endroit où la nouvelle configuration n'est pas documentée.

**Tests** : +7 dans `tests/research-rules.test.mjs` — parseur OpenAI (texte + citations + pages consultées, accents intacts), absence d'`include` (le texte survit, les sources se réduisent aux citations), bornage `MAX_SOURCES` + dédoublonnage citation/source, robustesse (`null`, non-tableau, annotation d'un autre type), **étanchéité des deux parseurs** (une réponse OpenAI lue par `parseResearchResponse` perd ses sources — la régression silencieuse qu'on voulait rendre impossible), `countWebSearchCalls`, `openaiSearchContext`. **Total : 129 → 136.**

**Vérif** : `npm test` **136/136, exit 0** ; `npx tsc --noEmit` **complet, exit 0 explicite — deux fois** (24 s puis 40 s).

**Constat sur l'outillage (hors périmètre, noté)** : le montage Windows a été **bien plus lent que les 42 s de référence** pendant une bonne partie de la session. Mesures utiles pour la prochaine fois : `find lib app components -name '*.ts*'` (107 fichiers) a pris **20 s à froid, 3,6 s à chaud** ; un `find node_modules -maxdepth 3` n'a listé que **516 entrées en 30 s** ; `cp -a node_modules` copie **5,9 Mo / 264 fichiers en 38 s** (copier le repo en local est donc hors de portée). **Le cache de pages ne survit pas d'un appel bash à l'autre** — relire les `.d.ts` de `next`+`react` a coûté 38 s, puis 30 s, puis encore plus. Ce qui a fini par marcher : **relancer, simplement** (le complet est passé au 11e essai, puis de nouveau au 13e). Un `tsc --noEmit` sur un fichier trivial coûte déjà **9 s** de démarrage ; la recette du `tsconfig` réduit (`extends`, `incremental: false`, `include` limité) reste valable — **8,9 s** pour `lib/research/**`, **18,8 s** pour les 8 fichiers du chantier et leur fermeture transitive — mais ce n'est **pas** un substitut au complet, et le fichier temporaire a bien été supprimé. À noter aussi : **`rm` est refusé** sur le montage sans autorisation explicite côté Cowork.

**Reste (Fathi)** :
1. **`git push`** — six commits locaux (docs session 5, C1, cadrage R1, C2, C3, R1).
2. `npm run build` (SWC Windows).
3. **Relever le coût réel, c'est le point le plus important de ce chantier** : dérouler `signup → philosophie → écran identité` sur un compte neuf avec une vraie entreprise, puis regarder l'entrée `research_succeeded` du journal → champ **`searches`**. À 1 centime la recherche, `MAX_RESEARCH_PER_DAY = 30` plafonne à ~0,30 € **si** `searches = 1`, mais à ~3 € si le modèle en enchaîne 10. Si le chiffre dépasse 3, dis-le : le plafond doit alors compter des **recherches**, pas des appels (ça demande un champ de plus dans `research_runs`, donc une migration — hors périmètre ici).
4. Vérifier `GET /api/llm/status` → `research.provider = "openai"` (la forme a changé : `provider` + `openai` + `perplexity`).
5. **Parcours de contrôle** : l'écran d'identité doit afficher un texte **et des sources cliquables** ; relancer la même recherche ne doit créer **aucun** second `research_started` (cache) ; mettre l'org en pause doit donner `research_blocked` / `paused`. Puis, sans aucune clé de recherche en env, vérifier que l'onboarding saute l'étape comme avant.
6. Si tu ouvres finalement un compte Perplexity : `RESEARCH_PROVIDER=perplexity` suffit, rien à recoder.

### 2026-07-26 (3) — Claude (Cowork) — **C3 « Vocabulaire : deux acronymes, pas quatre »** — **phase A terminée**

Chantier volontairement minuscule, et il l'était encore plus que prévu.

**Fait** : un seul libellé changé — l'en-tête de colonne `CTR` du tableau « Campagnes en cours » (`app/(cockpit)/campagnes/page.tsx`) devient **« Taux de clic »**, avec `whitespace-nowrap` pour que l'en-tête ne se coupe pas en deux (le tableau est déjà en `overflow-x-auto`, les largeurs tiennent).

**Constat qui vaut d'être noté** : la roadmap annonçait « en-têtes de tableau **et cartes KPI** ». En réalité, après grep exhaustif sur `app/` et `components/` :
- **`CTR` n'était affiché qu'à un seul endroit** (les cartes KPI de `/campagnes` montrent dépense, revenu, ROAS, CAC — pas le taux de clic) ;
- **`CVR` n'a jamais été affiché nulle part.** Il est calculé par `deriveKpis` et testé, mais aucune vue ne le rend. Rien à renommer, donc — et surtout, **rien à supprimer** : `deriveKpis` reste inchangé (interdit du chantier), la valeur servira le jour où une vue l'affichera.

**Non touché, conformément aux interdits** : les clés de code (`c.ctr`, `deriveKpis`, types, payloads), les moteurs purs (`lib/ads/metrics-rules.ts`), **ROAS et CAC** (lexique standard assumé par CLAUDE.md — la cible est « à l'aise avec leads, CAC, ROAS, funnel »), et `tests/ads-metrics.test.mjs` dont le nom de test cite CVR/CTR comme clés de calcul, pas comme libellés.

**Vérif** : grep `CVR|CTR` sur `app/` + `components/` → **0 résultat** ; `npm test` **129/129, exit 0** ; `npx tsc --noEmit` **complet, exit 0** (trois tentatives : le montage reste le facteur limitant, cf. entrée précédente).

**Reste (Fathi)** :
1. **`git push`** — cinq commits locaux (docs session 5, C1, cadrage R1, C2, C3).
2. `npm run build`.
3. Coup d'œil sur `/campagnes` avec un scénario chargé : la dernière colonne du tableau doit afficher « Taux de clic » sans casser la mise en page.

**État de la roadmap** : **phase A terminée côté code** (C1 · C2 · C3). Il ne reste que le **jalon 0** (§3 de `roadmap-beta.md`) avant la démo Charly — et il est en grande partie fait : migration 0010 passée, tests et `tsc` verts. Restent le **push**, le **build**, et **dérouler `docs/demo/GUIDE-TEST.md` de bout en bout toi-même** sur les trois scénarios (y compris le changement de scénario). Après la démo : C4 (structure), qui demande l'accord de Charly.

### 2026-07-26 (2) — Claude (Cowork) — **C2 « Le premier écran dit la vérité »** (roadmap-beta, phase A)

**But atteint** : un nouvel utilisateur (ou Charly) qui arrive sur `/` avec une base vide voit désormais le **diagnostic de départ** au lieu de quatre tirets et d'une consigne d'onboarding gravée à vie.

**1. Rendu partagé** — `app/(cockpit)/_components/starter-diagnostic.tsx` (`StarterDiagnosticCard`, props `{ diagnostic: StarterDiagnostic }`). Composant **serveur**, aucun état, aucun `"use client"`. Le rendu est repris **à l'identique** de `/plan` ; l'en-tête de page reste à l'appelant (les deux écrans n'ont pas le même titre). `/plan` l'utilise : **comportement inchangé**.

**2. Accueil** (`app/(cockpit)/page.tsx`) — `hasData = prospects > 0 || lignes ad_metrics sur 30 j > 0`. Si faux : le diagnostic **remplace la grille de KPIs** (et le lien « entreprise fictive » qui la suivait). Si vrai : accueil actuel, strictement inchangé. La fenêtre de 30 jours réutilise la requête `adSpendRows` déjà présente — **même sémantique que `/plan`**, pour que les deux écrans basculent au même moment.

**3. Copie d'onboarding** — le paragraphe « Nepteo apprend votre entreprise… » sous « Bonjour » n'apparaît plus **que dans l'état vide**, où il est vrai.

**4. Guide** — `docs/demo/GUIDE-TEST.md` : le parcours commence maintenant sur `/` (l'étape 3 de « Mise en route » invite à s'y arrêter avant de charger un scénario) ; le détour obligatoire par « Plan du mois » est retiré ; §1 et §5 réécrits en conséquence.

**Décisions de mise en œuvre** :
- **`diagnosticInputFromMemory` ajouté à `lib/diagnostic.ts`** (pur, **zéro import** — la forme des sections est décrite structurellement via `DiagnosticMemory`, pas importée de `lib/memory.ts`). La roadmap ne demandait que d'extraire le *rendu* ; extraire aussi le *mapping* évite que `/` et `/plan` finissent par conseiller des choses différentes à partir de la même fiche. C'est la duplication que C2 aurait créée. **Écart assumé, signalé ici.**
- **Aucun lien démo ajouté sous le diagnostic** : l'état vide de la file de validation porte déjà « Pas encore d'outil à brancher ? → /agent ». Un troisième CTA aurait fait doublon.
- **Bulle `CoachBubble id="today"` non modifiée** : vérifiée, son texte ne fait référence ni à `/plan` ni au parcours déplacé. Le bouton « Analyser » qu'elle mentionne reste présent dans l'état vide (`AnalysisRunner` de `ValidationQueue`).

**Tests** : +1 sur `diagnosticInputFromMemory` (mémoire vide ⇒ que des valeurs neutres, jamais d'`undefined` ; et deux appels équivalents produisent le **même** diagnostic — le contrat anti-divergence entre les deux écrans). **Total : 128 → 129.**

**Vérif** : `npm test` **129/129, exit 0** ; `npx tsc --noEmit` **complet, exit 0 explicite**.

**Constat sur l'outillage (hors périmètre)** : la VM du sandbox a redémarré en cours de session et le `tsc` complet est passé de ~42 s à **plus de 43 s** (échecs répétés) avant de repasser au vert une fois le cache chaud. Confirmation que le montage Windows, et non la charge CPU, est le facteur limitant (mesure : `tar` ne copie que **~11 Mo en 38 s** depuis `node_modules`). Recette utile quand le complet ne boucle pas : un `tsconfig` temporaire `extends: "./tsconfig.json"` avec `incremental: false` et un `include` réduit aux fichiers du chantier **type-checke leur fermeture transitive en < 38 s** — à supprimer après usage, et ce n'est **pas** un substitut au complet.

**Reste (Fathi)** :
1. **`git push`** — quatre commits locaux (docs session 5, C1, cadrage R1, C2).
2. **Migration `0010_research.sql`** : ✅ **déjà passée** (vérifiée le 26/07 — l'erreur `42P07 relation already exists` signifie que le script avait été validé en entier). Plus rien à migrer.
3. `npm run build` (SWC Windows).
4. **Parcours de contrôle** : compte neuf ou base vidée → `/` doit montrer « Bonjour » + le paragraphe d'onboarding + le **diagnostic** avec ses deux CTA ; puis `/agent` → charger un scénario → revenir sur `/` : **KPIs, plus de diagnostic, plus de paragraphe d'onboarding** ; `/plan` inchangé dans les deux états.

**Suite** : phase A terminée côté code (C1 + C2), **C3** (libellés CVR/CTR, ~1 h) reste disponible quand tu veux — après quoi il n'y a plus que le jalon 0 avant la démo.

### 2026-07-26 — Claude (Cowork) — cadrage **R1 : recherche web via OpenAI** (aucun code)

Suite immédiate de la session C1, **hors périmètre C1 et volontairement sans code** (règle « un chantier = une session »).

**Déclencheur (Fathi)** : la clé OpenAI est déjà ouverte, le compte Perplexity API reste à créer. Constat vérifié dans le code : **OpenAI ne fait aucune recherche internet aujourd'hui** — `lib/research/perplexity.ts` est le seul chemin de recherche, et `lib/llm.ts` n'expose aucun outil de navigation. Mettre `LLM_MODEL*=openai:*` configure **le rédacteur**, pas le chercheur. Sans `PERPLEXITY_API_KEY`, `researchConfigured()` est faux → le 2e écran d'onboarding est sauté (dégradation propre, rien ne casse) — c'est la 2e branche du jalon 0, donc l'état actuel est cohérent pour la démo.

**Doc OpenAI vérifiée le jour même** (<https://developers.openai.com/api/docs/guides/tools-web-search>) : outil `web_search` sur la **Responses API**, sources structurées via `include: ["web_search_call.action.sources"]`, coût bornable par `search_context_size`, filtrage par domaine possible. **`gpt-4o-search-preview` est arrêté depuis le 2026-07-23** et `web_search_preview` est legacy — à ne pas utiliser.

**Livré** : `docs/projets/recherche-web-openai.md` — ordre de mission complet (but, fichiers autorisés, interdits, pièges, variables d'env, 9 critères d'acceptation), + entrée ADR dans `docs/DECISIONS.md`.

**Décisions de cadrage** :
- **Ajouter un fournisseur, pas en remplacer un.** Perplexity reste ; `RESEARCH_PROVIDER` tranche, à défaut la présence d'une clé. Le choix redevient réversible en une variable d'env.
- `runResearch` (cache → garde-fous → journal AVANT → appel), les plafonds et la table `research_runs` **ne bougent pas**. C'est le dividende de la décision du 25/07 « la recherche vit hors de `lib/llm.ts` ».
- `researchConfigured()` **déménage** de `perplexity.ts` vers un nouveau `lib/research/provider.ts` — 4 imports à suivre, listés dans l'ordre de mission. Pas de ré-export de compatibilité (deux chemins pour une même question = dette).
- **Parseur dédié**, `parseResearchResponse` non modifié : les deux formes se ressemblent assez pour qu'un parseur « unifié » extraie le texte OpenAI **mais perde ses sources**, silencieusement.

**Risque principal identifié** : chez OpenAI, **une requête ≠ une recherche facturée** — un modèle de raisonnement peut enchaîner plusieurs dizaines de recherches par appel. `MAX_RESEARCH_PER_DAY` compte des appels `runResearch` : le plafond ne protège donc plus le budget comme avec Perplexity. Le chantier doit **mesurer** le nombre de `web_search_call` par requête et le consigner, ou dire qu'il n'est pas maîtrisable — pas laisser le plafond mentir.

**Hors périmètre, noté** : la **génération d'images** (playground OpenAI) évoquée par Fathi relève de `docs/projets/generation-creative-ia.md` (Phase 4), pas de ce chantier — garde-fous et modèle de validation différents.

**Reste (Fathi)** : décider quand lancer R1 (avant la démo si tu veux montrer l'assistant d'identité ; sinon après, la démo tient par les scénarios fictifs) et le lancer en **session dédiée** avec le prompt du §0 de `roadmap-beta.md`, en remplaçant `CX` par `R1 (docs/projets/recherche-web-openai.md)`.

### 2026-07-25 (6) — Claude (Cowork) — **C1 « Nettoyage invisible »** (roadmap-beta, phase A)

Chantier **C1** exécuté seul, périmètre strict. **Aucun changement visible** hors les deux boutons de démo retirés. Aucune migration, aucune dépendance, aucune variable d'env.

**1. Un seul chemin de données fictives.** `lib/demo/*` (scénarios) devient la seule voie. Supprimés : `lib/ads/mock-provider.ts`, `lib/ads/seed.ts`, `lib/revenue/mock-provider.ts`, `lib/revenue/seed.ts`, l'action `loadRevenueDemo` (`app/(cockpit)/actions.ts`) et l'action `loadAdsDemo` (`campagnes/actions.ts`).
- **Accueil** : le bouton « Charger le revenu de démo (Stripe) » devient un lien sobre `→ /agent` (« Essayer avec une entreprise fictive »), comme prévu par la roadmap.
- **`/campagnes`** : le bouton « Recharger la démo » disparaît ; l'**état vide** (qui promettait « chargez un jeu de données de démonstration ») pointe désormais lui aussi vers `/agent`. La roadmap ne mentionnait que l'accueil — l'état vide serait resté un cul-de-sac, d'où le même traitement. *Signalé plutôt que fait en silence (règle 2).*
- **`lib/journal.ts` conservé tel quel** : les libellés `ads_demo_loaded` / `revenue_demo_loaded` restent. La table `journal` refuse UPDATE/DELETE (invariant volontaire) — les entrées passées doivent rester lisibles. Ne pas les « nettoyer ».

**2. `lib/memory-store.ts` — `readMemory` (une seule lecture de la mémoire).** Neuf duplications du `select("section, content")` + `Object.fromEntries` remplacées : `app/(cockpit)/actions.ts` (×2), `campagnes/actions.ts`, `contenu/actions.ts`, `contenu/page.tsx`, `plan/page.tsx`, `entreprise/page.tsx`, `lib/analysis.ts`, `lib/briefing.ts`, `lib/execution.ts`.
- **Signature retenue** : `readMemory(client, sections?, orgId?)`. La roadmap disait `(supabase, sections?)`, mais les appels service-role filtrent sur `organization_id` (le client serveur classique s'appuie sur la RLS) — d'où le 3e paramètre optionnel. Comportement identique appel par appel : les sous-ensembles historiques (`["activite","ton","objectifs"]`, `["offres","activite"]`, `["activite","offres","ton"]`) sont **préservés tels quels**, pas alignés sur `LLM_MEMORY_SECTIONS`.
- **`readMemory` ne va PAS dans `lib/memory.ts`** (fichier pur, zéro import, testé par `node:test`) — c'est le point du fichier séparé, et le commentaire d'en-tête le dit.
- `entreprise/page.tsx` conserve son `?? {}` par section (un `content` nul restait un objet vide).

**3. `lib/types.ts` supprimé, `ConnectorType` relogé** dans `lib/connectors.ts` (seul consommateur). Grep de contrôle avant suppression : **aucun autre import** de `@/lib/types` dans le code. Constat : le fichier était intégralement mort à ce type près — `Role`, `Organization`, `Connector`, `AgentAction`, `JournalEntry`, `ActionStatus`, `RiskLevel` n'étaient importés nulle part (`JournalEntry` vit dans `lib/journal.ts`).

**Tests** : 2 cas retirés — ceux qui couvraient le code supprimé (`mockRevenueEvents` dans `tests/revenue.test.mjs`, `mockMetaCampaigns` dans `tests/ads-metrics.test.mjs`). Les cas `revenue-rules` et `metrics-rules` sont intacts. **Total : 130 → 128.**

**Vérif** : `npm test` **128/128, exit 0** ; `npx tsc --noEmit` **complet, exit 0 explicite** (Node 22.22.3). ⚠️ `npx eslint` **n'a pas pu aboutir** dans le sandbox (démarrage > 43 s sur le montage, y compris sur une poignée de fichiers — *lenteur, pas d'erreur*). Les imports devenus inutiles ont été vérifiés à la main fichier par fichier ; `npm run build` côté Fathi fait foi.

**Constats hors périmètre (notés, PAS corrigés)** :
- Le montage Windows rend le sandbox lent : `git status` et `eslint` dépassent le plafond de 43 s. `tsc --noEmit` complet passe en ~42 s — il faut viser `timeout 43`, pas 40.
- `docs/projets/simplification.md` décrit encore l'ancien ordre des lots ; `roadmap-beta.md` le remplace (déjà dit en tête de ce dernier). Rien touché.

**Reste (Fathi)** :
1. **`git push`** — cinq sessions de travail sont locales (le sandbox n'a pas d'identifiants GitHub).
2. **Migration `0010_research.sql`** dans Supabase — toujours la seule en attente (jalon 0).
3. `npm run build` (SWC Windows).
4. Contrôle rapide : accueil sans vente → le lien « Essayer avec une entreprise fictive → » mène à `/agent` ; `/campagnes` sans donnée → même lien ; `/agent` → charger un scénario → les analyses, brouillons, brief et fiche entreprise se comportent comme avant (c'est `readMemory` qui les alimente maintenant).

**Suite** : **C2 — Le premier écran dit la vérité** (dépend de `readMemory`, livré ici).

### 2026-07-25 (5) — Claude (Cowork) — audit contradictoire + roadmap d'exécution bêta

- **Audit contradictoire** du plan `docs/projets/simplification.md` (à la demande de Fathi) + évaluation valeur du produit — en conversation, **rien codé**. Verdicts clés : lot 1 validé (2 amendements), lot 2 après la démo, **lots 3+4 = une seule décision de structure** (le « 9 → 5 » du lot 3 est impossible sans le lot 4), lot 5 réduit à CVR/CTR (ROAS/CAC sont du lexique standard d'après CLAUDE.md), lot 6 validé.
- **Constats factuels à retenir** : `lib/types.ts` n'est PAS un pur réexport (`ConnectorType` importé par `lib/connectors.ts` — reloger avant suppression) ; `prospects` n'a **aucune date de dernier contact** (trou n°1 du moteur de relance) ; la copie d'onboarding sous « Bonjour » sur `/` est permanente ; le diagnostic de départ n'est visible que sur `/plan`.
- **`docs/projets/roadmap-beta.md` créé** : 12 chantiers (C1–C12) en 3 phases autour de la démo Charly (A : avant démo ; B : structure ; C : valeur — envoi réel, temps dans la relance, compteur de valeur, brief du lundi, diagnostic public). Chaque chantier : ordre de mission, fichiers, interdits, pièges, critères d'acceptation, **modèle conseillé** (Opus 5 pour C4/C7/C8/C12, Sonnet 5 sinon). §2 = règles anti-erreurs IA communes ; §3 = jalon 0 (checklist démo : **migration 0010**, push, décision clé Perplexity). Ce fichier remplace l'ordre du plan simplification.
- **Reste (Fathi)** : dérouler le jalon 0 (§3 de roadmap-beta), `git push` (ce doc inclus), puis lancer C1 avec le prompt du §0.

### 2026-07-25 (4) — Claude (Cowork) — enchaînement rapide des cas + étape 3 (diagnostic de départ)

**`npm run build` validé par Fathi** (Next 16.2.10, TypeScript 18,1 s, **23 routes**, `/onboarding/identite` présente) — les trois lots précédents de la journée sont confirmés côté prod.

**Défaut corrigé (bloquant pour tester les cas à la suite)** : `loadDemoScenario` ne purgeait **pas** les propositions, le briefing ni l'outbox. On gardait donc les propositions de la menuiserie en regardant l'e-commerce — l'agent avait l'air de délirer. Ajout de `resetCockpitState` (outbox + actions + briefings), appelé au **chargement** comme au **retrait** d'un scénario.

**« Charger et analyser »** : le bouton du panneau démo enchaîne désormais `runAnalysis` + `runAdsAnalysis` après le seed, et le message de retour annonce le nombre de propositions en attente. Un cas se teste en **un clic** au lieu de trois écrans. Un échec d'analyse ne fait pas échouer le chargement.

**Étape 3 du chantier onboarding — `lib/diagnostic.ts`** (pur, aucun import) :
- `detectProfile` : **B2C local / B2B / e-commerce / SaaS / générique** depuis activité + clientèle + zone (l'activité prime sur la clientèle : plus discriminante).
- `buildStarterDiagnostic` : **3 canaux maximum** (question ouverte de la spec tranchée), chacun avec le *pourquoi*, le *premier geste*, l'effort et un ordre de coût ; **`avoid`** = ce qu'il vaut mieux ne pas faire tout de suite **avec la raison** (souvent le conseil le plus utile, et celui qu'aucun outil ne donne parce qu'il ne vend pas de fonctionnalité) ; **`firstWeek`** = trois gestes concrets ; **`basis`** = sur quoi le diagnostic s'appuie, pour qu'il soit contestable.
- Reconnaît ce que l'entreprise **fait déjà** (canaux déclarés **+** section `presence` issue de la recherche web) et le signale au lieu de le lui apprendre. Si tout est couvert, l'intro le dit et ne pousse pas un canal de plus pour faire nombre.
- **Affichage sur `/plan`** : tant qu'aucun prospect ni aucune ligne de campagne n'existe, l'écran rend le diagnostic (« Par où commencer ») au lieu d'un plan du mois creux ; deux CTA (« Corriger ma fiche » / « Brancher mes outils »). Dès qu'il y a des données, on retrouve le plan.
- Tests : `tests/diagnostic.test.mjs` (7 — profils, bornage, mises en garde justifiées, reconnaissance de l'existant, fondement exposé).

**Vérif** : `npm test` **130/130** ; **`tsc --noEmit` complet exit 0**.

**Reste (Fathi)** : `git push` ; migration **0010** (toujours la seule en attente) ; `npm run build`. Parcours de test rapide : `/plan` **avant** de charger quoi que ce soit (diagnostic de départ) → `/agent` → « Charger et analyser » sur un scénario → `/` (propositions déjà là) → changer de scénario et vérifier qu'il ne reste rien de l'ancien.

### 2026-07-25 (3) — Claude (Cowork) — historique de campagnes + fenêtre d'analyse + communication publique

**Déclencheur (Fathi)** : « il faudrait aussi les données fictives des campagnes précédentes pour une étude de cas plus pertinente ». Question juste — et elle a mis au jour un **vrai défaut** : **aucune lecture de `ad_metrics` ne filtrait par date**. Avec 14 jours de démo ça ne se voyait pas ; avec 6 mois d'historique, trois choses cassaient (ROAS moyenné sur 6 mois, campagne arrêtée toujours proposée « à couper », KPI « Dépenses (30 j) » affichant tout l'historique). L'historique n'était donc pas qu'un ajout de données.

**Fenêtre d'analyse** (`lib/ads/metrics-rules.ts`, pur) :
- `ANALYSIS_WINDOW_DAYS = 30`, `windowBounds` (période courante + précédente de même durée), `splitByPeriod`.
- **`rollupWithStatus`** : distingue `active` de `ended` (aucune ligne dans la fenêtre courante) et **change volontairement de périmètre** — une campagne en cours est jugée sur 30 jours (ce sur quoi on peut encore agir), une campagne terminée sur toute sa vie (sinon rien à montrer). Chaque ligne porte `firstDate`/`lastDate`/`daysSinceLast`.
- `comparePeriods` → `null` s'il n'y a rien avant (on n'invente pas de tendance) ; `buildTrendFinding` ; `buildHistoryFindings` (« ça avait marché » / « inutile de retenter à l'identique »).
- **`buildAdsProposals` ignore les campagnes terminées** — le comportement est inchangé pour les appelants qui ne passent pas de statut.

**Lectures branchées** : `/campagnes` (KPI sur 30 j + comparaison, tableau « Campagnes en cours », section **« Déjà tenté »**), `lib/ads/analysis.ts` (lit les dates, ne propose que de l'actif), `/plan` et `/contenu` (filtre de date), et **correction du KPI « Dépenses » de l'accueil** qui agrégeait tout l'historique sous une étiquette « 30 jours ».

**Historique dans les scénarios** : `DemoCampaignProfile` gagne `startDaysAgo`, `endDaysAgo`, `trend` (dérive graduelle de performance). Chaque scénario a désormais **3-4 campagnes en cours** (dont une qui s'essouffle et une qui progresse) et **2 campagnes arrêtées** — un succès saisonnier et un test raté. Couverture jusqu'à 180 jours, dont ≥ 60 jours pour permettre la comparaison de périodes.

**Communication publique** (2e demande de Fathi : « extraire les offres et les campagnes publiques ») :
- `buildCompanyQuery` demande désormais explicitement la **communication publique observable** : publicités visibles (bibliothèque publicitaire Meta, annonces Google), promotions en cours, réseaux actifs et rythme, blog, newsletter, salons — et de **distinguer le vérifié du supposé**.
- Nouvelle section mémoire **`presence`** (aucune migration), proposée dans l'assistant d'identité sous forme de **cases à décocher** (l'utilisateur retire ce qui est faux), éditable ensuite dans « Identité & activité » (une observation par ligne). Ajoutée à `LLM_MEMORY_SECTIONS` → elle entre dans les prompts de relance et de brief.
- Pourquoi ça compte : l'agent doit savoir **ce que l'entreprise fait déjà** avant de proposer quoi que ce soit. Les trois scénarios de démo portent aussi leur `presence`.

**Vérif** : `npm test` **123/123** ; **`tsc --noEmit` complet exit 0** (sandbox rétabli). `npm run build` côté Fathi fait foi.

**Reste** : inchangé (push, migration 0010, build). Rien de nouveau à migrer.

### 2026-07-25 (2) — Claude (Cowork) — kit de démonstration pour le test de Charly

**Demande de Fathi** : se rapprocher d'une version présentable — des données fictives (plusieurs, servant d'études de cas), un prompt pour que Charly génère les siennes, et un guide (fichier + bulles au bon moment). Arbitrages pris avec lui : **3 profils contrastés**, **tout chargé en un clic**, **bulles + fiche**, **choix depuis « Agent & garde-fous »**.

- **`lib/demo/demo-rules.ts`** (pur, aucun import) : générateurs **déterministes** — `buildDemoProspects`, `buildDemoCampaigns`, `buildDemoRevenue`. Une démo se rejoue à l'identique, et le seed reste idempotent.
- **`lib/demo/scenarios.ts`** (pur) : trois entreprises fictives cohérentes de bout en bout — **Menuiserie Dubreuil** (artisan B2C local), **Atelier Northwind** (agence B2B, cycle long), **Racines & Co** (e-commerce, gros volume). Chacune : identité complète (dont **philosophie**), offres, vivier de contacts, profils de campagnes, produits.
- **Les bases sont volontairement IMPARFAITES** : emails manquants, statuts vides, un doublon, et **une campagne en perte par scénario** (ROAS < 1 avec une dépense significative). Une base parfaite ne démontrerait rien — c'est testé (`tests/demo.test.mjs`, 8 tests dont l'existence d'une campagne à couper et d'une campagne nettement rentable).
- **`lib/demo/seed.ts`** : `loadDemoScenario` écrit mémoire + prospects + `ad_metrics` + `revenue_events`, **idempotent**. Les prospects passent par un **connecteur `demo`** créé à la volée (la table exige un `connector_id`) — donc **aucune donnée d'un vrai connecteur n'est touchée**, et changer de scénario remplace proprement le précédent. `clearDemoData` remet le cockpit à vide. **Aucune migration.**
- **`/agent` → section « Mode démonstration »** : trois cartes, chargement animé (étapes visibles), lien « Retirer les données de démonstration ». Actions `loadDemoScenarioAction` / `clearDemoAction` (garde `canEdit`, journal `demo_scenario_loaded` / `demo_scenario_cleared`).
- **Bulles de guidage** (`components/ui/coach-bubble.tsx`) : une bulle par écran (Aujourd'hui, Prospects, Campagnes, Contenu, Plan, Agent, Entreprise) avec **ce qu'il faut faire** *et* **ce qu'il faut observer**. Refermable, mémorisée dans le navigateur (`localStorage`), rendue seulement après montage (pas de désaccord serveur/navigateur).
- **`docs/demo/GUIDE-TEST.md`** : parcours pas à pas, tableau des trois scénarios, ce qu'il faut juger, et une section **« ce qui n'est pas encore là »** (aucun envoi réel, lancement de campagne non branché, recherche web optionnelle) — mieux vaut le dire avant que Charly le cherche.
- **`docs/demo/PROMPT-DONNEES-FICTIVES.md`** : prompt prêt à coller pour produire un CSV au bon format, avec les défauts volontaires demandés explicitement, puis la marche à suivre pour l'importer via Sheets.
- **Dégradation sans Perplexity** : `createOrganization` ne redirige vers `/onboarding/identite` que si `researchConfigured()`, et la page elle-même redirige vers `/` sinon. Plus d'écran sans issue en démonstration.

**Vérif** : `npm test` **113/113**. ⚠️ **`tsc` complet non bouclé ce tour** : le sandbox s'est dégradé en fin de session (dépassements du plafond 43 s, y compris sur `lib` seul — **pas des erreurs**). Ce qui est acquis : le `tsc --noEmit` **complet était vert plus tôt dans la session** (il couvre tout jusqu'à l'assistant d'identité inclus) ; les fichiers purs `lib/demo/*` type-checkent **en isolé (exit 0)** ; le reste (panneau démo, bulles, insertions dans 7 pages) a été **relu à la main**. **`npm run build` côté Fathi fait foi.**

**Piège rencontré, à retenir** : insérer un import par script en visant « la dernière ligne commençant par `import` » casse les **imports multi-lignes** (l'import a atterri au milieu d'un bloc dans `prospects/page.tsx`). Corrigé ; à l'avenir, viser la fin de la déclaration (`} from …`).

**Reste (Fathi)** : `git push` ; migration **0010** ; `npm run build` ; puis `/agent` → charger « Menuiserie Dubreuil » → `/` → « Analyser ». Envoyer `docs/demo/GUIDE-TEST.md` et `docs/demo/PROMPT-DONNEES-FICTIVES.md` à Charly.

### 2026-07-25 — Claude (Cowork) — onboarding enrichi : philosophie (étape 1) + socle de recherche web Perplexity (backend)

**État repo au départ (vérifié)** : arbre **propre**, `main` synchro avec `origin/main` sur `b8f4cf6`. Les lots signalés « écrits mais à commiter » par l'entrée du 2026-07-23 **étaient déjà commités et poussés** — la note était périmée. `npm test` **82/82** (Node 22.22.3), migration **0009 confirmée passée par Fathi**.

**Étape 1 — encart « philosophie »** (chantier `docs/projets/onboarding-ia.md`, périmètre confirmé avec Fathi avant de coder) :
- `lib/memory.ts` (pur, sans import) : section **`philosophie`** ajoutée à `MEMORY_SECTIONS`, `MemoryContent.philosophie`, `PHILOSOPHY_MAX = 2000`, `normalizePhilosophy` (trim, retours à la ligne réduits, bornage), `philosophyText`/**`philosophyBlock`**, et **`LLM_MEMORY_SECTIONS`** = liste unique des sections lues pour les prompts (remplace les `.in([...])` dupliqués).
- **Aucune migration** : `company_memory.section` est un `text` sans contrainte de check — ajouter une section ne touche pas la base.
- **Captation** : 3e champ *facultatif* dans `app/onboarding/page.tsx` (les 2 champs existants sont intacts) ; `createOrganization` upsert la section + journal `memory_updated` (vide ⇒ aucune écriture ; un échec ici ne bloque pas la création du cockpit).
- **Édition** : `savePhilosophie` + `MemRow` « Philosophie » dans « Identité & activité » (aperçu `line-clamp-2`).
- **Branchement** : `philosophyBlock` injecté dans `lib/draft.ts` (relance groupe + par prospect) et `lib/creative.ts` (brief). **Contrat anti-régression testé** : pas de philosophie ⇒ bloc = `""` ⇒ prompts identiques à avant.

**Perplexity — socle de recherche (backend seul, aucune UI)** :
- **Décision d'architecture** : la recherche vit **hors de `lib/llm.ts`**. Perplexity **collecte** des faits sourcés, la couche LLM existante les **met en forme**. `POST https://api.perplexity.ai/v1/agent` en `fetch` natif ⇒ **aucune dépendance npm ajoutée**. (Doc vérifiée le 25/07 : Perplexity recommande l'**Agent API** — `{preset, input}` → `output[]` — plutôt que Sonar Chat Completions ; presets `fast|low|medium|high|xhigh`.)
- `lib/research/research-rules.ts` (**pur, aucun import**) : `subjectKey` (clé de cache — `https://www.Acme.fr/` et `acme.fr` convergent), `cleanWebsite`, `buildCompanyQuery`, `buildProspectCompanyQuery`, `guardResearch`, `isFresh`, `parseResearchResponse` (Agent API **et** repli forme Sonar), `renderResearch`, presets/plafonds.
- `lib/research/perplexity.ts` : client HTTP, timeout 45 s, **ne lève jamais**, ne renvoie jamais le corps d'erreur ; `researchConfigured()` exposé dans `GET /api/llm/status`.
- `lib/research/research.ts` : cache → garde-fous → **journal AVANT l'appel** → appel → upsert + journal. Même discipline que l'exécution.
- **Migration `0010_research.sql`** : table `research_runs` (unique `(org, kind, subject_key)`, RLS select `is_member`, index de comptage quotidien). **À exécuter dans Supabase (Fathi).**
- `lib/research/profile-rules.ts` (**pur**) : `parseIdentityProposal` recale la sortie LLM sur les **options réelles** de la mémoire (les listes sont **injectées en paramètre**, pas importées — le piège type-stripping reste évité) ; tout champ hors options est **omis, jamais forcé**.
- `lib/research/company-profile.ts` : recherche + nouvelle tâche LLM **`identity_synthesis`** → **proposition** d'identité + sources. **Rien n'est écrit dans `company_memory`** : la proposition pré-remplira les formulaires existants, que l'utilisateur valide section par section (⇒ on ne perd aucune information). Action serveur `proposeIdentityFromWeb` (retour direct, pas de redirect).
- `lib/research/prospect-company.ts` : enrichissement **de la société** d'un prospect. `ProspectContext.research` ajouté (rendu par `renderProspectContext`, **additif** : absent ⇒ prompt inchangé) et `draftForProspect(..., enrich = false)` — la recherche reste **explicite, jamais automatique** (appel facturé).
- **3 décisions consignées dans `docs/DECISIONS.md`** : recherche hors couche LLM ; **enrichissement société uniquement, jamais la personne (RGPD)** ; une recherche = une exécution (garde-fous + journal avant + cache, échecs compris).

**UI de l'étape 2 — 2e écran d'onboarding, FACULTATIF** (placement tranché avec Fathi) :
- `createOrganization` redirige désormais vers **`/onboarding/identite`** au lieu de `/`.
- `app/onboarding/identite/` : page serveur + `_components/identity-wizard.tsx` (client). Deux temps — (1) coller l'adresse du site → recherche avec **étapes cadencées** (autonomie visible, même patron que `AnalysisRunner`) ; (2) la proposition s'affiche **corrigeable** (chips activité/clientèle/canaux, textareas description/zone/ton), avec les **offres repérées**, les **« gaps »** (ce que l'agent n'a pas trouvé) et les **sources cliquables**. Bouton **« Passer cette étape »** à chaque instant.
- `actions.ts` : `proposeIdentity` (retour direct), **`applyIdentity`** (écrit section par section, une section vide n'écrase jamais l'existant → la philosophie saisie à l'écran 1 reste intacte, journal par section avec `source: onboarding_web`), `skipIdentity`.
- Les messages d'erreur sont **traduits par raison** (`no_key`, `daily_cap`, `paused`…) : l'utilisateur comprend pourquoi ça n'a pas marché.
- `proposeIdentityForOrg` factorisé dans `lib/research/company-profile.ts` → une seule implémentation pour l'onboarding **et** la vue Entreprise.

**Vérif** : `npm test` **105/105** ; `tsc --noEmit` sur **tout le projet exit 0** ; `npx eslint lib app` **propre**. `npm run build` côté Fathi fait foi.

**Sur les modèles (échange avec Fathi)** : la nouvelle tâche `identity_synthesis` est en niveau `standard` → elle hérite automatiquement de l'override `LLM_MODEL=openai:gpt-5.4`. **Perplexity cherche, OpenAI rédige** (sur le crédit test de Fathi). L'Agent API permettrait aussi de choisir le modèle de raisonnement, mais il serait alors **facturé par Perplexity** — d'où la séparation actuelle, la moins chère. Épinglage possible : `LLM_TASK_IDENTITY_SYNTHESIS=openai:gpt-5.4`.

**Reste (Fathi)** :
1. **Migration `0010_research.sql`** dans Supabase.
2. `PERPLEXITY_API_KEY` dans `.env.local` (compte à créer ; sans clé la recherche est désactivée proprement, rien ne casse). Vérif : `GET /api/llm/status` → `research.perplexity: true`.
3. **`git push`** — le sandbox n'a pas d'identifiants GitHub, les commits sont locaux.
4. `npm run build` (vider `.next` si l'erreur `dev/types` réapparaît).
5. Tester le parcours complet : créer un compte → champ philosophie → **2e écran, coller l'adresse d'un site** → proposition → corriger → enregistrer → `/entreprise` doit être pré-remplie (et la philosophie intacte). Puis ouvrir une relance : le message doit respecter le ton annoncé.

**Suites** : **étape 3 = diagnostic d'expert** (meilleurs canaux + stratégie de départ, sur le moteur de `lib/plan.ts`, nourri par l'identité au lieu des connecteurs) — c'est le premier « waouh » avant tout connecteur. Puis : bouton « enrichir ce prospect » branché sur `draftForProspect(..., enrich = true)` (le backend est prêt, il ne manque que le déclencheur UI), et relance de la recherche depuis `/entreprise` (`proposeIdentityFromWeb` existe déjà).

### 2026-07-23 — Claude (Cowork) — 2 chantiers cadrés (docs projet) avant changement de sujet
- **Discussion métier** (solopreneur, « outil magique, plus besoin de personne ») → deux features cadrées et **documentées pour reprise à froid** (conversation devenue longue).
- **`docs/projets/onboarding-ia.md`** : onboarding enrichi par IA — encart « philosophie » (texte libre) + ingestion page web (+ réseaux en backlog) → identité synthétisée + **première expertise** (meilleurs canaux/stratégie) avant tout connecteur. Réutilise `company_memory` + moteur Plan. **Contrainte forte : rester simple, GARDER le formulaire existant, ne rien perdre.**
- **`docs/projets/generation-creative-ia.md`** : génération de contenu **fini** par IA — l'agent génère le visuel (API OpenAI), pas que le brief ; vidéo en option plus tard. Réutilise creative/campaign. Validation humaine obligatoire.
- **`docs/ROADMAP.md`** : section « Chantiers à venir » ajoutée, liant les deux docs (Onboarding → Phase 5, Génération créative → Phase 4).
- **Rien codé** sur ces deux features (cadrage seulement). À reprendre à froid dans une nouvelle conversation.
- **Rappel état code** : plusieurs lots récents (Plan du mois, boucle revenu, peaufinages campagne, etc.) **écrits sur le disque mais à commiter par Fathi** (mon sandbox bash est resté HS en fin de session). Migrations à passer : 0009 (revenue). `npm test` attendu ~82, `npm run build` à relancer (vider `.next` si l'erreur `dev/types` réapparaît).

### 2026-07-23 — Claude (Cowork) — boucle revenu (démo) + KPIs vivants sur l'accueil
- **Suite stratégique** : faire raisonner Nepteo en **euros gagnés** (vente/revenu = la métrique qui compte, cf. CLAUDE.md), pas en vanité. Connecteur paiements (Stripe) en **données de démo d'abord**, même patron que Meta Ads.
- **Migration `0009_revenue.sql`** : table `revenue_events` (org, source, external_id, label, amount, occurred_on), idempotence `unique(org,source,external_id)`, RLS select `is_member`. **À exécuter dans Supabase (Fathi).**
- **`lib/revenue/revenue-rules.ts`** (pur) : `revenueStats` (total, nombre, panier moyen), `overallRoas` (revenu/dépense). **`lib/revenue/mock-provider.ts`** (pur, déterministe) : `mockRevenueEvents` (~14 ventes/30 j, 4 produits). **`lib/revenue/seed.ts`** : `seedRevenueDemo` (upsert idempotent, journal `revenue_demo_loaded`).
- **KPIs vivants** (`app/(cockpit)/page.tsx`) : les 4 cartes de l'accueil (« — » depuis le début) affichent enfin du réel sur 30 j — **Revenu** (total ventes), **Ventes** (nombre), **Dépenses** (somme `ad_metrics`), **Prospects** (count). Bouton « Charger le revenu de démo (Stripe) » quand aucune vente (canEdit) ; action `loadRevenueDemo`.
- **Tests** : `tests/revenue.test.mjs` (4 : stats, vide, roas, mock déterministe). Attendu **~82**.
- **Vérif** : sandbox HS → pas de test/commit ici ; logique validée à la main. Calqué sur le patron ads (qui a build vert). Pas de dépendance.
- **Reste** : Fathi — migration **0009** (sinon la requête revenue sur l'accueil renvoie vide, mais ne casse pas), commiter/pusher, `npm test` (~82), `npm run build`. Voir accueil → « Charger le revenu de démo » → KPIs Revenu/Ventes remplis. **Suites** : brancher `overallRoas`/revenu dans le **Plan du mois** (prioriser par ROI réel) ; attribution revenu → campagne (vraie ROAS par campagne) ; connecteur Stripe réel derrière `revenue_events`.

### 2026-07-23 — Claude (Cowork) — « Plan du mois » (l'agent directeur marketing)
- **Décision stratégique (Fathi)** : l'envoi email réel = commodité, pas la valeur ; ces relances sont personnelles (pas de mass-mailing). La vraie valeur = le **cerveau** (comprendre, décider, préparer), pas le tuyau. On monte donc d'un cran : de l'action isolée vers **la stratégie du mois**. Envoi SMTP réel **dépriorisé** (à brancher plus tard si un pilote en a besoin).
- **`lib/plan.ts`** (pur, testable) : `buildMarketingPlan(signals)` — ORCHESTRE ce que l'agent sait déjà en 4-5 mouvements **priorisés par levier** (1. couper les pubs en perte, 2. relancer les prospects prêts, 3. renforcer la meilleure campagne si ROAS≥2, 4. campagne d'acquisition pour l'offre, 5. contenu, 6. compléter emails manquants) — bornés à 5. Chaque `PlanMove` = titre, pourquoi, canal, impact, **CTA vers l'écran où agir** (`/`, `/campagnes`, `/contenu`). Intro stratégique assemblée selon les leviers présents. Budget indicatif. **Aucune action créée** (vue lecture seule qui pointe vers les flux existants → pas de doublon/conflit).
- **Page `/plan`** : bandeau « Cap du mois » (intro + budget indicatif) + cartes de mouvements (numéro, canal coloré, pourquoi, impact, bouton CTA). Signaux calculés depuis funnel (`computeFunnelStats`), pubs (`rollupByCampaign`/`deriveKpis`), mémoire (offre). **Nav « Plan du mois »** ajoutée en tête du Pilotage (icône bulb).
- **Pourquoi c'est fort** : c'est le geste « directeur marketing » — au lieu d'actions éparses, une stratégie cohérente et priorisée, qui réutilise TOUT (funnel, ads, campagne, contenu) et renvoie vers les bons écrans. Aligné « proposer pour simplifier ».
- **Tests** : `tests/plan.test.mjs` (4 : priorisation/bornage, CTA valides, cas vide, seuil renforcer). Attendu **~78**.
- **Vérif** : sandbox HS → pas de test/commit ici ; logique validée à la main. Pas de migration, pas de dépendance. Calqué sur les patrons existants.
- **Reste** : Fathi — commiter/pusher, `npm test` (~78), `npm run build`. Voir /plan. **Suites possibles** : intro LLM (voix directeur), « ajouter tout le plan à ma file » en 1 clic, boucle revenu (connecteur paiements) pour prioriser par ROI réel.

### 2026-07-23 — Claude (Cowork) — peaufinage « Nouvelle campagne » (détails au tiroir + variantes éditables)
- **Détails campagne au moment de valider** : la proposition `launch_campaign` montrait constat/raison mais pas le concret. Ajouté : `QueueAction` reçoit `payload` (select `page.tsx` + interface), et le tiroir affiche `CampaignDetails` (budget/durée/coût-contact, contacts attendus, **messages A/B**, garde-fous plafond/arrêt) quand `kind === "launch_campaign"`. On relit ce qu'on valide.
- **Variantes éditables** : dans la modale (étape 3), les 2 accroches deviennent des textarea liées à l'état `variants` → les versions modifiées sont soumises telles quelles.
- **Vérif** : sandbox HS → pas de test/commit ici. Affichage + état éditable uniquement (pas de logique pure nouvelle, pas de migration/dépendance). Relu à la main.
- **Reste** : Fathi — commiter/pusher, `npm run build`. Tester : « + Nouvelle campagne » → retoucher un message → Ajouter à ma file → ouvrir la proposition dans « À valider » → voir budget + messages + garde-fous.

### 2026-07-23 — Claude (Cowork) — « Nouvelle campagne » (le geste phare de la maquette)
- **Retour Fathi/Charly** : le bouton **« + Nouvelle campagne »** (point fort de la maquette) avait disparu. Reconstruit **fidèlement à `docs/maquettes/nepteo-cockpit.html`** (modale 4 étapes : Brief → Construction → Proposition → Garde-fous). **Rien n'est lancé** — la campagne rejoint la file de validation ; le lancement réel = étape séparée, gated (argent).
- **`lib/campaign-plan.ts`** (pur, testable) : `buildCampaignPlan(brief, {avgCostPerContact})` — budget total (budget/j × 14), coût/contact (réel si dispo via `ad_metrics`, sinon défaut par canal), fourchette contacts, **confiance** (0,76 calibré / 0,60 défaut), garde-fous (plafond = budget/j, arrêt auto = coût×2,4 borné). Objectifs (clients/rdv/relance), canaux (Meta/Google/LinkedIn), budgets (10/20/30). `objectiveLabel`/`channelLabel`.
- **`lib/campaign.ts`** : `generateCampaignVariants` — 2 accroches A/B via tâche LLM `draft_post` (déjà au registre), repli déterministe.
- **Actions** (`campagnes/actions.ts`) : `buildCampaignAction` (calcule plan + variantes, `avgCostPerContact` = dépense/conversions réelles) ; `submitCampaignAction` (insère l'action **kind `launch_campaign`**, statut `proposed`, risk `medium`, payload {brief, plan, variants}, journal `action_proposed`). **Non exécutable** (kind hors relance/ads_pause → `executeApprovedAction` renvoie `not_executable`) : validable mais pas lançable → lancement réel = future étape gated.
- **UI** : `_components/new-campaign-modal.tsx` (modale 4 étapes, étape 2 animée façon autonomie visible, étape 3 = KPIs + 2 variantes, étape 4 = garde-fous) + bouton **« + Nouvelle campagne »** en tête de `/campagnes` (toujours visible si canEdit, même sans données ads).
- **Boucle** : la proposition apparaît dans « À valider » (Aujourd'hui) avec constat/raison/impact/confiance ; validée → « Décisions récentes » (pas de bouton Exécuter, c'est voulu).
- **Tests** : `tests/campaign-plan.test.mjs` (5 : budget/plafond, défaut vs calibré, avg invalide, libellés). Attendu **~74**.
- **Vérif** : ⚠️ **sandbox HS ce tour** (bash timeout) → pas de test/commit ici. `buildCampaignPlan` validé à la main. Nouveau code calqué sur patrons éprouvés (draft/creative), pas de migration, pas de dépendance. Import inutilisé retiré.
- **Reste** : Fathi — `Remove-Item -Recurse -Force .next` (si l'erreur de types dev réapparaît) ; **commiter/pusher**, `npm test` (~74), `npm run build`. Tester /campagnes → « + Nouvelle campagne » → 4 étapes → « Ajouter à ma file » → la campagne dans « À valider ». **Suites** : rendre les variantes éditables ; brancher le lancement réel (API pub, budget cap serveur) en étape gated ; typologies additionnelles.

### 2026-07-23 — Claude (Cowork) — Phase 4 (contenu) : conseil créatif / brief (agnostique canal)
- **Cadrage Fathi** : distinction claire du cycle campagne (contenu → brief → validation → lancement → mesure → optimisation). Manque identifié = **création de contenu/brief** (on avait mailing de relance + analyse + pause, pas le créatif). Choix : un **conseil créatif GÉNÉRAL, agnostique du canal** (met en avant le produit, s'inspire des bonnes pratiques du secteur), débouchant sur un **brief exploitable** par un humain OU une IA de génération (pub Meta ou autre). **Zéro lancement, zéro dépense.**
- **`lib/creative-template.ts`** (pur, testable) : `templateCreativeBrief(seed)` déterministe (objectif, produit, cibles, canal, angles, « ce qui marche dans le secteur » = bonnes pratiques générales avec disclaimer, accroches, message clé, CTA, « prêt à transmettre »). `CREATIVE_CHANNELS`/`CHANNEL_LABELS` (indifférent/pub/newsletter/social).
- **`lib/creative.ts`** : `generateCreativeBrief` via tâche LLM **`campaign_brief`** (déjà dans `LLM_TASKS`, jusqu'ici inutilisée), `withLlmTrace`, repli template. Ancré sur la mémoire (activite/offres/cibles/ton).
- **`/contenu`** : page + `_components/creative-workspace.tsx` (client : objectif + canal → « Générer le conseil créatif » → brief affiché, Copier/Régénérer) + action `generateBriefAction` (journal `creative_brief_generated`, acteur agent). **Nav « Contenu » activée** (était Phase 4). Disclaimer UI : inspiration sectorielle = bonnes pratiques générales, pas de veille temps réel (backlog enrichissement internet).
- **Honnêteté** : « s'inspirer de ce qui marche dans le secteur » = connaissance générale du modèle, PAS de scraping concurrentiel (backlog).
- **Vérif** : ⚠️ **sandbox HS ce tour** → pas de test/commit ici. `templateCreativeBrief` **validé en isolé** (pas d'undefined/parenthèses vides ; cas complet OK). Nouveau code calqué sur le moteur de brouillons (patron éprouvé). Pas de migration, pas de dépendance. Attendu **67/67** (+3).
- **Recadrage Fathi (simplicité — proposer, pas page blanche)** : le champ vide mettait la charge sur l'utilisateur. **Rendu proposition-first** : `buildCreativeSuggestions` (pur, `creative-template.ts`) génère 3-4 **idées cliquables** à partir de ce que l'agent sait déjà — offre (mémoire), `priorityCount` (prospects prêts), campagne en perte (`ad_metrics`) — + toujours « Annoncer une nouveauté ». La page `/contenu` calcule ces signaux (réutilise `computeFunnelStats`, `rollupByCampaign`/`deriveKpis`) et les passe au workspace ; cliquer une idée pré-remplit objectif+canal et **génère en un clic**. Le champ libre reste, en second. Tests +2 (suggestions plein/vide). Logique validée mentalement (sandbox HS). Attendu **69/69**.
- **Reste** : Fathi — **commiter/pusher**, `npm test` (attendu 69), `npm run build`. Tester /contenu → cliquer une idée de l'agent → brief. **Suites Phase 4** : variantes multiples, typologie (acquisition/retargeting/nurturing…), puis brancher une IA de génération d'annonce ; plus tard « préparer une campagne » complète (brief + audience + budget → proposition → lancement gated).

### 2026-07-23 — Claude (Cowork) — vue « Envois préparés » + sélecteur de mode (vers étape B)
- **Décision actée** : `docs/DECISIONS.md` — **Nepteo ne détient ni ne déplace jamais de fonds** (campagnes payantes = budget sur le compte du client, l'agent ne fait que des appels API ; la plateforme facture le client). Conséquence : lancer/augmenter un budget = action la plus engageante (validation + plafond serveur) ; on démarre par « pause » (réduit la dépense).
- **Choix Fathi** : marche sûre vers l'étape B (pas l'envoi réel tout de suite). **Aucun envoi, aucune dépendance, aucune migration.**
- **`app/(cockpit)/agent/page.tsx`** : (1) **Mode d'exécution** = sélecteur visuel deux états — « Mode sûr » (Actif) / « Mode réel — envoi SMTP » (**désactivé, badge « Bientôt · étape B »**) ; honnête, pas de mode réel factice. (2) **Section « Envois préparés »** : lit `outbox_messages` (count `prepared` + 15 récents), affiche statut (Préparé/Envoyé/Échec), destinataire, objet, date. Rend visible dans l'app ce qui n'était visible que dans Supabase.
- **Vérif** : ⚠️ **sandbox HS ce tour** (bash timeout) → pas de test/commit ici. Changement = 1 page serveur (lecture + rendu) + DECISIONS.md ; aucune logique pure nouvelle (tests inchangés, attendu 64), pas de migration, pas de dépendance. Relu à la main (types cohérents, tokens couleur existants).
- **Reste** : Fathi — **commiter/pusher** (`git add -A && git commit && git push`), `npm run build`. Voir /agent → « Envois préparés » (après avoir exécuté une relance). **Étape B (à venir)** : transport SMTP (Mailjet) derrière `outbox` `prepared`→`sent`, activé par le mode réel + creds ; bouton « Envoyer ».

### 2026-07-23 — Claude (Cowork) — page « Agent & garde-fous » + niveau d'autonomie
- **Choix Fathi** : avant l'étape B (envoi SMTP), rendre les garde-fous Phase 3 **visibles et sous contrôle**. Aucun envoi.
- **Migration `0008_autonomy.sql`** : `organizations.autonomy_level` (`suggest` | `prepare`, défaut `prepare`, check). `suggest` = proposer seulement (aucune exécution) ; `prepare` = préparer les actions validées (mode sûr). **À exécuter dans Supabase (Fathi).**
- **Garde-fou** (`execution-rules.ts`) : `guardExecution` gagne `autonomy?` → refuse `blocked_autonomy` si `suggest`. **Ordre** : pause > autonomie > déjà exécutée > pas validée. `execution.ts` lit `autonomy_level`. Logique validée en isolé (sandbox HS ce tour).
- **Page `/agent`** (`app/(cockpit)/agent/`) : (1) **Bouton d'arrêt** (réutilise `ExecutionSwitch`) ; (2) **Niveau d'autonomie** (`_components/autonomy-selector.tsx`, action `setAutonomyLevel`, journal `autonomy_changed`) ; (3) **Plafonds serveur** (affiche `MAX_PER_RUN`/`MAX_PER_DAY`, non contournables) ; (4) **Mode d'exécution** = « Mode sûr » (prépare, aucun envoi ; le mode réel viendra à l'étape B). **Nav « Agent & garde-fous » activée** (`/agent`). Carte pied de sidebar rafraîchie (n'affiche plus « Phase 1 »).
- **Tests** : +2 sur `guardExecution` (autonomie suggest/prepare, pause prime). Attendu **64/64**.
- **Vérif** : ⚠️ **sandbox HS ce tour** (montage tombé + bash qui timeout) → `npm test`/`tsc`/commit **non faits ici**. Logique guard validée en isolé. Fichiers écrits sur le disque.
- **Reste** : Fathi — migration **0008** dans Supabase ; **commiter/pusher** (`git add -A && git commit && git push`), `npm test` (attendu 64), `npm run build`. Tester : /agent → basculer autonomie sur « Proposer seulement » → une action validée ne s'exécute plus (Exécuter bloqué, journal `execution_blocked` reason `blocked_autonomy`) ; bouton d'arrêt idem.

### 2026-07-23 — Claude (Cowork) — correctifs retours Fathi (doublons outbox + CTA campagnes)
- **Retour test réel de Fathi** (migrations 0003→0007 passées, push + build OK). Deux points :
- **Doublons dans `outbox_messages`** : deux connecteurs (Sheets + Notion) lisent la même base → `prospects` contient chaque personne en double → l'exécution préparait **deux messages par email** (Julie, Sarah… ×2). La dédup n'existait qu'à l'affichage. **Corrigé** : `dedupeByEmail` (pur, `execution-rules.ts`, garde la 1re occurrence, casse/espaces ignorés, conserve les sans-email) appliqué dans `executeApprovedAction` (destinataires) **et** `prospectsForAction` (liste par prospect). Test +2.
- **Point 6 (analyse campagnes sans suite visible)** : « Analyser mes campagnes » créait la proposition mais rien ne le disait ni n'orientait vers Aujourd'hui. **Corrigé** : `analyzeAdsForm` redirige `/campagnes?proposed=<n>` ; bandeau sur la page — vert « N action(s) proposée(s) → **Valider sur Aujourd'hui →** » (lien `/`), gris si 0, rouge si erreur.
- **Vérif** : ⚠️ **le montage du repo dans le sandbox a sauté ce tour** (« couldn't be mounted ») → `npm test`/`tsc` **non exécutables** ici. Algorithme `dedupeByEmail` **validé en isolé** (node : Julie/Sarah ×1, sans-email conservés, 1re occurrence). Changements petits et relus (helper pur + redirect + bandeau). **`npm test` (attendu 60) + `next build` côté Fathi** = confirmation.
- **Dédup de secours nom+entreprise (fiches sans email)** — retour Fathi : « et ceux sans email, ça reste des doublons ? ». Réponse : à l'**envoi**, aucune : les sans-email sont écartés par `planRecipients` → jamais d'outbox. À l'**affichage**, oui, car sans email pas de clé fiable. **Choix Fathi : dédup de secours nom+entreprise.** Ajouté : `dedupeContacts` (`execution-rules.ts`, email prioritaire sinon `nom|entreprise` normalisés) utilisé par `prospectsForAction` ; `lib/dedupe-prospects.ts` (`dedupeByEmail`) étendu avec la même clé de secours (`dedupeKey`). Ni email ni nom → conservé. Compromis assumé : peut fusionner deux homonymes de la même société. Tests +2 (execution-rules, dedupe-prospects) ; test existant renommé (« sans email ni nom »).
- **Validé côté Fathi (Windows)** : commit `a05d8a8` **poussé**, `npm test` **62/62**, `npm run build` **vert** (route `/campagnes` présente). Correctifs confirmés.
- **Reste** : Fathi — re-tester à l'usage : ré-exécuter une **nouvelle** relance validée → outbox sans doublons ; vue Prospects → les fiches sans email en double (même nom+société) regroupées. NB : la vraie **fusion** des doublons de `prospects` reste la proposition `dedupe_emails` (Phase 3) ; ici on protège l'envoi et on nettoie l'affichage. (Warnings build LF→CRLF et MODULE_TYPELESS_PACKAGE_JSON = inoffensifs ; option future `"type":"module"` dans package.json.)

### 2026-07-23 — Claude (Cowork) — ads → propositions d'action + exécution mode sûr
- **Boucle bouclée** : les constats de campagnes deviennent des **propositions d'action** dans la file de validation, exécutables via la colonne vertébrale Phase 3 (mode sûr).
- **`buildAdsProposals`** (`lib/ads/metrics-rules.ts`, pur) : propose de **couper les campagnes en perte** (ROAS < 1 ET dépense ≥ 50 €). Action **réversible/faible risque**. `kind` unique par campagne `ads_pause_<campaign_id>` (dédup). Payload = campagne + ROAS + dépense.
- **`lib/ads/analysis.ts`** (`runAdsAnalysis`) : lit `ad_metrics`, rollup+KPI, insère les propositions dans `actions` (dédup par kind, statut `proposed`, journal `action_proposed` acteur agent). Branché dans **`analyzeNow`** (le bouton animé « Analyser » couvre prospects + ads) **et** bouton dédié **« Analyser mes campagnes »** sur `/campagnes` (`analyzeAdsForm`/`analyzeAdsNow`).
- **Exécution ads mode sûr** (`lib/execution.ts`) : `executeApprovedAction` accepte désormais les kinds `ads_pause_*` — mêmes garde-fous (pause org, idempotence, journal avant) puis **enregistre le changement voulu** (journal `execution_succeeded` payload `intended: pause_campaign`, note « mode sûr — préparé, non appliqué »), statut `executed`, **AUCUN appel externe**. L'API Meta réelle se branchera exactement ici.
- **UI** : `decisions-history.tsx` — `isExecutable` couvre relance **et** `ads_pause_*` → bouton **Exécuter** sur une proposition ads validée.
- **Tests** : `buildAdsProposals` (seuil dépense, perte only). **58/58**.
- **Vérif** : `npm test` **58/58**. ⚠️ `tsc` sandbox **non bouclé ce tour** (environnement saturé, dépassements 43 s même sur `lib`) — pas des erreurs ; nouveaux fichiers ads purs exercés par les tests, fichiers à alias `@/` (analysis/seed/execution + câblage app) **relus à la main** (types cohérents, plus aucune réf `isRelance` cassée). **`next build` côté Fathi** = juge final (process habituel).
- **Flux démo complet** : `/campagnes` → Charger démo → **Analyser mes campagnes** → une proposition « Mettre en pause Notoriété Reels » apparaît sur **Aujourd'hui** → Valider → **Exécuter** (mode sûr : changement enregistré, journalisé, rien d'appliqué) ; bouton d'arrêt bloque l'exécution.
- **Reste** : Fathi — migrations 0003→0007 dans Supabase, `git push`, `npm run build`. **Étape suivante ads** : API Insights Meta réelle (remplace `mockMetaCampaigns`) ; puis appliquer réellement la pause via l'API (étape B, garde-fous).

### 2026-07-23 — Claude (Cowork) — connecteur ads (Meta Ads) en données fictives + vue Campagnes
- **Décision Fathi** : attaquer un connecteur de **stats de campagnes payantes**. Choix (après recherche web sur les bacs à sable) : **Meta Ads** (Development Mode + comptes de test = meilleur sandbox, sans dépense ; GA4 démo **non** utilisable via API ; Google Ads test = zéro métrique + jeton à approuver). Approche : **données fictives d'abord**, l'API réelle branchée derrière la même interface ensuite. Lecture seule, métriques **vente/revenu** (ROAS/CAC/conversions), pas de vanité.
- **Migration `0007_ad_metrics.sql`** : table `ad_metrics` (org+provider+campaign+date, impressions/clics/dépense/conversions/revenu), idempotence `unique(org,provider,campaign,date)`, RLS select `is_member`. **À exécuter dans Supabase (Fathi).**
- **`lib/ads/metrics-rules.ts`** (pur, testable) : `deriveKpis` (ROAS, CAC, CTR, CVR, CPC — divisions sûres), `rollupByCampaign`, `aggregate`, `buildAdsFindings` (campagne en perte ROAS<1, meilleure campagne, CAC global).
- **`lib/ads/mock-provider.ts`** (pur, déterministe) : `mockMetaCampaigns(7)` = 4 campagnes × 7 jours, profils calibrés (retargeting ROAS ~4,5 · prospection ~2,4 · lead ~1,6 · **notoriété en perte ~0,6**), jitter pseudo-aléatoire semé (reproductible).
- **`lib/ads/seed.ts`** : `seedMetaAdsDemo` upsert idempotent + journal `ads_demo_loaded`. Action `loadAdsDemo` (`app/(cockpit)/campagnes/actions.ts`).
- **Vue `/campagnes`** : KPIs globaux (dépense, revenu, ROAS coloré, CAC), constats de l'agent (perte/meilleure/CAC), tableau par campagne (ROAS vert/rouge, CAC, CTR), état vide avec bouton « Charger des données de démo (Meta Ads) ». **Nav « Campagnes » activée** (était Phase 4).
- **Tests** : `tests/ads-metrics.test.mjs` (6 : KPI, rollup, aggregate, findings, mock déterministe/cohérent). **57/57**.
- **Vérif** : `npm test` **57/57** ; `tsc` ciblé complet **exit 0 (28,5 s)**.
- **Reste** : Fathi — migration **0007** dans Supabase, `git push`, `npm run build`, puis `/campagnes` → « Charger des données de démo » → KPIs + constats. **Étape suivante ads** : brancher l'**API Insights Meta réelle** derrière `ad_metrics` (app Meta en Development Mode, jetons chiffrés, `mockMetaCampaigns` → vrai fetch) ; plus tard, proposer des actions (couper une campagne en perte) via la file de validation + exécution Phase 3.

### 2026-07-23 — Claude (Cowork) — PHASE 3 étape A : colonne vertébrale d'exécution (mode sûr)
- **Décision de Fathi** : passer à la Phase 3 (l'agent *agit*, pas seulement propose). Attaqué par la **colonne vertébrale sûre**, PAS l'envoi externe. `CLAUDE.md` « Phase actuelle » mis à jour (Phase 3 étape A, mode sûr ; étape B = SMTP, gardée).
- **Non négociables respectés** : idempotence + journal **AVANT** exécution ; garde-fous **serveur** (plafonds) ; **bouton d'arrêt**.
- **Migration `0006_execution.sql`** : `organizations.execution_paused` (bouton d'arrêt) + table `outbox_messages` (message préparé par destinataire, statut `prepared|sent|failed`, `idempotency_key` unique, RLS select `is_member`, écriture service-role). **À exécuter dans Supabase (Fathi).**
- **`lib/execution-rules.ts`** (pur, testable) : `guardExecution` (pause > déjà exécutée > pas validée), `planRecipients` (filtre sans-email + plafonds `MAX_PER_RUN=50`/`MAX_PER_DAY=200`), constantes.
- **`lib/execution.ts`** (`executeApprovedAction`) : charge action + org, `guardExecution` (sinon journal `execution_blocked`), pose `idempotency_key=exec:<id>` + journal `execution_started` **avant**, sélectionne les destinataires (relance priorité / statut), compte l'envoi du jour, `planRecipients`, construit le message par destinataire (brouillon par prospect `payload.prospect_drafts[id]` sinon brouillon de groupe + **prénom réel** via `applyFirstName`), **upsert `outbox_messages` statut `prepared`** (anti-doublon `onConflict idempotency_key ignoreDuplicates`), statut action `executed` + journal `execution_succeeded` (ou `failed`). **Aucun envoi externe.**
- **Actions** (`app/(cockpit)/actions.ts`) : `executeAction(id)` (retour `ExecutionResult`), `executeActionForm` (bouton), `toggleExecutionPause(paused)`. `revalidatePath("/")`.
- **UI** : bouton **Exécuter** sur les actions **validées** de relance (`decisions-history.tsx`, + badges `Exécutée`/`Échec`) ; interrupteur **Exécution active/en pause** (`execution-switch.tsx`) dans l'en-tête « Décisions récentes » (lu depuis `organizations.execution_paused`). Libellés journal `execution_*` ajoutés.
- **Tests** : `tests/execution-rules.test.mjs` (8 : guard approved/paused/executed, plafonds run/jour, sans-email). **51/51**.
- **Vérif** : `npm test` **51/51** ; `tsc` **lib complet exit 0 (36 s)** (couvre `execution.ts`) ; ⚠️ `tsc` ciblé complet (lib+app) **non bouclé ce tour** (sandbox lent, dépassements 43 s) → câblage app relu à la main (types cohérents, tokens couleur `bg-green/red` existants et déjà utilisés). **`next build` côté Fathi** confirmera (process habituel).
- **Reste** : Fathi — migration **0006** (+ 0003/0004/0005) dans Supabase, `git push`, `npm run build`. Démo : valider une relance → **Exécuter** → messages préparés dans l'outbox (aucun envoi) ; tester le **bouton d'arrêt** (en pause → Exécuter bloqué, journal `execution_blocked`). **Étape B** : envoi SMTP réel derrière la même colonne vertébrale (choix serveur SMTP, creds chiffrés, `outbox` `prepared`→`sent`).

### 2026-07-22 — Claude (Cowork) — prénom réel + notes éditables dans Nepteo
- **Build Windows confirmé vert** par Fathi (Next 16.2.10, TypeScript 13,6 s, 18 routes) — valide toute la session côté prod.
- **Prénom réel dans les brouillons par prospect** : `firstName` + `applyFirstName` (purs, `draft-template.ts`) remplacent `{prénom}` par le 1er mot du nom (variantes accent/casse, multi-occurrences). Appliqué dans `draftForProspect` **après** génération (on connaît le destinataire). Le message de **groupe** garde `{prénom}` (destinataire inconnu). Variante « Monsieur/Madame Nom » = **non faite** (demande une civilité/genre → à mapper plus tard comme les notes ; noté).
- **Notes éditables DANS Nepteo** : **migration `0005_prospect_note_internal.sql`** (`note_internal text`) — colonne **jamais écrite par le sync** (l'upsert ne liste pas la colonne → conservée à chaque resync). Distincte de la colonne `notes` mappée depuis la source. Action `saveProspectNote(prospectId, note)` (journal `prospect_note_saved`). UI : zone « Ma note sur ce prospect » dans chaque ligne de `prospect-drafts.tsx` (Enregistrer, désactivé si inchangé). `draftForProspect` **réunit** notes source + note interne pour la personnalisation. `prospectsForAction` renvoie la note + `hasNotes` tient compte des deux.
- **Bidirectionnel** (Nepteo → source) = **Phase 3** (écriture externe, garde-fous) — noté, pas construit.
- **Vérif** : `npm test` **43/43** (firstName/applyFirstName ×4) ; `tsc` ciblé complet **exit 0 (32,7 s)**.
- **Reste** : Fathi — migration **0005** (+ 0003/0004) dans Supabase, `git push`, `npm run build`. Backlog : civilité « M./Mme » (mapper une colonne), enrichissement internet, contexte « toutes colonnes » Notion.

### 2026-07-22 — Claude (Cowork) — perso par prospect : UI (liste + brouillon individuel)
- **Suite du backend perso** : brancher la personnalisation par personne dans le tiroir d'une relance. Phase 2 (prépare, n'envoie rien).
- **Actions** (`app/(cockpit)/actions.ts`) : `prospectsForAction(id)` → liste les prospects ciblés (relance priorité = `prospectPriority.tier==='priority'` ; `relaunch_stage_*` = même statut que `payload.stage`), max 25, avec `hasNotes`/`hasDraft`. `draftForProspect(actionId, prospectId, regenerate?)` → brouillon individuel via `draftRelanceForProspect` (notes + toutes colonnes du prospect), **idempotent** (cache `payload.prospect_drafts[prospectId]`), journal `draft_prepared`.
- **UI** : `_components/prospect-drafts.tsx` (client) — liste dépliable des contacts ciblés, badge « Notes » si le prospect en a, brouillon généré **à la première ouverture** de chaque ligne, Copier/Régénérer. Branché sous la section brouillon de groupe dans `validation-queue.tsx` (section « Personnaliser par prospect »).
- **Vérif** : `npm test` **39/39** ; **`tsc` ciblé complet (lib+app+components) exit 0 en 27,7 s** (sandbox rétabli) — **confirme aussi rétroactivement le câblage `notes` du backend du tour précédent** (tout le graphe compile). `next build` côté Fathi.
- **Reste** : Fathi — migrations **0003 + 0004** dans Supabase (sinon la lecture de `notes`/`briefings` échoue), `git push`, `npm run build`. Puis démo : ouvrir une relance → « Personnaliser par prospect » → déplier un contact avec des notes → message individualisé. Backlog : enrichissement internet (choix LLM/outil) ; contexte « toutes colonnes » pour Notion (raw typé).

### 2026-07-22 — Claude (Cowork) — perso par prospect : champ Notes + brouillon individuel (backend)
- **Demande Fathi** : personnaliser le message par prospect à partir de **toutes ses colonnes** + un champ **Notes** dédié (notes perso sur le client). Enrichissement via internet (Perplexity…) = **backlog explicite, pas construit** (à trancher : quel LLM/outil). Session = **backend d'abord**.
- **Champ Notes mappé (5e champ Nepteo)** : `PROSPECT_FIELDS` + `NormalizedProspect.notes` (`common.ts`) ; auto-détection (`notes|remarque|commentaire|comment`) + extraction dans `google-sheets.ts` et `notion.ts` ; **migration `0004_prospect_notes.sql`** (`alter table prospects add column if not exists notes text`) ; `FIELD_LABELS.notes = "Notes"` (l'écran de mapping l'affiche automatiquement, il itère `PROSPECT_FIELDS`). Le sync propage `notes` via le spread `...p` (aucune autre modif). **À exécuter dans Supabase (Fathi).**
- **Brouillon par prospect** : `renderProspectContext` (pur, `draft-template.ts`) = nom + entreprise + statut + **notes perso** + **toutes les colonnes brutes** non vides (borné : 12 champs, valeurs tronquées à 120, dédup des valeurs déjà citées). `draftRelanceForProspect` (`draft.ts`) injecte ce contexte au prompt (`draft_email`, `withLlmTrace`, repli gabarit). ⚠️ **Limite connue** : pour Notion, `raw` contient des objets typés (pas des chaînes) → `renderRaw` ne pioche que string/number ⇒ Sheets = toutes colonnes, Notion = champs mappés + notes seulement (améliorable plus tard).
- **Pas encore d'UI** : la fonction par prospect existe mais n'est pas branchée dans le tiroir (liste des prospects ciblés + brouillon individuel) — prochaine étape UI si Fathi valide.
- **Tests** : `renderProspectContext` (3 : nom/notes/colonnes, vide, dédup valeur) + notes auto-détection Sheets/Notion. **39/39**.
- **Vérif** : `npm test` **39/39**. ⚠️ **tsc non bouclé dans le sandbox ce tour-ci** : coût de démarrage tsc ~18 s (mesuré) + graphe → dépassements répétés du plafond 44 s, y compris sur `lib` seul (surcharge environnement, PAS des erreurs). Validé ce qui était isolable : **`draft-template.ts` type-check propre (exit 0)**. Câblage `notes` dans les fichiers à alias `@/` = additif et relu à la main (types cohérents : `FieldMapping` Partial couvre `notes`, `NormalizedProspect.notes` renseigné par les deux fetchs, `FIELD_LABELS` complété). **`tsc` complet + `next build` à faire côté Fathi (Windows)** — conforme au process habituel.
- **Reste** : Fathi — migration 0004 (+ 0003) dans Supabase, `git push`, `npm run build` (confirme le tsc complet). Puis, si OK : UI liste prospects + brouillon individuel ; backlog enrichissement internet (choix LLM/outil).

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
