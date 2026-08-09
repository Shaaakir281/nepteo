# Roadmap — Campagnes supervisées et intégrateurs

> **Statut au 2026-08-09** : CAMP-0, CAMP-1, CAMP-2, CONN-0, CONN-1 et
> META-READ sont fusionnés dans `main`. Le projet Supabase lié est vérifié à la
> version 27. Le worktree est aligné sur le dernier `origin/main` et le lot
> créatif campagne-first y est implémenté localement, mais il n'est ni fusionné
> dans `main`, ni déployé ; il ajoute `0028_creative_assets.sql`. Les états fusionné, migré, déployé et
> recetté restent distincts.
>
> Elle ne remplace pas la
> [roadmap valeur — tests commanditaires](roadmap-valeur-commanditaires.md) :
> les gates R0, R1 et R2 restent prioritaires avant toute mutation fournisseur.

## 1. Ligne d'arrivée

La première ligne d'arrivée Campagnes est la porte de la phase 4 :

> une campagne est proposée, validée, lancée sur un fournisseur pilote, puis
> mesurée avec un coût et un statut vérifiables dans Nepteo et chez le
> fournisseur.

Le chemin minimal est :

```text
CAMP-0 brief fiable et non-lancement                  fusionné, recette en ligne à attester
  → CAMP-1 studio arbitrable                          fusionné, recette en ligne à attester
  → CAMP-2 cockpit reproductible                      fusionné, recette en ligne à attester
  → CAMP-3 lecture Meta bornée                        socle fusionné, recette en ligne à attester
  → CAMP-4 pause réelle supervisée                    après preuve CAMP-3
  → CAMP-5 lancement mono-fournisseur contrôlé        ferme la phase 4
```

CAMP-6 à CAMP-10 sont des extensions conditionnelles. Elles ne sont pas des
prérequis à la première campagne pilote.

## 2. Mode de livraison par micro-lots

Après la release de rattrapage CAMP-0/1/2, chaque lot suit exactement la même
boucle :

1. Codex implémente **un seul micro-lot local** et préserve le reste du
   worktree.
2. Tests ciblés, tests de non-régression proportionnés, typecheck, lint, build
   et revue du diff sont verts.
3. Codex fournit une note de release, un script de test en ligne et le plan de
   retour arrière.
4. Fathi donne une autorisation distincte pour commit, push, migration,
   déploiement ou appel fournisseur.
5. Un seul micro-lot est publié sur l'environnement prévu.
6. Fathi teste en ligne et donne le verdict `vert`, `à corriger` ou `retour
   arrière`.
7. Le lot suivant ne démarre qu'après consignation du verdict.

Une modification de schéma et une modification d'outbox ne sont jamais menées
en parallèle. Une recette fournisseur n'est jamais incluse implicitement dans
le développement local.

### Échange obligatoire à la fin de chaque lot

Chaque lot se termine dans sa tâche Codex par une fiche courte, utilisable par
Fathi en déplacement, dans cet ordre :

1. **Confirmation** — identifiant du lot et état exact `terminé localement`,
   `publié` ou `disponible en ligne`.
2. **Changements** — ce qui devient visible, les principaux fichiers ou
   contrats modifiés et ce qui reste volontairement inchangé.
3. **Contrôles Codex** — tests, typecheck, lint, build, revue du diff et limites
   de preuve, sans demander à Fathi de reproduire les contrôles techniques.
4. **Mini-recette téléphone** — URL ou chemin exact, prérequis, trois à cinq
   gestes maximum, résultat visible attendu après chaque geste et un contrôle
   de non-effet quand il est pertinent. Elle doit tenir en cinq minutes, sans
   terminal, console développeur ni copie de longues données.
5. **Verdict simple** — Fathi répond `VERT <lot>`, `À CORRIGER <lot> :
   <symptôme>`, `BLOQUÉ <lot> : <écran>` ou, pour un lot publié, `RETOUR ARRIÈRE
   <lot>`. Une capture d'écran peut remplacer une longue explication.
