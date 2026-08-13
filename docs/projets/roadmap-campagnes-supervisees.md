# Roadmap — boucle Campagnes mesurable et supervisée

> **Statut au 2026-08-13** — La priorité produit immédiate est de fermer une
> boucle Campagnes fondée sur des données réelles : **collecter → qualifier →
> comparer budget et résultats → recommander → faire décider → mesurer
> l'avant/après**. CAMP-0, CAMP-1, CAMP-2, CONN-0, CONN-1 et META-READ existent
> déjà. META-METRICS est implémenté dans le checkout local; le projet Supabase
> lié est au schéma 29 et OAuth `ads_read` a prouvé le compte, EUR, Europe/Paris
> et une lecture vide de 7 jours. Le code atomique reste non publié, le smoke
> JWT n'est pas joué et aucun échantillon Meta non vide n'est disponible ;
> l'alimentation réelle de `ad_metrics` n'est donc pas encore recettée. L'arbitrage budgétaire et la mesure d'une
> recommandation restent absents.
>
> Cette roadmap remplace l'ancien ordre qui faisait du lancement d'une campagne
> Meta la ligne d'arrivée immédiate. Le prochain gate est la recette G1 de
> **META-METRICS**, puis le prochain lot proposé est **BUDGET-RESULTS**. Aucune
> écriture Ads n'est ouverte par ce recadrage.

## 1. Ligne d'arrivée immédiate

La première ligne d'arrivée n'est ni un lancement payant ni une pause distante.
Elle est la preuve qu'un utilisateur peut, pour un compte Meta réel :

1. identifier le compte, la campagne et la période observés ;
2. comparer un budget prévu explicite à une dépense réelle ;
3. voir un type de résultat, son volume et son coût avec leur provenance ;
4. recevoir une recommandation prudente entre campagnes Meta ;
5. accepter ou refuser cette recommandation sans effet fournisseur ;
6. constater ensuite un avant/après calculé sur des fenêtres figées et
   traçables.

Le chemin critique devient :

```text
Contrat de vérité des métriques
  → META-METRICS : compte → campagnes → métriques quotidiennes → ad_metrics
  → BUDGET-RESULTS : cockpit prévu/réalisé, résultats et qualité
  → META-RECOMMEND : recommandation/simulation entre campagnes Meta
  → RECOMMENDATION-MEASURE : baseline, décision et avant/après
  → gate distinct de preuve lecture/analyse/mesure
  → META-PAUSE : une pause supervisée, si elle est ensuite autorisée
  → GOOGLE-METRICS en lecture
  → arbitrage Meta ↔ Google, seulement avec des métriques comparables
```

## 2. État réel à ne pas confondre avec la maquette

| Capacité | État constaté | Conséquence de roadmap |
|---|---|---|
| Préparer, expliquer et valider une campagne sans la lancer | Réel dans CAMP-0/1 et le Studio | Socle conservé ; ce n'est pas une preuve de diffusion |
| Analyser `ad_metrics`, comparer des fenêtres et afficher un cockpit | Réel dans CAMP-2 | Moteur à conserver, mais données réelles et sémantique à durcir |
| Lire Meta en `ads_read` | OAuth, compte, devise, fuseau et lecture vide sont prouvés ; META-METRICS étend localement la lecture paginée | Publier le code atomique et recetter une photographie non vide |
| Alimenter `ad_metrics` depuis Meta | Schéma `0029` attesté à 29 ; code local non publié et smoke JWT non joué | Fermer G1 sur le smoke puis un échantillon Meta non vide autorisé |
| Budget prévu relié à une campagne fournisseur | Partiel : budget dans les propositions/studio, sans rapprochement fournisseur prouvé | Aucun prévu/réalisé tant que la correspondance n'est pas explicite |
| Résultats Meta | Types et volumes `provider_reported` implémentés localement, sans preuve distante | Ne pas appeler une action Meta « conversion prouvée » |
| Revenu attribué et ROAS réel | Non prouvé | ROAS indisponible jusqu'à une source de revenu rapprochée et vérifiable |
| Pause ou lancement Meta | Absent ; les actions `ads_pause_*` ne sont pas exécutables | Toute mutation reste fermée |
| Google Ads ou LinkedIn Ads réels | Absents | Google vient après la boucle Meta mesurée ; LinkedIn est dépriorisé |

