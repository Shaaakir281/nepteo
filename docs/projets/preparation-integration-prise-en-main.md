# Préparation de l’intégration — Prise en main et laboratoire web

> **Actualisation au 2026-08-03** : Fathi autorise une intégration locale bornée
> après avoir constaté que le tutoriel n’était pas présent dans l’application.
> Le premier incrément suit cette préparation : progression locale versionnée,
> liens vers les écrans réels, aucune migration et aucune exécution automatique.
> Le push, la fusion, le déploiement et les critères terrain G1 restent ouverts.

## 1. De quelle roadmap parle-t-on ?

Le dépôt contient plusieurs roadmaps qui ne répondent pas à la même question.

| Document | Rôle | Statut utile aujourd’hui |
|---|---|---|
| [`docs/ROADMAP.md`](../ROADMAP.md) | cap stratégique général de Nepteo | sa phase 4 décrit le futur cycle de campagnes supervisées à haut niveau |
| [`roadmap-valeur-commanditaires.md`](roadmap-valeur-commanditaires.md) | ordre opérationnel des preuves à obtenir avec les pilotes | référence pour les prochains lots produit et les gates avant envoi réel |
| [`roadmap-prise-en-main.md`](roadmap-prise-en-main.md) | ordre G0 → G6 pour concevoir puis intégrer le parcours guidé | G0 est en cours ; le présent document prépare G2 sans l’autoriser |
| [`roadmap-beta.md`](roadmap-beta.md) | historique des chantiers C1 à C12 | utile pour comprendre le passé, mais son ordre de phase C est remplacé par la roadmap valeur |

La confusion est donc réelle : lorsque nous parlions de « prochaine roadmap »
pour les campagnes, il s’agissait de la **phase 4 de la roadmap générale**. Il
n’existe pas encore de roadmap détaillée et autonome couvrant la création,
l’automatisation supervisée et l’évaluation des campagnes. Cette future feuille
devra être créée séparément, après cadrage avec le commanditaire, sous un nom
sans ambiguïté tel que `roadmap-campagnes-supervisees.md`.

Elle ne doit pas être confondue avec :

- la roadmap valeur, qui cherche d’abord la preuve terrain et ferme le gate C7 ;
- la roadmap de prise en main, qui apprend à utiliser des capacités livrées ;
- le parcours G6, qui enseignera les campagnes une fois leur propre périmètre
  validé.

## 2. Décision d’expérience pour le laboratoire web

La mission d’enrichissement doit proposer un **laboratoire distinct** où
l’utilisateur peut saisir :

- le site de son entreprise ;
- ou tout autre site public qu’il souhaite étudier, un domaine à la fois.

Le résultat doit permettre d’examiner :

1. les offres et le positionnement repérés ;
2. les audiences et la zone mentionnées ;
3. le ton, les prix, les réalisations et autres preuves publiques ;
4. les informations absentes ou incertaines ;
5. les pages sources utilisées.

Le laboratoire n’est **pas** une deuxième fiche entreprise. Une analyse de test
ne modifie ni le nom, ni l’activité, ni la mémoire, ni les offres utilisées par
l’agent. Un bouton séparé « Utiliser pour ma fiche » ne devient disponible que
si l’utilisateur confirme qu’il s’agit de son entreprise, qu’aucun scénario
d’exemple n’est actif et qu’il valide les sections une par une.

Cette séparation permet d’autoriser un vrai moment de découverte pendant un
scénario d’exemple sans mélanger l’analyse du site choisi avec les données du
scénario.

## 3. Ce qui existe réellement aujourd’hui