6. **Lot suivant** — titre proposé, objectif, résultat visible, hors-périmètre,
   dépendances ou risques et mini-recette envisagée.
7. **Approbation** — Codex attend `GO <lot suivant>` avant de l'ouvrir et de le
   commencer, de préférence dans une nouvelle tâche de ce projet.
8. **Commande à copier-coller** — la fiche se termine par un bloc de code
   contenant une seule commande recommandée complète. Fathi ne doit jamais
   avoir à reconstruire la commande depuis le texte précédent.

Si un résultat n'est pas raisonnablement vérifiable sur téléphone, Codex le dit
explicitement et fournit la preuve technique correspondante ; aucun faux test
mobile n'est inventé. Toute surface utilisateur doit néanmoins subir les
contrôles responsive et clavier proportionnés avant publication.

### Portée des validations courtes

- `GO <lot>` autorise la création rapide d'une nouvelle tâche et le travail
  **local** sur ce seul lot. Il n'autorise aucune publication.
- `PUBLIER <lot>` n'est demandé qu'après la validation locale et énumère les
  actions exactes envisagées : commit, push, PR, migration, déploiement ou appel
  fournisseur. Seules les actions explicitement annoncées sont autorisées.
- `VERT <lot> + GO <lot suivant>` permet de consigner la recette et d'ouvrir
  immédiatement la tâche suivante ; il ne vaut pas `PUBLIER` pour celle-ci.
- `À CORRIGER` ou `BLOQUÉ` maintient le travail dans la tâche courante. Aucun
  lot suivant n'est ouvert tant que le verdict n'est pas résolu.

### Contrôle d'ouverture d'une nouvelle tâche

Avant l'ouverture, Codex annonce :

- le titre du lot ;
- l'état source attendu : chemin, HEAD et fichiers sentinelles du lot ;
- le modèle : soit celui explicitement demandé par Fathi, soit `modèle par
  défaut de l'application — aucun override Codex`.

Après l'ouverture, Codex lit le premier diagnostic de la nouvelle tâche et
compare immédiatement le chemin, le HEAD et les fichiers sentinelles. Une tâche
ouverte depuis un autre checkout est déclarée invalide et recréée depuis l'état
correct ; Fathi n'a pas à retransmettre lui-même les fichiers déjà présents. Le
lot n'est considéré comme lancé qu'après cette concordance.

### Exception de rattrapage — état fusionné

CAMP-0, CAMP-1 et CAMP-2 sont fusionnés dans `main` avec les migrations
séquentielles `0025`, `0026` et `0027` ; le projet Supabase lié est vérifié à 27.
Ils restent une **release de rattrapage unique à attester en ligne** : la fusion
et la migration ne prouvent ni le déploiement de l'application ni les trois
recettes. CONN-0, CONN-1 et META-READ ont depuis été fusionnés à leur tour.

## 3. Contrat commun de tout intégrateur

Un intégrateur est une capacité métier portée par un adaptateur vérifié. La
maquette peut suggérer `API` ou `MCP`, mais le transport définitif est choisi
seulement après lecture de la documentation officielle et un essai serveur.

Tout intégrateur doit fournir :

- organisation et compte distant explicitement identifiés ;
- secrets chiffrés, jamais renvoyés au navigateur ni écrits dans le journal ;
- scopes minimaux et révocation réelle ;
- états honnêtes : `prévu`, `déconnecté`, `connexion_en_cours`,
  `connecté_lecture`, `action_requise`, `connecté_écriture_bornée`, `en_pause`
  ou `erreur` ;
- dernière synchronisation, fenêtre de données, devise et fuseau quand ils
  existent ;
- pagination, bornes, idempotence et détection des lectures partielles ;
- journal métier append-only et trace technique expurgée ;
- aucune conservation par défaut de corps d'email, paramètres secrets ou
  réponses fournisseur brutes ;
- timeout explicite et **aucun retry automatique d'une écriture ambiguë** ;
- isolation stricte scénario d'exemple / organisation de recette / pilote ;
- test de déconnexion et preuve qu'aucune synchronisation ne reprend après
  révocation.

