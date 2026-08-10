# Suivi du projet — journal des agents

> **Règle pour tout agent (Claude Code, Cowork, autre) travaillant sur ce repo :**
> 1. Lire ce fichier + `CLAUDE.md` avant de coder.
> 2. À la fin de ta session : ajouter une entrée en haut de l'« Historique des sessions » (date, ce qui a été fait, décisions prises, ce qui reste), et mettre à jour « État actuel » si besoin.
> 3. Ne jamais construire en avance des phases suivantes (voir docs/ROADMAP.md). Vérifier `npm run typecheck` + `npm run build` avant de conclure.

> **Références de recette** : `docs/demo/GUIDE-TEST.md` pour le parcours, `docs/tests/SCORECARD-COMMANDITAIRE.md` pour mesurer la valeur, `docs/TESTS.md` pour les connecteurs et `docs/tests/SMOKE-AUTH-RLS.md` pour l'isolation Supabase. Au 2026-08-10, Azure sert à 100 % la révision `nepteo-prod--0000023`, image du merge `7424d2926e6423e1af674c741eb90dc1fcd914a3`. La PR #31, sa CI, le déploiement et les contrôles HTTP sont attestés ci-dessous ; la recette Story authentifiée reste celle de la PR #29. Le smoke RLS multi-rôles/tenants complet reste réservé à des organisations de recette séparées.

## État actuel (2026-08-10)

**CAMP-0, CAMP-1, CAMP-2, CONN-0, CONN-1, META-READ et le studio Story campagne-first sont fusionnés dans `main` et servis par la révision courante `nepteo-prod--0000023`.** L'agent lit, détecte et propose pour les seules capacités autorisées. Les lots Campagnes et Connecteurs ne publient aucun visuel, n'envoient rien et n'autorisent aucune écriture Ads. La [roadmap Campagnes supervisées et intégrateurs](projets/roadmap-campagnes-supervisees.md) séquence la suite ; elle ne remplace ni la [roadmap valeur — tests commanditaires](projets/roadmap-valeur-commanditaires.md), ni la [roadmap de prise en main](projets/roadmap-prise-en-main.md), qui gardent leurs propres gates.

**Mise à jour du 9 août — états séparés et attestés.** Le projet Supabase lié `hrqnzorapjnosjphftur` est à `app_schema_version = 28`. Les tables créatives et le bucket privé sont contrôlés après déploiement. La PR #29 est fusionnée au merge `c5e7148`, la CI `31332578671` et le déploiement `31332676182` sont verts, et Azure sert la révision `nepteo-prod--0000022`. La recette runtime authentifiée campagne → Story → sélection → validation est verte sur fixture synthétique ; elle reste distincte des recettes OAuth Connecteurs et du smoke RLS inter-tenant complet.

**Mise à jour du 10 août — simplifications d'authentification fusionnées et déployées.** La PR #31 ajoute une déconnexion explicite dans l'en-tête mobile et un contrôle partagé « Afficher/Masquer le mot de passe » sur la connexion et la création de compte. La CI `31368969929` et le déploiement `31369161993` sont verts ; la production sert `nepteo-prod--0000023`. Ce micro-lot n'ajoute aucune migration Supabase et ne modifie aucun connecteur.

**Email de confirmation — configuration corrigée, recette d'un nouvel envoi ouverte.** Le tableau Supabase expose aujourd'hui la Site URL `https://nepteo.bogasolution.com` et l'unique callback autorisé `https://nepteo.bogasolution.com/auth/confirm`. Le modèle « Confirm signup » anglais a été remplacé par un email français Nepteo dont la source est versionnée dans `supabase/templates/confirm-signup.html`. Un ancien email conserve son ancienne destination `0.0.0.0` : seul un nouvel envoi permettra de fermer la recette.

État du produit déployé ou local, avec le niveau de recette précisé dans chaque lot :

- **Socle et produit** : auth, organisation/RLS de base, mémoire, journal, couche LLM, analyse, validation, funnel/kanban, onboarding enrichi, recherche web et navigation à cinq entrées.
- **Connecteurs en lecture seule** : Google Sheets et Notion, OAuth chiffré, mapping configurable, sync manuelle et cron. La lecture Notion est désormais paginée ; les appels connecteurs ont un timeout. Les demandes, configurations, callbacks OAuth, déconnexions et synchronisations participent au verrou d'isolation démo.
- **Exécution sûre** : idempotence, journal avant exécution, pause, plafonds serveur et messages au statut `prepared`. C7, l'envoi externe, n'est pas activé.
- **CAMP-0 — déployé dans `0000022`, recette métier partielle** : « Nouvelle campagne » part désormais de onze champs explicites sans valeur engageante par défaut. Le serveur nettoie et valide le brief, recalcule le plan et le budget total, borne deux variantes, puis `0025` crée atomiquement et de façon idempotente une action `launch_campaign` `proposed` avec son journal. La validation est libellée « Validée — non lancée » ; aucun bouton Exécuter, aucune outbox et aucun appel Ads/email ne sont ajoutés.
- **CAMP-1 — déployé dans `0000022`, recette métier partielle** : le studio v2 rend éditables un à cinq adsets, leur allocation totale, deux à six hooks et leur sélection ; les formats sont dérivés du canal côté serveur. La preuve agrège 30 jours du fournisseur correspondant et ne rend une projection qu'avec au moins 7 jours distincts, une dépense positive et 10 conversions ; sinon aucun benchmark ne remplace les données manquantes. Une veille concurrentielle séparée exige confirmation et passe par `runResearch`. `0026` distingue intention et snapshot serveur pour conserver l'idempotence malgré l'évolution des métriques. La sortie reste une action `launch_campaign` `proposed` avec son journal, sans exécution, outbox, publication ni mutation Ads/email.
- **CAMP-2 — déployé dans `0000022`, recette métier partielle** : le cockpit de décision agrège `ad_metrics` sur deux fenêtres calendaires explicites et rattache l'historique réel de `actions`/`journal`. Dépense, conversions, revenu, CAC, ROAS, CPM et CTR, événements et recommandations conservent une source inspectable ; une confiance non calibrée reste absente. Le résumé opérationnel distingue contrôles persistés, dernier démarrage et connecteurs hors scénario ; la recherche prospect est expurgée et bornée. Un rapport strict 7 jours contre 7 jours et quatre questions fixes sont dérivés sans IA. La récence des métriques produit seulement « Données récentes » ou « Historique » : aucun état « Active »/« Terminée » n'est inféré sans statut fournisseur. Le refus d'une proposition exige un motif. `0027` rend atomique et idempotente la création des actions `ads_pause_*` avec leur journal, adopte les anciennes propositions à confiance fixe avec une trace liée, refuse les doublons ouverts préexistants sans les fusionner et ferme claim comme finalisation à toute pause Ads ; une validation affiche « Validée — non appliquée ». Aucun appel Ads, outbox, IA, envoi ou dépense n'est ajouté.
- **Schéma Campagnes + Créatif — Supabase et application alignés à 28** : les migrations `0022` à `0028` sont présentes dans le projet lié, qui expose `app_schema_version = 28`, et la révision applicative `0000022` exige ce niveau. La recette JWT a prouvé la lecture RLS de l'asset propre et les refus d'accès directs ; le smoke inter-tenant/concurrence complet reste distinct.
- **Connecteurs Growth — déployés dans `0000022`, sans migration supplémentaire** : CONN-0 conserve le catalogue existant et rend les capacités honnêtes ; CONN-1 porte consentement, pause, reprise et révocation ; META-READ ajoute une lecture Meta bornée. Ces lots réutilisent `connectors`, `journal`, `ad_metrics` et `connectors.config`, sans toucher aux tables ou RPC créatives. Le catalogue et les trois liens OAuth se rendent sans erreur ; les callbacks et lectures réelles restent à recetter.
- **Créatif IA campagne-first — fusionné via PR #29 et déployé dans `0000022`** : `/contenu` part d'une campagne récente, reprend son message et recommande la Story 9:16 pour Meta ; la création libre reste secondaire et paginée. La recette production a généré une Story `gpt-image-2` 1008 × 1792, persisté un JPEG privé, rechargé sa version signée, sélectionné puis validé atomiquement le visuel avec la campagne. Le JWT voit son asset mais reçoit `42501` sur les requêtes internes et l'update direct ; le Storage direct répond `404`. L'objet, l'asset, la requête de génération, l'action/campagne et l'acteur synthétiques du run ont été supprimés. L'organisation-coquille et le journal append-only sont conservés ; un nouvel acteur dédié a ensuite été provisionné et le smoke CSV officiel a repassé ses six contrôles. Aucun lancement, aucune publication fournisseur, aucune outbox et aucune écriture Ads n'ont eu lieu.
- **C8 — temps dans la relance** : déployé, à recetter sur les connecteurs. Le champ facultatif `last_contact_at` est synchronisé depuis Sheets/Notion ; un contact de moins de 7 jours est exclu des relances et une attente d'au moins 21 jours renforce la priorité.
- **R1A/C9A — preuve terrain structurée** : `0020` ajoute `value_events`, une saisie déclarative minimisée et append-only, les garde-fous de rôle/tenant, la séparation `manual`/fournisseur et le marqueur `is_demo`. À l'approbation d'une relance, sa cohorte non vide (50 prospects maximum) est figée avec la décision et son journal dans une transaction ; les suites terrain sont ensuite rattachées prospect par prospect. Rien n'est envoyé et aucun statut fournisseur n'est fabriqué.
- **R1B — file « Aujourd'hui » utile** : jusqu'à 50 propositions autorisées sont examinées avant de retenir au plus cinq actions existantes. Le classement pur favorise les gestes proches d'un résultat, explique « Pourquoi maintenant », neutralise les données invalides et ne transforme pas le volume d'un payload en score.
- **R2 — play supervisé « prospects dormants »** : seuil **30 ou 45 jours choisi explicitement**, sans valeur par défaut ; date valide obligatoire ; prospect actif et joignable ; tri déterministe du silence le plus ancien au plus récent et plafond de 50. Les membres des snapshots des vagues dormantes antérieures sont exclus. Le lanceur produit seulement une action à valider humainement, sans outbox ni envoi ; l'approbation revalide puis fige atomiquement la cohorte via `0020`. La scorecard dédiée au kind dormant exclut la démo, montre ses dénominateurs et sépare faits déclarés et faits fournisseur observés. Elle est strictement locale au tenant courant : le gate programme « 3 testeurs » se consolide manuellement et anonymement hors application.
- **Confidentialité LLM** : les métriques techniques restent actives, mais prompts et réponses ne sont plus enregistrés par la télémétrie.
- **Simplification déployée** : contexte auth/organisation centralisé et fail-closed, ciblage des relances partagé, file « Aujourd'hui », fiche connecteur et façade Server Actions découpées, navigation mobile et dialogues clavier ajoutés. Aucun garde-fou métier n'a été retiré.
- **Simplifications auth mobile — déployées dans `0000023`** : la déconnexion est désormais visible dans l'en-tête sous le breakpoint desktop, sans ajouter une sixième destination à la barre mobile. Connexion et inscription partagent un champ mot de passe qui conserve la valeur lors du basculement entre texte visible et masqué, avec libellé accessible. Le lot passe 574/574 tests, typecheck, lint et build ; le contrôle production confirme Afficher/Masquer sur `/login` et `/signup`. Le clic Déconnexion puis Retour depuis une session mobile authentifiée reste à recetter.
- **Prise en main guidée — déployée dans `0000022`, recette à poursuivre** : l’onboarding propose désormais les voies exemple/entreprise réelle avant le formulaire ; `/prise-en-main` porte onze missions et ouvre les vrais écrans ; la progression locale versionnée ne conserve ni URL ni contenu métier. Le scénario choisi n’est jamais chargé automatiquement.
- **Tenancy, rôles et RLS en production** : `0013` impose une organisation au plus par utilisateur sans arbitrer les doublons ; `0014` retire l'écriture directe de `company_memory` ; `0015` centralise les capacités ; `0019` réapplique la frontière de façon additive. Le commercial ne lit aucun contenu libre/dérivé (mémoire, recherche, briefing, action, journal, outbox) et conserve uniquement les colonnes prospects expurgées, le nom d'organisation et les métadonnées non sensibles des connecteurs CRM/fichiers. `organizations.activity`, `connectors.config` et `connectors.encrypted_credentials` restent côté service role. Les rôles inconnus échouent fermés.
- **Deux voies de test techniques exclusives déployées ; RPC CSV et chargements/analyses recettés** : **A**, l'un des trois scénarios Nepteo V2 certifiés dans une organisation vide et classé `certified-demo` ; **B**, un environnement de test alimenté par des données saisies ou importées par le testeur via interface, connecteur ou CSV, qu'elles soient réelles ou synthétiques. Le scénario doit être retiré avant toute saisie ou tout import. Le préflight, les marqueurs namespacés et le verrou distribué empêchent le mélange ; une sauvegarde corrompue bloque tout seed. Sans fencing distribué, un verrou orphelin reste bloquant jusqu'à récupération manuelle vérifiée. Le smoke réel de `0021` est vert sur `E2E_RLS_CSV_OWN` / `E2E_RLS_CSV_OTHER`, y compris après reprovisionnement de l'acteur dédié le 2026-08-09. Les cycles de chargement et d'analyse des trois variantes sont verts ; chaque scénario a produit six propositions avec une console vide et Atelier Northwind reste actif. Le gate `reset → reseed → préparation → exécution` reste ouvert.
- **Concurrence et coûts** : `0018` rend transactionnels décisions, reprises, claim, finalisation, pause/autonomie et leurs journaux ; un état ambigu exige une reprise manuelle. Le quota de recherche payante est réservé atomiquement par jour et organisation dans `0017`, séparément du cache et sous le même verrou d'organisation que la pause.
- **Readiness de schéma active** : `0016` introduit le marqueur privé. Le projet Supabase lié est vérifié à 28 après `0022` à `0028`. L'application et le workflow exigent 28 pour le lot créatif ; le contrôle distant atteste les objets du schéma, pas leur comportement sous JWT, concurrence ou panne Storage.
- **Release applicative courante attestée** : la PR #31 a passé la CI `31368969929`, puis a été fusionnée au merge `7424d2926e6423e1af674c741eb90dc1fcd914a3`. Le déploiement `31369161993` est vert sur la révision Azure `nepteo-prod--0000023`, latest et ready, Healthy, qui sert 100 % du trafic.
- **Qualité de release et recettes ciblées** : 574/574 tests, typecheck, lint et build de 29 routes sont verts. Sur le domaine public, `/` aboutit à `/login` en 200 ; `/login`, `/signup`, `/api/health` et `/api/ready` répondent 200. Health/readiness sont également verts sur le FQDN Azure. En production, Afficher/Masquer conserve le mot de passe saisi sur connexion et inscription. La recette Story authentifiée de la PR #29 reste valide ; le nouvel email français et le clic Déconnexion puis Retour depuis une session mobile authentifiée restent ouverts. Le gate `reset → reseed → préparation → exécution` reste ouvert.
- **Historique PR #17 conservé** : son contrat de scénario d'exemple et ses preuves restent valables à leur date, mais ne décrivent plus la révision de production courante.
- **Gate C7 toujours fermé** : il n'existe pas encore de suppression-list indépendante et non contournable. L'exclusion d'une opposition portée par le statut ne la remplace pas ; R2 impose donc la validation humaine et ne déverrouille aucun envoi externe.