| Capacité | État déployé | Réutilisation possible |
|---|---|---|
| Analyser le site de l’entreprise | interface disponible dans l’onboarding et depuis « Mon entreprise » lorsque la recherche est configurée et qu’aucun scénario n’est actif | `proposeIdentity` / `proposeIdentityFromWeb` puis `proposeIdentityForOrg` |
| Produire une proposition structurée | disponible : activité, audience, description, zone, ton, canaux, offres, présence, manques et sources | moteur `lib/research/company-profile.ts` |
| Encadrer la recherche payante | disponible : réservation atomique par organisation, cache, journal avant appel, fournisseur sélectionné côté serveur, délai de 120 secondes pour `company_profile`, échec propre et aucun retry automatique | orchestrateur obligatoire `runResearch` |
| Tester n’importe quel site sans toucher à la fiche | **déployé** dans `/entreprise/laboratoire-web` avec le type séparé `website_preview` ; l’analyse seule n’écrit jamais dans la mémoire | l’application à la fiche reste un geste séparé, confirmé section par section et bloqué pendant un scénario |
| Enrichir la société d’un prospect | moteur disponible côté serveur et déclenchement explicite prévu par paramètre | le composant de brouillon ne transmet pas encore ce paramètre et n’affiche pas les sources |
| Notes prospect utilisées dans les brouillons | disponible | `saveProspectNote` puis `draftForProspect` |
| Progression de prise en main | intégrée sur la branche locale via `localStorage` versionné ; seulement parcours, scénario, identifiants de missions et date | aucune URL, réponse libre ou donnée métier ; aucune migration serveur |

Conclusion : le raccordement n’est pas une reconstruction complète. La plupart
des gestes métier existent déjà. Le principal travail consiste à guider vers
ces gestes, écouter leur réussite et créer une frontière sûre pour le
laboratoire multi-sites.

## 4. Architecture recommandée

### 4.1 Une couche de guidage, pas une copie du cockpit

Le centre de prise en main présente la mission et conduit vers le vrai écran.
L’utilisateur clique ensuite sur le vrai bouton du produit. La mission est
validée par le succès du geste courant, pas par la présence ancienne d’une
donnée qui pourrait avoir été créée par un autre membre.

Le système existant `CoachBubble` doit être absorbé ou retiré des écrans couverts
au moment de l’intégration. Deux systèmes de guidage concurrents rendraient
l’interface moins lisible.

### 4.2 Progression minimale pour le premier pilote

Première recommandation : conserver un état local versionné, limité à
`parcours / étape / terminé / date`, sans URL, contenu métier ou réponse de
l’agent. Cette solution permet la reprise sur le même navigateur et évite une
migration avant d’avoir prouvé l’utilité du parcours.

Une table `walkthrough_progress` avec RLS par utilisateur et organisation ne
sera introduite que si le pilote démontre un besoin de reprise multi-appareil,
de support partagé ou de mesure serveur. Elle ne contiendra jamais les textes,
notes, sites ou résultats métier.

### 4.3 Laboratoire réel, isolé de l’identité

Le laboratoire appelle une Server Action dédiée. Elle exige un membre éditeur,
valide une URL publique `http/https`, refuse identifiants, hôtes locaux et
adresses privées, puis passe par les mêmes garde-fous que toute recherche
payante.

Le résultat utilise un type de recherche séparé, par exemple
`website_preview`, afin que le cache ne puisse jamais nourrir
`company_profile`. L’ajout de ce type nécessite une migration explicite de la
contrainte `research_runs.kind`, des tests de RLS/readiness et une règle claire
de rétention. Les entrées sont bornées par organisation et sujet ; elles restent
des analyses de test, jamais de la mémoire d’entreprise.

Le chemin synchrone actuel est recommandé pour le premier pilote :

```text
clic explicite
  → validation et confirmation du coût
  → réservation atomique du quota
  → journal avant appel
  → recherche bornée à 45 s
  → synthèse structurée
  → résultat, manques et sources
```

Le bouton est verrouillé pendant l’appel, aucun nouvel essai automatique n’est
lancé et une relance manuelle indique si elle réutilise le cache ou consomme une
nouvelle recherche. Un traitement asynchrone avec identifiant de run et polling
ne sera ajouté que si les mesures montrent que le temps de réponse ou les
reprises dépassent ce que ce chemin simple supporte.

### 4.4 Résultat attendu

La restitution comporte trois onglets maximum :

- **Synthèse** : offres, publics, zone, ton, présence publique ;
- **Manques** : ce qui n’a pas été trouvé et ce qui reste incertain ;
- **Sources** : titre, domaine et lien de chaque page consultée.

L’interface peut conserver dans la session les trois derniers domaines testés
pour les rouvrir, sans classement ni comparaison artificielle entre
entreprises. La conservation serveur reste celle du cache de recherche et doit
être expliquée à l’utilisateur.

## 5. Raccordement mission par mission