Une carte n'affiche jamais « Connecté » parce qu'une ligne existe en base. La
connexion exige une identité distante vérifiée et un appel complet réussi. Un
cron n'est pas présenté comme du temps réel.

## 4. Ce que la maquette conserve — sans le simuler

### 4.1 Catalogue existant — socle à préserver

CONN-0 est **additif**. Il ne supprime, ne fusionne, ne masque et ne
recatégorise aucun des vingt-deux connecteurs déjà proposés dans
`lib/connectors.ts`. Les cinq familles, leur ordre et leurs cartes restent
visibles :

| Catégorie conservée | Propositions conservées |
|---|---|
| Trouver et suivre les prospects | HubSpot, Pipedrive, Salesforce, Airtable, Fichier CSV, Google Sheets, Notion |
| Comprendre les visiteurs | Google Analytics, Matomo, PostHog, Site internet |
| Suivre les campagnes | Meta Ads, Google Ads, LinkedIn Ads |
| Communiquer | Brevo, Mailchimp, ActiveCampaign, Gmail |
| Suivre les ventes | Stripe, Shopify, WooCommerce, Logiciel de facturation |

Les connecteurs supplémentaires issus de la maquette Growth Cockpit sont des
**ajouts**, jamais des remplacements. Ils rejoignent une famille existante ou
une famille supplémentaire validée explicitement, sans renommer les cinq
familles ci-dessus. Les capacités déjà réelles — notamment CSV, Google Sheets,
Notion et l'analyse explicite du site — conservent leurs parcours et ne sont pas
rétrogradées en simple promesse.

### 4.2 Intégrateurs supplémentaires de la maquette Growth Cockpit

Les intégrateurs visibles dans cette seconde maquette sont conservés dans le
backlog produit :

| Intégrateur | Promesse utile conservée | Première tranche autorisable | Écriture future |
|---|---|---|---|
| Meta Ads | campagnes, adsets, annonces, audiences et performances | lecture pilote CAMP-3 | pause CAMP-4, lancement CAMP-5 ; budgets/créas plus tard |
| LinkedIn Ads | campagnes, Thought Leader Ads, Lead Gen Forms, CPM par audience | lecture conditionnelle | pilotage après preuve Meta ou choix explicite du pilote |
| HeyReach | séquences LinkedIn, statuts et réponses | lecture seule des faits minimisés | séquence/handoff seulement après gates outbound |
| Resend | domaine, templates, délivrabilité et nurturing | configuration et santé du domaine | self-test puis lot de cinq destinataires maximum après C7 |
| PostHog | funnels, cohortes, activation, tendances et rétention | agrégats en lecture seule | aucune écriture dans le premier cycle |
| Stripe | paiements, abonnements et revenu observé | lecture seule et rapprochement prudent | aucune mutation financière par Nepteo |
| Google Ads | Search, PMax, campagnes et métriques | lecture si le pilote le justifie | pause/lancement après preuve mono-fournisseur |
| Supabase interne | comptes, essais et événements d'activation | vues/RPC étroites en lecture seule | jamais d'accès agent générique à la base |
| TikTok Ads | campagnes et performance par créatif | backlog lecture | rotation/création seulement après CAMP-8 |
| n8n | workflows disponibles et état d'exécution | inventaire en lecture seule | un workflow allowlisté après CAMP-6 |
| MCP personnalisé | découverte d'un serveur et de ses outils | catalogue administrateur vérifié | outil par outil, jamais activation globale |

Les libellés de la maquette « officiel », « zéro glue code », « connecté en
quelques secondes », « temps réel », les URLs, versions, scopes, outils et dates
ne sont pas des contrats. Google Ads y est même présenté à la fois comme `API`
et comme `MCP` : la roadmap spécifie donc les capacités, pas le transport
illustré.

## 5. Séquence exécutable

### Cadence regroupée pour les intégrateurs

Les lots suivants ne sont plus découpés artificiellement lorsqu'ils partagent
le même contrat et la même recette mobile. Un lot reste publiable seulement
quand sa preuve est complète, mais peut contenir plusieurs étapes cohérentes :

