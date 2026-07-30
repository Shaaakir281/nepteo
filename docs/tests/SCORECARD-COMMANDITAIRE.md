# Scorecard — test commanditaire Nepteo

Une fiche par testeur. Utiliser une organisation neuve et noter les observations, pas seulement les opinions.

## Deux niveaux de lecture — local et programme

La scorecard intégrée à « Aujourd'hui » est **strictement locale à l'organisation courante**. Les RLS, le contexte d'organisation et la requête par `action_kind` empêchent toute lecture ou agrégation inter-tenant. Le nombre d'évaluateurs affiché dans l'application est donc un repère local ; même s'il atteint trois, il ne valide pas à lui seul le gate du programme.

Le gate **« 3 testeurs »** se consolide manuellement et anonymement hors de l'application, à partir d'une fiche par testeur. Ne réunir que les éléments nécessaires à la décision : pseudonyme, écosystème, numérateurs/dénominateurs, durée, incidents et appréciations prévues ci-dessous. Ne pas exporter d'adresse, de nom de prospect, d'objet, de corps de message ni de données brutes d'un tenant.

Cette séparation est volontaire :

- **dans Nepteo** : preuve locale, cloisonnée par organisation ;
- **hors Nepteo** : consolidation programme anonymisée des différents pilotes ;
- **jamais** : tableau ou requête qui mélange les événements de plusieurs organisations.

## Contexte

| Champ | Valeur |
|---|---|
| Date / version testée | |
| Testeur / rôle | |
| Scénario | Démo / feuille réelle |
| Navigateur / appareil | |
| Assistance donnée avant le test | Aucune / légère / guidée |
| Écosystème de travail | Google Workspace / Microsoft 365 / autre |

## Préflight

- [ ] Inscription, confirmation et connexion fonctionnent.
- [ ] L'organisation est neuve et ne contient aucune donnée d'un autre testeur.
- [ ] Le testeur sait qu'aucun message ne sera envoyé par Nepteo ; tout envoi manuel reste son geste volontaire, hors du produit.
- [ ] Pour une feuille réelle, les données utilisées sont autorisées et minimisées.

## Parcours observé

Laisser le testeur agir sans le guider. N'aider qu'en cas de blocage, puis noter précisément l'aide.

| Preuve recherchée | Résultat | Observation factuelle |
|---|---|---|
| Atteint une recommandation utile sans aide | Oui / Non | |
| Comprend pourquoi elle est proposée | Oui / Non | |
| Juge un brouillon envoyable avec des retouches légères | Oui / Non | |
| Identifie une tâche manuelle que Nepteo pourrait remplacer | Oui / Non | |
| Distingue « préparé », « envoi manuel déclaré » et « envoyé par un fournisseur » | Oui / Non | |
| Comprend l'effet du dernier contact sur la priorité | Oui / Non / N.A. | |
| Rencontre un blocage ou une action destructive | Oui / Non | |

## Mesures

| Mesure | Valeur |
|---|---:|
| Temps jusqu'à la première recommandation utile | min |
| Nombre d'aides nécessaires | |
| Nombre de brouillons examinés | |
| Retouches jugées nécessaires au meilleur brouillon | 0 / légères / importantes |
| Temps médian de recherche du contexte avant décision | min / action |
| Rejets dus à un historique d'interactions manquant | nombre / recommandations rejetées |
| Confiance pour réutiliser le produit (1–5) | |
| Valeur perçue pour son activité (1–5) | |

## Suivi longitudinal du play

Une ligne par recommandation réellement examinée. Utiliser l'identifiant d'action et un pseudonyme ; ne pas recopier d'adresse, d'objet ou de corps d'email.

| Date | Action / prospect pseudonymisé | Utile | Faux positif / motif | Retouche | Envoi manuel déclaré | Résultat déclaré | Source |
|---|---|---|---|---|---|---|---|
| | | Oui / Non | Non / contact récent / déjà répondu / opposition / mauvaise personne / statut terminal / contexte manquant / autre | 0 / légère / importante | Non / Oui + date | Aucun / réponse / RDV / opportunité + date | Testeur / fournisseur |

Règles de saisie :

- « Envoi manuel déclaré » ne fait jamais passer un message Nepteo au statut fournisseur `sent`.
- Une réponse ou un rendez-vous saisi par le testeur reste **déclaré** jusqu'à confirmation éventuelle par un connecteur.
- Un faux positif se compte même si le brouillon est bien écrit.
- Choisir le motif technique `missing_context` uniquement lorsqu'un **historique d'interactions manquant** empêche réellement la décision. Utiliser un autre motif pour un contact récent, une opposition, une mauvaise personne, un statut terminal ou une recommandation simplement peu utile.
- Corriger une observation par une nouvelle ligne datée ; ne pas effacer silencieusement l'historique.