| Mission de la maquette | Surface ou fonction réelle | Signal de réussite recommandé |
|---|---|---|
| Décrire l’activité | onboarding / mémoire d’entreprise | sauvegarde réussie par l’utilisateur courant |
| Définir les principes de communication | mémoire `ton` / `philosophie` | sauvegarde réussie, jamais simple ouverture |
| Tester l’enrichissement | nouvelle action `website_preview` | résultat réel reçu ou cache explicitement réutilisé |
| Examiner le scénario actif | marqueur du scénario et données certifiées | consultation du scénario déjà choisi, sans second chargement |
| Lancer l’analyse | `analyzeNow` | résultat serveur `ok`, pas minuterie visuelle seule |
| Ouvrir une priorité | file « Aujourd’hui » | ouverture de la proposition sélectionnée |
| Examiner le raisonnement | tiroir de validation | sections constat/raison/données/impact/confiance/risque consultées |
| Personnaliser une relance | note prospect + brouillon personnalisé | note sauvegardée ou brouillon régénéré ; enrichissement société séparé et explicite |
| Décider | `decideAction` | transaction réussie pour le scénario courant |
| Contrôler l’historique | page Journal | entrée correspondante consultée |
| Suspendre l’agent | `toggleExecutionPause` | réponse serveur confirmant la pause |
| Connecter les données | surfaces Sheets, Notion et CSV | connexion/synchronisation réellement réussie après retrait du scénario |

Les connecteurs de messagerie, ventes, analytique et publicité restent présentés
comme roadmap tant qu’ils ne sont pas livrés. Ils ne peuvent pas valider une
mission réelle aujourd’hui.

## 6. Lots d’intégration proposés

### I0 — Arbitrage documentaire — en cours

- valider le laboratoire de la maquette ;
- confirmer le vocabulaire des roadmaps ;
- approuver ou corriger ce document ;
- aucun code produit.

### I1 — Tranche verticale « laboratoire réel »

- composant du laboratoire sur la vraie surface de prise en main ;
- nouvelle action de prévisualisation isolée ;
- type de recherche et migration associée ;
- coût, quota restant, cache, erreurs, sources et manques visibles ;
- aucun bouton d’application à la fiche pendant un scénario ;
- tests d’URL, rôle, quota, journal, cache, démo et absence de mutation mémoire.

Cette tranche est recommandée en premier : elle matérialise rapidement l’effet
« waouh » en restant en lecture seule.

### I2 — Centre de prise en main connecté

- catalogue versionné des missions ;
- progression locale minimale ;
- ouverture des vraies routes et reprise ;
- convergence avec `CoachBubble` ;
- accessibilité clavier et mobile.

### I3 — Boucle essentielle réelle

- scénario déjà choisi → analyse → priorité → raisonnement → décision → journal ;
- validation par les résultats des actions serveur ;
- aucun envoi externe ;
- rejouabilité sans répéter une mutation.

### I4 — Recette et décision de stockage

- test Fathi, commanditaire et personne découvrant Nepteo ;
- mesure des abandons sans contenu métier ;
- décision documentée : garder la progression locale ou ouvrir une migration
  RLS pour la reprise multi-appareil.

## 7. Portes avant tout code

1. Fathi approuve la maquette G0, y compris le laboratoire.
2. Le test G1 confirme que personne ne confond exemple simulé, vraie recherche
   et application à la fiche.
3. La spécification G2 ferme le modèle de données, le comportement en démo, la
   rétention et les tests de rôle/RLS.
4. Fathi autorise explicitement I1 ou G3 avec une liste de fichiers bornée.
5. Aucune migration distante, recherche payante ou mise en production n’est
   déclenchée pendant la préparation.

## 8. Risques principaux

| Risque | Réponse prévue |
|---|---|
| un site testé écrase la fiche entreprise | type `website_preview` et aucun appel à `applyIdentity` |
| mélange scénario / données réelles | résultat de test non consommable par l’agent et application à la fiche désactivée en démo |
| coût incontrôlé | confirmation, quota serveur atomique, cache, pas de retry automatique, journal avant appel |
| analyse d’une personne | recherche bornée au site et à l’entreprise ; aucune requête nominative sur une personne physique |
| résultat plausible mais faux | manques visibles, sources cliquables, validation humaine et aucune écriture automatique |
| progression créditée au mauvais membre | validation sur le geste courant ; jamais sur le seul état partagé de l’organisation |
| double système d’aide | convergence avec `CoachBubble` au lot I2 |