| Lot regroupé | Contenu | Porte avant publication |
|---|---|---|
| **CONN-1** | consentement, chiffrement, état de lecture vérifiée, erreur, pause et révocation des connecteurs existants | aucun jeton restant après révocation ; aucune lecture pendant une pause |
| **META-READ** | contrat officiel, OAuth lecture seule, sélection explicite du compte et première lecture bornée des métriques | identité distante, scopes et métriques relues côté serveur ; aucune écriture Ads |
| **REV-READ** | connecteurs Stripe et PostHog, chacun seulement si le pilote fournit l'accès de recette | rapprochement lecture seule et données minimisées ; aucune mutation financière ou produit |
| **OUTBOUND-READ** | cadrage puis lecture HeyReach/Resend, après les gates outbound | aucun envoi, séquence ou handoff ; erreurs et révocation prouvées |
| **AUTOMATION-LATE** | n8n et MCP personnalisé après les connecteurs officiels | allowlist, egress borné et outil par outil ; jamais d'activation globale |

Les sous-étapes historiques restent des repères d'audit. Elles ne créent plus
une publication autonome si le lot regroupé n'est pas entièrement vérifiable.

### META-READ — lecture Meta Ads bornée (fusionné dans `main` ; déploiement et recette à attester)

- OAuth demande exclusivement `ads_read` ; le retour vérifie ce droit côté
  serveur avant de chiffrer le jeton ;
- aucun compte n'est choisi par défaut : la liste courte (25 maximum) est lue
  seulement sur geste explicite, puis la sélection est revalidée côté serveur ;
- une lecture explicite demande 7, 14 ou 30 jours et au plus 100 lignes. Toute
  pagination ou valeur ambiguë échoue fermée : aucun résultat partiel n'est
  affiché ;
- le snapshot persisté est normalisé et minimisé (compte, devise, campagne,
  jour, impressions, clics, dépense). Il n'alimente pas `ad_metrics` ni les
  propositions CAMP tant que revenu/conversions et contrat d'ingestion ne sont
  pas explicitement établis ;
- pause, révocation, rôles et verrou d'isolation démo sont ceux de CONN-1 ;
  aucun endpoint de mutation Meta Ads n'est introduit.

### REL-0 — Release de rattrapage CAMP-0/1/2 (fusionnée ; déploiement à attester)

**But** : attester en ligne, après autorisation, l'état fusionné déjà validé localement.

- réconcilier les documents et l'inventaire exact des fichiers ;
- vérifier les migrations `0025` à `0027` et la readiness 27 ;
- déployer un seul artefact reproductible ;
- ne lancer aucun appel IA payant ni appel Ads pendant le déploiement.

**Test en ligne Fathi** : brief sans présélection et double clic CAMP-0, studio
CAMP-1, cockpit/filtres/refus/non-exécution CAMP-2, puis contrôle de l'outbox et
du journal. La procédure mobile détaillée est
[`REL-0-RECETTE-MOBILE.md`](../tests/REL-0-RECETTE-MOBILE.md).

**Porte** : exactement les actions et journaux attendus, zéro effet externe.

### CONN-0 — Catalogue honnête et registre de capacités (fusionné ; déploiement à attester)

**But** : rendre visibles les intégrateurs de la maquette sans inventer leur
connexion.

- les cinq catégories et les vingt-deux cartes existantes sont conservées sans
  disparition, fusion ou recatégorisation ;
- un test de contrat fige leurs cinq titres et leurs vingt-deux identifiants ;
  hors décision explicite de Fathi, seules les additions sont acceptées ;
- les nouvelles propositions sont ajoutées sans remplacer les anciennes ;
- chaque carte affiche un état réel parmi `Disponible`, `À configurer`,
  `Demandé`, `Prévu`, `Connecté vérifié` ou `Erreur` ;