Les écrans et maquettes commerciales décrivent une direction. Ils ne prouvent
ni connexion, ni fraîcheur, ni conversion, ni revenu, ni effet fournisseur.

## 3. Contrat de vérité des indicateurs

Le contrat suivant est une précondition de META-METRICS. Il doit être traduit en
types, stockage et libellés inspectables ; aucune valeur inconnue ne doit être
remplacée par zéro.

| Indicateur | Définition autorisée | Provenance minimale | Affichage si preuve absente |
|---|---|---|---|
| Budget prévu | Montant et période explicitement validés par l'utilisateur, reliés sans ambiguïté à la campagne fournisseur | snapshot de proposition/plan + identifiant de rapprochement + devise | `Non rapproché` ou `Non défini` |
| Budget configuré fournisseur | Budget lu chez Meta, distinct du budget prévu Nepteo | compte/campagne Meta + horodatage | `Indisponible` |
| Dépense réelle | Somme quotidienne `spend` renvoyée par Meta sur la période | fournisseur, compte, campagne, dates, devise, sync | `Dépense indisponible` |
| Type de résultat | Résultat choisi et nommé avec la définition Meta correspondante | clé d'action/metric Meta + libellé normalisé | `Résultat non défini` |
| Résultats Meta | Volume directement déclaré par Meta pour le type et la fenêtre d'attribution retenus | Meta + type + fenêtre d'attribution | `Non fourni par Meta` |
| Coût par résultat | dépense réelle / résultats Meta homogènes et strictement positifs | mêmes campagne, période, devise, type et attribution | `Non calculable` |
| Conversion vérifiée | Événement rapproché par une source CRM, paiement ou analytics autorisée | source aval + identifiant/méthode de rapprochement | `Non vérifiée` |
| CAC | dépense / acquisitions vérifiées ; jamais simple synonyme du coût par résultat Meta | source Ads + source aval rapprochée | `CAC indisponible` |
| Revenu attribué | Revenu rapproché par une règle documentée et vérifiable | paiement/CRM/analytics + méthode d'attribution | `Revenu non rapproché` |
| ROAS réel | revenu attribué vérifié / dépense réelle | les deux preuves précédentes, même devise et période | `ROAS indisponible` |
| Fraîcheur | ancienneté de la dernière photographie complète appliquée | `synced_at`, fenêtre couverte, statut complet/partiel | retard ou erreur explicite |

Chaque série persistée doit aussi porter ou permettre de retrouver :

- `organization_id`, fournisseur, compte, campagne et granularité ;
- date métier, devise et fuseau du compte ;
- type de résultat, origine `provider_reported` ou `verified_downstream` ;
- fenêtre/modèle d'attribution lorsqu'ils existent ;
- début et fin de fenêtre, horodatage de synchronisation et provenance ;
- état de qualité `complete`, `stale`, `partial`, `unavailable` ou `unverified`.

### Règles non négociables

- Ne jamais afficher un ROAS réel sans revenu rapproché et vérifiable.
- Ne jamais appeler `CAC` un simple coût par lead/action fourni par Meta.
- Distinguer visuellement les résultats **déclarés par Meta** des conversions et
  revenus **vérifiés en aval**.
- Ne jamais sommer des devises, types de résultat ou fenêtres d'attribution
  incompatibles.
- Une page manquante, une borne dépassée ou un échec de persistance invalide la
  photographie entière ; aucun snapshot partiel n'alimente le cockpit.
- Un rejeu de synchronisation produit le même état final : l'unicité minimale
  est organisation + fournisseur + compte + campagne + date + type de résultat.

## 4. Gates du programme Campagnes