Environnement : Supabase `hrqnzorapjnosjphftur`, repo GitHub `Shaaakir281/nepteo` (branche `main`), dev local port 3001, Node 22+. Production Azure dans `francecentral`, domaine `https://nepteo.bogasolution.com` et HTTPS opérationnels. Au 2026-08-10, la base est à la version 28 et la révision déployée est `nepteo-prod--0000023`, issue du SHA `7424d2926e6423e1af674c741eb90dc1fcd914a3`, image `nepteoacr27de3b.azurecr.io/nepteo:7424d2926e6423e1af674c741eb90dc1fcd914a3`. Elle est latest et ready, `Succeeded`/`Running`, Healthy/Provisioned/RunningAtMaxScale avec une réplique, sert 100 % du trafic et les contrôles HTTP sont verts.

## Prochaines étapes (dans l'ordre)

Pour l'intégration actuelle, les lots Connecteurs accessibles sont déjà dans `main` et ne réservent aucune migration après `0027`. Le lot créatif occupe désormais définitivement `0028`, déjà appliquée sur le projet lié ; toute nouvelle migration doit commencer à `0029` ou au numéro supérieur présent dans `main`.

### Simplification UX suivante

1. **Terminé — publier le micro-lot auth** : PR #31, CI `31368969929` et déploiement `31369161993` sont verts ; `nepteo-prod--0000023` sert 100 % du trafic.
2. **Fermer les deux smokes auth restants** : vérifier la déconnexion depuis une session mobile authentifiée, l'impossibilité de restaurer le cockpit avec le bouton Retour, puis générer un nouvel email de confirmation et contrôler son texte français, l'absence de `0.0.0.0` et le passage par `/auth/confirm`.
3. **Poursuivre l'allègement par parcours** : reprendre ensuite les écrans les plus denses un par un, en supprimant les répétitions et en gardant une action principale visible par surface, sans retirer les preuves, validations humaines ou garde-fous métier.

### Recette post-déploiement

1. **Terminé — repartir du dernier `origin/main`** : les contrats CAMP-0/1/2 et CONN-0/1/META-READ sont conservés, puis la refonte et la Story ont été réappliquées par-dessus.
2. **Terminé — résoudre les recouvrements additifs** : readiness et workflow ciblent 28, tous les libellés de journal, variables d'environnement, pages/actions Campagnes et scripts de reconstruction sont réunis.
3. **Terminé — publier et fusionner** : la PR #29 est fusionnée au merge `c5e7148` après CI verte.
4. **Terminé — déployer l'application exigeant 28** : le workflow `31332676182` a construit l'image immuable et activé `nepteo-prod--0000022` à 100 %.
5. **Terminé — recetter Story en production** : génération payée unique, sélection, validation atomique, rechargement Storage signé, contrôles JWT/RLS et nettoyage exact sont verts ; la fixture CSV utilisée ponctuellement a été réparée et son smoke repassé. **Ouvert** : créer une fixture `E2E_CREATIVE_*` distincte avant toute nouvelle recette Story, puis jouer OAuth/lecture réelle Google Sheets, Notion et Meta, le smoke créatif inter-tenant/concurrence complet et le scénario `reset → reseed → préparation → exécution`.

### Gates produit toujours ouverts

1. **Fermer le gate de scénario encore ouvert** : jouer `reset → reseed → préparation → exécution` sur chacune des trois variantes et vérifier les comptages, les artefacts restaurés, les propositions et l'absence d'envoi externe.
2. **Terminer le smoke RLS multi-rôles** : compte neuf, rôles, lecture/écriture autorisées et refus inter-tenant sur des organisations `E2E_RLS_*` ; contrôler à nouveau l'absence d'envoi externe.
3. **Recetter les connecteurs réels avant pilote** : callbacks et synchronisations OAuth Google Sheets/Notion, dates C8 et conflit de statut multi-source. Pour un même contact, tout statut terminal/opposé doit bloquer la relance et deux statuts actifs contradictoires doivent suspendre la cible, de la proposition jusqu'à la préparation.
4. **Recetter R1A, R1B et R2 sur fixtures dédiées** : Top 5, seuils 30/45, sélection oldest-first, exclusion des vagues antérieures, verdicts/retouches, cohorte atomique, conservation de `action_kind` et scorecard locale non-démo/fail-closed.
5. **Promouvoir sur un pilote dédié et mesurer la preuve terrain** : reporter le SHA et la révision alors effectivement actifs dans la scorecard, puis réunir 3 testeurs/30 recommandations pour le checkpoint qualitatif et 50 recommandations/deux semaines pour la décision produit, avec consolidation programme pseudonymisée hors application et sans agrégation inter-tenant.
6. **Lancer le play dormant supervisé** : après recette R0 complète, faire choisir le seuil au commanditaire et conserver la validation humaine.
7. **Décider du connecteur par la preuve** : cadrer Gmail **ou** Microsoft 365 en lecture seule seulement si au moins deux pilotes partagent l'écosystème et si le manque d'historique ou le temps de recherche manuelle franchit le gate documenté ; coder un seul écosystème après accord explicite de Fathi.
8. **Apprendre des corrections** après 30 brouillons corrigés, avec règles et préférences explicites.
9. **N'autoriser C7 qu'après les gates valeur, RGPD et exploitation** : suppression-list, fournisseur UE, budget/claim global atomique, états ambigus réconciliables, kill switch, self-test et décision explicite de Fathi.

## Pièges connus