- adaptateur annoncé `API`, `MCP` ou `à vérifier` depuis un registre serveur ;
- séparation des capacités `lecture`, `proposition` et `écriture` ;
- `Connecter` n'est affiché que lorsqu'un parcours de connexion réel existe ;
  sinon l'action honnête reste `Demander`, `Configurer` ou une carte `Prévu` ;
- aucune URL libre, aucun secret et aucun bouton d'activation fictif ;
- Google Sheets et Notion existants restent inchangés.

**Test en ligne Fathi** : recompter les cinq catégories et les vingt-deux cartes
existantes, vérifier séparément les ajouts, leurs libellés, leurs états, le
mobile et l'absence de prétendue connexion.

**Porte** : aucune catégorie ni proposition existante ne manque et aucune carte
ne promet plus que l'état persistant vérifié.

### CONN-1 — Noyau de connexion et de révocation (fusionné ; déploiement à attester)

**But** : partager seulement les primitives réellement communes.

- identité du compte distant, scopes accordés et statut de consentement ;
- chiffrement des secrets et façade serveur expurgée ;
- dernière lecture complète, erreur honnête et révocation ;
- capacité de pause du connecteur ;
- trace technique sans payload personnel brut.

Ce lot ne construit pas encore de framework MCP générique et ne modifie aucun
fournisseur.

**Regroupement décidé** : CONN-1 porte ensemble le consentement distinct de la
connexion vérifiée, la preuve de dernière lecture, l'erreur expurgée, la pause,
la révocation et les tests de contrat des 22 cartes. Il ne publie aucun nouveau
connecteur et ne lance aucun appel fournisseur de recette.

**Test en ligne Fathi** : connecteur de recette simulé localement puis état
connecté/déconnecté/erreur ; aucune donnée métier ni appel payant.

**Porte** : un adaptateur peut être révoqué sans laisser de secret ou de tâche
active.

## 6. CAMP-3 — Meta Ads en lecture seule, micro-lot par micro-lot

Meta Ads est le fournisseur pilote par défaut parce que le cockpit et les
propositions actuelles portent déjà ce provider. Un autre choix reste possible
si le client pilote n'utilise pas Meta.

### META-0 — Contrat officiel vérifié

- vérifier API ou MCP disponible, conditions d'accès, version, OAuth, scopes,
  quotas, sandbox et révocation ;
- définir l'account ID canonique et la matrice des capacités ;
- documenter devise, fuseau, fenêtres d'attribution et données indisponibles ;
- aucun code fournisseur et aucun secret de production.

**Test en ligne** : aucun ; revue documentaire et décision explicite de Fathi.

### META-1 — Connexion lecture seule

- OAuth/scopes lecture uniquement ;
- sélection explicite d'un compte publicitaire de recette ;
- identité et permissions relues côté serveur ;
- déconnexion et tombstone de révocation ;
- aucune synchronisation de métriques dans ce lot.

**Test en ligne Fathi** : connecter le compte de recette, voir son identité et
ses scopes, puis le révoquer et vérifier que l'état repasse à `Déconnecté`.

### META-2 — Synchronisation bornée des campagnes et métriques

- campagnes/adsets/annonces en lecture ;
- métriques quotidiennes vers `ad_metrics` avec pagination et upsert
  idempotent ;
- fenêtre explicite, comptage exact, fraîcheur et lecture partielle bloquante ;
- aucune audience personnelle, créatif binaire ou permission d'écriture.

**Test en ligne Fathi** : comparer un petit échantillon de dates et montants
avec l'interface Meta, rejouer la synchronisation et vérifier l'absence de
doublon.

### META-3 — Vérité du cockpit

- statuts fournisseur datés ;
- devise et fuseau visibles ;
- fenêtre d'attribution déclarée ;
- campagne/adset/créatif distingués ;
- erreurs, retard et absence de données affichés sans fabriquer `Actif`.

**Test en ligne Fathi** : contrôler une campagne active, une terminée et une
sans données, puis filtres, rapport 7+7 et journal.

**Porte CAMP-3** : un compte pilote alimente le cockpit de façon idempotente et
bornée, sans aucun scope d'écriture.

## 7. Sources de mesure en lecture seule