Dans l'application, `value_events.action_kind` conserve le play d'origine même si l'action opérationnelle est ensuite supprimée et que `action_id` devient nul. La preuve historique reste ainsi attribuée à `relaunch_dormant`, sans recréer ni réattribuer artificiellement une action disparue.

## Questions de fin

1. Quelle tâche feriez-vous moins souvent à la main grâce à Nepteo ?
2. Quelle recommandation vous a semblé la plus utile, et pourquoi ?
3. Qu'est-ce qui vous empêcherait de connecter votre vraie feuille ?
4. À quel moment avez-vous hésité sur ce que l'agent allait faire ?
5. Quelle information manquait pour décider d'une relance ?

## Incidents et retours

| Type | Description | Sévérité | Reproductible |
|---|---|---|---|
| Blocage / confiance / valeur / préférence | | P0 / P1 / P2 / P3 | Oui / Non |

## Porte de décision

Sur trois testeurs minimum **et 30 recommandations examinées**, le lot est candidat à la suite si :

- au moins **2/3** atteignent une recommandation utile sans aide ;
- au moins **2/3** jugent une recommandation utile pour leur activité ;
- au moins **2/3** jugent un brouillon envoyable avec des retouches légères ;
- **3/3** distinguent « préparé », « envoi manuel déclaré » et « envoyé par un fournisseur » ;
- il n'y a **aucun incident destructif ou bloquant non contourné**.

Si une condition échoue, corriger le point observé puis rejouer le même protocole. Une préférence visuelle isolée ne bloque pas une preuve de valeur.

Cette porte est une **porte programme** : les trois testeurs peuvent appartenir à des organisations différentes et sont alors consolidés manuellement avec des pseudonymes. La scorecard intégrée ne franchit et n'affiche que des objectifs locaux ; elle ne doit jamais interroger un autre tenant pour compléter ce volume.

## Porte longitudinale du play

Ne prendre une décision d'accélération qu'après au moins **50 recommandations examinées** et **deux semaines de test** :

- **accélérer** si l'utilité atteint 60 % et les faux positifs restent sous 15 % ;
- **itérer** si l'utilité est comprise entre 40 % et 59 % ;
- **pivoter le play** si l'utilité reste sous 40 % ;
- viser au moins 60 % de brouillons sans retouche ou avec retouches légères ;
- exiger zéro incident destructif, fuite inter-organisation ou action non voulue.

## Porte de décision du connecteur

Gmail ou Microsoft 365 devient candidat, en lecture seule, uniquement si :

1. au moins **deux pilotes** utilisent le même écosystème ; et
2. au moins **30 % des rejets** sont dus à un contexte d'interaction manquant, **ou** la recherche manuelle de ce contexte dépasse **2 minutes par action** en médiane.

La scorecard locale calcule le premier signal comme suit :

- numérateur : derniers verdicts `false_positive` dont le motif est `missing_context` ;
- dénominateur : derniers verdicts rejetés, soit `suggestion_not_useful` + `false_positive` ;
- seuil d'alerte local : **≥ 30 %**, avec le numérateur et le dénominateur visibles.

Ce taux local est un **signal de cadrage**, pas un gate programme franchi. La condition « deux pilotes dans le même écosystème », le taux consolidé et la médiane du temps de recherche sont rapprochés manuellement et anonymement hors de l'application. Une base locale sans rejet donne `0/0` et ne fournit aucune preuve favorable.

Cette porte autorise uniquement un cadrage. Le développement d'un seul écosystème exige ensuite un accord explicite de Fathi ; elle n'autorise ni le développement des deux écosystèmes, ni l'envoi externe.

## Limites d'affichage de la scorecard intégrée

- seuls les événements `relaunch_dormant` non-démo de l'organisation courante sont lus ;
- les derniers verdicts et dernières revues de brouillon remplacent les versions antérieures dans les taux, sans effacer l'historique append-only ;
- au-delà de 5 000 événements ou si une page ne peut pas être lue, la scorecard est suspendue plutôt que d'afficher des taux partiels ;
- un événement historique dont l'action ou le prospect a été supprimé reste distinct ; il n'est jamais fusionné sous une fausse identité « inconnue » ;
- aucun objectif local, y compris 30 ou 50 recommandations, ne déclenche automatiquement un connecteur, C7 ou une agrégation inter-tenant.
