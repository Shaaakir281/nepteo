# Projet — Prise en main guidée de Nepteo

> **Statut au 2026-08-03** : après avoir constaté que le produit déployé ne
> contenait encore que l’ancien onboarding en deux écrans, Fathi a autorisé la
> préparation et l’intégration locale du tutoriel. Cette autorisation couvre une
> branche de travail, sans migration, appel automatique ni donnée distante ;
> **elle n’autorise pas encore le push, la fusion ou le déploiement.** Les
> critères utilisateurs de G1 restent à mesurer et ne sont pas réputés acquis.
>
> Référence d'exécution :
> [`roadmap-prise-en-main.md`](roadmap-prise-en-main.md). Prompt de passation :
> [`prompt-claude-maquette-prise-en-main.md`](prompt-claude-maquette-prise-en-main.md).
> Préparation technique :
> [`preparation-integration-prise-en-main.md`](preparation-integration-prise-en-main.md).

## 1. Décision produit

Avant d'ajouter de nouvelles fonctions — notamment le cycle complet de
construction et d'évaluation des campagnes — Nepteo doit apprendre à
l'utilisateur comment s'en servir.

La réponse retenue n'est pas une refonte générale immédiate. C'est une couche de
**prise en main par l'action**, inspirée des walkthroughs de VS Code :

- des parcours courts et reprenables ;
- une progression visible ;
- des missions accomplies dans les scénarios d'exemple Nepteo ;
- un guidage vers les vrais écrans, sans réaliser le geste à la place de
  l'utilisateur ;
- une explication immédiate de ce que chaque information ou action change dans
  le produit.

Le premier parcours enseigne la boucle qui définit Nepteo :

> **comprendre la situation → repérer une priorité → comprendre pourquoi →
> décider → vérifier ce qui a été préparé.**

## 2. Objectifs

1. Permettre à une personne qui ne connaît pas Nepteo d'en comprendre la valeur
   en moins de dix minutes.
2. Faire apprendre le produit par des gestes réels dans un environnement sans
   risque.
3. Expliquer pourquoi Nepteo demande chaque information d'entreprise et où elle
   sera réutilisée.
4. Distinguer sans ambiguïté `proposé`, `validé`, `préparé`, `envoyé` et
   `observé par un fournisseur`.
5. Mesurer les endroits où les utilisateurs hésitent afin de décider ensuite
   quelles surfaces doivent réellement être simplifiées.
6. Préparer un futur parcours « Piloter une campagne » sans élargir le périmètre
   de la première maquette.

## 3. Non-objectifs

- Ne pas lancer d'email, de campagne ou d'appel externe.
- Ne pas modifier l'architecture, la navigation à cinq entrées ou les écrans
  actuels pendant la phase de maquette.
- Ne pas créer de système de points, classement, compétition ou série
  quotidienne.
- Ne pas évaluer le niveau marketing d'une personne.
- Ne pas mélanger données d'exemple et données apportées par un testeur.
- Ne pas concevoir maintenant la future exécution publicitaire.
- Ne pas introduire de dépendance, table, migration ou télémétrie avant
  validation de la maquette et d'une spécification technique distincte.

## 4. Principes d'expérience

### 4.1 Apprendre en faisant

Une étape demande un geste concret. Les longues visites guidées qui décrivent
toute l'interface sont évitées.

### 4.2 Guider sans agir à la place de l'utilisateur

Un bouton de mission peut conduire au bon écran et mettre en évidence la zone
utile. Il ne valide, ne prépare, ne modifie et n'envoie jamais automatiquement.

### 4.3 Progression, pas notation

La barre signifie :

> « Vous avez découvert 3 des 5 gestes essentiels. »

Elle ne signifie jamais :

> « Votre compétence marketing est de 60 %. »

La gamification reste sobre : missions, coches, progression, reprise, jalons et
déblocage de la suite. Aucun score social ou artificiel.

### 4.4 Montrer l'effet d'une information

Chaque question d'onboarding précise :

1. pourquoi Nepteo la pose ;
2. un exemple cohérent avec le scénario choisi ;
3. où cette information sera utilisée ;
4. si possible, un aperçu avant/après.

### 4.5 Divulgation progressive

L'étape montre d'abord l'objectif et l'action à réaliser. Les détails, la
méthode et les règles de sécurité restent accessibles sans encombrer le geste
principal.

### 4.6 Toujours reprenable

Le parcours peut être quitté, repris, rejoué et réinitialisé. Terminer ou
retirer un scénario ne doit pas effacer la progression personnelle.

## 5. Deux portes d'entrée

L'onboarding commence par une décision explicite.

### A — Découvrir avec une entreprise d'exemple (recommandé)

Copie proposée :