Ces intégrateurs sont ouverts un par un après META-3, selon les données du
pilote. Ils ne sont pas tous obligatoires.

### PROD-1 — Supabase interne étroit

- vues ou RPC allowlistées pour essais et activation ;
- agrégats par organisation et période ;
- aucun SQL libre, service role ou schéma arbitraire exposé à l'agent.

**Test en ligne** : rapprocher un total d'essais connu sans exposer les lignes
personnelles.

### REV-1 — Stripe en lecture seule

- compte et mode test explicitement visibles ;
- paiements/abonnements et devise ;
- rapprochement seulement avec un identifiant ou une convention vérifiable ;
- une réconciliation reste distincte d'une attribution causale.

**Test en ligne** : comparer quelques paiements du mode test, puis vérifier que
les lignes sans preuve restent `non attribuées`.

### ANALYTICS-1 — PostHog en lecture seule

- projet/région identifiés ;
- funnels, cohortes et tendances agrégés ;
- bornes temporelles et dénominateurs ;
- aucun événement personnel brut envoyé au LLM ou conservé dans le journal.

**Test en ligne** : reproduire un funnel connu avec les mêmes filtres et la même
période.

## 8. CAMP-4 et CAMP-5 — écritures Meta strictement séparées

### META-4 — Pause supervisée

- une seule campagne distante ;
- relecture statut et budget avant mutation ;
- claim atomique et journal avant appel ;
- clé d'idempotence fournisseur si disponible ;
- aucun retry automatique ;
- relecture distante après appel et état `unknown` réconcilié manuellement ;
- kill switch et révocation de l'écriture.

**Test en ligne Fathi** : d'abord dry-run, puis une pause autorisée sur une
campagne de recette et vérification des deux journaux. Toute mutation réelle
exige une autorisation dédiée.

**Porte CAMP-4** : zéro pause non voulue, zéro doublon et réconciliation
possible entre Nepteo et Meta.

### META-5 — Lancement contrôlé

- payload et créatif client figés ;
- compte, paiement, permissions et formats vérifiés ;
- budget journalier, total et durée imposés côté serveur ;
- aperçu final et seconde confirmation ;
- identifiant distant obligatoire ;
- timeout sans identifiant = `unknown`, sans retry ;
- pause immédiate disponible ;
- aucune hausse automatique de budget.

**Test en ligne Fathi** : préflight puis campagne de recette ; un lancement
payant demande une autorisation et un budget pilote séparés.

**Porte CAMP-5** : une campagne pilote est proposée, validée, lancée et mesurée
avec un statut et un coût vérifiables des deux côtés.

## 9. Autres fournisseurs — lecture avant écriture

Chaque fournisseur répète le patron `contrat → connexion → lecture → vérité UI`
avant toute capacité d'écriture.

### LINKEDIN-0 à LINKEDIN-3

1. contrat officiel, OAuth et compte pilote ;
2. campagnes et métriques en lecture ;
3. Lead Gen Forms minimisés et dédupliqués ;
4. écriture seulement après preuve CAMP-5 et autorisation distincte.

### GOOGLE-0 à GOOGLE-3

1. vérifier API ou MCP au lieu de reprendre l'incohérence de la maquette ;
2. Search/PMax et métriques en lecture ;
3. requêtes et estimations clairement séparées des résultats observés ;
4. pause/lancement seulement après preuve mono-fournisseur.

### TIKTOK-0 à TIKTOK-2

1. contrat et lecture des campagnes ;
2. performance par créatif avec définition inspectable ;
3. création ou rotation seulement après CAMP-8 et preuve du besoin pilote.

## 10. Outbound — dépendance stricte à la roadmap valeur

### HEYREACH-0 — Lecture des séquences et réponses

- séquences, statut, dernière interaction et réponse minimisés ;
- aucune création, relance ou handoff automatique ;
- correspondance prospect déterministe et révocable.

### RESEND-0 — Domaine et délivrabilité