| Gate | Condition d'entrée | Preuve de sortie | Ce qu'il n'autorise pas |
|---|---|---|---|
| **G0 — vérité** | inventaire des métriques Meta et du schéma actuel | matrice ci-dessus traduite en contrat testable ; inconnus distincts de zéro | aucun appel fournisseur |
| **G1 — lecture réelle** | G0 + compte Meta de recette autorisé | compte → campagnes → toutes les pages quotidiennes → `ad_metrics`, borné et idempotent ; comparaison à Meta | aucune recommandation financière non prouvée |
| **G2 — analyse honnête** | G1 | cockpit prévu/réalisé, résultats, coût par résultat, tendances 7/30 j et qualité ; CAC/ROAS absents si non justifiés | aucune mutation Ads |
| **G3 — recommandation Meta** | G2 + historique suffisant et comparable | recommandation/simulation entre campagnes Meta, hypothèses et refus explicites | aucun arbitrage inter-fournisseur |
| **G4 — mesure** | G3 + décision humaine journalisée | baseline figée, fenêtre après, métriques comparables et verdict sans causalité exagérée | aucune écriture Ads |
| **G5 — aptitude à muter** | G1 à G4 verts sur le pilote | revue scopes, claim, idempotence, statut ambigu, kill switch, journal et réconciliation | ne vaut pas autorisation de mutation |
| **G6 — pause supervisée** | G5 + autorisation dédiée | une pause de recette voulue, relue chez Meta et réconciliable | aucun lancement ni hausse de budget |
| **G7 — lecture Google** | boucle Meta mesurée et besoin pilote confirmé | compte Google → campagnes → métriques comparables, toujours en lecture | aucun arbitrage automatique |
| **G8 — multicanal** | G7 + définitions, devises et résultats comparables | recommandation Meta ↔ Google prudente et mesurable | aucune réallocation automatique |

La preuve **lecture/analyse/mesure** est une porte autonome. Même verte, elle ne
donne ni scope d'écriture, ni autorisation de pause, ni droit de lancer une
campagne.

## 5. Lots exécutables

### Lot 1 — META-METRICS — implémenté localement, G1 encore ouvert

**État au 13 août 2026** : le code local et la migration `0029_meta_metrics.sql`
ferment la chaîne compte sélectionné → campagnes paginées → insights quotidiens
paginés → photographie atomique. Le projet lié est attesté à 29 et un appel
Meta autorisé a prouvé OAuth `ads_read`, compte, devise, fuseau et lecture vide.
Les contrats locaux sont verts. G1 n'est pas encore acquis : le smoke
atomique/JWT n'est pas joué, le code META-METRICS n'est pas publié et le compte
vide ne fournit aucun tuple campagne/date/dépense/résultat. Le prochain geste
n'est donc ni une pause ni un lancement, mais publication supervisée, smoke et
rapprochement d'un échantillon non vide sous autorisation séparée.

**Objectif** : transformer la lecture Meta existante en photographie quotidienne
complète, qualifiée et exploitable par `ad_metrics`, sans écriture fournisseur.

**Dépendances** : META-READ et socle connecteurs ; contrat G0 ; prochaine
migration numérotée depuis le niveau réellement présent dans `main` au démarrage
de la tâche. Le commit local `0091a12` atteste les recettes OAuth Google/Notion
et documente les écarts connecteurs, mais ne vaut pas preuve Meta.

**Contenu** :

1. relire le compte sélectionné et ses métadonnées de devise/fuseau ;
2. lister toutes les campagnes dans des bornes explicites ;
3. lire les insights quotidiens avec pagination contrôlée ;
4. mapper dépense, impressions, clics et résultats Meta sans inventer de
   conversion ou de revenu ;
5. appliquer une photographie complète par upsert/remplacement transactionnel
   et idempotent ;
6. tracer fenêtre, pages, lignes, fraîcheur, provenance et qualité ;
7. conserver `ads_read` uniquement et ne créer aucun endpoint de mutation.

**Gate de recette G1** :

- compte et campagnes identiques à l'interface Meta ;
- échantillon de dates, dépense, devise et type de résultat rapproché à la
  source ;
- pagination forcée et borne dépassée testées ;
- double synchronisation sans doublon ni dérive ;
- page/timeout/persistance en échec = zéro photographie partielle appliquée ;
- changement ou disparition d'une campagne réconcilié selon le contrat ;
- journal unique par tentative et absence démontrée de requête d'écriture Meta.

**Hors périmètre** : UI finale, recommandation, pause, lancement, Google Ads,
CRM/revenu, Conversions API et modification d'une campagne.

### Lot 2 — BUDGET-RESULTS

**Objectif** : construire le cockpit honnête « Budget et résultats » à partir de
la photographie réelle.

**Dépendance** : G1 vert, y compris migration staging et échantillon Meta
rapproché. Tant que ces deux preuves manquent, BUDGET-RESULTS reste le lot
suivant proposé mais ne doit pas être présenté comme alimenté par des données
réelles recettées.