> **Découvrir Nepteo en 10 minutes**
>
> Essayez le produit avec une entreprise et des données d'exemple. Aucun outil
> externe n'est connecté et aucun message ne sera envoyé. Tout est
> réinitialisable.

L'utilisateur choisit le profil le plus proche :

| Profil présenté | Scénario interne | Rôle pédagogique |
|---|---|---|
| Artisan ou service local | Menuiserie Dubreuil | simplicité, devis, relances, dépense publicitaire inutile |
| Services B2B | Atelier Northwind | cycle long, gros panier, contexte et relances indispensables |
| E-commerce | Racines & Co | volume, données incomplètes et arbitrage publicitaire |

Un seul scénario cohérent alimente toutes les réponses d'exemple. Il est
interdit de composer un faux profil en mélangeant les trois entreprises.

### B — Configurer mon entreprise

Copie proposée :

> **Configurer mon entreprise**
>
> Renseignez vos informations et connectez vos données quand vous êtes prêt.
> Des exemples vous aideront, mais ils ne seront jamais enregistrés sans votre
> choix explicite.

Dans cette voie, « Voir un exemple » ouvre une aide ou un aperçu. L'exemple ne
devient pas silencieusement une donnée de l'entreprise.

## 6. Onboarding — niveau 0 de la prise en main

Le parcours « Préparer l'agent » comporte quatre missions.

### Mission O1 — Présenter l'entreprise

- activité ;
- zone ;
- type de clients.

Explication : ces informations cadrent les recommandations et évitent les
conseils génériques.

### Mission O2 — Décrire ce qui est vendu

- offres ;
- ordre de grandeur du prix ;
- cible ;
- promesse.

Explication : Nepteo peut relier une recommandation et une campagne à une offre
concrète.

### Mission O3 — Donner sa voix à l'agent

- ton ;
- philosophie ;
- pratiques à éviter.

Explication : ces informations modifient les brouillons et les briefs. La
maquette doit montrer un aperçu avant/après.

### Mission complémentaire — Tester l'enrichissement web bêta

Cette mission reste passable, mais elle est **fortement recommandée** : elle
constitue l'un des premiers moments où l'utilisateur peut évaluer concrètement
la qualité de l'agent, avant même de connecter ses données.

- l'utilisateur fournit l'adresse de son site ;
- un laboratoire séparé permet aussi de préparer le test de tout autre site
  public, un domaine à la fois, sans l’associer à la fiche entreprise ;
- l'agent prépare une proposition d'identité à partir des pages publiques ;
- les offres, cibles, éléments de ton et preuves sont reliés à leurs sources ;
- les informations absentes ou incertaines sont signalées explicitement ;
- l'utilisateur conserve, modifie ou exclut chaque section avant validation.

La présentation expose d'abord les deux bénéfices : accélérer la saisie
initiale et tester les capacités d'extraction, de traçabilité et de prudence de
l'agent. Elle présente ensuite les limites : fonctionnalité bêta, recherche
facturée à la requête, plafonnée et tracée, sans écriture ni remplacement
automatique. Le libellé de surface recommandé est `Bêta · recommandé`, et non
`facultatif` seul. Le refus ou l'indisponibilité de la recherche ne bloque
jamais la suite du parcours.

Dans la maquette G0, le laboratoire valide uniquement le langage, les catégories
de résultat et le geste de saisie : aucun appel réseau n’est lancé et le rendu
reste marqué comme exemple simulé. Dans l’intégration future, le même geste
appellera réellement le moteur après confirmation du coût. Le résultat de test
restera isolé ; il ne pourra alimenter la mémoire de l’entreprise qu’après une
action distincte, la confirmation qu’il s’agit du site de l’utilisateur et la
validation section par section hors scénario d’exemple.

### Mission O4 — Définir les objectifs

- obtenir des rendez-vous ;
- relancer les prospects ;
- vendre davantage ;
- fidéliser ;
- améliorer les campagnes.

Explication : l'objectif détermine le parcours conseillé ensuite ; il ne
déclenche aucune action automatique.

Chaque mission propose trois gestes :

- `Utiliser les données d'exemple` dans la voie A ;
- `Saisir mes informations` dans la voie B ;
- `Passer pour l'instant` quand la donnée n'est pas indispensable.

## 7. Premier walkthrough — « Votre première décision avec Nepteo »

Durée visée : 8 à 10 minutes. Il se joue uniquement dans un scénario d'exemple.

| Étape | Mission utilisateur | Validation conceptuelle | Ce que l'utilisateur apprend |
|---:|---|---|---|
| 1 | Examiner le scénario déjà choisi au démarrage | scénario actif et clairement identifié, anomalies visibles | quelles données Nepteo utilise et pourquoi elles sont imparfaites |
| 2 | Lancer ou observer l'analyse | résumé et propositions disponibles | indicateur ≠ conseil ≠ action à valider |
| 3 | Ouvrir et personnaliser une recommandation | raisonnement consulté, contexte prospect visible | constater, vérifier le « pourquoi maintenant » et adapter le message |
| 4 | Reporter, refuser ou valider dans le scénario | décision explicite de l'utilisateur | l'utilisateur garde le contrôle |
| 5 | Préparer puis consulter l'Historique | état préparé visible, aucun envoi | proposé ≠ validé ≠ préparé ≠ envoyé |