- domaine, SPF/DKIM, identité d'expéditeur et état de délivrabilité ;
- templates inspectables sans envoi ;
- aucune réutilisation du SMTP d'authentification comme transport marketing.

Les écritures `HEYREACH-1` et `RESEND-1` restent bloquées par la Gate C7 :
suppression-list indépendante, base légale, fournisseur retenu, budget/claim
atomique, états `sending | sent | failed | unknown`, idempotence fournisseur,
kill switch, allowlist, self-test puis lot de cinq destinataires maximum.

## 11. MCP personnalisé et n8n — derniers lots

Le MCP personnalisé ne signifie jamais « coller une URL et faire confiance ».

### MCP-0 — Registre administrateur

- serveurs prédéclarés ou allowlistés ;
- validation d'origine, DNS/IP, redirections et protection SSRF ;
- auth, chiffrement et révocation ;
- aucune URL libre pour les rôles métier.

### MCP-1 — Handshake et découverte non fiables par défaut

- identité/version/schéma vérifiés ;
- manifeste et descriptions traités comme contenu non fiable ;
- outils classés `lecture`, `écriture réversible`, `écriture engageante` ou
  `interdit` ;
- chaque outil est désactivé par défaut.

### MCP-2 — Dry-run lecture seule

- paramètres validés par schéma serveur ;
- egress et volume bornés ;
- sortie minimisée ;
- journal expurgé et rétention décidée juridiquement, jamais fixée par la
  maquette.

### MCP-3 — Première écriture allowlistée

- un seul outil réversible ;
- proposition, approbation, claim, journal avant appel, idempotence et
  réconciliation ;
- aucun outil financier, message ou workflow arbitraire.

### N8N-0 puis N8N-1

- inventaire et état des workflows en lecture ;
- puis un seul workflow versionné et allowlisté, avec entrée/sortie bornées,
  timeout, idempotence et arrêt global.

## 12. Extensions après la première porte

- CAMP-6 : supervision continue bornée, sans hausse autonome de budget ;
- CAMP-7 : boucle leads/nurturing alignée sur la Gate C7 ;
- CAMP-8 : créatifs finis texte/image, vidéo plus tard ;
- CAMP-9 : prévisions uniquement calibrées sur des campagnes closes ;
- CAMP-10 : multi-canal, reporting consolidé et autonomie réversible.

## 13. Lot local à intégrer — CREATIVE-1

**But** : terminer une campagne avec un visuel fini sans confondre génération,
publication et performance fournisseur.

- conserver l'alignement déjà réalisé sur le dernier `main`, CAMP-0/1/2 ainsi
  que CONN-0/1/META-READ ;
- sélectionner une campagne récente par défaut et préremplir message et format ;
- générer explicitement via `gpt-image-2`, sans appel automatique ;
- stocker le JPEG dans un bucket privé, avec quotas, versions et sélection ;
- valider campagne et visuel sélectionné dans la même transaction via
  `transition_action_decision_v2` ;
- permettre à une campagne approuvée sans visuel d'en finaliser un plus tard par
  un choix explicite, toujours sans publication ;
- libérer le verrou organisation pendant l'appel OpenAI et réconcilier par cron
  tout chemin Storage pending abandonné ;
- porter le schéma de 27 à 28 avec `0028_creative_assets.sql`.

**Frontière** : aucun asset n'est publié chez Meta ou un autre fournisseur. Les
créatifs ne sont pas injectés dans `ad_metrics` et ne constituent pas encore un
audit de performance créative. Toute écriture Ads reste dans les lots ultérieurs.

**Ordre de sortie** : commit/relecture puis intégration sur `main` → application
de `0028` sur une base Supabase de staging/recette distincte déjà à 27 → preuves
réelles RLS/JWT, concurrence, bucket privé, pending/cron, validation atomique et
recette croisée Story + Connecteurs → autorisation explicite → application de
`0028` en production → preuve du schéma 28 → déploiement de l'application
exigeant 28 → recette de production. La production ne constitue jamais la
première exécution de `0028`. Si une
migration parallèle prend entre-temps le numéro 28, renuméroter ce lot avant
fusion.