**Contenu** : prévu/réalisé avec correspondance explicite ; résultats Meta et
coût par résultat ; tendances 7 et 30 jours ; date de dernière donnée complète ;
badges de devise, fuseau, attribution, provenance et qualité. Les cartes CAC,
revenu et ROAS restent absentes ou indisponibles tant que leur preuve aval
n'existe pas.

**Gate G2** : pour chaque nombre visible, la recette retrouve la campagne, la
période, le numérateur, le dénominateur et la source. Une campagne sans mapping,
une série périmée ou un résultat ambigu est présentée comme telle.

### Lot 3 — META-RECOMMEND

**Objectif** : recommander et simuler prudemment une allocation entre campagnes
du même compte Meta.

**Dépendance** : G2 vert et historique suffisant selon un seuil documenté.

**Contenu** : comparer uniquement des campagnes compatibles par objectif, type
de résultat, devise, attribution et période ; afficher hypothèses, limites,
plancher/plafond et scénario inchangé ; produire une proposition à décision
humaine, sans outbox ni effet Meta.

**Gate G3** : mêmes données = même recommandation ; données insuffisantes ou
incomparables = refus explicite ; la somme simulée respecte le budget total ;
aucun gain garanti ni projection présentée comme résultat observé.

### Lot 4 — RECOMMENDATION-MEASURE

**Objectif** : mesurer l'avant/après d'une recommandation sans fabriquer de
causalité.

**Dépendance** : G3 vert.

**Contenu** : figer au moment de la décision la version de la recommandation,
les campagnes, le budget, les hypothèses, la fenêtre de référence et les
métriques ; définir une fenêtre après comparable ; journaliser acceptation,
refus ou application manuelle déclarée ; produire écarts absolus/relatifs et
qualité des deux fenêtres.

**Gate G4** : un tiers peut reconstruire baseline, décision et résultat depuis
les identifiants persistés. L'interface dit « évolution observée après la
décision », jamais « gain causé par Nepteo » sans protocole d'attribution.

### Lot 5 — OUTCOME-PROOF, conditionnel

**Objectif** : ajouter des conversions ou revenus vérifiés seulement si une
source aval du pilote permet un rapprochement déterministe.

**Dépendances** : choix d'une seule source CRM, paiement ou analytics ; contrat
de consentement, minimisation et rétention ; G2 déjà vert sans cette source.

**Gate** : rapprochement reproductible, non-attribués visibles, devise et
période cohérentes. Ce lot seul peut rendre CAC, revenu attribué ou ROAS
éligibles à l'affichage.

### Lot 6 — META-PAUSE-READINESS puis META-PAUSE

**Objectif** : ouvrir au plus une pause Meta supervisée, après la preuve de la
boucle en lecture.

**Dépendances** : G1 à G4 verts ; scope `ads_management` distinct ; compte de
recette ; autorisation séparée de Fathi.

**Readiness** : relecture statut/budget, claim atomique, journal avant appel,
aucun retry ambigu, résultat `unknown` réconciliable, kill switch et révocation.

**Gate G6** : une pause voulue est confirmée chez Meta et dans Nepteo, sans
doublon. Le lot n'autorise ni lancement, ni hausse, ni réallocation automatique.

### Lot 7 — GOOGLE-METRICS

**Objectif** : reproduire le patron lecture réelle et vérité UI pour Google Ads.

**Dépendance** : boucle Meta mesurée ; besoin pilote explicite ; contrat officiel
Google vérifié.

**Gate G7** : photographie Google complète, bornée et idempotente ; définitions
de résultats et attribution visibles ; aucune écriture Google.

### Lot 8 — CROSS-CHANNEL-RECOMMEND

**Objectif** : envisager un arbitrage Meta ↔ Google seulement sur des résultats
réellement comparables.

**Gate G8** : refus automatique si objectifs, devises, fenêtres ou définitions
diffèrent ; recommandation humaine et mesure avant/après ; aucune réallocation
automatique.

## 6. Ordre dépriorisé explicitement

Ne sont pas la prochaine étape produit :

- Salesforce et tout autre CRM complet ;
- LinkedIn Ads et l'automatisation LinkedIn ;
- lancement Meta, lancement payant ou hausse de budget ;
- écriture chez un fournisseur, hors future pause Meta séparément autorisée ;
- automatisation avancée, n8n, MCP personnalisé et autonomie multi-canal ;
- intégration directe à Andromeda ou Conversions API ;
- attribution complexe, revenu estimé, LTV, churn ou prédictions ambitieuses.