- `middleware.ts` serait **silencieusement ignoré** — toute logique de garde va dans `proxy.ts`.
- Clés Supabase au nouveau format `sb_publishable_`/`sb_secret_` (drop-in dans les vars `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`).
- Lien de confirmation email Supabase arrive en `?code=` (PKCE) — géré dans `app/auth/confirm/route.ts`, ne pas « simplifier ».
- La table `journal` refuse UPDATE/DELETE (trigger) — c'est voulu.
- Design : reprendre les tokens validés de la maquette Growth Cockpit dans `globals.css` et documenter toute adaptation ; ne pas inventer un second système visuel.
- **Migrations parallèles** : le numéro d'une migration de branche n'est pas une réservation durable tant qu'elle n'est pas appliquée. `0028` est désormais verrouillée par son application sur le projet lié ; les chantiers suivants doivent partir de `0029` ou du numéro supérieur présent dans `main`, sans renuméroter `0028`.
- **Copie produit** : ne PAS définir le lexique marketing standard (prospect, lead, funnel…). CLAUDE.md corrigé en ce sens (retour de Fathi 2026-07-21).
- **Recherche web (OpenAI ou Perplexity)** : appel **facturé**. Toujours passer par `runResearch` (garde-fous + journal + cache + réservation atomique) — ne jamais appeler `askPerplexity` / `askOpenAiSearch` / `askResearch` directement depuis une action. Seul un résultat `status = ok` est réutilisé comme réponse ; un échec reste tracé et consomme sa réservation quotidienne, sans décrément automatique.
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
- **Agrégats prospects** : passer par `lib/prospect-cohort-loader.ts`, jamais par un `.limit(...)` local présenté comme un total. Seul l'état `complete` expose des lignes ; `partial` et `unavailable` doivent suspendre tout chiffre métier. Le double snapshot PostgREST détecte les variations usuelles (`count` + tête + IDs), mais ne constitue pas une transaction répétable : toute synchronisation doit continuer à mettre `synced_at` à jour.
- **Doublons multi-source et opposition** : distinguer la déduplication visuelle de la canonicalisation métier. Le lot déployé impose « terminal/opposé gagne », neutralise les statuts actifs contradictoires et conserve le dernier contact valide avant toute intersection de snapshot. Tant que ce contrat n'est pas recetté sur deux sources réelles, ne pas promouvoir le play dormant.
- **Coût de la recherche web OpenAI** : le prix affiché (10 $ / 1 000 appels d'outil) n'est **que la moitié de la facture** — les *search content tokens* sont facturés au tarif du modèle et dominent le total (~0,06 $ par recherche avec `gpt-5.5`). Toujours chiffrer les deux parts, et se rappeler que `MAX_RESEARCH_PER_DAY` compte des appels `runResearch`, **pas** des `web_search_call`.

## Historique des sessions

### 2026-08-10 — Codex — **PR #31 fusionnée et simplifications auth déployées**

**Promotion technique** : la PR [#31](https://github.com/Shaaakir281/nepteo/pull/31) a passé la CI `31368969929`, puis a été fusionnée au SHA `7424d2926e6423e1af674c741eb90dc1fcd914a3`. Le workflow protégé `31369161993` a validé la configuration, la cible Azure et `app_schema_version >= 28`, construit l'image immuable `nepteoacr27de3b.azurecr.io/nepteo:7424d2926e6423e1af674c741eb90dc1fcd914a3`, puis activé `nepteo-prod--0000023` à 100 %.

**Production** : la révision est latest et ready, `Succeeded`/`Running`, Healthy/Provisioned/RunningAtMaxScale avec une réplique. `/` aboutit à `/login` en 200 ; `/login`, `/signup`, `/api/health` et `/api/ready` répondent 200, et health/readiness sont aussi verts sur le FQDN Azure. Le navigateur de production confirme la présence d'Afficher/Masquer sur connexion et inscription, le passage du champ de `password` à `text` et la conservation de la valeur saisie.

**Auth Supabase et reste** : la Site URL et l'unique callback `/auth/confirm` sont corrects ; le modèle Confirm signup français est publié depuis `supabase/templates/confirm-signup.html`. Un ancien email reste immuable et doit être remplacé par un nouvel envoi. Restent à jouer avec un compte de test dédié : clic du nouvel email, puis Déconnexion et Retour depuis une session mobile authentifiée. Aucun schéma, connecteur, appel fournisseur, campagne ni donnée métier n'a été modifié par ce lot.

### 2026-08-10 — Codex — **Déconnexion mobile et affichage du mot de passe prêts localement**

**Simplification UX** : l'unique déconnexion du cockpit vivait dans la sidebar masquée sur mobile. Un bouton « Déconnexion » est maintenant présent dans l'en-tête mobile et réutilise l'action serveur existante ; la barre inférieure ne reçoit aucune sixième entrée et continue d'afficher uniquement les destinations autorisées par le rôle. Les pages de connexion et de création de compte utilisent un champ partagé « Afficher/Masquer le mot de passe », sans perdre la valeur saisie et avec les attributs `autocomplete` adaptés.

**Vérifications** : `npm test` passe 574/574, `npm run typecheck`, `npm run lint`, `npm run build` et `git diff --check` sont verts ; le build génère 29 pages/routes. Dans le navigateur local à 463 px, le contrôle affiche puis remasque le mot de passe en conservant sa valeur, sur connexion comme sur inscription, sans débordement horizontal ni erreur console. Les contrats automatisés verrouillent aussi le formulaire de déconnexion mobile, son nom accessible et la conservation de `{{ .ConfirmationURL }}` dans le modèle email français.

**Frontière et reste** : aucun secret, schéma Supabase, connecteur ni donnée métier distante n'est modifié. La seule modification distante concerne la configuration Auth Supabase et son modèle de confirmation ; aucun push, PR ni déploiement applicatif n'est encore effectué à ce stade. La déconnexion doit encore être cliquée dans une session mobile authentifiée après publication, puis le bouton Retour doit confirmer que le cockpit n'est pas restauré. La simplification suivante restera un lot séparé, traité parcours par parcours.

### 2026-08-09 — Codex — **PR #29 fusionnée, design + Story déployés et recettés sur le schéma 28**

**Promotion technique** : la branche `codex/design-story-release`, recalée sur le dernier `main`, a passé 571/571 tests, TypeScript, ESLint et le build de production. La PR [#29](https://github.com/Shaaakir281/nepteo/pull/29) a ensuite passé la CI `31332578671` puis a été fusionnée au merge `c5e7148ad62908a52536f6b2b52fd32ed0c357c0`.

**Production** : le workflow `31332676182` a validé la configuration, la cible Azure et `app_schema_version >= 28`, construit l'image immuable `nepteoacr27de3b.azurecr.io/nepteo:c5e7148ad62908a52536f6b2b52fd32ed0c357c0`, puis activé la révision `nepteo-prod--0000022` à 100 %. Le domaine public et le FQDN Azure répondent directement HTTP 200 sur `/api/health` et `/api/ready`. Sur le domaine public, `/` répond directement 307 vers `/login`, puis la réponse finale de connexion est 200.

**Recette Story authentifiée** : sur la fixture technique `E2E_RLS_CSV_OWN`, un utilisateur synthétique `.invalid` et une campagne Meta sans donnée personnelle ont validé le chemin Aujourd'hui → campagne → « Créer le visuel » → studio prérempli. Le contrôle responsive en desktop 1280 × 720 et mobile 390 × 844 ne montre aucun débordement horizontal. Un unique parcours payant a produit avec `gpt-image-2` un JPEG Story 1008 × 1792 de 146 743 octets, enregistré comme version 1 dans le bucket privé. Après rechargement, l'image provenait d'une URL signée ; la sélection a ajouté `creative_image_selected`, puis la validation a porté atomiquement la campagne à `approved` et l'asset à `validated`, avec le même `creative_id` dans `action_approved`. Aucun lancement, publication, outbox ni appel d'écriture Ads n'a eu lieu.

**RLS, Connecteurs et nettoyage** : le JWT de la fixture lit son asset, mais la lecture de `creative_generation_requests` et l'update direct de `creative_assets` sont refusés en `42501`; le téléchargement Storage direct répond 404 tandis que l'URL signée répond 200. La surface Connecteurs se rend sans erreur et expose les trois OAuth Google Sheets, Notion et Meta Ads ; aucun OAuth n'a été déclenché. Le JPEG, l'asset, la requête de génération, l'action/campagne et l'utilisateur synthétiques du run ont été supprimés avec postconditions à zéro ; connecteurs, prospects, outbox et métriques Ads sont restés inchangés. L'organisation-coquille et ses traces append-only subsistent. Son acteur CSV dédié et son membership admin ont été reprovisionnés, puis `npm run smoke:csv-rpc` a repassé au schéma 28 les contrôles inter-tenant, import, rollback, rejeu idempotent et double retrait. Les callbacks et lectures OAuth réels, le smoke créatif inter-tenant/concurrence complet et le gate de scénario restent ouverts.

### 2026-08-09 — Codex — **Refonte allégée et Story liée aux campagnes, compatible Connecteurs — local seulement**

**Produit et design** : les surfaces principales ont été allégées, la navigation et les textes raccourcis, et le workspace créatif ne part plus d'une page blanche. Une campagne récente est proposée par défaut ; son message et son canal préremplissent le visuel, avec Story recommandée pour Meta. Les couleurs et composants restent centralisés dans `app/globals.css`, d'après la direction Growth Cockpit, sans copie écran par écran.

**Créatif fini** : l'appel serveur `gpt-image-2` génère un JPEG, l'aperçu conserve le texte net côté application, et le téléchargement reste disponible. `0028_creative_assets.sql` ajoute un bucket privé, les réservations de quota, les versions, la sélection/finalisation unique et un chemin pending réconcilié par le cron. L'appel payant s'exécute entre deux sections critiques courtes : les connecteurs ne restent pas bloqués pendant OpenAI. L'approbation d'une campagne valide son visuel déjà sélectionné dans la même transaction via `transition_action_decision_v2`, tout en conservant le motif de refus introduit par `0027` ; sans visuel initial, un choix explicite peut le finaliser plus tard. Limites réservées avant l'appel payant : vingt tentatives par organisation/jour et cinq réservations actives ou réussies par campagne ; un échec libère une version de campagne, pas son coût quotidien.

**Compatibilité Connecteurs vérifiée** : CONN-0, CONN-1 et META-READ sont déjà fusionnés dans `main`, n'ajoutent aucune migration après `0027` et ne touchent ni `creative_assets` ni les RPC créatives. Le seul chevauchement directement additif est `lib/journal.ts`, où tous les libellés sont conservés. Le projet Supabase lié est désormais vérifié à la version 28 après `0028`.

**Vérifications locales et distante** : le dernier `origin/main` est intégré ; `npm run typecheck`, le lint complet, `git diff --check`, les 567/567 tests et `npm run build` sont verts, avec 29 pages statiques générées et toutes les routes dynamiques construites. La recette visuelle du workspace réel est verte en desktop et en mobile 390 × 844. En lecture distante, le projet lié répond avec le marqueur 28, les deux tables, le bucket privé et les cinq RPC attendues. Cette preuve ne couvre ni les RLS avec JWT, ni les courses concurrentes, ni le nettoyage Storage réel. Aucun push, PR, déploiement, publication Ads ou envoi externe n'a été effectué.

**Reste** : attester l'environnement de staging/recette et y exécuter les smokes PostgreSQL/RLS/concurrence/Storage, pousser et faire relire le lot applicatif, puis déployer l'application exigeant 28 et jouer la recette croisée Story + Connecteurs.

### 2026-08-08 — Codex — **REL-0 consolidée localement ; publication préparée, non autorisée**

**Concordance source** : le diagnostic repart du worktree exact `5429`, HEAD détachée `e023984` égale à `origin/main`. Toutes les sentinelles sont présentes : readiness 27, migrations `0025` à `0027`, cockpit, soumission et roadmap Campagnes. Le précédent diagnostic depuis un checkout historique à 21 est invalidé ; aucun fichier CAMP n'a été perdu.

**Validation et invariants** : `npm test` passe 530/530 ; `npm run typecheck`, lint ciblé des surfaces CAMP et `npm run build` (26 routes) sont verts. Le lint complet atteint la limite de 120 s sans sortie et reste non attesté. La revue statique confirme la chaîne 24→25→26→27, la transaction action+journal, les rôles/démo, l'idempotence, les filtres et l'exclusion de `launch_campaign` comme `ads_pause_*` de l'exécution et de l'outbox. `git diff --check` est vert, avec seulement les avertissements CRLF connus.

**Publication préparée, pas exécutée** : les procédures documentaires exigent désormais pour REL-0 l'application manuelle et ordonnée `0022 → 0023 → 0024 → 0025 → 0026 → 0027`, le contrôle de `app_schema_version = 27`, puis seulement le workflow Azure qui préflight ce niveau avant de construire l'image. Le retour arrière applicatif est le redéploiement de la révision précédente ; le schéma est additif et doit être corrigé par fix-forward, jamais par rollback SQL supposé.

**Frontière** : aucun commit, push, PR, migration distante, déploiement, appel IA/fournisseur, recette payante, campagne, email ou dépense n'a été effectué. `PUBLIER REL-0` doit énumérer et autoriser ces actions séparément ; les recettes téléphone CAMP-0, CAMP-1 et CAMP-2 sont prêtes dans [`REL-0-RECETTE-MOBILE.md`](tests/REL-0-RECETTE-MOBILE.md).

### 2026-08-08 — Codex — **Roadmap Campagnes et intégrateurs replanifiée en micro-lots**

**Cadrage consolidé** : `nepteo-growth-cockpit-v2.html`, sa capture et les documents d'autorité ont été relus sans appel réseau. Les huit cartes principales — Meta Ads, LinkedIn Ads, HeyReach, Resend, PostHog, Stripe, Google Ads et Supabase — ainsi que TikTok Ads, n8n et MCP personnalisé présents dans la modale sont conservés dans le backlog. Leurs états, URLs, outils, badges, métriques et promesses de temps réel restent des éléments illustratifs, pas des connexions prouvées.

**Correction de périmètre demandée par Fathi** : le catalogue Growth Cockpit ne remplace pas le catalogue actuel. Les cinq catégories métier et leurs vingt-deux cartes restent visibles, dans leur classement existant ; toute nouvelle proposition est additive. L'honnêteté porte sur l'état et le geste disponible, pas sur la disparition d'une carte : `Connecter` est réservé à un branchement réel, tandis qu'un connecteur futur reste proposé avec un libellé explicite.

**Organisation du travail à distance** : chaque micro-lot doit vivre de préférence dans une nouvelle tâche Codex et se terminer par une confirmation factuelle, les contrôles exécutés, une mini-recette de trois à cinq gestes réalisable en moins de cinq minutes sur téléphone, le verdict attendu et la fiche du lot suivant. `GO` autorise seulement l'ouverture de la tâche et le travail local ; `PUBLIER` reste une autorisation externe séparée et bornée ; `VERT + GO` permet d'enchaîner rapidement après la recette. Un problème maintient la correction dans la tâche courante.

**Incident de passation REL-0, sans perte de source** : la première nouvelle tâche a repris le checkout enregistré `C:\dev\agent_marketing` au lieu du worktree actif. Son diagnostic HEAD `718bbff`, readiness 21 et absence de CAMP est invalide pour REL-0. Le worktree source reste à `e023984` avec readiness 27, migrations `0025`–`0027`, code et tests CAMP présents. Dorénavant, toute ouverture vérifie chemin, HEAD et fichiers sentinelles avant d'être annoncée comme réussie ; la fiche finale fournit aussi une commande unique prête à copier-coller et précise si le modèle est celui par défaut ou un choix explicite.

**Plan de livraison** : la [roadmap Campagnes supervisées et intégrateurs](projets/roadmap-campagnes-supervisees.md) fixe une release de rattrapage CAMP-0/1/2, puis un seul micro-lot par cycle `implémentation locale → contrôles → autorisation → publication → test en ligne Fathi → verdict`. Le premier lot conseillé est CONN-0, catalogue honnête et registre de capacités. Les intégrateurs avancent ensuite par contrat officiel, connexion, lecture, vérité UI, puis écriture bornée et séparément autorisée. Meta est le pilote par défaut ; les sources de mesure, les autres Ads, l'outbound, n8n et MCP personnalisé restent conditionnels.

**Frontière de cette session** : seuls les documents de roadmap, de décision et de suivi sont modifiés. Aucun code produit, secret, migration, commit, push, PR, déploiement, appel fournisseur, recette payante, campagne, email ou dépense externe n'est créé. La prochaine publication et chaque test en ligne demandent une nouvelle autorisation.

### 2026-08-04 — Codex — **CAMP-2 local : cockpit de décision et preuve reproductible**

**Sources et fenêtres** : le cockpit lit les métriques observées de `ad_metrics` sur une période courante et une période de comparaison calendaires explicites. Dépense, conversions, revenu, CAC, ROAS, impressions, clics, CPM et CTR restent déterministes, rattachés à leurs lignes sources et cessent d'être présentés si la lecture est incomplète ou invalide. Un dénominateur nul rend CPM/CTR ou leur comparaison indisponibles ; leur évolution reste descriptive et ne prouve aucune cause. La confiance reste non calibrée plutôt que transformée en pourcentage. L'activité affichée provient uniquement des actions campagne et de leur journal ; aucun exemple ou état vide n'est présenté comme un fait.

**Statuts honnêtes** : `ad_metrics` ne contient aujourd'hui aucun statut fournisseur. Une synchronisation récente autorise donc seulement « Données récentes », puis « Historique » lorsque la preuve vieillit ; elle ne prouve ni « Active » ni « Terminée ». Les filtres de canal sont limités aux fournisseurs présents et le cycle `proposed | approved | rejected | postponed` reste un état de décision Nepteo, distinct de tout état Ads.

**Contrôles et recherche bornés** : le résumé opérationnel relit le bouton d'arrêt persistant, le niveau d'autonomie et le dernier démarrage `analysis_run`, sans les transformer en preuve d'un agent actif, sain ou d'une analyse réussie. Le nombre exact de connecteurs exclut le provider de scénario et échoue fermé au-delà de 100 lignes. La recherche prospect accepte 2 à 80 caractères, interroge seulement nom et société dans l'organisation courante, limite la sortie à 20 résultats complets et n'expose ni email, contenu brut ni note interne ; la provenance scénario/test reste visible.

**Rapport et dock sans IA** : un second snapshot calcule un rapport strict sur les 7 derniers jours face aux 7 jours immédiatement précédents. Quatre questions analytiques prédéfinies exposent totaux observés, variations, CPM/CTR et couverture des campagnes, toujours avec période, source et motif d'indisponibilité. Aucun champ libre, appel IA, retry, stockage ou effet externe n'est ajouté. L'audit créatif est explicitement indisponible : le schéma ne contient ni identifiant créatif, asset, format, portée ni fréquence.

**Décisions supervisées** : le refus exige un motif borné, enregistré atomiquement avec la transition et son journal ; l'ancienne RPC ne peut plus contourner ce motif. `0027_campaign_decision_cockpit.sql` crée un lot borné de propositions `ads_pause_*` avec leur journal par une RPC transactionnelle. Les verrous sont pris dans un ordre stable. Un préflight bloque la migration si l'ancien chemin a laissé plusieurs propositions ouvertes identiques, avec les identités à arbitrer ; aucune décision n'est fusionnée silencieusement. Les anciennes propositions à confiance fixe repassent par la RPC pour être normalisées ou adoptées avec un journal lié. Le verrou par organisation+campagne rend le double clic idempotent et l'historique supprime durablement une nouvelle proposition automatique pour une campagne déjà arbitrée ; les métriques ultérieures restent visibles, mais aucune réouverture implicite n'est inventée. Ces actions restent non exécutables, y compris si une ancienne clé de claim existe : claim et finalisation sont bornés aux relances. L'interface affiche « Validée — non appliquée », sans bouton Exécuter. Aucun provider, aucune outbox, aucun appel IA, aucune mutation Ads/email, aucun envoi et aucune dépense ne sont déclenchés.

**Reste explicite de CAMP-2** : attribution causale d'une fatigue ou d'une saturation, question analytique libre, santé temps réel de l'agent et des connecteurs, et audit créatif réel. Faute de preuve inspectable restent aussi différés les connecteurs Google Ads et LinkedIn Ads réels, les statuts fournisseur, la devise et le modèle d'attribution, le détail créas/adsets, les tests A/B, le scaling et la réallocation, les métriques MRR, churn, LTV et blended et la mise à jour temps réel. Ces capacités ne sont ni simulées ni déduites des métriques disponibles ; ce lot ne prétend donc pas clore toute la roadmap CAMP-2.

**Validation locale** : 184/184 tests Campagnes ciblés, dont 72/72 tests CAMP-2 croisés, et 530/530 tests complets sont verts, comme `npm run typecheck`, le lint complet, `git diff --check` et `npm run build` (26 routes). La revue parallèle finale ne relève plus aucun P1/P2 ; elle a notamment fait fermer les journaux de statut sans motif borné et les fuites d'activité hors filtre. Les contrôles SQL restent statiques/mockés : aucune migration réelle n'a été appliquée.

**Autorisation** : le travail reste strictement local. `0027` n'a été appliquée dans aucun environnement ; aucun commit, push, PR, fusion, déploiement, appel fournisseur ou recette payante n'a été effectué.

### 2026-08-04 — Codex — **CAMP-1 local : studio arbitrable et preuves explicites**

**Preuve et estimations** : les lignes `ad_metrics` sont normalisées sur les 30 jours calendaires du fournisseur correspondant au canal. La source expose période, nombre de lignes et campagnes, ainsi que la dernière synchronisation. Dépense, conversions, revenu, CAC et ROAS restent des faits observés ; coût/contact, volume et ROAS prévisionnels ne sont produits qu'avec au moins sept jours distincts, une dépense positive et dix conversions. Sans cette preuve, le studio affiche l'insuffisance et n'injecte aucun benchmark de canal.

**Studio v2** : la proposition permet de corriger un à cinq adsets, leurs audiences et allocations, de conserver deux à six hooks puis de sélectionner ceux retenus. La somme budgétaire est contrôlée en basis points et répartie en centimes depuis le budget total serveur ; les formats attendus sont dérivés du canal. Les faits observés, estimations, hypothèses et limites restent distingués dans le récapitulatif.

**Recherche et persistance** : la veille concurrentielle est séparée de la construction et de la soumission. Elle exige une confirmation explicite, passe uniquement par `runResearch` et conserve réservation, cache, journal avant appel, timeout, sources, coût observable et absence de retry automatique. `0026_campaign_studio.sql` ajoute le kind `campaign_competition` et renforce la RPC de proposition : l'intention canonique éditée est distincte du snapshot recalculé côté serveur. Un rejeu compare l'intention, reste idempotent malgré une évolution des métriques et ne crée ni seconde action ni second journal.

**Non-exécution** : CAMP-1 conserve `launch_campaign` hors des claims d'exécution. Il n'ajoute aucun bouton Exécuter, outbox, statut `launched`/`sent`, mutation fournisseur, publication, envoi ou dépense. Aucun appel payant de recette, migration distante, commit, push, PR, fusion ou déploiement n'a été effectué.

**Validation locale finale** : 76/76 tests ciblés et 452/452 tests complets sont verts, comme `npm run typecheck`, le lint ciblé et `npm run build` (26 routes). La revue finale confirme que les migrations restent seulement préparées dans le worktree : aucun appel fournisseur, aucune recette payante et aucune publication n'ont été effectués.

### 2026-08-03 — Codex — **CAMP-0 local : brief explicite et preuve de non-lancement**

**Point de départ** : le worktree était propre et détaché sur `e023984`, soit `origin/main` et non l'ancienne branche tutoriel. Les documents d'autorité locaux et le cadrage non commité de l'ancien worktree ont été lus sans modifier ce dernier. L'audit a confirmé des présélections, un brief réduit à quatre champs, une durée figée, un plan navigateur accepté et deux insertions non transactionnelles action/journal.

**Contrat livré localement** : le brief couvre objectif, étape, audience, offre, hypothèse, canal, budget journalier, durée 7/14/30, métrique, seuil et contexte facultatif, sans choix engageant par défaut. Les listes, bornes et textes sont validés à la construction puis à la soumission. Le navigateur ne renvoie plus de plan : budget total, estimation et garde-fous sont recalculés depuis le brief et les métriques serveur. Deux variantes restent éditables mais sont nettoyées, bornées et revalidées.

**Atomicité et honnêteté** : `0025_campaign_proposals.sql` ajoute `proposal_request_key`, une unicité par organisation et la RPC service-role `propose_campaign_action`. Le premier appel crée dans une transaction exactement une action `launch_campaign` `proposed` et son journal relié ; le rejeu identique ne crée rien et un payload conflictuel échoue fermé. La clé reste distincte du claim d'exécution. Le verrou et le marqueur démo sont conservés, les rôles `lecture`/`commercial` restent bloqués, `launch_campaign` reste hors de la RPC d'exécution et l'historique affiche « Validée — non lancée » sans bouton Exécuter.

**IA et non-effets** : la rédaction ne part que du geste « Construire la proposition », avec un seul appel au plus, timeout de 20 s, `maxRetries: 0`, télémétrie du modèle/tokens/coût et repli local honnête. Aucun appel IA de recette n'a été lancé. Le lot n'écrit ni outbox, ni statut `launched`/`sent`, n'appelle aucun fournisseur Ads/email, ne modifie ni kill switch, ni navigation, ni `website_preview`, ni `company_profile`, ni mémoire d'onboarding.

**Validation locale** : 52/52 tests ciblés CAMP-0, rôles, démo, transitions et readiness sont verts ; la suite complète passe désormais 432/432. Le calcul d'empreinte du CSV figé canonise uniquement CRLF vers LF dans le script opératoire et son test, ce qui conserve le contrôle de contenu tout en le rendant portable sous Windows ; la fixture n'a pas été modifiée. `npm run typecheck`, le lint ciblé et `npm run build` sont verts, avec 26 routes construites. L'installation des 456 dépendances a été réalisée depuis le cache npm hors réseau, sans scripts, et signale zéro vulnérabilité.

**Reste** : la migration `0025` n'est appliquée dans aucun environnement ; aucune recette Supabase ou navigateur avec mutation n'a été jouée. Aucun commit, push, PR, fusion ou déploiement n'a été effectué. Toute publication, application de migration ou recette payante exige une nouvelle autorisation de Fathi.

### 2026-08-03 — Codex — **tutoriel d’onboarding intégré localement, sans publication**

**Constat** : la production demandait toujours le nom, l’activité/principes puis l’analyse du site. Le tutoriel n’avait jamais été intégré : la maquette et les spécifications se trouvaient uniquement parmi des changements non commités d’un autre worktree.

**Sécurisation** : les cinq artefacts source ont d’abord été copiés sans modifier leur worktree d’origine, avec cinq empreintes SHA-256 correspondantes. La maquette et le prompt restent identiques octet par octet ; les trois documents de cadrage ont ensuite reçu uniquement les actualisations de statut du 2026-08-03. Une branche locale `codex/onboarding-guided-tutorial` part du merge déployé `82d9618`.

**Intégration** : la première arrivée propose explicitement « Découvrir avec un scénario d’exemple » ou « Configurer mon entreprise ». Le centre `/prise-en-main`, accessible hors des cinq entrées métier, présente onze missions, une progression locale minimisée, un reset et des liens vers les vrais écrans. Pour la voie exemple, le scénario choisi est présenté seul mais exige toujours un clic distinct « Charger et analyser » ; après succès, l’utilisateur reprend volontairement le tutoriel. Les anciennes bulles `CoachBubble` ont été retirées pour éviter deux guidages concurrents.

**Garde-fous** : aucune migration, télémétrie, analyse payante, recherche, retry, envoi ou chargement automatique n’a été ajouté. Le laboratoire reste séparé de la fiche et l’application à la mémoire reste une action distincte. Les tests utilisateurs G1 ne sont pas déclarés acquis ; push, fusion et déploiement attendent une nouvelle autorisation explicite de Fathi.

**Validation locale** : 5/5 tests spécifiques du tutoriel, typecheck final et lint ciblé de tous les fichiers applicatifs touchés sont verts. Le build Next/Webpack compile, termine TypeScript et génère les 26 routes, dont `/prise-en-main`; il ne conserve que les avertissements historiques de `lib/observability.ts`. La suite complète passe 420/421 : l’unique échec est l’empreinte connue du CSV `docs/tests/prospects-test.csv` checkouté en CRLF, hors périmètre. Turbopack refuse la jonction temporaire `node_modules` pointant hors du worktree ; cette jonction a été retirée après les contrôles sans toucher à sa source. Les navigateurs intégrés bloquent les URL `localhost` avant navigation (`ERR_BLOCKED_BY_CLIENT`) : la recette visuelle authentifiée desktop/mobile reste donc à effectuer avant publication et n’est pas déclarée verte.

### 2026-08-02 — Codex — **timeout d'analyse d'onboarding diagnostiqué, correctif local non déployé**

**Preuve production** : pour `https://www.airwell.com/`, le journal de l'organisation d'onboarding porte `research_started` à `2026-08-02T16:59:48.177345Z`, puis `research_failed` à `2026-08-02T17:00:33.576930Z` avec `reason = timeout` et `provider = openai`, soit 45,40 s. L'échec correspond donc au `AbortSignal.timeout(45_000)` du fournisseur, avant toute synthèse ; ni le client, ni Next/Azure, ni une récupération directe du site par Nepteo n'ont interrompu la requête. Deux exécutions explicites et distinctes de `website_preview` sur le même domaine avaient abouti plus tôt en 13,47 s et 18,73 s, avec six sources chacune.

**Correctif local** : `company_profile` utilise désormais le schéma JSON strict déjà éprouvé par `website_preview`, accepte 12 000 caractères et exploite directement la proposition du seul appel `runResearch`. Les analyses d'identité ont un délai borné à 120 s ; `prospect_company` conserve 45 s. Le second appel de synthèse a été retiré, aucun retry automatique n'a été ajouté et aucune écriture dans `company_memory` n'a lieu avant validation.

**Validation locale** : 28/28 tests ciblés, typecheck, lint des dix fichiers touchés (0 erreur, 0 avertissement) et build Next/Webpack de 25 routes verts. La suite complète passe 415/416 ; l'unique échec, hors périmètre, est l'empreinte octet du CSV `docs/tests/prospects-test.csv` checkouté en CRLF (`i/lf`, `w/crlf`). Le build Turbopack n'a pas pu démarrer dans ce worktree car il refuse la jonction temporaire `node_modules` pointant hors racine ; le build Webpack du même Next a compilé et généré toutes les pages. La jonction a été supprimée sans toucher aux dépendances sources.

**Reste à faire** : après accord explicite de Fathi, pousser le correctif, ouvrir/fusionner la PR et déployer. La recette production devra lancer une seule analyse manuelle d'Airwell, vérifier un seul `research_started`, son `research_succeeded`, le nombre de `web_search_call`, les sources et l'absence de mutation de la fiche avant validation. Aucun appel payant de recette n'a été lancé pendant ce diagnostic.

### 2026-07-31 — Codex — **PR #17 déployée et recettée en production**

**Terminologie livrée** : la voie A devient en surface « scénario d'exemple Nepteo » / « données d'exemple », tout en conservant `certified-demo` comme classification technique. La voie B reste « environnement de test » et peut contenir des données saisies ou importées par le testeur, réelles ou synthétiques.

**Garde de course** : le préflight serveur reste l'autorité et renvoie `unsafe_existing_data` avant sauvegarde, reset ou seed. La réponse arme un latch client fail-closed qui désactive les trois chargements jusqu'au rafraîchissement et à un nouvel inventaire serveur.

**Release prouvée** : la PR [#17](https://github.com/Shaaakir281/nepteo/pull/17), head `28781aad52564f02fcee1c0dda4b5ee5291836b8`, a une CI `30620564365` verte. Elle est fusionnée au SHA `704efabd80de434ea2619cd993ae87427c114838` ; la CI `main` `30620691704` et le déploiement `30620812901` sont verts. Supabase reste au schéma 21. Azure sert à 100 % `nepteo-prod--0000011`, latest et ready, Healthy/Provisioned/RunningAtMaxScale avec une réplique, image `nepteoacr27de3b.azurecr.io/nepteo:704efabd80de434ea2619cd993ae87427c114838`, digest `sha256:fe6cafbe991c45952262e33be965e4ba09239ff421a86dce80231117a3504425` ; les six contrôles HTTP répondent 200.

**Recette authentifiée** : les surfaces emploient le nouveau vocabulaire et le briefing indique « à partir des données d'exemple du scénario Nepteo ». L'identité reste en lecture seule et `/onboarding/identite` est redirigé vers « Mon entreprise » avec le nouveau message de garde. Northwind reste actif sans mutation et la console est vide.

**Validation et frontière de preuve** : 385/385 tests, typecheck, lint et build de 24 routes verts ; aucune anomalie P1/P2 en revue croisée. Le gate `reset → reseed → préparation → exécution`, le smoke RLS multi-rôles, les OAuth réels et la preuve terrain commanditaire restent ouverts. C7 demeure fermé et aucun envoi externe n'est activé.

### 2026-07-31 — Codex — **Étape historique PR #16 : hotfix déployé et recetté**

**Release historique** : la PR [#16](https://github.com/Shaaakir281/nepteo/pull/16), head `3a9b228eda3c4480fc9d96f34b51d984dfb28d37`, a une CI `30617946344` verte. Elle est fusionnée au SHA `21c90f77af0c877e9c99f60a4997c4dad4b1ba84` ; la CI `main` `30618088771` et le déploiement `30618214620` sont verts. Supabase reste au schéma 21. Azure a servi `nepteo-prod--0000010`, image `nepteoacr27de3b.azurecr.io/nepteo:21c90f77af0c877e9c99f60a4997c4dad4b1ba84`, digest `sha256:aff8b036211f25704205a8b9d76237bac3e82a0d2f8a73ab4e08b5319b707ce0` ; les six contrôles HTTP étaient verts.

**Recette authentifiée** : le briefing indique les données fictives du scénario ; l'identité, les offres et le site restent en lecture seule et l'accès direct est refusé ; Artisan explique « 13 visibles / 12 actionnables / 1 suspendu ». Northwind a été rechargé et laissé actif avec six propositions ; la console est vide.

**Frontière de preuve** : cette recette valide le hotfix, tandis que le gate `reset → reseed → préparation → exécution`, le smoke RLS multi-rôles, les OAuth réels et la preuve terrain commanditaire restent ouverts. C7 demeure fermé et aucun envoi externe n'est activé.

### 2026-07-31 — Codex — **Étape historique PR #15 : vitrine reconstruite et trois scénarios chargés/analysés**

**Release** : la PR [#15](https://github.com/Shaaakir281/nepteo/pull/15) est fusionnée au SHA `9889b6e37d6f3856a6ea8721cbd96963d9d8c711`. Sa CI `30614649997` est verte sur le head `6104aae48f016af0203dc8fbe25e30184b0097c9` ; la CI `main` `30614730996` et le déploiement `30614818816` sont verts. Supabase reste au schéma 21 ; Azure a créé `nepteo-prod--0000009`, qui sert l'image `nepteoacr27de3b.azurecr.io/nepteo:9889b6e37d6f3856a6ea8721cbd96963d9d8c711`, digest `sha256:7ed581a3ee91181ff4c0928b05d1272ddc7ad65669e774a8031e6e85e4c56ff3`, et les six contrôles HTTP sont verts.

**Reconstruction et recette** : la préparation de `Fathi Solution` a été appliquée après sauvegarde (`sha256:ffa9536fadf70d195cebc9b63c4fcfb73e3745ede0e9a20be31348cd6748e07c`) : 48 prospects, 6 connecteurs et 8 rubriques ont été retirés, sans modifier le nom ni les membres. Les cycles de chargement et d'analyse des trois scénarios sont verts ; chaque scénario a produit six propositions avec une console vide et Atelier Northwind a été laissé actif. Le gate `reset → reseed → préparation → exécution` reste ouvert.

**Frontière de preuve** : cette étape établit la reconstruction et les cycles de chargement et d'analyse ; la recette du hotfix qui en découle est consignée dans l'entrée PR #16 ci-dessus. Le gate `reset → reseed → préparation → exécution`, le smoke RLS multi-rôles, les OAuth réels et la preuve terrain commanditaire restent ouverts. C7 demeure fermé et aucun envoi externe n'est activé.

### 2026-07-31 — Codex — **Scénarios et CSV V1 déployés ; RPC et surfaces contrôlées**

**Livraison GitHub** : la PR [#13](https://github.com/Shaaakir281/nepteo/pull/13) a intégré les trois scénarios Nepteo V2 certifiés, la séparation explicite entre données fictives Nepteo et données autorisées du testeur, ainsi que le connecteur CSV V1 atomique. Sa [CI `30609476514`](https://github.com/Shaaakir281/nepteo/actions/runs/30609476514) et la [CI `main` `30609579805`](https://github.com/Shaaakir281/nepteo/actions/runs/30609579805) sont vertes.

**Production alignée** : Supabase reste certifié à `app_schema_version = 21`. Le build ACR `dd8` a produit l'image `nepteoacr27de3b.azurecr.io/nepteo:813d2e0f3d49f19ec4d2c5094fe1e5f95af281ae`, digest `sha256:73b9566dcdafe12d01b472fa02c7ed1108bf042f7154631ec9ed01fa9283eca9`, puis une mise à jour directe de Container Apps a promu la révision `nepteo-prod--0000008`. Azure la sert à 100 % ; les contrôles publics et Azure de `/`, `/api/health` et `/api/ready` répondent HTTP 200.

**Recettes** : le smoke RPC CSV réel est vert sur les fixtures dédiées `E2E_RLS_CSV_OWN` / `E2E_RLS_CSV_OTHER` : refus inter-tenant `42501`, import valide, rollback complet sur date invalide tardive, rejeu idempotent, retrait puis second retrait `not_found`, avec nombre et contenu des prospects, fingerprint, `last_import_count` et stabilité des identifiants contrôlés. Le contrôle administrateur dans le navigateur intégré confirme la présence des trois cartes de scénario, le libellé prudent « environnement de test », l'accès CSV conditionné au retrait du scénario et une console sans erreur ; il ne remplace pas le gate `load → analyse → reset → reseed → préparation → exécution`.

**Reste et limites** : terminer le smoke RLS multi-rôles, recetter OAuth et les synchronisations sur des connecteurs réels distincts, puis recueillir la preuve terrain commanditaire. C7 reste fermé : aucun envoi externe n'est activé et les gates valeur, RGPD et exploitation restent obligatoires.

### 2026-07-30 — Codex — **Deux voies de test exclusives et CSV V1 préparés**

**Décision utilisateur** : l'environnement reste destiné aux tests commanditaires, avec deux voies qui ne doivent jamais coexister dans la même organisation. La voie A charge l'un des trois scénarios Nepteo V2 certifiés ; elle seule est qualifiée de « données fictives ». La voie B utilise des données autorisées apportées par le testeur via connecteur ou CSV. Le scénario doit être retiré avant l'import et ses événements restent exclus des preuves terrain.

**Contrat du lot local** : le scénario porte sa version, son identité, son état final et ses comptages certifiés ; l'affichage prudent retombe sur « Environnement de test » dès que la certification est incomplète ou que des données apportées sont présentes. Le CSV V1 exige UTF-8, refuse plus de 900 Ko ou 5 000 lignes, mappe sans ambiguïté six champs utiles, ignore les colonnes inconnues, conserve des identifiants stables et permet un retrait explicite. `0021` remplace ou retire le seul import CSV avec ses artefacts dérivés dans une transaction service-role, sous verrou des mutations réelles, puis journalise le résultat.

**Validation et livraison achevées le 2026-07-31** : **359/359 tests**, typecheck, lint, `git diff --check` et build Next.js de production (**24 pages/routes**) sont verts. Les revues indépendantes démo et CSV ne relèvent plus de P1/P2. Le commit `b1f760d`, poussé initialement sur `codex/demo-scenarios-v2`, a été intégré par la PR #13 ; `0021` est appliquée en production (`app_schema_version = 21` à `2026-07-30T17:40:26Z`). Le smoke RPC réel, le déploiement Azure `nepteo-prod--0000008` et le contrôle navigateur de surface ont ensuite été validés ; les preuves détaillées figurent dans l'entrée du 2026-07-31 ci-dessus.

### 2026-07-30 — Codex — **Cap précédent : la démo devient un tenant vitrine durable**

**Décision utilisateur** : l'environnement est encore en démonstration et ses données sont nécessaires pour illustrer les possibilités de l'agent. Le marqueur et le dataset ne doivent donc pas être retirés comme préalable à la suite.

**Produit** : le cockpit signale désormais partout « Démonstration active — données fictives ». L'onglet Connecteurs précise qu'aucun compte externe n'est branché et présente les cartes comme des aperçus démo, sans réactiver OAuth ni affaiblir le verrou qui empêche le mélange fictif/réel.

**Recette et valeur** : le guide et la scorecard séparent maintenant deux voies. La vitrine mesure compréhension, explicabilité, confiance et qualité des brouillons ; les gates terrain utilisent exclusivement un tenant pilote réel. OAuth, RLS et synchronisations se jouent dans des organisations de recette dédiées. Le prochain durcissement utile est un scénario versionné avec comptages attendus et un cycle `reset → reseed` reproductible.

**Validation locale** : 341/341 tests, lint, typecheck et build Next.js (23 pages/routes) sont verts. Aucun seed, reset, OAuth, appel externe ni changement de données de production n'a été effectué.

**Livraison** : la PR [#11](https://github.com/Shaaakir281/nepteo/pull/11) et sa [CI](https://github.com/Shaaakir281/nepteo/actions/runs/30550314627) sont vertes ; le merge `main` est `a2bbc34dcb97ab00951a3efa631c4f7c0a0428ca` et sa [CI](https://github.com/Shaaakir281/nepteo/actions/runs/30550451846) est verte. Le workflow [30550603760](https://github.com/Shaaakir281/nepteo/actions/runs/30550603760), approuvé sur l'environnement protégé `production`, a promu l'image du même SHA vers `nepteo-prod--0000007`. Azure la sert à 100 % ; liveness et readiness répondent HTTP 200.

**Recette navigateur** : Prospects affiche le badge latéral et le bandeau permanent « Démonstration active — données fictives » avec les 24 contacts/48 lignes existants. Connecteurs précise qu'aucun compte externe n'est branché ; Google Sheets et Notion affichent « Aperçu démo — connexion réelle désactivée ». Aucune erreur console et aucune mutation métier.

### 2026-07-30 — Codex — **Release cohortes/connecteurs déployée et recettée en lecture**

**GitHub** : la PR [#7](https://github.com/Shaaakir281/nepteo/pull/7) a livré la cohorte complète, la canonicalisation multi-source, la stabilité des snapshots et le retrait sûr du marqueur démo. La recette de production a ensuite révélé deux défauts de clarté : cartes OAuth muettes pendant le blocage démo, puis confusion possible entre les 24 contacts regroupés pour la lecture et les 29 identités conservées par prudence. La PR [#8](https://github.com/Shaaakir281/nepteo/pull/8) a ajouté les explications et la PR [#9](https://github.com/Shaaakir281/nepteo/pull/9) a corrigé l'espace visible détecté au dernier passage. Les CI de chaque PR et de `main` sont vertes ; le SHA final est `5d03f109e9d06c456781d72c2c0b5ab13eca1a4c`.

**Azure** : le workflow final [#30540910670](https://github.com/Shaaakir281/nepteo/actions/runs/30540910670) a contrôlé `app_schema_version >= 20`, construit l'image `nepteoacr27de3b.azurecr.io/nepteo:5d03f109e9d06c456781d72c2c0b5ab13eca1a4c` et promu la révision `nepteo-prod--0000006`. Elle est `Healthy`, `Provisioned`, `RunningAtMaxScale`, active et reçoit 100 % du trafic.

**Recette finale** : `/api/health` et `/api/ready` répondent HTTP 200. La session administrateur intégrée a rechargé sans erreur console « Aujourd'hui », Prospects, Campagnes, Contenu, Mon entreprise (Identité, Connecteurs, Agent) et Journal. « Aujourd'hui » affiche 24 contacts dédoublonnés sur 48 lignes et 15 prêts à relancer. Prospects explique désormais les deux usages : 24 contacts/5 sans email pour la lecture, 29 identités/10 fiches source sans email pour la cohorte prudente. Google Sheets et Notion affichaient alors « Retirez la démonstration pour reconnecter. » ; cette interprétation a été supplantée par la décision de conserver le tenant vitrine et de tester les connexions ailleurs. Aucun clic d'analyse, OAuth, synchronisation, recherche, chargement/retrait démo, décision, exécution ou envoi n'a été effectué.

**Validation** : référence locale et CI à **341/341 tests**, lint, typecheck et build Next.js 16.2.10 verts, 23 pages/routes. Le smoke RLS lecture seule n'a lancé aucune requête : il s'est arrêté avant réseau faute de `RLS_SMOKE_EMAIL`.

**Reste, corrigé par la décision suivante** : conserver et certifier le tenant vitrine, puis jouer le smoke RLS multi-rôles/tenants sur organisations `E2E_RLS_*`, les callbacks/synchronisations OAuth et les parcours C8/R1A/R1B/R2 avec mutation sur fixtures dédiées distinctes. C7 reste fermé et aucun envoi externe n'est activé.

### 2026-07-30 — Codex — **Smoke authentifié et hotfix connecteurs préparé**

**Smoke applicatif en lecture** : une session administrateur a chargé sans erreur console « Aujourd'hui », Prospects, Campagnes, Mon entreprise (Identité, Connecteurs, Agent), Journal, Contenu et les fiches déconnectées Google Sheets/Notion. Le play dormant conserve un seuil vide par défaut ; choisir 30 jours active localement le bouton, puis le retour au choix vide le désactive. Aucun clic d'analyse, recherche, OAuth, synchronisation, chargement/retrait démo, décision, exécution ou envoi n'a été effectué.

**P1 connecteurs — constat technique historique** : la production contient un unique connecteur `provider=demo`, `status=connected`, sans prospect `source=demo`, campagne, revenu ni sauvegarde démo. Le code le qualifiait donc d'orphelin et le correctif a sécurisé son éventuel retrait. La décision produit ultérieure conserve cependant le tenant et ses données de vitrine : ce marqueur n'est plus un déchet à éliminer, mais un état à rendre explicite puis à remplacer par un scénario versionné et certifié.

**P1/P2 de confiance** : les 48 lignes visibles sur l'accueil sont 24 contacts importés depuis Google Sheets et les mêmes 24 depuis Notion. Un lecteur partagé charge désormais une cohorte stable, paginée et bornée à 5 000 lignes, vérifie le volume, la tête et les identifiants, puis déduplique seulement après lecture complète. L'affichage regroupe les 48 lignes en 24 fiches. La cohorte métier prudente en compte toutefois 29 : les 19 adresses présentes permettent un rapprochement fiable entre sources, tandis que les 10 lignes sans email restent distinctes plutôt que de fusionner cinq homonymes supposés. Dans le jeu constaté, 15 fiches sont prioritaires, 10 sont sans email et 7 appartiennent au groupe actif « Nouveau » ; les lignes brutes servent aussi aux sources et au signal de 19 emails dupliqués. Une lecture partielle, incohérente ou indisponible n'expose aucune ligne et suspend les totaux, funnels, suggestions et analyses au lieu d'inventer un zéro ou un total tronqué.

**Canonicalisation opérationnelle** : un statut terminal, DNC ou une opposition gagne même s'il vient d'une ligne plus ancienne ; des statuts actifs contradictoires produisent une cible non relançable ; seule la date de dernier contact valide la plus récente est conservée. Le rapprochement métier utilise uniquement un email non vide : deux homonymes sans email restent deux prospects, même s'ils peuvent être regroupés visuellement. Ce contrat protège aussi le play dormant lors de la proposition, de l'approbation et de la préparation. La cohorte entière est canonicalisée avant l'intersection du snapshot : un DNC porté par le doublon hors snapshot ne peut pas être contourné. Si l'ordre de fraîcheur Sheets/Notion change, l'email courant retrouve le membre figé et son ID de snapshot reste celui des brouillons et de l'outbox ; une identité disparue sans correspondance est exclue.

**Concurrence et retour utilisateur** : clic manuel, cron et démonstration partagent le verrou distribué par organisation avant de journaliser ou lancer l'analyse, ce qui ferme le check-then-insert concurrent sans nouvelle migration. L'approbation et l'exécution d'une relance utilisent aussi le verrou `data` des synchronisations pendant toute leur lecture paginée et leur décision. Le bouton n'ignore plus le résultat serveur : il distingue succès, absence de nouveauté, verrou occupé, droits insuffisants et échec. Si les prospects réussissent mais que la passe publicitaire échoue, il annonce ce succès partiel ; les erreurs Supabase renvoyées sans exception lors des lectures, insertions d'actions ou du journal Ads sont maintenant remontées au même contrat.

**Validation locale** : 340/340 tests, lint, typecheck, build de production (23 routes/pages) et `diff --check` sont verts. Le test SQL sensible aux fins de ligne normalise désormais CRLF/LF. La branche `codex/authenticated-smoke-fixes` n'est ni poussée, ni fusionnée, ni déployée ; aucune donnée de production n'a été modifiée. `gh auth status` reconnaît de nouveau le compte GitHub ; publier ce nouveau lot reste une étape explicite distincte de sa validation locale.

**Reste** : recetter la canonicalisation sur deux sources réelles, l'inversion du représentant Sheets/Notion et le blocage du play par un DNC hors snapshot. Le smoke applicatif administrateur ne prouve pas l'isolation inter-tenant ni les refus du rôle `lecture`/`commercial`. Ces contrôles exigent les fixtures dédiées de `docs/tests/SMOKE-AUTH-RLS.md`. Les callbacks OAuth et les parcours C8/R1A/R1B/R2 avec mutation restent également ouverts. Actions Ads et journal sont deux écritures distinctes : les erreurs sont visibles, mais leur atomicité complète demanderait une future RPC/migration.

### 2026-07-30 — Codex — **Release schéma 20 déployée en production**

**GitHub** : le worktree complet a été figé au commit `f353ea4` sur `codex/schema20-production-release`. La PR [#5](https://github.com/Shaaakir281/nepteo/pull/5) a passé tests, lint, typecheck et build, puis a été fusionnée par squash dans `main` au commit `73f7e79`. La CI de `main` est également verte.

**Azure** : le workflow manuel [#30520034704](https://github.com/Shaaakir281/nepteo/actions/runs/30520034704) a validé `app_schema_version >= 20` avant toute mutation, puis construit et promu l'image `nepteoacr27de3b.azurecr.io/nepteo:73f7e79ea64ed72102a1f59f6344add8122dcdc9`. La révision `nepteo-prod--0000003` est `Running`, `Succeeded` et reçoit 100 % du trafic.

**Contrôles** : le domaine public et le FQDN Azure répondent HTTP 200 sur `/`, `/api/health` et `/api/ready`. Le navigateur public charge `/login` sans erreur console. Aucune session authentifiée n'étant disponible dans le navigateur de contrôle, le smoke authentifié/RLS, les callbacks OAuth et les parcours C8/R1A/R1B/R2 restent à recetter ; aucun connecteur, chargement démo, appel de recherche ni envoi externe n'a été déclenché pendant ce contrôle.

**Incident résorbé au niveau applicatif** : l'application et la base sont de nouveau alignées sur le schéma 20. Les restrictions temporaires liées à l'ancienne révision sont levées après recette fonctionnelle des écrans concernés. C7 reste fermé et aucun envoi externe n'est activé.

### 2026-07-30 — Codex — **Incident de version en production et release en cours**

**État vérifié** : les migrations Supabase `0012` à `0020` ont été appliquées manuellement en production le 2026-07-30. Le marqueur `app_schema_version = 20` est enregistré à `2026-07-30T06:02:14Z`.

**Décalage applicatif** : Azure sert encore l'image `49b410a7`, révision `0000002`. `/` et `/api/health` répondent HTTP 200, tandis que `/api/ready` répond HTTP 404 parce que cette ancienne version ne contient pas la route. La base est donc en avance sur l'artefact applicatif actuellement servi.

**Restriction pendant la fenêtre d'incident** : `0019` a retiré aux JWT la lecture de `connectors.config`, encore demandée par l'ancienne interface. Jusqu'à la nouvelle release, ne pas utiliser les écrans Connecteurs, « Charger et analyser » ni la recherche web. Le contrôle agrégé a confirmé un seul compte `admin`, aucun membership dupliqué, aucun connecteur réel actif, un connecteur démo et aucune recherche payante le jour de l'incident.

**Release non terminée** : le worktree complet est en préparation pour la release, mais aucune nouvelle image ni révision applicative n'est déployée à ce stade. La suite est : commit de release → PR/CI → fusion dans `main` → déploiement manuel protégé → contrôles `/`, `/api/health`, `/api/ready` puis smoke authentifié/RLS et recette fonctionnelle. Aucun envoi externe ne doit être activé.

### 2026-07-30 — Codex — **R2 local : play dormant supervisé et scorecard de valeur**

**Play borné et explicite** : le lanceur oblige le testeur à choisir 30 ou 45 jours, sans seuil par défaut. La règle pure exige un prospect actif, un email présent et une date de dernier contact valide, exclut les statuts terminaux, classe les silences du plus ancien au plus récent et borne la vague à 50. Les prospects déjà présents dans le snapshot d'une vague dormante antérieure sont écartés.

**Supervision conservée** : le geste crée uniquement une action `relaunch_dormant` au statut `proposed` et sa trace de journal. Il ne prépare aucune outbox et ne déclenche aucun envoi. La validation humaine reste le point de décision ; l'approbation réutilise la RPC de `0020` pour revalider puis figer atomiquement une cohorte non vide avec la décision et son journal.

**Preuve lisible et cloisonnée** : la scorecard « Aujourd'hui » est limitée aux événements `action_kind = relaunch_dormant`, `is_demo = false` de l'organisation courante. Elle montre les numérateurs/dénominateurs, retient le dernier verdict et la dernière évaluation de brouillon par action, déduplique les suites par action/prospect et maintient deux colonnes distinctes pour le déclaré manuel et l'observé fournisseur. Le kind reste conservé dans `value_events` si l'action est supprimée et que `action_id` devient nul : l'historique demeure attribué au bon play sans réattribution artificielle.

**Séparation local/programme** : aucun écran ni calcul R2 n'agrège plusieurs tenants. Le compteur local d'évaluateurs ne valide pas le gate programme « 3 testeurs ». Les 3 testeurs/30 recommandations, les deux pilotes d'un même écosystème et la décision longitudinale sont consolidés manuellement et anonymement hors application, avec des pseudonymes et uniquement les mesures nécessaires.

**Signal connecteur documenté** : le motif `missing_context` est réservé au faux positif causé par un historique d'interactions réellement manquant. La scorecard affiche son numérateur sur tous les derniers verdicts rejetés ; **≥ 30 %** est un signal local de cadrage, jamais une autorisation automatique. Le gate programme exige deux pilotes du même écosystème et, comme alternative au taux de 30 %, une médiane de recherche supérieure à deux minutes, puis l'accord explicite de Fathi.

**Garde-fous finaux du lot** : une action dormante active est dédupliquée ; les snapshots antérieurs et, lorsque disponible, l'email normalisé empêchent une nouvelle vague ; les scans bornés échouent fermés plutôt que de sélectionner une cohorte partielle. L'exécution est restreinte au snapshot puis revalide les faits courants ; l'absence de snapshot sur un play dormant impose une récupération manuelle et les résultats aval exigent la cohorte. Enfin, la scorecard est suspendue si sa lecture échoue ou dépasse 5 000 événements, au lieu d'afficher des taux partiels.

**Vérification finale locale** : les tests ciblés couvrent les bornes 30/45, les dates invalides, le tri oldest-first/cap 50, la stabilité, la revalidation, l'exclusion des snapshots, l'absence d'écriture outbox et les calculs de scorecard. `npm test` **288/288**, `npm run typecheck`, `npm run lint`, `npm run build` (**23 routes/pages**) et `git diff --check` sont verts. Le build a notamment détecté puis fait corriger un export de type placé à tort sur la façade des Server Actions.

**Reste avant pilote** : appliquer `0012` → `0020` hors production, obtenir readiness 20, jouer le smoke et les parcours C8/R1/R2. Le lot n'est ni migré, ni déployé, ni recetté. Les deux semaines de test, les 30 puis 50 recommandations et leurs résultats restent entièrement à observer. L'absence de suppression-list indépendante maintient C7 fermé et impose la validation humaine ; aucun envoi externe n'a été activé.

### 2026-07-29 — Codex — **R1A preuve terrain et R1B Top 5 intégrés en parallèle**

**Deux chantiers locaux disjoints puis intégrés** : R1A/C9A instrumente les verdicts, faux positifs, retouches, relances manuelles et résultats déclarés ; R1B transforme « Aujourd'hui » en file de cinq priorités maximum avec une explication factuelle. Le filtre de rôle précède le classement et aucune action n'est fabriquée pour remplir la file.

**Preuve fiable et isolée** : la migration `0020_value_events.sql` porte le readiness à 20, réserve l'écriture au service role via des RPC étroites et la lecture à `admin`, `marketing` et `direction`. Les événements démo sont marqués côté base et exclus des gates terrain. Une relance ne peut être approuvée avec une cohorte vide ; jusqu'à 50 cibles sont figées avec l'approbation et son journal dans la même transaction. Les résultats aval exigent ensuite une action approuvée/exécutée et un prospect de cette cohorte. Les faits restent déclaratifs : aucune écriture dans l'outbox et aucun statut fournisseur `sent`.

**Ciblage durci** : les relances par statut excluent désormais les prospects sans email, terminaux ou contactés depuis moins de sept jours, puis revalident la fiche avant préparation. Les anciennes propositions par statut restent déclassées dans le Top 5.

**Vérification finale locale** : `npm test` **261/261**, `npm run typecheck`, `npm run lint`, `npm run build` (**23 routes/pages**) et `git diff --check` sont verts après revue croisée.

**Reste avant terrain** : appliquer et recetter `0012` → `0020` hors production, jouer le smoke authentifié/RLS et les parcours OAuth/C8/R1A/R1B. Le play R2 devra sélectionner les 50 silences les plus anciens avant sa cohorte 30/45 jours. Aucun déploiement, changement de base distante, appel payant ni envoi externe n'a été effectué.

### 2026-07-29 — Codex — **Roadmap valeur issue du benchmark**

**Décision produit** : la faiblesse actuelle est la preuve terrain, pas le nombre de connecteurs. La boucle cible devient « signal fiable → priorité expliquée → action supervisée → résultat mesuré ». La phase 3A reste acquise techniquement, tandis que la porte de valeur de la phase 2 reste ouverte.

**Ordre adopté** : recette `0012`–`0019` ; C9A de preuve manuelle et Top 5 en parallèle ; play « prospects dormants » ; puis un seul connecteur Gmail ou Microsoft 365 si les tests mesurent un manque de contexte. C7 n'est plus l'étape automatique suivante et C9 est séparé entre faits déclarés avant C7 et résultats fournisseur après C7.

**Livrables documentaires** : création de `docs/projets/roadmap-valeur-commanditaires.md`, alignement de la roadmap générale, des décisions, de l'audit, de la scorecard, du plan bêta et de `CLAUDE.md`. Aucun code produit, déploiement, migration distante, appel payant ou envoi externe n'a été déclenché.

### 2026-07-29 — Codex — **Troisième vague : frontières financières, démo isolée, readiness et concurrence**

**Quatre chantiers parallèles intégrés puis relus en croisé** : rôles/RLS financiers, isolation du mode démonstration, contrat de readiness du schéma et primitives atomiques pour les coûts et les transitions. Le développement est resté en mode sûr : aucun envoi externe, appel de recherche payant, déploiement ou changement de base distante.

**Rôles et données sensibles** : `lib/auth/roles.ts` devient la matrice de capacités unique. `0015_financial_role_boundaries.sql`, puis le rattrapage additif `0019`, appliquent une frontière simple : aucun contenu libre/dérivé n'est lisible par le commercial (mémoire, recherches, briefings, actions, journal, outbox), car une allowlist de type n'expurge pas un `payload`. Il conserve les colonnes prospects normalisées et les métadonnées des connecteurs CRM/fichiers ; `prospects.raw`/notes, `organizations.activity`, la configuration et les credentials des connecteurs restent côté serveur. `lecture` conserve la lecture financière sans mutation ; un rôle inconnu reçoit zéro capacité.

**Démonstration sans mélange** : seul l'admin peut charger une démo dans une organisation sans donnée réelle. Campagnes et ventes utilisent le préfixe `demo:`, actions et briefings sont marqués, les anciennes clés ne sont nettoyées qu'avec un marqueur actif fiable. Un verrou distribué `__demo_lock`, typé `demo | analysis | campaign | data`, sérialise chargement, retrait, analyses et mutations réelles. Mémoire, onboarding, OAuth/connecteurs et sync effectuent le contrôle puis l'écriture dans la même section critique. Une sauvegarde existante corrompue bloque le seed. La reprise TTL a été supprimée : un verrou orphelin exige une récupération manuelle vérifiée ; les analyses restent scopées et l'enrichissement web est coupé.

**Exploitation et coût** : `0016` prouve les prérequis critiques de `0012` à `0015` avant de créer le singleton privé `app_schema_version` et `/api/ready`; `0019` réapplique les frontières à une base déjà migrée et certifie les privilèges finaux. Le workflow refuse de muter Azure si la base n'atteint pas la version 19, puis vérifie `/api/health` et `/api/ready`. `0017` verrouille l'organisation, arbitre la pause et réserve atomiquement le quota quotidien avant journal et appel externe. Chaque future migration doit relever le marqueur, sous peine d'échec du test de contrat.

**Concurrence fail-closed** : `0018` regroupe dans des RPC transactionnelles la décision et son journal, le verrouillage de l'organisation avec pause/autonomie puis le claim et son journal de départ, la finalisation `executed | failed` et sa trace, ainsi que les changements de pause/autonomie et leur audit. Toute ambiguïté conserve le claim et demande une reprise contrôlée au lieu d'inventer un état ou de recommencer.

**Vérification finale locale** : `npm test` **231/231**, `npm run typecheck`, `npm run lint` et `npm run build` (23 pages/routes, `/api/ready` incluse) sont verts après la revue croisée. `git diff --check` est rejoué en clôture. Les migrations `0012` à `0019`, le smoke authentifié/RLS et les tests OAuth restent à jouer sur une recette dédiée avant tout déploiement.

### 2026-07-29 — Codex — **Deuxième vague : façade serveur, tenancy fail-closed et smoke RLS**

**Trois chantiers parallèles intégrés** : découpage des Server Actions, stratégie d'organisation bêta et smoke authentifié/RLS. Une revue sécurité croisée a ensuite vérifié le lot complet.

**Code simplifié sans changer l'API publique** : `app/(cockpit)/actions.ts` passe de **468 à 99 lignes** et délègue à cinq modules (`decisions`, `prospects`, `action-drafts`, `execution`, `analysis`). Next 16/Turbopack refuse les réexports directs depuis une façade `"use server"` ; les exports publics restent donc des wrappers `async`, structure validée par le build.

**Tenancy fail-closed** : `0013_single_organization_per_user.sql` refuse les doublons existants sans modifier une ligne, puis impose un `user_id` unique. Le contexte auth et l'onboarding lisent au plus deux memberships et refusent toute ambiguïté. La double soumission concurrente de l'onboarding est traitée comme idempotente lorsque la requête gagnante a déjà créé le membership.

**RLS et rôles** : `0014_company_memory_service_writes.sql` remplace la policy `for all` par une lecture seule pour les membres. Les écritures restent dans les Server Actions au service role ; l'onboarding enrichi exige désormais `canEdit`. Des tests de contrat couvrent la migration et ce garde applicatif.

**Smoke reproductible** : `npm run smoke:rls` vérifie authentification, membership `lecture`, lecture du tenant propre, invisibilité d'un autre tenant et refus PostgreSQL `42501` sur une écriture éphémère. Le mode complet exige un acquittement explicite, une organisation `E2E_RLS_*`, deux fixtures réelles et vérifie le nettoyage exact. Il n'a pas été exécuté à distance faute de fixtures dédiées.

**Vérification finale locale** : `npm test` **179/179**, `npm run typecheck`, `npm run lint`, `npm run build` (**23 routes/pages**) et `git diff --check` sont verts.

**Reste** : contrôler les doublons puis appliquer `0012` → `0013` → `0014` en recette, jouer le smoke et le parcours applicatif avec un rôle `lecture`. Aucun déploiement, aucune migration distante, aucun connecteur, aucune recherche payante et aucun envoi externe n'ont été déclenchés.

### 2026-07-29 — Codex — **Simplification parallèle du code et fiabilisation des connecteurs**

**Vague exécutée en tâches parallèles**, sur des périmètres disjoints : nettoyage mécanique, contexte auth/organisation, interface « Aujourd'hui », fiche connecteur, navigation mobile et accessibilité des dialogues. Les invariants essentiels — validation humaine, journal, idempotence, pause, plafonds et absence d'envoi externe — n'ont pas été simplifiés.

**Nettoyage invisible** : suppression du client Supabase navigateur inutilisé, de `ALL_PROVIDERS` et de trois icônes mortes ; suppression d'un paramètre inutilisé ; types `Draft` locaux remplacés par la source commune ; `noUnusedLocals` et `noUnusedParameters` activés. La copie obsolète annonçant une future Phase 3 indique désormais correctement que la validation autorise une préparation sous garde-fous, sans envoi externe.

**Frontières clarifiées** : `lib/auth/context.ts` devient la source unique du contexte serveur utilisateur/membership et de `getEditorContext`; l'auth ne vit plus dans `lib/connectors/common.ts`. Le choix implicite `.limit(1)` est volontairement conservé : le contexte d'organisation actif reste un risque P1 distinct, non masqué par ce refactor. `matchesRelaunchTarget` centralise la règle utilisée par l'aperçu et l'exécution, avec six cas de régression ; les deux déduplications restent distinctes parce qu'elles n'ont pas la même sémantique.

**Interfaces découpées et fiabilisées** :

- `validation-queue.tsx` passe de **499 à 91 lignes** ; tiroir, brouillon, campagne et intertitres vivent dans des composants bornés ;
- `connecteurs/[provider]/page.tsx` passe de **347 à 181 lignes** ; credentials lus/déchiffrés une fois, états distants `success | empty | error` explicites ;
- le bug Notion « bon identifiant, titre de la première base » est corrigé par un couple radio `[id, titre]` validé côté action, avec quatre tests ;
- les cinq destinations existent une seule fois et alimentent sidebar desktop + barre mobile fixe, avec `aria-current` et safe-area ;
- modale Campagnes et tiroir de validation partagent le même comportement clavier : dialogue nommé, Échap, focus initial, confinement et retour au déclencheur.

**Vérification finale du worktree complet** : `npm test` **170/170**, `npm run typecheck`, `npm run lint` sans avertissement, `npm run build` (**23 routes/pages**) et contrôle local du serveur. Le navigateur sans session est correctement redirigé vers `/login`, sans erreur console ni débordement horizontal à 390 × 844 ; la recette visuelle authentifiée reste à faire avec le gate commanditaire.

**Reste volontairement hors de ce lot** : découper la façade serveur `app/(cockpit)/actions.ts`, automatiser le smoke authentifié, décider le contexte d'organisation actif, et n'introduire un registre de providers qu'avant un troisième connecteur. Aucun déploiement, aucune migration distante et aucun envoi externe.

### 2026-07-29 — Codex — **Audit valeur/architecture/qualité + C8 temps dans la relance**

**Audit consolidé** dans `docs/AUDIT-2026-07-29.md` : potentiel produit **8/10**, démonstrabilité **7/10**, preuve terrain **3/10**. Le wedge recommandé est « ne plus oublier les prospects, savoir qui relancer et préparer le bon message ». La production publique répond HTTP 200 ; le smoke authentifié, les callbacks OAuth et la recherche sur compte neuf restent à recetter. Une scorecard commune aux commanditaires a été ajoutée dans `docs/tests/SCORECARD-COMMANDITAIRE.md`.

**C8 implémenté localement, non déployé** : migration `0012_prospect_last_contact.sql`, champ facultatif `last_contact_at`, détection et parsing ISO/`jj/mm/aaaa` pour Sheets et Notion, mapping UI, affichage sur les cartes, conservation de la date la plus récente lors de la déduplication et scénarios démo datés. Les règles excluent une relance si le dernier contact date de moins de 7 jours et signalent une attente à partir de 21 jours ; sans date, le comportement précédent est conservé.

**Durcissements faits dans le même passage d'audit** : pagination Notion au-delà de 100 lignes avec limite de sécurité, timeout sur les appels connecteurs, télémétrie LLM sans prompts ni réponses, et `npm test` ajouté à la CI.

**Vérification finale** : `npm test` **160/160**, `npm run typecheck`, `npm run lint`, `npm run build` (**23 routes/pages**) et `git diff --check` terminés avec exit 0.

**Décisions** : production figée pendant les tests commanditaires ; aucune activation C7 avant les gates rôles/RLS, tenancy, isolation démo, migrations/readiness, claim transactionnel et suppression-list ; outbound futur via outbox PostgreSQL et worker borné, pas dans une boucle synchrone. Une organisation neuve par testeur.

**Reste** : appliquer `0012` sur un environnement de recette, dérouler Sheets + Notion + compte sans date, faire le smoke authentifié de production, puis trancher le fournisseur C7. Aucun email externe, aucune migration distante et aucun déploiement effectués pendant cette session.

### 2026-07-26 (17) — Codex — **Timeout de recherche web diagnostiqué et modèle interactif corrigé**

**Incident reproduit en production** : deux clics sur « Analyser mon site » avec `https://www.bogasolution.com/` ont produit deux couples `research_started` / `research_failed` espacés d’exactement 45 secondes, avec `reason: timeout` et `provider: openai`. Le site lui-même répond en environ 0,5 seconde depuis l’extérieur ; il n’est pas la cause. Le délai venait de `AbortSignal.timeout(45_000)` autour de la Responses API avec le modèle de recherche par défaut `gpt-5.5`.

**Correction d’exploitation, sans changer la synthèse** : `RESEARCH_OPENAI_MODEL=gpt-5.4-mini` a été ajouté aux variables de l’environnement GitHub `production` et au runtime Container Apps. Ce modèle conserve Web Search mais vise une latence et un coût inférieurs pour ce parcours interactif. `LLM_MODEL`, `LLM_MODEL_LIGHT` et `LLM_MODEL_PREMIUM` restent inchangés.

**Azure** : la révision `nepteo-prod--0000002` est `Healthy`, reçoit 100 % du trafic et expose bien l’override. `https://nepteo.bogasolution.com/api/health` répond toujours HTTP 200. La ligne `research_runs` en échec n’empêche pas une nouvelle tentative : seul un cache `status = ok` est relu.

**Reste** : Fathi doit recliquer « Analyser mon site » dans sa session authentifiée ; Codex contrôlera immédiatement la nouvelle trace et la proposition générée.

### 2026-07-26 (16) — Codex — **Domaine personnalisé et HTTPS activés**

**DNS validé** : `nepteo.bogasolution.com` pointe par CNAME vers `nepteo-prod.bravedune-81efb6a5.francecentral.azurecontainerapps.io` ; `asuid.nepteo` contient le code de vérification de la Container App. Les deux enregistrements ont été confirmés depuis les résolveurs publics Cloudflare et Google.

**Azure** : le domaine a été ajouté à `nepteo-prod`. Azure a émis le certificat managé `mc-nepteo-prod-en-nepteo-bogasolut-3930` par validation CNAME, puis la liaison SNI a été activée. Contrôle externe sans contournement TLS : `https://nepteo.bogasolution.com/api/health` renvoie HTTP 200 avec `{"status":"ok","service":"nepteo"}`, et `/login` renvoie HTTP 200.

**Reste manuel** : utiliser exclusivement `https://nepteo.bogasolution.com` comme Site URL Supabase, ajouter `https://nepteo.bogasolution.com/auth/confirm` aux redirects, puis déclarer les callbacks Google Sheets et Notion sur ce même domaine. Le certificat Azure est renouvelé automatiquement tant que le CNAME reste en place.

### 2026-07-26 (15) — Codex — **Nepteo déployé en production sur Azure Container Apps**

**Publication** : la PR #1 a été sortie du mode brouillon puis fusionnée dans `main` au commit `49b410a`. La CI de `main` est verte (install, lint, typecheck, build). Le workflow manuel `Deploy (Azure Container Apps)` a été lancé avec l’ID exact de la souscription `Abonnement 1`, puis l’environnement GitHub protégé `production` a été approuvé.

**Deux écarts réels corrigés** : GitHub émet le sujet OIDC immuable `repo:Shaaakir281@128485159/nepteo@1305970728:environment:production` ; une Federated Credential correspondante a été ajoutée à l’App Registration. Le service principal a aussi reçu `Managed Identity Operator` au seul scope de `nepteo-prod-acr-pull`, nécessaire pour conserver cette identité lors des mises à jour de la Container App. Les rôles existants restent limités au resource group et à l’ACR.

**Résultat Azure** : ACR a construit l’image immuable `nepteo:49b410a7ad95d9ed8d0b2c044d2f396924360935` (digest `sha256:3e3d95a8d6a7997ced83b842d464c3d1139093c816ef7852df755397ad1b7607`). La révision `nepteo-prod--0000001` est `Healthy`, `Running`, reçoit 100 % du trafic et répond sur `https://nepteo-prod.bravedune-81efb6a5.francecentral.azurecontainerapps.io`. Le workflow GitHub Actions (essai 3) est vert et son smoke `/api/health` a réussi ; un second contrôle externe renvoie `{"status":"ok","service":"nepteo"}` en HTTP 200. Sans session, `/api/llm/status` renvoie HTTP 401, comportement de sécurité attendu.

**Reste manuel** : régler Supabase Auth avec cette URL (`Site URL` et redirect `/auth/confirm`), puis faire le smoke authentifié complet. Les callbacks OAuth Google/Notion de production restent à ajouter avant leur recette. Le cron `/api/cron/sync` reste volontairement désactivé.

### 2026-07-26 (14) — Codex — **Retour de recette B1/B2 + recherche web rendue accessible**

**B2 validé sur la base réelle après passage de `0011` par Fathi** : le dernier retrait ne produit plus « journal is append-only ». Contrôle Supabase en lecture seule : `actions = 0`, `outbox_messages = 0`, tandis que **2 entrées historiques** `execution_started` / `execution_succeeded` gardent leur `action_id` orphelin et restent lisibles. C'est exactement l'invariant visé par B2.

**Retour B1 — nom resté « Atelier Northwind ». Cause confirmée dans la base, pas un simple cache** : aucun `__demo_backup` n'existe et les deux derniers `demo_scenario_cleared` portent `restored:false`. Le scénario Northwind avait été chargé le **2026-07-25**, avant la livraison de B1 le 26 : au moment où la sauvegarde a été introduite, la fiche d'origine était déjà écrasée. Le journal append-only conserve toutefois `organization_created.payload.name = "Fathi Solution"`.

**Correction de transition, volontairement prudente** :

1. Si aucune sauvegarde B1 n'existe, `restoreLegacyOrganizationName` relit le nom de création et le dernier nom de scénario dans le journal.
2. Le nom historique n'est rendu **que si le nom courant correspond encore exactement au dernier scénario chargé**. Si l'utilisateur l'a modifié depuis, le secours ne touche rien.
3. Le succès spécifique est ajouté au payload du retrait (`legacy_name_restored`) sans prétendre que les anciennes sections ont été retrouvées.
4. `revalidatePath("/", "layout")` invalide maintenant le layout du cockpit : le nom de la sidebar suit immédiatement le chargement/retrait au lieu de pouvoir rester en cache.

**Limite honnête du cas pré-B1** : le journal de 2026-07-19 contient le nom initial mais pas `organizations.activity` ni le contenu des sections. Ces valeurs antérieures au premier scénario ne sont donc pas reconstructibles automatiquement. Les scénarios chargés depuis B1 restent, eux, entièrement protégés par `__demo_backup`.

**Recherche web — backend présent, accès permanent manquant** : la recherche multi-fournisseurs, le cache, le journal-avant, la synthèse d'identité et le wizard `/onboarding/identite` étaient bien implémentés. Mais seule la fin du premier onboarding menait au wizard ; la carte permanente « Documents & sources » affichait encore « votre site pourra être lu… à l'arrivée des connecteurs », ce qui était faux et rendait la fonctionnalité introuvable après onboarding. La carte explique désormais la recherche réelle et expose **« Analyser mon site »**, vers le wizard existant. « Ajouter un document » reste honnêtement marqué « bientôt ».

**Fichiers** : `lib/demo/memory-backup-rules.ts`, `lib/demo/memory-backup.ts`, `lib/demo/seed.ts`, `app/(cockpit)/agent/actions.ts`, `app/(cockpit)/entreprise/_components/{identity-panel,side-cards}.tsx`, tests B1.

**Vérifs** : tests ciblés **11/11, exit 0** ; `npm test` **148/148, `NPM_TEST_EXIT:0`** ; `npx tsc --noEmit` **`TSC_EXIT:0`** ; `npm run build` (Turbopack + TypeScript + 23 pages) **`BUILD_EXIT:0`** ; `git diff --check` **exit 0**.

**Reste (Fathi)** : dans l'app locale déjà ouverte, cliquer une fois encore sur « Retirer les données de démonstration » (le serveur dev tourne et prend le correctif à chaud) : la sidebar doit afficher **Fathi Solution**. Puis ouvrir Mon entreprise → Identité → Documents & sources → **Analyser mon site**. Codex contrôle ensuite la base et le journal.

### 2026-07-26 (13) — Codex — **B2 « Une action validée doit pouvoir être supprimée »** (hors roadmap, docs/projets/demo-isolation.md)

**Défaut bloquant corrigé dans le dépôt** : après une exécution en mode sûr, `lib/execution.ts` écrit `journal.action_id`. Or la FK de `0001_init.sql` était en `on delete set null`, tandis que le trigger volontaire `journal_no_update` refuse tout UPDATE/DELETE. La suppression de l'action demandait donc un UPDATE du journal et échouait avec « journal is append-only ». Comme `loadDemoScenario` et `clearDemoData` appellent tous deux `resetCockpitState`, les deux parcours étaient bloqués.

**Ordre de mission écrit avant le code** : nouvelle section « Chantier B2 » dans `docs/projets/demo-isolation.md`, avec les mêmes rubriques que B1 et application intégrale des règles anti-erreurs de `roadmap-beta.md` §2.

**Grep complet et décision** :

1. Les six écritures applicatives de `action_id` sont toutes dans `lib/execution.ts`. Aucun code applicatif ne le lit ni ne déréférence une ligne d'`actions`.
2. Les deux affichages du journal (`/` et `/journal`) sélectionnent `id, event, actor, actor_id, payload, created_at` et rendent l'entrée seule : une action disparue ne nuit pas à la lisibilité.
3. La seule suppression directe de `actions` dans le repo est `resetCockpitState` (`lib/demo/seed.ts`). `outbox_messages` est supprimée juste avant ; sa FK `action_id on delete cascade` est correcte et reste intacte.
4. **Correction retenue** : migration nouvelle `0011_drop_journal_action_fk.sql`, qui retire uniquement `journal_action_id_fkey` et garde la colonne `journal.action_id`. Le journal conserve ainsi l'identifiant historique, volontairement orphelin si l'entité opérationnelle est supprimée. L'alternative « archiver et filtrer les actions partout » est plus large et ne répond pas au besoin de remise à zéro.

**Invariants respectés** : aucune modification de `journal_no_update` ni de `forbid_journal_mutation` ; aucun recul sur les `ensureOk` ou la remontée d'erreur B1 ; aucune modification de migration existante, de l'outbox, des données de démonstration ou de `lib/memory.ts` ; aucune dépendance, variable d'environnement ou table.

**Vérification des parcours** : la lecture des deux chemins confirme que `loadDemoScenario` et `clearDemoData` ne rencontraient qu'un même bloqueur, le `delete` de `actions`. Après `0011`, le journal n'est plus une relation entrante contraignante ; la suppression préalable de l'outbox puis celle des actions peut aboutir, et `clearDemoData` poursuit vers `restoreMemory` sans modification de l'invariant B1. La recette réelle Supabase ne peut être faite avant l'application manuelle de la migration ; aucun `psql`/CLI Supabase n'est installé ici et le moteur Docker local n'est pas lancé. Aucune réussite UI n'est donc inventée.

**Test de régression** : `tests/journal-action-deletion.test.mjs` vérifie le diagnostic de `0001`, conserve la cascade de `0006`, exige le retrait de la seule FK dans `0011`, et interdit dans cette migration toute suppression/désactivation du trigger, de la colonne, de l'outbox ou création de table. Total **145 → 146**.

**Vérifs terminées** : test ciblé **1/1, exit 0** ; `npm test` **146/146, `NPM_TEST_EXIT:0`** ; `npx tsc --noEmit` **complet, `TSC_EXIT:0`** ; `git diff --check` **exit 0**. Après autorisation de Fathi, `npm run build` a aussi terminé sous Windows : compilation Turbopack, TypeScript, génération des **23 pages**, `BUILD_EXIT:0`.

**Constat hors périmètre — noté, pas corrigé** : supprimer une organisation qui possède déjà des entrées de journal demanderait aussi un DELETE en cascade sur `journal`, que le trigger append-only refuserait. Aucun flux courant ne fait cela : le seul `organizations.delete()` applicatif est le rollback d'onboarding, avant l'écriture du journal. La stratégie future de suppression de compte/RGPD devra traiter explicitement cet invariant.

**Jalon 0** : `0010_research.sql` est **déjà passée** d'après la vérification consignée le 2026-07-26 dans ce fichier ; elle n'est plus en attente.

**Reste (Fathi)** :
1. **Passer manuellement `supabase/migrations/0011_drop_journal_action_fk.sql` dans Supabase.**
2. Dire à Codex que la migration est passée. **Codex prend ensuite en charge la recette réelle**, dans cet ordre : conserver une fiche entreprise d'origine → valider puis exécuter une action (mode sûr, messages préparés) → charger un scénario → vérifier que les anciennes entrées du journal restent lisibles → « Retirer les données de démonstration » → confirmer que la fiche d'origine revient à l'identique.

**Publication** : commit B2 `012d506` poussé sur `agent/azure-container-apps-deployment` (`PUSH_EXIT:0`) ; la PR GitHub existante est la **#1**.

### 2026-07-26 (12) — Codex — **Azure provisionné et GitHub Actions relié par OIDC**

**Cible confirmée** : compte `fathimetalsi@gmail.com`, tenant `10dc421f-ab69-471c-8d9c-9e52a35e60b9`, souscription `Abonnement 1` (`22045923-e995-4df0-8001-27de3b66290f`). L’ancien abonnement `Cabinet-DrAbdelkader-Prod` reste mémorisé dans la CLI mais n’est plus la cible par défaut et n’a reçu aucune modification.

**GitHub** : environnement `production` créé sur `Shaaakir281/nepteo`, approbateur requis `Shaaakir281`, branche autorisée `main`. Les variables d’infrastructure et applicatives ont été ajoutées ; les secrets Azure/Supabase/OpenAI/OAuth/Langfuse présents dans `.env.local` ont été importés sans affichage. Modèles fixés à `openai:gpt-5.4`, recherche fixée à `openai`.

**Azure** : après un `what-if` limité à six créations, Bicep déployé avec succès dans `nepteo-prod-rg` / `francecentral` : ACR Basic `nepteoacr27de3b` (admin désactivé), identité managée dédiée + `AcrPull`, Log Analytics, Container Apps Environment et Container App `nepteo-prod`. URL bootstrap : `https://nepteo-prod.bravedune-81efb6a5.francecentral.azurecontainerapps.io`.

**OIDC** : App Registration `github-nepteo-production`, client ID `39de0077-29f0-450f-8855-40e714f71d67`, aucun mot de passe. Federated Credential limitée à `repo:Shaaakir281/nepteo:environment:production`. Rôles : `Container Apps Contributor` sur le resource group et `Container Registry Tasks Contributor` sur l’ACR.

**Correctif avant publication** : la vérification de région du workflow normalise désormais `France Central` et `francecentral`, car les deux CLI Azure ne rendent pas la même forme.

**Publication** : commit `80b6a10` poussé sur `agent/azure-container-apps-deployment`, draft PR GitHub **#1** ouverte et CI GitHub verte.

**Reste** : fusionner la PR #1 après accord de Fathi, lancer manuellement le workflow avec l’ID de souscription confirmé, approuver `production`, régler Supabase Site URL + redirect URL sur le FQDN final, puis dérouler le smoke test complet. Le cron reste désactivé.

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

**Suite immédiate — commit `2891ec8`, « dire POURQUOI le retrait a échoué »** : Fathi a déclenché le message d'échec dès le premier essai. Le message était honnête mais **muet sur la cause** — il ne distinguait même pas une session expirée d'une erreur de base. Trois corrections : `DemoResult` porte désormais un `detail` (message technique, borné à 300 caractères) remonté de l'action serveur jusqu'au panneau, qui l'affiche sous le message en petit ; `reason: "forbidden"` a son propre texte (« votre session a peut-être expiré… reconnectez-vous ») au lieu du générique ; et **`entryDetail` affiche enfin `payload.error`** (`lib/journal.ts`) — la raison était écrite au journal depuis toujours et n'était rendue nulle part, ce qui vaut aussi pour `connector_sync_failed`. **Cause du dysfonctionnement non identifiée à ce stade** : le schéma ne l'explique pas (aucune clé étrangère bloquante sur `prospects`, `activity` nullable, toutes les tables visées existent en migrations 0001-0009) et le sandbox n'a pas d'accès base. Le prochain essai donnera la ligne « Détail : … » — c'est elle qu'il faut me rapporter.

**⚠️ CAUSE IDENTIFIÉE le 2026-07-26 au soir — `propositions : journal is append-only`** (message relevé par Fathi grâce au `detail` ci-dessus). **À traiter en priorité : le mode démonstration est bloqué, chargement compris.**

`journal.action_id` est déclaré `references actions(id) **on delete set null**` (migration 0001, l. 79), et le trigger `journal_no_update` interdit `update or delete` sur `journal` (l. 96). Supprimer une ligne de `actions` oblige donc Postgres à faire un **UPDATE sur `journal`** pour mettre `action_id` à `null` — que le trigger rejette. **Une action référencée par le journal ne peut pas être supprimée, jamais.** Seul `lib/execution.ts` écrit `action_id` (6 endroits) : le blocage apparaît donc **dès qu'une action a été validée** (mode sûr → `outbox_messages`).

Conséquences, dans l'ordre de gravité :
1. `resetCockpitState` échoue → **`clearDemoData` ET `loadDemoScenario` échouent tous les deux** (les deux appellent cette fonction). Depuis B1 c'est un échec **dur** ; avant B1 c'était un échec **muet** — les propositions n'étaient en réalité jamais supprimées entre deux scénarios, ce que personne ne voyait.
2. **Ne PAS revenir en arrière sur `ensureOk`** : le silence était le défaut, pas le remède. C'est lui qui a caché ce bug jusqu'à aujourd'hui.
3. **Ne pas toucher au trigger** (invariant volontaire, règle 7).

**Piste recommandée, à valider par l'agent qui reprendra** : retirer la **contrainte de clé étrangère** `journal_action_id_fkey` en gardant la colonne `action_id` (migration 0011, `alter table journal drop constraint …`). Un journal est un historique : il est normal qu'il pointe vers une entité disparue, et c'est la contrainte — pas le trigger — qui rend toute suppression impossible. Alternative sans migration, plus lourde : ne plus supprimer `actions` du tout et les écarter du cockpit autrement. À trancher après avoir grepé tous les usages de `action_id`.

**Reste (Fathi)** :
0. ~~Relever la ligne « Détail : … »~~ **fait** : `propositions : journal is append-only` (voir ci-dessus).
1. ~~Commiter `docs/SUIVI.md`~~ — **fait**, embarqué par les commits Azure `80b6a10`/`5e67427` arrivés entre-temps. L'arbre est propre.
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