Le prototype ne doit pas réellement appeler les actions du produit. Il simule
les changements d'état nécessaires pour valider le langage, le rythme et la
compréhension.

Le scénario est sélectionné **une seule fois**, dans la porte d'entrée du
parcours d'exemple. Le walkthrough ne demande jamais de refaire ce choix : sa
première mission confirme le scénario actif et invite à examiner ses données.
Le changement de scénario reste une action secondaire accessible en revenant
aux choix de prise en main.

### Personnalisation d'une relance

Le passage « Examiner la proposition » doit rendre visibles trois couches de
contexte, avec leur statut réel :

1. les données normalisées du prospect — disponibles ;
2. la note source et la note interne Nepteo — disponibles et utilisées lors de
   la génération ou de la régénération du brouillon ;
3. la recherche web sur la **société** du prospect — capacité bêta, déclenchée
   explicitement, facturée, plafonnée et tracée, jamais dirigée vers la
   personne physique.

La maquette peut enseigner cette troisième couche, mais doit préciser que son
déclenchement n'est pas encore exposé dans l'interface déployée. Elle ne doit
pas présenter une note comme « intelligente » si elle a seulement été saisie
par l'utilisateur : sa valeur vient de sa réutilisation contrôlée pour adapter
les relances et autres messages.

### Connecter pour comprendre, agir et mesurer

La dernière étape ne se limite pas à une liste de sources de contacts. Elle
présente trois finalités, en séparant clairement le disponible de la roadmap :

- **comprendre et personnaliser — disponible** : Google Sheets, Notion et CSV
  pour les prospects, notes et derniers contacts ;
- **agir — prochaine roadmap supervisée** : un seul écosystème de messagerie à
  la fois, d'abord en lecture de faits dérivés, puis en envoi réel uniquement
  après validation et ouverture du gate C7 ;
- **mesurer — prochaine roadmap** : sources de ventes, revenus, analytique et
  campagnes afin de relier une action à son résultat observé.

Le parcours présente également l'automatisation supervisée des campagnes comme
le futur deuxième pilier : préparer, valider, activer sous plafond, mesurer et
optimiser. Il ne promet ni campagne réelle déjà connectée, ni autonomie totale.

## 8. Centre « Prise en main »

Le motif visuel s'inspire des walkthroughs de VS Code : cartes empilées, icône,
libellé d'état, courte barre de progression et reprise directe.

Parcours à représenter dans la maquette :

1. **Comprendre Nepteo** — parcours essentiel ;
2. **Préparer une relance** — suite prioritaire ;
3. **Piloter une campagne** — aperçu du futur deuxième pilier ;
4. **Connecter mes données** — disponible après retrait du scénario ;
5. **Contrôler l'agent** — autonomie, pause et historique.

Seul le premier parcours doit être entièrement détaillé dans cette phase. Les
autres cartes peuvent présenter leur intention, leur progression simulée et
leur état disponible/verrouillé.

## 9. Placement dans le produit

Hypothèse recommandée pour la maquette :

- à la première arrivée, une carte légère sur « Aujourd'hui » propose de
  commencer ou d'explorer librement ;
- pendant une mission, un panneau compact reste accessible et conduit vers le
  geste suivant ;
- une fois le parcours essentiel terminé, la grande carte disparaît ;
- le centre reste accessible depuis une aide `?`, sans ajouter une sixième
  destination à la navigation métier.

La maquette doit aussi présenter au moins une alternative de placement afin que
Fathi puisse arbitrer avant intégration.

## 10. Frontière données d'exemple / données du testeur

Les règles déjà actées restent non négociables :

1. Une organisation suit une seule voie à la fois.
2. La voie A utilise exclusivement un scénario Nepteo V2 complet et identifié.
3. La voie B contient les informations saisies ou importées par le testeur,
   réelles ou synthétiques, et reste un « environnement de test ».
4. Les exemples affichés dans la voie B ne sont jamais sauvegardés
   automatiquement.
5. Le passage A → B exige une transition explicite : retrait des données
   d'exemple, conservation de la progression personnelle, aucun mélange.
6. Un compte possédant déjà des données réelles ne reçoit jamais un scénario
   d'exemple par-dessus ses données.
7. Les événements et résultats d'un scénario ne comptent pas dans la preuve
   terrain.

Copie proposée pour la transition :

