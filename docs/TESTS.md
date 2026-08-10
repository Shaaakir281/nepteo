# Procédure de test — connecteurs & Phase 2

Jeu de données : `docs/tests/prospects-test.csv` (24 prospects, 5 sans email, statuts variés — conçu pour déclencher les 2 règles d'analyse).

> Pour la recette commanditaire actuelle, commencer par `docs/demo/GUIDE-TEST.md` et reporter les résultats dans `docs/tests/SCORECARD-COMMANDITAIRE.md`. Cette procédure reste la référence technique des connecteurs. C8 ajoute le champ facultatif « Dernier contact » via la migration `0012`.

## 0. Prérequis (une fois)

1. **Migrations — uniquement en développement/recette d'abord** : appliquer tous les fichiers de `supabase/migrations/` dans l'ordre, de préférence avec `supabase db push`. Sur une base à jour jusqu'à `0011`, l'ordre est :

   - `0012_prospect_last_contact.sql` ;
   - `0013_single_organization_per_user.sql` ;
   - `0014_company_memory_service_writes.sql` ;
   - `0015_financial_role_boundaries.sql` ;
   - `0016_schema_readiness.sql` ;
   - `0017_research_daily_quota.sql` ;
   - `0018_atomic_action_decisions.sql` ;
   - `0019_commercial_rls_catchup.sql` ;
   - `0020_value_events.sql` ;
    - `0021_atomic_csv_import.sql` ;
    - `0022_website_preview.sql` ;
    - `0023_website_preview_apply.sql` ;
    - `0024_unlimited_research_and_structured_preview.sql` ;
    - `0025_campaign_proposals.sql` ;
    - `0026_campaign_studio.sql` ;
    - `0027_campaign_decision_cockpit.sql` ;
    - `0028_creative_assets.sql`.

   Avant `0013`, contrôler les doublons :

   ```sql
   select user_id, count(*)
   from public.memberships
   group by user_id
   having count(*) > 1;
   ```

   Si la requête renvoie une ligne, arrêter et arbitrer explicitement les memberships concernés. `0013` échoue volontairement sans modifier les données ; ne pas supprimer automatiquement une appartenance. Après `0015`, exécuter le [smoke authentifié/RLS](tests/SMOKE-AUTH-RLS.md), puis compléter par une recette manuelle du rôle commercial ; le smoke automatisé actuel couvre le rôle lecture. `0016` crée le marqueur de readiness après avoir vérifié les prérequis critiques ; les migrations suivantes le portent progressivement à 28. Depuis une base à 21, respecter `0022 → 0023 → 0024 → 0025 → 0026 → 0027 → 0028`. Le projet lié est déjà à 28 : ne jamais rejouer `0028`. Toute nouvelle base doit recevoir la migration d'abord en staging/recette, dans l'ordre, avant une promotion explicitement autorisée. (« Success. No rows returned » est normal pour une migration de schéma.)
2. **`CONNECTOR_TOKEN_ENCRYPTION_KEY` et `CRON_SECRET`** : ces clés ne se « trouvent » nulle part — **c'est toi qui les fabriques**. Ouvre PowerShell et lance **deux fois** :

   ```powershell
   $b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```

   Chaque exécution affiche une chaîne aléatoire : colle la 1re comme valeur de `CONNECTOR_TOKEN_ENCRYPTION_KEY=`, la 2de comme `CRON_SECRET=`. Ne plus jamais changer la clé de chiffrement ensuite (sinon les connecteurs devront être reconnectés).
3. **Clé IA — tests avec OpenAI** (pas encore de clé Anthropic) : la couche LLM est multi-fournisseurs, il suffit d'ajouter dans `.env.local` :

   ```
   OPENAI_API_KEY=sk-...
   OPENAI_IMAGE_MODEL=gpt-image-2
   LLM_MODEL=openai:gpt-5.4
   LLM_MODEL_LIGHT=openai:gpt-5.4
   LLM_MODEL_PREMIUM=openai:gpt-5.4
   ```

   Pour cette release, `OPENAI_API_KEY` est obligatoire dans l'environnement de déploiement afin d'activer la Story. `OPENAI_IMAGE_MODEL` est facultative, propagée au runtime et vaut `gpt-image-2` par défaut. L'analyse utilise la tâche `recommend_action` → niveau premium, d'où les trois lignes `LLM_MODEL*`. Sans clé de texte compatible, l'analyse retombe sur ses templates, mais la génération d'image ne dispose pas de ce repli.
4. Redémarrer `npm run dev` après toute modif d'env.

> **État au 10 août 2026 — release courante attestée** : la PR #31 est fusionnée
> dans `main` au SHA `7424d2926e6423e1af674c741eb90dc1fcd914a3` après la CI
> `31368969929`. Le déploiement `31369161993` est vert et la révision
> `nepteo-prod--0000023`, latest et ready, sert 100 % du trafic avec l'image
> `nepteoacr27de3b.azurecr.io/nepteo:7424d2926e6423e1af674c741eb90dc1fcd914a3`.
> Supabase et l'application restent alignés sur le schéma 28. La recette Story,
> les contrôles JWT/RLS et le Storage privé signé restent attestés par la PR #29 ;
> la concurrence et l'isolation inter-tenant complètes restent des recettes séparées.

### Deux voies de données, jamais mélangées

Choisir exactement une voie par organisation :

1. **Scénario d'exemple Nepteo** : charger l'une des trois variantes natives dans une organisation vide. Le connecteur porte le scénario, `seed_version = 2` et l'heure de chargement ; l'état complet et cohérent est classé techniquement `certified-demo`, tandis que la surface présente ses artefacts marqués comme des « données d'exemple ». Recetter `seed → analyse → actions préparées → reset → reseed identique`.
2. **Environnement de test alimenté par le testeur** : retirer d'abord tout scénario Nepteo, puis saisir des données ou utiliser Google Sheets, Notion ou CSV. L'interface reste « Environnement de test » et indique que les données saisies ou importées peuvent être réelles ou synthétiques ; elle n'en déduit jamais la provenance. Les résultats de cette voie peuvent alimenter une preuve terrain seulement selon le protocole de la scorecard.

Les événements `is_demo = true` de la voie A sont toujours exclus des gates terrain. Un scénario actif doit bloquer OAuth, synchronisation et import ; aucun test ne doit superposer une feuille ou un CSV au scénario.

### Historique — contrat PR #17 attesté en production

La release courante inclut ce contrat et sa preuve de production :

1. Toutes les surfaces de la voie A emploient « scénario d'exemple Nepteo » et
   « données d'exemple », sans exposer `certified-demo` comme texte produit ;
   les anciens libellés ont disparu.
2. La voie B reste « environnement de test » et précise que les données saisies
   ou importées par le testeur peuvent être réelles ou synthétiques.
3. La couverture automatisée vérifie la course de rendu : si l'inventaire
   devient dangereux avant le clic, le serveur retourne
   `unsafe_existing_data` avant sauvegarde, invalidation, reset ou seed, puis le
   latch UI fail-closed désactive les trois chargements.
4. La recette authentifiée confirme la source du briefing, l'identité en lecture
   seule, la redirection de `/onboarding/identite` vers « Mon entreprise » avec
   le message de garde, Northwind actif sans mutation et une console navigateur
   vide.

### Contrat CSV V1

- fichier strictement UTF-8, au plus **900 Ko**, **5 000 lignes de données** et 100 colonnes ;
- séparateur virgule, point-virgule ou tabulation, avec support de `sep=;` et rejet des séparateurs ambigus ;
- auto-mapping non ambigu de nom, email, entreprise, statut, notes et dernier contact : un en-tête ne peut servir qu'une fois ;
- confirmation explicite que les données sont autorisées ; seuls ces six champs sont conservés et peuvent nourrir analyses et brouillons, les colonnes inconnues sont ignorées ;
- identifiants stables dérivés de l'email normalisé ou, à défaut, du couple nom/entreprise ; réordonner les lignes ou modifier une note ne recrée pas tous les prospects ;
- remplacement idempotent et retrait explicite du seul import CSV ; les autres connecteurs restent intacts ;
- remplacement, suppression des artefacts CSV devenus obsolètes, métadonnées et journal exécutés atomiquement par les RPC service-role de `0021`, sous verrou `data`.
- le retrait supprime contacts, propositions liées à la source et briefing courant ; le journal append-only et le cache des recherches d'entreprise déjà demandées restent conservés. Ce retrait de source ne vaut pas effacement RGPD complet du tenant.

### Contrats de sécurité locaux

Avant toute recette distante, lancer :

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Passage de référence de la release actuelle : **574/574 tests**, typecheck,
lint et build verts, **29 pages/routes** générées et aucun défaut P1 ou P2 lors
de la relecture finale. PR #31 est fusionnée au SHA
`7424d2926e6423e1af674c741eb90dc1fcd914a3`, avec la CI de PR `31368969929`
verte, puis le déploiement `31369161993` vert.

**Lot du 10 août — simplifications auth mobile déployées** : le contrôle
navigateur local à 463 px et la recette de production sur `/login` et `/signup`
confirment le basculement Afficher/Masquer sans perte de la valeur saisie. Le lot
est servi par `nepteo-prod--0000023` et n'ajoute ni migration ni changement de
connecteur.

Le tableau Supabase expose la Site URL et le callback `/auth/confirm` de
production. Le modèle « Confirm signup » français est publié et sa source
versionnée conserve `{{ .ConfirmationURL }}`. Cette vérification de configuration
ne remplace pas la recette d'un nouvel email : un message ancien garde son ancien
`redirect_to` et doit être abandonné.

Recette mobile authentifiée à finaliser en production avec une fixture dédiée,
en 390 × 844 :

1. se connecter avec un compte de test, toucher « Déconnexion » dans l'en-tête
   et vérifier la redirection vers `/login` ;
2. utiliser le bouton Retour et vérifier que le cockpit ne réapparaît pas ;
3. sur `/login` puis `/signup`, saisir un mot de passe, l'afficher, le masquer et
   vérifier que sa valeur reste inchangée ;
4. confirmer que la barre mobile n'ajoute aucune entrée Déconnexion, affiche
   uniquement les destinations autorisées par le rôle et ne déborde pas
   horizontalement ; un compte admin/financier en voit cinq.

Le point 3 est attesté dans le navigateur local à 463 px et sur les deux pages de
production. Le point 4 est couvert par les contrats automatisés et la structure
de navigation. Les points 1 et 2 restent volontairement ouverts faute de session
mobile authentifiée dédiée ; les tests couvrent le formulaire, l'action serveur
réutilisée et le nom accessible du bouton, mais ne remplacent pas ce parcours runtime.

Recette email encore ouverte : demander un **nouvel** envoi, vérifier le sujet et
le corps français, confirmer que le lien ne contient jamais `0.0.0.0`, passe par
`/auth/confirm` puis aboutit dans l'application. Un message émis avant la correction
conserve son ancien `redirect_to` et ne constitue pas une preuve valable.

**Historique — lot livré jusqu'à la PR #11** : **341/341 tests**, lint,
typecheck et build Next.js 16.2.10 verts ; **23 pages/routes** générées.

Les tests couvrent notamment :

- le contrat auth mobile : présence d'un formulaire de déconnexion dans l'en-tête masqué sur desktop, nom accessible du bouton, champ mot de passe partagé, boutons Afficher/Masquer non-submit et `autocomplete` distinct entre connexion et inscription ;
- la matrice de rôles et le filtrage RLS fail-closed de `0015`, réappliqués par `0019` : le commercial ne voit aucun contenu libre/dérivé (mémoire, recherches, briefings, actions, journal, outbox), seulement les colonnes prospects expurgées, le nom de l'organisation et les métadonnées non sensibles des connecteurs non financiers ; `organizations.activity`, `connectors.config` et les credentials restent côté serveur ;
- l'isolation des deux voies : administrateur uniquement pour le scénario, organisation vide au seed, certification V2 fail-closed, retrait obligatoire avant import, sauvegarde validée, verrou partagé avec les mutations de données apportées et nettoyage sélectif ;
- `/api/health` sans dépendance base et `/api/ready` exigeant le marqueur de schéma `>= 28` pour le lot créatif déployé ;
- le quota de recherche atomique de `0017`, séparé du cache et sérialisé avec la pause : une pause gagnante ne réserve rien ; les appels forcés ou échoués après claim consomment une réservation, mais seul `status = ok` sert une réponse en cache ;
- les RPC transactionnelles de `0018` pour décisions, claim, finalisation, pause et autonomie, avec reprise fail-closed en cas d'état ambigu ;
- le Top 5 de R1B : filtre d'autorisation avant classement, plafond strict de cinq actions et justification « Pourquoi maintenant » déterministe ;
- la cohorte prospects partagée : pagination bornée à 5 000, ordre stable, double snapshot, dédoublonnage après lecture complète et suspension de tous les agrégats sur une lecture partielle ou incohérente ;
- la canonicalisation multi-source : terminal/DNC/opposition prioritaire, conflit de statuts actifs non relançable, dernier contact valide le plus récent, homonymes sans email distincts en métier et application avant le snapshot sur proposition, approbation et préparation ;
- la stabilité opérationnelle du snapshot : inversion du représentant Sheets/Notion réconciliée avec l'ID figé, identité disparue exclue, et verrou partagé avec les synchronisations pendant l'approbation et l'exécution ;
- la concurrence d'analyse : clic, cron et démonstration partagent le même verrou distribué avant le journal et le moteur ; une passe Ads échouée après une analyse prospects réussie remonte comme succès partiel, y compris quand Supabase renvoie une propriété `error` sans lever d'exception ;
- `0020` : cohorte de relance figée dans la transaction d'approbation, `value_events` append-only, séparation stricte des organisations, idempotence des déclarations et résultats aval rattachés à un prospect de la cohorte.
- `0028` : bucket créatif privé, réservation atomique des quotas, versions et sélection/finalisation uniques, chemin pending réconciliable, puis validation campagne + visuel dans la transaction de décision sans publication fournisseur.

Après application sur une base de recette, vérifier séparément :

1. `GET /api/health` renvoie 200 si le processus répond ;
2. `GET /api/ready` renvoie 200 uniquement si Supabase est joignable et `app_schema_version.version >= 28` pour le lot créatif ;
3. le chargement d'une démo est refusé hors rôle admin ou dans une organisation contenant une donnée réelle ;
4. deux recherches simultanées ne peuvent pas dépasser le quota quotidien ;
5. deux décisions ou exécutions concurrentes ne produisent qu'un gagnant ;
6. « Aujourd'hui » affiche au plus cinq propositions autorisées, ordonnées, chacune avec sa raison « Pourquoi maintenant » ;
7. l'approbation d'une relance fige ses cibles, puis les suites terrain sont déclarées prospect par prospect sans aucun envoi externe.

### Recette croisée Story et Connecteurs — post-déploiement

La production est alignée sur le schéma 28 et l'application courante `0000023`.
La preuve Story ci-dessous a été établie sur PR #29 / `0000022` ; le code Story
est inchangé dans `0000023`, mais ce parcours payant n'y a pas été rejoué.

1. **Vert historique en production — PR #29 / `0000022`** : campagne → studio Story prérempli → génération `gpt-image-2` → rechargement de l'objet privé signé → sélection → approbation atomique campagne + visuel. Miniature, journal, statut final et absence de publication fournisseur vérifiés ;
2. **À jouer** : approuver une autre campagne sans visuel, rouvrir le studio, générer puis choisir une version ; vérifier que ce choix devient le visuel validé sans lancement ni publication ;
3. **À jouer sur staging/recette** : provoquer un échec Storage après réservation, vérifier le chemin pending, puis lancer uniquement la rétention créative contrôlée et constater la suppression de l'objet abandonné et la remise à zéro du chemin ;
4. **Partiel** : la surface Connecteurs et les liens OAuth Google Sheets/Notion/Meta sont verts sans erreur. Les callbacks, lectures réelles, puis les états pause, reprise et révocation restent à recetter ; aucun OAuth n'a été déclenché pendant la recette Story.

Les tests Node contrôlent les contrats statiques. La recette production a ajouté la preuve JWT : asset propre visible, `creative_generation_requests` et update direct refusés en `42501`, Storage direct refusé en 404 et URL signée lisible en 200. Elle ne remplace pas les tests PostgreSQL à deux sessions, l'isolation inter-tenant complète, les courses de réservation/sélection/approbation ni la panne Storage ; ces scénarios restent obligatoires sur staging/recette avant de déclarer la porte base entièrement fermée.

Pour toute prochaine recette Story, créer une fixture persistante distincte
`E2E_CREATIVE_*`, avec son organisation marquée, son acteur `.invalid` dédié et
un inventaire qui couvre explicitement `creative_assets`,
`creative_generation_requests` et le bucket. Ne plus réutiliser
`E2E_RLS_CSV_OWN` : cette organisation reste réservée au smoke CSV et exige un
acteur admin stable. Les données de chaque run créatif restent éphémères ; la
fixture et le journal append-only restent identifiables pour l'audit.

### Smoke réel des RPC CSV

Le smoke `0021` utilise exclusivement deux organisations synthétiques réservées,
`E2E_RLS_CSV_OWN` et `E2E_RLS_CSV_OTHER`. Il crée la fixture si elle n'existe
pas, refuse tout état métier préexistant, vérifie le refus inter-tenant, l'import
valide, le rollback d'une date invalide, le rejeu idempotent et le retrait. Il ne
touche jamais au tenant vitrine. Les organisations et les événements du journal
append-only sont conservés pour rendre les recettes suivantes identifiables.

```powershell
$env:CSV_RPC_SMOKE_WRITE_PROBE = "I_ACKNOWLEDGE_E2E_CSV_PRODUCTION_FIXTURES"
npm run smoke:csv-rpc
Remove-Item Env:CSV_RPC_SMOKE_WRITE_PROBE
```

La commande exige `NEXT_PUBLIC_SUPABASE_URL` et
`SUPABASE_SERVICE_ROLE_KEY`, chargées depuis `.env.local` si présent. Les
contacts utilisés portent uniquement des adresses `.invalid`.

Résultat de production du 31 juillet 2026 : smoke vert sur
`E2E_RLS_CSV_OWN` et `E2E_RLS_CSV_OTHER`, avec refus inter-tenant, import
valide, rollback, rejeu idempotent et retrait vérifiés.

Contrôle du 9 août 2026 : après le retrait de l'acteur temporairement utilisé
par la recette Story, un nouvel acteur `.invalid` dédié et son membership admin
ont été provisionnés sur `E2E_RLS_CSV_OWN`. Le smoke officiel a ensuite repassé
au schéma 28 ses six contrôles : refus inter-tenant, import valide, rollback,
rejeu idempotent, retrait et second retrait `not_found`. Les deux organisations,
l'acteur dédié et le journal append-only restent conservés ; les tables métier
de la fixture sont revenues à zéro.

### Recette technique de production — PR #31

- PR [#31](https://github.com/Shaaakir281/nepteo/pull/31) fusionnée au SHA
  `7424d2926e6423e1af674c741eb90dc1fcd914a3` ;
- CI `31368969929` et déploiement `31369161993` verts ;
- 574/574 tests, typecheck, lint et build verts, 29 pages/routes générées ;
- révision `nepteo-prod--0000023`, latest et ready, état
  `Succeeded`/`Running`, Healthy/Provisioned/RunningAtMaxScale avec une réplique,
  100 % du trafic, image
  `nepteoacr27de3b.azurecr.io/nepteo:7424d2926e6423e1af674c741eb90dc1fcd914a3` ;
- schéma Supabase 28 inchangé ; aucune migration ni aucun connecteur modifié ;
- `/` aboutit à `/login` en 200 ; `/login`, `/signup`, `/api/health` et
  `/api/ready` répondent 200. Health/readiness sont aussi verts sur le FQDN Azure ;
- sur connexion et inscription, Afficher/Masquer fait passer le champ de
  `password` à `text` et conserve la valeur saisie ;
- la Site URL `https://nepteo.bogasolution.com`, le callback unique
  `/auth/confirm` et le modèle Confirm signup français sont configurés. Le clic
  d'un nouvel email et Déconnexion puis Retour en session mobile restent ouverts.

### Historique — recette technique de production PR #29

- PR [#29](https://github.com/Shaaakir281/nepteo/pull/29) fusionnée au SHA
  `c5e7148ad62908a52536f6b2b52fd32ed0c357c0` ;
- CI `31332578671` et déploiement `31332676182` verts ;
- 571/571 tests, typecheck, lint et build verts, 29 pages/routes générées ;
- révision `nepteo-prod--0000022`, latest et ready, état
  `Succeeded`/`Running`, 100 % du trafic, image
  `nepteoacr27de3b.azurecr.io/nepteo:c5e7148ad62908a52536f6b2b52fd32ed0c357c0` ;
- schéma Supabase 28 ; tables créatives accessibles et bucket privé conforme ;
- contrôles directs sur le domaine public : `/` répond 307 vers `/login`, puis
  la réponse finale est 200 ; `/api/health` et `/api/ready` répondent 200.
  Health/readiness sont également verts sur le FQDN Azure ;
- contrôle responsive desktop 1280 × 720 et mobile 390 × 844 sans débordement,
  puis un unique parcours authentifié : campagne préremplie, Story 9:16 générée
  par `gpt-image-2`, version persistée, sélectionnée et validée avec la campagne ;
- JPEG 1008 × 1792, 146 743 octets, rechargé via URL signée ; accès direct au
  bucket privé refusé, lecture des requêtes internes et update direct refusés ;
- artefacts du run nettoyés : objet, asset, requête de génération,
  action/campagne et acteur synthétiques supprimés ; connecteurs, prospects,
  outbox et métriques Ads inchangés. L'organisation-coquille et le journal
  append-only restent ; l'acteur CSV dédié a été reprovisionné et vérifié ;
- catalogue Connecteurs chargé sans erreur avec Google Sheets, Notion et Meta
  Ads disponibles en OAuth, mais aucun callback ni fournisseur Connecteurs réel déclenché.

Cette recette ferme la promotion technique et le happy path Story de PR #29.
Elle ne ferme pas les OAuth réels, l'isolation inter-tenant et la concurrence
complètes, le scénario d'échec Storage ni les parcours terrain commanditaires.
C7 reste fermé : aucun envoi externe n'est activé.

### Historique — recette de production PR #17

- PR [#17](https://github.com/Shaaakir281/nepteo/pull/17) fusionnée au SHA
  `704efabd80de434ea2619cd993ae87427c114838` ;
- CI de PR `30620564365` verte sur le head
  `28781aad52564f02fcee1c0dda4b5ee5291836b8` ;
- CI `main` `30620691704` et déploiement `30620812901` verts ;
- 385/385 tests, typecheck, lint et build verts, 24 pages/routes générées ;
  relecture finale sans défaut P1 ni P2 ;
- révision `nepteo-prod--0000011`, latest et ready, état
  Healthy/Provisioned/RunningAtMaxScale, une réplique et 100 % du trafic, image
  `nepteoacr27de3b.azurecr.io/nepteo:704efabd80de434ea2619cd993ae87427c114838`,
  digest attesté
  `sha256:fe6cafbe991c45952262e33be965e4ba09239ff421a86dce80231117a3504425`,
  schéma Supabase 21 ;
- six réponses HTTP 200 pour `/`, `/api/health` et `/api/ready`, sur le
  domaine public et sur le FQDN Azure ;
- recette authentifiée : nouveau vocabulaire « scénario d'exemple Nepteo » et
  « données d'exemple » présent, anciens libellés absents ; briefing attribué
  aux données d'exemple du scénario Nepteo ; identité en lecture seule et accès
  direct à `/onboarding/identite` redirigé vers « Mon entreprise » avec le
  message de garde ; Northwind actif sans mutation de ses données pendant la
  recette ; console navigateur vide ;
- garde historique : PR #16 / `nepteo-prod--0000010` est la release attestée
  précédente et ne doit plus être interprétée comme la production courante ;
- étape historique PR #15 / `nepteo-prod--0000009` : reconstruction de
  production appliquée après sauvegarde
  (`sha256:ffa9536fadf70d195cebc9b63c4fcfb73e3745ede0e9a20be31348cd6748e07c`) :
  exactement 48 prospects, 6 connecteurs et 8 rubriques retirés ; nom et
  membres préservés ;
- cycles de chargement et d'analyse historiques des trois scénarios verts :
  chaque scénario a produit six propositions avec une console vide.

Cette recette valide PR #17 mais ne ferme pas le gate complet
`reset → reseed → préparation → exécution`, le smoke RLS multi-rôles complet,
les OAuth réels ni les parcours terrain commanditaires. C7 reste fermé : aucun
envoi externe n'est activé.

## 1. Fausse base Google Sheets

1. [sheets.new](https://sheets.new) → Fichier → Importer → Importer un fichier → `prospects-test.csv` → « Remplacer la feuille ».
2. **Google Cloud** ([console.cloud.google.com](https://console.cloud.google.com), projet créé, Sheets API activée) — deux étapes, dans cet ordre :

   **a) Écran de consentement** (obligatoire avant de créer l'ID client) — menu gauche « Écran de consentement OAuth » (parfois « Google Auth Platform » → Commencer) :
   - Nom de l'application : `Nepteo (dev)` · Adresse d'assistance : ton email → Continuer
   - Audience / Type d'utilisateur : **Externe** → Continuer
   - Coordonnées : ton email → Continuer → Accepter → **Créer** (rien d'autre à remplir, pas de scopes à ajouter)
   - Puis section « Audience » (ou « Test users ») → **+ Add users** → `fathimetalsi@gmail.com` → Enregistrer. L'app reste « En mode test » : normal, seul ton email pourra se connecter.

   **b) ID client** — menu « Identifiants » (ou « Clients ») → **+ Créer des identifiants** → **ID client OAuth** :
   - Type : **Application Web** · Nom : `Nepteo dev`
   - « URI de redirection autorisés » → + Ajouter un URI → `http://localhost:3001/api/connectors/google_sheets/callback` → **Créer**
   - Une fenêtre affiche l'**ID client** et le **code secret** : copie-les tout de suite dans `.env.local`.
3. Copier dans `.env.local` : `GOOGLE_OAUTH_CLIENT_ID=` et `GOOGLE_OAUTH_CLIENT_SECRET=`.
4. Dans Nepteo : Connecteurs → Google Sheets → **Connecter** → autoriser → coller l'URL du classeur → Enregistrer → **Synchroniser maintenant**.

## 2. Fausse base Notion

1. Dans Notion : nouvelle page → `/table` → base de données pleine page → Fusionner avec CSV (ou importer `prospects-test.csv` : … → Merge with CSV). Vérifier les propriétés : Nom (Titre), Email (**type Email**), Entreprise (Texte), Statut (**Select**).
2. [notion.so/my-integrations](https://www.notion.so/my-integrations) → Nouvelle intégration → type **Public** →
   Redirect URI : `http://localhost:3001/api/connectors/notion/callback` → récupérer client ID + secret.
3. `.env.local` : `NOTION_OAUTH_CLIENT_ID=` et `NOTION_OAUTH_CLIENT_SECRET=`.
4. Nepteo : Connecteurs → Notion → **Connecter** → dans l'écran Notion, **sélectionner la page/base à partager** → choisir la base dans Nepteo → Enregistrer → Synchroniser.

## 3. Parcours de validation Phase 2

1. Vue **Prospects** : avec le même CSV dans Sheets et Notion, **24 contacts regroupés pour la lecture** à partir de 48 lignes importées. Le résumé reste : À relancer en priorité **15** · Fiche à compléter **5** · En veille **4**. La note « Deux comptages, deux usages » doit expliquer que les lignes sans email sont regroupées visuellement, mais jamais fusionnées automatiquement pour décider d'une relance.
2. **Aujourd'hui** → « Analyser mes données maintenant » :
   - avec une seule source, **3 propositions** attendues : vérifier **5 fiches importées sans email**, préparer la relance de **7 contacts joignables « Nouveau »**, puis relancer en priorité les **15 prospects prêts** ;
   - avec le même CSV dans les deux sources, la cohorte métier prudente compte **29 identités** : **10 fiches importées sans email**, **7 contacts joignables « Nouveau »** et **15 prospects prêts**. Une 4e proposition signale les **19 doublons d'email** dans les 48 lignes brutes.
   L'écart avec les 24 contacts du tableau est volontaire : sans email, Nepteo ne suppose pas que deux homonymes provenant de sources différentes sont la même personne. Jamais plus de cinq propositions ne sont affichées.
3. Vérifier la ligne « Pourquoi maintenant », puis examiner une action (constat/raison/impact/confiance/risque/sources) → déclarer si la suggestion est utile, pas utile ou un faux positif → **Valider** une, **Refuser** une, **Reporter** la troisième, puis la **Reprendre** depuis « Décisions récentes ».
4. Pour la relance approuvée, ouvrir « Déclarer les suites terrain » et renseigner prospect par prospect une relance manuelle, une réponse, un rendez-vous ou une opportunité. Ces boutons enregistrent une déclaration structurée ; ils n'envoient aucun message et ne fabriquent aucun statut fournisseur.
5. **Journal** : vérifier `connector_connected`, `connector_synced`, `action_proposed` (acteur agent), `action_approved/rejected` (acteur vous) et `value_event_recorded`.
6. Cron local : `Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/cron/sync" -Headers @{Authorization="Bearer TON_CRON_SECRET"}` → nouvelle entrée journal `mode: auto`.

## 4. Langfuse (observabilité LLM) — optionnel

Chaque appel LLM porte déjà un `functionId` par tâche (`recommend_action`, etc.) via le champ `telemetry`. Pour voir les traces dans Langfuse (**AI SDK 7**) :

1. **Paquets** (Node ≥ 22) : `npm i @langfuse/otel @langfuse/vercel-ai-sdk @opentelemetry/sdk-node`
2. **`.env.local`** : `LANGFUSE_PUBLIC_KEY=pk-lf-...`, `LANGFUSE_SECRET_KEY=sk-lf-...`, et pour l'hébergement **EU** `LANGFUSE_BASE_URL=https://cloud.langfuse.com` (⚠️ `LANGFUSE_BASE_URL` **avec underscore** dans le nouveau SDK, plus `LANGFUSE_BASEURL`).
3. Redémarrer `npm run dev`, lancer une analyse (§3.2) → une trace `recommend_action` apparaît dans Langfuse.

Sans paquets ni clés : aucun impact, l'app tourne normalement (no-op silencieux, imports dynamiques).

**Branchement (v7)** : `instrumentation.ts` appelle `registerObservability` (`lib/observability.ts`) qui, si les clés sont là, démarre un `NodeSDK` avec `LangfuseSpanProcessor` (`@langfuse/otel`) puis `registerTelemetry(new LangfuseVercelAiSdkIntegration())` (`@langfuse/vercel-ai-sdk`). ⚠️ L'ancienne voie `@vercel/otel` + `LangfuseExporter` (`langfuse-vercel`) **ne capte plus** les spans de l'AI SDK 7 — ne pas y revenir.

**Si aucune trace n'arrive** : activer `LANGFUSE_LOG_LEVEL=DEBUG`. Des spans OTel dans les logs mais rien dans Langfuse → vérifier clés + `LANGFUSE_BASE_URL` (et, en serverless, un `forceFlush()` avant fin de fonction). Aucun span → l'instrumentation ne s'est pas chargée avant le code applicatif.

## Et en production ?

**Un seul projet Google / une seule intégration Notion pour TOUS les clients.** Les clients ne créent rien : ils cliquent « Connecter » et autorisent Nepteo sur leur propre compte. Avant la mise en prod, une fois :

1. Google : ajouter l'URI de redirection de prod (`https://<domaine>/api/connectors/google_sheets/callback`), puis **publier l'app et passer la validation Google** (scope Sheets = sensible : politique de confidentialité en ligne + domaine vérifié requis, compter quelques jours). Tant que l'app est « en test » : max 100 testeurs déclarés.
2. Notion : ajouter l'URI de prod et soumettre l'intégration publique à l'approbation Notion.
3. Reporter `GOOGLE_*`/`NOTION_*`/`CRON_SECRET`/`CONNECTOR_TOKEN_ENCRYPTION_KEY` dans la config du Container App Azure (jamais dans l'image).

## Dépannage rapide

- **redirect_uri_mismatch** (Google) : l'URI déclarée doit être exactement `http://localhost:3001/...` (port compris).
- **403 Google** : Sheets API non activée, ou ton email absent des testeurs de l'écran de consentement.
- **« Aucune base visible » (Notion)** : la base n'a pas été partagée avec l'intégration lors de l'OAuth — relancer Connecter et cocher la page.
- **« Lecture impossible »** : vérifier `CONNECTOR_TOKEN_ENCRYPTION_KEY` inchangée depuis la connexion (sinon déconnecter/reconnecter).
- Erreur `&&` PowerShell : utiliser `;` comme séparateur.
