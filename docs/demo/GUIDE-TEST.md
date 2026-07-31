# Nepteo — guide de test (bêta)

> Compte ~25 minutes pour le parcours complet. En mode sûr, **aucun message ne part à l'extérieur** : l'agent prépare, il n'envoie pas.

## Choisir une seule voie

- **A — scénario Nepteo V2 certifié** : choisir l'une des trois variantes ci-dessous. Le jeu complet est fictif, identifié et réinitialisable ; il reste chargé pendant tout le parcours.
- **B — données autorisées du testeur** : importer un CSV ou connecter une source après avoir retiré tout scénario Nepteo. Ces lignes appartiennent à un environnement de test et ne sont jamais présentées comme fictives.

Les deux voies ne se mélangent jamais. Si vous passez de A à B, retirez d'abord le scénario. Les observations de A servent à juger compréhension, explicabilité et qualité des brouillons, mais ne comptent pas comme preuves terrain.

## Ce que Nepteo essaie d'être

Un copilote marketing pour une personne seule ou une petite équipe. Il comprend l'activité, lit les données, **propose** des actions argumentées, et n'exécute que ce qui est validé. La promesse n'est pas « un outil de plus » : c'est **le raisonnement d'un directeur marketing**, avec le travail préparé.

Trois questions à garder en tête pendant le test :

1. Est-ce que je comprends **pourquoi** l'agent propose ça ?
2. Est-ce que je **ferais confiance** à ce qu'il a préparé ?
3. Qu'est-ce qui manque pour que je l'utilise **vraiment** ?

## Mise en route

1. Créer un compte, confirmer l'email.
2. **Onboarding** : nom de l'entreprise, ce que vous vendez, et le champ **« Votre philosophie »** — écrivez-y votre façon de travailler, ce à quoi vous tenez. C'est ce qui donne sa voix à l'agent.
3. **Un écran facultatif peut s'intercaler** : si la recherche web est activée, l'agent lit votre site et **propose une fiche d'identité** (ce que vous vendez, vos offres, votre ton, ce que vous faites déjà en communication) que vous corrigez avant de valider — chaque affirmation porte ses sources, cliquez-les. « Passer cette étape » entre directement au cockpit. Sans clé de recherche, cet écran n'apparaît pas du tout.
4. **Vous arrivez sur « Aujourd'hui ». Arrêtez-vous là une minute avant de charger quoi que ce soit** : sans aucune donnée branchée, l'écran d'accueil affiche un **diagnostic de départ** — deux ou trois canaux conseillés à partir de votre seule fiche entreprise, avec le premier geste, ce qu'il vaut mieux éviter, et trois actions pour la semaine. C'est le moment où l'agent doit déjà paraître compétent, avant tout connecteur.
5. Pour la voie A, aller sur **« Mon entreprise » → onglet « Connecteurs »** → section **« Pas d'outil à brancher ? »** → choisir un scénario V2 :

| Scénario | Profil | Ce qu'il montre |
|---|---|---|
| **Menuiserie Dubreuil** | Artisan, vend à des particuliers, local | Cycle court, bouche-à-oreille, une pub de notoriété qui coûte sans rapporter |
| **Atelier Northwind** | Agence de services, vend à des entreprises | Cycle long, relances indispensables, gros paniers |
| **Racines & Co** | E-commerce | Gros volumes, panier moyen faible, la publicité pilote tout |

**« Charger et analyser »** remplit l'identité, les prospects, les campagnes et les ventes, **remet le cockpit à zéro** (propositions, briefing, messages préparés) puis lance l'analyse. Vous pouvez donc enchaîner les trois cas sans jamais mélanger deux entreprises.

> Chaque base contient volontairement des **défauts** : emails manquants, statuts vides, un doublon, une campagne en perte. C'est ce que l'agent doit repérer — une base parfaite ne prouverait rien.
>
> Chaque scénario porte aussi **six mois d'historique publicitaire** : des campagnes encore en cours, et des campagnes arrêtées (une saison qui avait bien marché, un test qui n'avait rien donné). Les chiffres affichés portent sur les **30 derniers jours**, comparés aux 30 précédents.

## Le parcours

### 1. Aujourd'hui — l'agent travaille

Le diagnostic de départ a laissé la place aux **KPI calculés sur le scénario** dès que celui-ci est chargé : l'écran ne dit plus « voici par où commencer », il montre ce qui se passe dans cette entreprise fictive.

Cliquez sur **« Analyser »**. Observez les étapes qui défilent, puis :

- le **bandeau « Le point de l'agent »** : deux ou trois phrases sur l'état cohérent du funnel fictif, calculé à partir des données du scénario sans chiffre inventé par le modèle ;
- le **bandeau « Cap du mois »** : quelques mouvements priorisés par levier — couper les pertes d'abord, réactiver les contacts chauds ensuite, alimenter le haut du funnel enfin. Chaque mouvement renvoie vers l'écran où agir. Ce sont des **conseils** : rien ne s'exécute depuis ce bandeau ;
- les **propositions à valider** — le seul endroit où l'on décide.

> **À juger** : l'ordre des mouvements du cap est-il celui que vous auriez choisi ? Sinon, pourquoi ?

Ouvrez une proposition de relance. Vous devez y trouver : le **constat**, la **raison**, les **données utilisées**, l'**impact estimé**, la **confiance**, le **risque** — et le **message déjà rédigé**.