> **Prêt à utiliser Nepteo pour votre entreprise ?**
>
> Le scénario et ses données d'exemple seront retirés. Votre progression de
> prise en main sera conservée. Aucune donnée d'exemple ne sera mélangée à vos
> informations.

## 11. Progression et mesure — contrat futur

La maquette simule la progression sans définir l'architecture finale.

Pour la future intégration :

- la progression est personnelle à l'utilisateur ;
- elle n'appartient ni à `company_memory` ni aux données métier ;
- un autre membre de la même organisation possède sa propre progression ;
- une étape est validée de préférence par un geste réellement observé ;
- une action réalisée par un collègue ne crédite pas automatiquement
  l'utilisateur ;
- la progression peut être rejouée sans répéter une mutation métier ;
- la télémétrie éventuelle ne contient ni nom de prospect, ni email, ni corps de
  message, ni mémoire d'entreprise.

Mesures produit minimales envisagées :

- démarrage et fin de chaque mission ;
- durée par étape ;
- abandon et reprise ;
- ouverture de l'aide ;
- étape passée ;
- compréhension déclarée en fin de parcours.

Aucune mesure n'est implémentée avant une spécification de confidentialité et
une validation séparées.

## 12. Règles de copie

- Employer `Prise en main`, `Parcours`, `Mission`, `Étape`, `Continuer`,
  `Reprendre`, `Terminé`.
- Préférer « données d'exemple » à « fausses données ».
- Ne jamais appeler la progression un score de compétence.
- Toujours rappeler la conséquence exacte d'un geste.
- Ne jamais écrire « envoyé » pour un élément seulement préparé.
- Ne jamais promettre un lancement de campagne ou un arrêt automatique qui
  n'existe pas.
- Conserver le français simple et le vocabulaire marketing standard utile.
- Adopter un ton professionnel, calme et précis : accessible ne signifie ni
  familier, ni infantilisant.
- Présenter une capacité différenciante par son bénéfice et ce qu'elle permet
  d'évaluer, puis exposer ses limites et garde-fous. Ne pas résumer une
  fonctionnalité forte à son caractère facultatif.
- Ne pas promettre un gain de temps chiffré sans mesure terrain ; employer
  `accélérer la saisie` ou `gagner du temps sur la saisie initiale`.
- Éviter les slogans construits par opposition (« pas un manuel »), les
  métaphores ludiques et les formulations relâchées qui diminuent la crédibilité
  du produit.
- Privilégier des verbes qui décrivent le travail réel : `analyser`,
  `identifier`, `examiner`, `décider`, `contrôler`, `connecter`.

## 13. États à maquetter

La maquette interactive doit couvrir au minimum :

1. première arrivée et choix A/B ;
2. sélection d'un scénario ;
3. une mission d'onboarding avec donnée d'exemple et explication de son utilité ;
4. aperçu avant/après sur le ton ;
5. centre « Prise en main » avec plusieurs parcours ;
6. détail du parcours essentiel et progression ;
7. panneau de mission pendant un faux écran « Aujourd'hui » ;
8. réussite de mission ;
9. fin du parcours essentiel ;
10. transition explicite vers les données du testeur ;
11. réinitialisation/rejeu du prototype ;
12. une vue mobile crédible.

## 14. Critères d'acceptation de la maquette

- HTML autonome, ouvrable sans build ni serveur.
- Navigation interactive entre les états principaux.
- Progression simulée et reprenable ; bouton de réinitialisation visible.
- Aucun appel réseau, aucune donnée réelle et aucune dépendance externe.
- Responsive desktop/mobile et utilisable au clavier.
- Respect des tokens et de l'esprit visuel de Nepteo.
- Les deux voies A/B et leur frontière sont compréhensibles sans explication
  orale.
- Le premier walkthrough enseigne les cinq gestes essentiels.
- La maquette ne laisse jamais croire qu'un message ou une campagne a été
  envoyé/lancé.
- Les choix restant à arbitrer sont listés dans le rendu de passation.

## 15. Décisions acquises et arbitrages ouverts

### Acquis

- Nom de surface : **Prise en main**.
- Apprentissage par actions dans les scénarios d'exemple.
- Onboarding inclus comme niveau 0.
- Exemples proposés lors des demandes d'information.
- Gamification sobre et progression non évaluative.
- Maquette HTML avant toute intégration.
- Aucun changement produit sans approbation de Fathi.

### À arbitrer après la maquette

1. Scénario recommandé par défaut ou choix obligatoire.
2. Carte sur « Aujourd'hui », page de bienvenue ou panneau d'aide comme entrée
   principale.
3. Barre globale unique ou une barre par parcours seulement.
4. Degré de verrouillage entre les missions.
5. Possibilité de valider/refuser une action simulée dès le premier parcours.
6. Moment exact de la proposition « passer à mes données ».
7. Place future du parcours Campagnes.
