# Nepteo — guide de test (bêta)

> Pour tester Nepteo sans rien brancher. Compte ~25 minutes pour le parcours complet.
> Toutes les données de démonstration sont **fictives**. En mode sûr, **aucun message ne part à l'extérieur** : l'agent prépare, il n'envoie pas.

## Ce que Nepteo essaie d'être

Un copilote marketing pour une personne seule ou une petite équipe. Il comprend l'activité, lit les données, **propose** des actions argumentées, et n'exécute que ce qui est validé. La promesse n'est pas « un outil de plus » : c'est **le raisonnement d'un directeur marketing**, avec le travail préparé.

Trois questions à garder en tête pendant le test :

1. Est-ce que je comprends **pourquoi** l'agent propose ça ?
2. Est-ce que je **ferais confiance** à ce qu'il a préparé ?
3. Qu'est-ce qui manque pour que je l'utilise **vraiment** ?

## Mise en route

1. Créer un compte, confirmer l'email.
2. **Onboarding** : nom de l'entreprise, ce que vous vendez, et le champ **« Votre philosophie »** — écrivez-y votre façon de travailler, ce à quoi vous tenez. C'est ce qui donne sa voix à l'agent.
3. **Vous arrivez sur « Aujourd'hui ». Arrêtez-vous là une minute avant de charger quoi que ce soit** : sans aucune donnée branchée, l'écran d'accueil affiche un **diagnostic de départ** — deux ou trois canaux conseillés à partir de votre seule fiche entreprise, avec le premier geste, ce qu'il vaut mieux éviter, et trois actions pour la semaine. C'est le moment où l'agent doit déjà paraître compétent, avant tout connecteur. (Le même diagnostic est visible sur « Plan du mois ».)
4. Aller sur **« Agent & garde-fous »** → section **« Mode démonstration »** → choisir un scénario :

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

Le diagnostic de départ a laissé la place aux **KPI réels** dès que le scénario est chargé : l'écran ne dit plus « voici par où commencer », il dit ce qui se passe.

Cliquez sur **« Analyser »**. Observez les étapes qui défilent, puis :

- le **bandeau « Le point de l'agent »** : deux ou trois phrases sur l'état réel du funnel, à partir de vos chiffres, sans invention ;
- les **propositions à valider**.

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

L'agent propose des idées tirées de ce qu'il sait déjà de vous. Cliquez sur l'une d'elles : vous obtenez un brief créatif exploitable par un humain ou par une IA de génération.

### 5. Plan du mois — le geste de directeur marketing

Une fois des données chargées, cet écran passe lui aussi du diagnostic de départ au **plan du mois** : quelques mouvements priorisés par levier — couper les pertes d'abord, réactiver les contacts chauds ensuite, alimenter le haut du funnel enfin. Chaque mouvement renvoie vers l'écran où agir.

> **À juger** : est-ce l'ordre que vous auriez choisi ? Sinon, pourquoi ?

### 6. Agent & garde-fous — la confiance

C'est ici que se joue la crédibilité du produit. Trois choses à essayer :

- **Bouton d'arrêt** → mettre en pause, puis tenter d'exécuter une action validée : elle est refusée, et le refus est tracé.
- **Autonomie « Proposer seulement »** → même chose : l'agent ne prépare plus rien.
- **Envois préparés** → après avoir exécuté une relance validée, les messages apparaissent avec le statut « Préparé ». **Aucun n'est parti.**

Les plafonds (messages par exécution, par jour) sont appliqués **côté serveur** : ils ne sont pas contournables depuis l'écran.

### 7. Votre entreprise — la mémoire

Tout ce qui s'y trouve nourrit les messages, les briefs et les recommandations. Modifiez le **Ton** ou la **Philosophie**, puis régénérez une relance : la voix doit changer.

## Ce qui n'est pas encore là

Autant le dire avant que vous le cherchiez :

- **Aucun envoi réel.** Le transport SMTP est la prochaine étape, derrière les mêmes garde-fous.
- **Le lancement réel de campagne** n'est pas branché (c'est l'action la plus engageante : elle attend des plafonds de budget côté serveur).
- **La recherche web** dans l'onboarding (lire votre site pour pré-remplir votre identité) est construite mais nécessite une clé d'API ; elle peut être absente de votre version.
- **Les connecteurs réels** (Google Sheets, Notion) fonctionnent, mais le mode démonstration évite d'avoir à les brancher pour ce test.

## Vos retours

Les plus utiles, dans l'ordre :

1. Un endroit où vous avez pensé « ça, je ne le ferais pas » — et pourquoi.
2. Un message ou un brief que vous n'auriez **pas** envoyé tel quel.
3. Ce qui manque pour que ça remplace une tâche que vous faites aujourd'hui à la main.
4. Un moment où vous n'avez pas compris ce que l'agent voulait dire.

## Utiliser vos propres données fictives

Le mode démonstration couvre trois métiers. Pour un quatrième — le vôtre, ou celui d'un client type — voir **`PROMPT-DONNEES-FICTIVES.md`** : un prompt à coller dans n'importe quel assistant IA pour obtenir un fichier au bon format, importable via Google Sheets.