> **À juger** : le message est-il envoyable tel quel ? Sinon, que faudrait-il changer ? Vous pouvez le modifier directement.

Dépliez **« Personnaliser par prospect »** : chaque contact reçoit un message adapté à ses notes et à son statut, avec son vrai prénom.

### 2. Prospects — ce que l'agent voit

Le funnel et le kanban. Le **repère de priorité** combine le statut et la complétude de la fiche — pas de score inventé. Repérez les fiches sans email : ce sont celles que l'agent propose de compléter.

### 3. Campagnes — l'argent

Cliquez sur **« Analyser mes campagnes »**. L'agent repère la campagne dont le ROAS est inférieur à 1 et propose de la couper. Un bandeau vous renvoie vers « Aujourd'hui » pour valider.

Deux choses à regarder au passage :

- la **comparaison à la période précédente** sur les KPI — « est-ce que ça va mieux que le mois dernier ? » ;
- la section **« Déjà tenté »**, qui liste les campagnes arrêtées et ce qu'elles avaient donné. C'est la mémoire qui manque à la plupart des outils : sans elle, un agent repropose indéfiniment ce qui a déjà échoué. Une campagne terminée n'est jamais proposée « à couper ».

Testez aussi **« + Nouvelle campagne »** : brief → construction → proposition → garde-fous. **Rien n'est lancé** — la campagne rejoint la file de validation. Le lancement réel (donc la dépense) est une étape séparée, volontairement pas encore branchée.

### 4. Contenu — la page blanche en moins

L'atelier de contenu n'est pas dans le menu : on y arrive par le bouton **« Idées de contenu »** de Campagnes, ou par le mouvement « Contenu » du cap du mois. L'agent propose des idées tirées de ce qu'il sait déjà de vous. Cliquez sur l'une d'elles : vous obtenez un brief créatif exploitable par un humain ou par une IA de génération.

### 5. Mon entreprise → Agent — la confiance

C'est ici que se joue la crédibilité du produit. Deux choses à essayer :

- **Bouton d'arrêt** → mettre en pause, puis tenter d'exécuter une action validée : elle est refusée, et le refus est tracé.
- **Niveau d'autonomie « Propose seulement »** → même chose : l'agent ne prépare plus rien. Le troisième cran, **« Envoie »**, est grisé avec le badge « Bientôt » — c'est l'étape B, pas encore branchée.

Les plafonds (messages par exécution, par jour) sont indiqués en note sous le curseur et appliqués **côté serveur** : ils ne sont pas contournables depuis l'écran.

> **Envois préparés** a déménagé sur **Journal**, en tête de page : après avoir exécuté une relance validée, les messages y apparaissent avec le statut « Préparé ». **Aucun n'est parti.**

### 6. Mon entreprise → Identité — la mémoire

Tout ce qui s'y trouve nourrit les messages, les briefs et les recommandations. Modifiez le **Ton** ou la **Philosophie**, puis régénérez une relance : la voix doit changer.

L'onglet **Connecteurs**, à côté, permet de choisir le scénario ou d'apporter les données du testeur. Un seul mode peut être actif : retirez le scénario avant Google Sheets, Notion ou CSV.

## Ce qui n'est pas encore là

Autant le dire avant que vous le cherchiez :

- **Aucun envoi réel.** Le transport SMTP est la prochaine étape, derrière les mêmes garde-fous.
- **Le lancement réel de campagne** n'est pas branché (c'est l'action la plus engageante : elle attend des plafonds de budget côté serveur).
- **La recherche web** dans l'onboarding (lire votre site pour pré-remplir votre identité) nécessite une clé d'API — OpenAI ou Perplexity. Si votre version n'en a pas, l'étape est simplement sautée ; rien ne casse. Quand elle est active, chaque recherche est **facturée** : le résultat est donc mis en cache 30 jours et plafonné par jour.
- **Les connecteurs de test** (Google Sheets, Notion, CSV) fonctionnent uniquement sans scénario actif. Les données doivent être autorisées pour le test et l'interface ne les qualifie pas de fictives.

## Vos retours

Les plus utiles, dans l'ordre :

1. Un endroit où vous avez pensé « ça, je ne le ferais pas » — et pourquoi.
2. Un message ou un brief que vous n'auriez **pas** envoyé tel quel.
3. Ce qui manque pour que ça remplace une tâche que vous faites aujourd'hui à la main.
4. Un moment où vous n'avez pas compris ce que l'agent voulait dire.

## Utiliser des données apportées pour le test

Retirez d'abord le scénario Nepteo, puis connectez Google Sheets/Notion ou importez un CSV UTF-8 de **900 Ko et 5 000 lignes maximum**. Nepteo détecte sans ambiguïté les six champs utiles, ignore les autres colonnes et précise que ces champs peuvent nourrir analyses et brouillons. Le remplacement ou le retrait du seul import CSV est atomique, verrouillé et journalisé ; les identifiants restent stables si les lignes sont réordonnées. Même si le fichier a été généré pour le test, il relève de la voie B et l'environnement n'est pas certifié « données fictives ».

Le bouton de retrait CSV supprime les contacts, les propositions liées à cette source et le briefing courant. Le journal append-only et les recherches d'entreprise déjà demandées restent des traces d'audit/cache : ce bouton ne constitue pas un effacement RGPD complet de l'organisation.