Le catalogue peut continuer à montrer ces propositions avec un état honnête.
Leur visibilité n'en fait ni des capacités disponibles ni des priorités.

## 7. Mode de livraison et preuves

Chaque lot conserve quatre états distincts : `terminé localement`, `publié`,
`disponible en ligne`, `recetté`. `GO <lot>` autorise seulement le travail local ;
commit, push, migration, déploiement et appel fournisseur exigent des
autorisations explicites séparées.

La fiche de sortie de chaque lot contient :

1. périmètre exact et hors-périmètre ;
2. contrat de données ou d'API modifié ;
3. tests, typecheck, lint, build et revue du diff ;
4. preuve de recette, avec source de chaque chiffre ;
5. preuve de non-effet fournisseur tant que G6 n'est pas ouvert ;
6. verdict `VERT`, `À CORRIGER`, `BLOQUÉ` ou `RETOUR ARRIÈRE` ;
7. prochain lot proposé et commande/prompt complet à copier-coller.

## 8. Prompt exact de la future tâche d'implémentation

```text
Objectif : implémenter le lot META-METRICS de Nepteo, première priorité de la roadmap Campagnes, afin d'alimenter réellement ad_metrics depuis Meta Ads en lecture seule.

Contexte obligatoire :
- Lire docs/projets/roadmap-campagnes-supervisees.md, docs/AUDIT-PRIORISATION-CAMPAGNES-2026-08-12.md, docs/AUDIT-CONNECTEURS-2026-08-12.md si ce fichier existe dans l'état source ou le commit local 0091a12, docs/SUIVI.md, docs/DECISIONS.md, docs/ARCHITECTURE.md et docs/TESTS.md.
- Examiner l'état réel de META-READ, lib/connectors/meta-ads.ts, lib/connectors/sync.ts, ad_metrics, le cockpit Campagnes et les tests Meta/Campagnes. Ne pas reprendre les capacités de la maquette comme des capacités disponibles.
- Partir du HEAD et du numéro de migration réellement présents dans le checkout ; ne pas supposer que 0091a12 est fusionné.

Résultat attendu :
1. Formaliser en types et stockage la provenance, la devise, le fuseau, la fenêtre d'attribution, le type de résultat, la fraîcheur et l'état complet/partiel/indisponible. Une valeur inconnue ne doit jamais devenir zéro.
2. Fermer le flux compte Meta sélectionné → liste complète et bornée des campagnes → insights quotidiens paginés → photographie complète dans ad_metrics.
3. Garantir idempotence et réconciliation sur organisation + fournisseur + compte + campagne + date + type de résultat ; un rejeu ne crée ni doublon ni dérive.
4. Refuser toute application partielle en cas de page manquante, timeout, réponse invalide, borne dépassée ou échec de persistance. Journaliser une seule tentative avec un code sûr.
5. Distinguer les résultats directement déclarés par Meta des conversions/revenus vérifiés en aval. Ne pas écrire de revenu, CAC ou ROAS réel sans source rapprochée et vérifiable.
6. Conserver exclusivement ads_read. Aucun endpoint de mutation, aucune pause, aucun lancement, aucun budget modifié, aucun secret ajouté au dépôt et aucun appel fournisseur sans autorisation explicite.

Recette exigée :
- tests unitaires/contrats pour pagination, bornes, mapping, devise/fuseau/attribution, résultat absent, double sync, suppression/changement, snapshot partiel et erreur de persistance ;
- tests d'intégration de la photographie atomique et de l'isolation tenant/RLS sur une base de staging si une migration est nécessaire ;
- preuve qu'un échantillon compte/campagne/date/dépense/résultat correspond à Meta sur un compte de recette, seulement après autorisation d'appel fournisseur ;
- preuve qu'aucune requête d'écriture Meta n'existe et qu'aucun ROAS/CAC non prouvé n'est produit ;
- npm test, typecheck, lint, build et revue du diff.

Contraintes de livraison :
- Travailler d'abord localement ; ne faire aucun commit, push, PR, migration distante, déploiement ou appel Meta sans autorisation séparée.
- Préserver les changements utilisateur non liés.
- Mettre à jour uniquement la documentation technique et de recette rendue nécessaire par l'implémentation.
- Terminer par l'état exact, les preuves, les limites restantes, une mini-recette et la proposition du lot BUDGET-RESULTS. Ne pas ouvrir META-PAUSE.
```
