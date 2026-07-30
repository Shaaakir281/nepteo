# Roadmap valeur — tests commanditaires

> **Statut au 2026-07-30** : feuille de route opérationnelle de référence pour les améliorations produit.
>
> Elle complète `docs/ROADMAP.md` et **remplace l'ordre d'exécution de la phase C** décrit historiquement dans `docs/projets/roadmap-beta.md`. Les fiches C1–C12 restent utiles comme historique et comme premières spécifications, mais ne valent ni autorisation d'envoi externe ni ordre de lancement.
>
> **Avancement de release** : R1A, R1B et le lot R2 ont été promus en production le 2026-07-30. Les migrations `0012` à `0020` sont appliquées (`app_schema_version = 20`) et Azure sert l'image `73f7e79`, révision `nepteo-prod--0000003`, avec 100 % du trafic. `/`, `/api/health` et `/api/ready` répondent HTTP 200 ; le smoke applicatif authentifié en lecture est propre. Un lot local isole le connecteur démo orphelin, unifie les agrégats autour d'une cohorte complète, canonicalise conservatoirement les conflits multi-source et stabilise les snapshots de relance face aux synchronisations, mais il n'est pas encore publié. R0 reste ouvert pour la livraison/recette de ce lot, le smoke RLS dédié, les callbacks OAuth et la recette fonctionnelle.

## Cap produit

La proposition à prouver reste volontairement étroite :

> **Ne plus oublier les prospects, savoir qui relancer maintenant et obtenir un message personnel prêt à envoyer.**

Le benchmark converge vers une boucle courte : **signal fiable → priorité expliquée → action supervisée → résultat mesuré**. La prochaine valeur ne vient donc pas d'un catalogue de connecteurs, mais d'une meilleure preuve que cette boucle aide réellement un commanditaire.

## État de départ et porte encore ouverte

- **Phase technique atteinte** : la phase 3A est déployée. Nepteo peut détecter, expliquer, faire décider et préparer une relance sans l'envoyer.
- **Porte produit encore ouverte** : la phase 2 n'est pas prouvée sur le terrain. Il manque des recommandations évaluées sur des données réelles et des résultats aval observés.
- **Schéma et application alignés** : les migrations `0012` à `0020` et l'application correspondante sont en production. C8, R1A, R1B, R2 et les durcissements associés restent à recetter sur session authentifiée avant le pilote.
- **C7 n'est plus l'étape automatique suivante** : l'envoi réel ne sera construit qu'après preuve de l'utilité du play de relance et fermeture de ses gates RGPD/exploitation.

## Définitions de mesure

| Terme | Définition |
|---|---|
| Recommandation utile | Le testeur agirait maintenant ou planifierait l'action pour une raison métier, indépendamment de son appréciation visuelle de l'interface. |
| Faux positif | Le contact a déjà répondu, a été contacté récemment, s'est opposé, n'est pas la bonne personne, est dans un statut terminal ou ne devait manifestement pas être relancé. |
| Brouillon légèrement retouché | Corrections de ton ou de formulation qui ne changent ni la cible, ni l'intention, ni les faits utilisés. |
| Envoi manuel déclaré | Le testeur indique avoir envoyé le message hors de Nepteo. Ce fait est utile mais **n'est pas** un statut fournisseur `sent`. |
| Résultat déclaré | Réponse, rendez-vous ou opportunité saisis par le testeur, avec date et source explicites. |
| Résultat observé | Événement confirmé par un fournisseur ou un webhook : envoyé, délivré, réponse détectée. |

Principes de preuve :

- les dénominateurs sont toujours visibles ;
- un fait déclaré et un fait observé ne sont jamais fusionnés ;
- aucun revenu n'est « attribué » sans source d'opportunité ou de paiement explicite ;
- aucun objet, corps d'email ou adresse n'est nécessaire dans les métriques de valeur.
- les événements marqués `is_demo = true` ne participent jamais aux gates terrain.

## Roadmap ordonnée

| Vague | Incrément | Effort indicatif | Dépendance | Porte de sortie |
|---:|---|---:|---|---|
| R0 | Fin du smoke et recette du lot | 1 j d'exploitation | Artefact `73f7e79` déployé, readiness 20 | Smoke auth/RLS/OAuth/C8/R1/R2 vert |
| R1A | Preuve manuelle structurée — C9A | 2–3 j | Modèle d'événements validé | Utilité, faux positif, retouche, envoi et résultat déclarés sans fabriquer de statut fournisseur |
| R1B | « Aujourd'hui » : jusqu'à cinq priorités réelles | 1–2 j | Règles actuelles réutilisées | Jusqu'à cinq actions classées de façon déterministe avec « pourquoi maintenant » |
| R2 | Play supervisé « prospects dormants » | 2–3 j + 2 semaines d'observation | R0 franchi, puis R1A + R1B promus sur l'environnement pilote | Cohorte bornée, validation humaine, snapshot atomique, scorecard exploitable et observations terrain suffisantes |
| R3 | Un connecteur de contexte en lecture seule | 3–6 j | Gate connecteur franchi + accord explicite de Fathi | Gmail **ou** Microsoft 365, faits d'interaction minimisés et révocation testée |
| R4 | Apprentissage à partir des corrections | 3–5 j | Au moins 30 brouillons corrigés | Réduction mesurée des retouches sans modèle opaque |
| R5 | C7 — outbound supervisé et ultra-borné | 4–7 j + recette fournisseur | Gates valeur, RGPD et exploitation franchis, accord explicite de Fathi | Self-test reçu, lot pilote sans doublon, opposition ni envoi non voulu |
| R6 | C9B, brief et séquences graduelles | 2–4 j puis cadrage | Événements fournisseur fiables | Résultats observés ; séquences seulement après une cohorte supervisée sûre |

Les estimations sont des ordres de grandeur de développement, hors délais de consentement administrateur, validation de domaine, revue juridique et disponibilité des testeurs.

## R0 — Recetter avant de promouvoir

1. Conserver la preuve de l'acquis base : `0012` → `0020` appliquées manuellement et `app_schema_version.version = 20` à `2026-07-30T06:02:14Z`.
2. Conserver la preuve de release : PR #5, CI de PR et de `main` vertes, image `73f7e79`, révision `nepteo-prod--0000003`.
3. Vérifier sur session authentifiée le smoke RLS, les rôles et l'absence d'envoi externe.
4. Livrer puis recetter le retrait sélectif du connecteur démo orphelin et la cohorte prospects complète partagée par les écrans, l'analyse et le briefing.
5. Recetter la réconciliation conservatrice des statuts contradictoires d'un même contact entre plusieurs sources : un état terminal ou une opposition bloque la relance ; deux statuts actifs contradictoires suspendent la cible.
6. Rejouer les callbacks Google Sheets/Notion, l'isolation de démonstration, C8, le Top 5, toute la boucle déclarative R1A et les garde-fous R2.
7. Ne pas déclarer R0 entièrement franchi ni basculer le pilote tant que cette verticale n'est pas verte.

R1A, R1B et R2 sont déployés et leur schéma de support est présent en production. R0 bloque encore leur promotion vers un pilote réel, pas leur recette sur la révision de production.

Les tests techniques publics continuent sur la révision `nepteo-prod--0000003`. Après recette authentifiée, R1A, R1B puis R2 sont promus de façon supervisée sur un tenant pilote dédié, avec l'image et la révision notées dans la scorecard.

## R1A — Instrumenter la preuve avant l'envoi

Le journal reste la trace humaine append-only. La migration `0020` ajoute des événements structurés, minimisés et idempotents :

- `suggestion_useful` ;
- `suggestion_not_useful` ;
- `false_positive` avec motif normalisé ;
- `draft_reviewed` avec niveau de retouche ;
- `manual_followup_sent` ;
- `reply_received` ;
- `meeting_booked` ;
- `opportunity_created`.

`value_events` porte l'organisation, l'action, le prospect facultatif, le type, la source, la date, l'acteur, l'idempotence et `is_demo`, sans objet, corps d'email ni adresse. La source de l'interface est forcée à `manual` ; Gmail/Microsoft restent réservés aux futurs faits observés. Les corrections de verdict ou de retouche ajoutent un nouvel événement et ne réécrivent pas l'historique. Les résultats aval sont confirmés avant saisie et restent immuables dans ce lot.

Pendant le pilote, la saisie reste réservée à `admin`, `marketing` ou `direction`. L'approbation d'une relance fige atomiquement une cohorte non vide de 50 prospects maximum ; un résultat aval exige ensuite une action approuvée/exécutée et un prospect de cette cohorte. Si le rôle `commercial` doit saisir ces faits, créer une RPC étroite sur ces seuls événements plutôt que de rouvrir les tables de contenu libre.

## R1B — Transformer « Aujourd'hui » en vraie file de travail

La page lit désormais au plus 50 propositions autorisées puis retient **jusqu'à cinq** priorités explicables, sans en fabriquer quand moins de cinq sont légitimes :

1. proximité d'un résultat commercial ;
2. prospect actif et joignable ;
3. ancienneté du dernier contact ;
4. ancienneté de la proposition ;
5. confiance et risque comme départage ;
6. horodatage exact puis identifiant en dernier recours.

Le classement est une fonction pure et déterministe. Le filtre de rôle est appliqué avant le classement ; les anciens `relaunch_stage_*` restent derrière une relance vérifiée, les volumes n'augmentent pas le score et l'interface affiche le fait qui explique « pourquoi maintenant ».

## R2 — Prouver le play « prospects dormants »

> **Statut de release au 2026-07-30** : le lanceur, la scorecard et leur schéma de support sont déployés en production sur l'image `73f7e79`. `/api/ready` répond HTTP 200 et le smoke applicatif administrateur en lecture est vert. Le pilote reste interdit tant que le reliquat R0 — hotfix connecteurs, smoke RLS dédié, OAuth et recette des parcours — n'est pas vert.

La cohorte implémentée est volontairement stricte :

- le testeur doit choisir explicitement **30 ou 45 jours** ; aucune valeur n'est présélectionnée ou déduite par défaut ;
- seuls les prospects actifs, joignables par email et dotés d'une date de dernier contact valide sont éligibles ; une date absente, invalide ou future échoue fermée ;
- les statuts terminaux et les oppositions représentées dans le statut sont exclus ;
- la sélection est déterministe, du silence le plus ancien au plus récent, puis bornée à **50 contacts maximum** ;
- les prospects déjà figés dans le snapshot d'une vague `relaunch_dormant` antérieure sont exclus des vagues suivantes ;
- le lanceur crée uniquement une action `proposed` à relire : il n'écrit pas dans l'outbox et ne déclenche aucun envoi ;
- au moment de l'approbation humaine, l'état courant est revalidé puis la cohorte non vide est figée avec la décision et son journal par la RPC atomique de `0020`.

La scorecard R2 ne lit que les événements non-démo `relaunch_dormant` de **l'organisation courante**. Elle affiche les numérateurs et dénominateurs, retient le dernier verdict et la dernière évaluation de brouillon par action, compte les relances manuelles sans doublon et sépare explicitement les résultats **déclarés** des faits **observés par un fournisseur**. Une absence de donnée reste une preuve indisponible, jamais un zéro favorable.

Cette scorecard est un outil local, pas un entrepôt programme. Les RLS et le contexte d'organisation interdisent toute agrégation inter-tenant. Le gate « 3 testeurs », les deux pilotes d'un même écosystème et la décision transversale sont consolidés manuellement et anonymement hors de l'application, à partir de numérateurs/dénominateurs et de fiches pseudonymisées.

`value_events.action_kind` conserve le kind d'origine même si l'action est supprimée et que sa référence devient nulle. La scorecard continue donc d'attribuer la preuve historique au play dormant sans recréer ni réattribuer l'action disparue. Si la lecture échoue ou dépasse la borne de 5 000 événements, elle est suspendue plutôt que calculée sur un historique partiel.

Les derniers garde-fous du lot restent fail-closed :

- une action dormante active empêche la création d'une proposition concurrente ;
- les vagues antérieures sont exclues par snapshot et, lorsque l'information existe encore, par email normalisé ;
- le scan des prospects et l'historique sont paginés et bornés ; une base ou un historique trop grand bloque la proposition plutôt que de produire une cohorte partielle ;
- approbation et exécution gardent le verrou distribué des synchronisations pendant toute la lecture paginée ;
- l'exécution ne peut utiliser que les membres du snapshot, puis revalide leur éligibilité courante ; si un autre connecteur devient le représentant canonique du même email, l'ID figé reste utilisé ; une identité disparue sans correspondance est exclue ;
- les lignes sans email restent distinctes dans les chiffres métier, même si nom et entreprise sont identiques ;
- un résultat aval dormant est refusé sans cohorte d'action ;
- la scorecard n'affiche aucun taux en cas de lecture incomplète ou échouée.

La base actuelle ne possède toutefois pas de suppression-list indépendante et non contournable. Une opposition portée par un statut ne remplace pas ce registre : la validation humaine reste obligatoire pendant R2 et C7 demeure bloqué jusqu'à son implémentation et sa recette.

Deux checkpoints évitent de conclure trop tôt :

### Checkpoint qualitatif

Après au moins **3 testeurs et 30 recommandations examinées** :

- au moins 2/3 atteignent une recommandation utile sans aide ;
- au moins 2/3 jugent le meilleur brouillon envoyable avec peu de retouches ;
- 3/3 distinguent « préparé », « envoi manuel déclaré » et « envoyé par un fournisseur » ;
- aucun incident destructif, fuite inter-organisation ou action non voulue.

### Décision produit

Après au moins **50 recommandations examinées** et **deux semaines de test** :

| Résultat | Décision |
|---|---|
| Utilité ≥ 60 % et faux positifs < 15 % | Accélérer le play |
| Utilité entre 40 % et 59 % | Itérer sur données, classement et copie |
| Utilité < 40 % | Pivoter le play ; ne pas ajouter de connecteur pour masquer le problème |

Le taux de brouillons sans retouche ou avec retouches légères vise **≥ 60 %**. Le temps jusqu'à une première recommandation utile vise **≤ 15 minutes pour 2 testeurs sur 3**.

Ces seuils restent à mesurer : le code local ne remplace ni les **3 testeurs / 30 recommandations** du checkpoint qualitatif, ni les **50 recommandations / deux semaines** nécessaires à la décision produit.

## Gate du prochain connecteur

Le cadrage d'un connecteur n'est lancé que si les observations montrent un manque de contexte, et non par préférence technique :

1. au moins **deux pilotes utilisent le même écosystème** ; et
2. soit **au moins 30 % des rejets** viennent d'un historique d'interactions manquant, soit la recherche manuelle de contexte dépasse **2 minutes par action** en médiane.

Dans la scorecard locale, `missing_context` compte uniquement les faux positifs dont l'historique d'interactions manquant a réellement empêché la décision ; son dénominateur est l'ensemble des derniers verdicts rejetés. Atteindre 30 % dans un tenant est un signal local. Le gate connecteur exige toujours la consolidation programme anonymisée, deux pilotes dans le même écosystème et l'alternative de temps mesurée dans les fiches.

Si le gate échoue, la priorité reste le classement, le mapping et la qualité des brouillons.

S'il est franchi, le cadrage compare les scopes, consentements, coûts et délais des deux écosystèmes. **Le code ne commence qu'après l'accord explicite de Fathi sur un seul écosystème.** Ensuite :

- choisir **Google Workspace/Gmail ou Microsoft 365, jamais les deux dans le même cycle** ;
- commencer en lecture seule par les faits dérivés : dernier entrant, dernier sortant, état de réponse, prochain rendez-vous, fraîcheur de synchronisation ;
- utiliser des scopes minimaux et un polling borné au volume pilote ;
- ne conserver ni sujet ni corps d'email par défaut ;
- tester séparation par organisation, rétention, export/suppression, révocation du token et tombstones empêchant une résynchronisation indésirable ;
- ajouter le calendrier du même écosystème seulement après le mail, avec le même consentement quand c'est possible.

## R4 — Apprendre des corrections

Après au moins **30 brouillons corrigés**, mesurer les motifs récurrents : ton, longueur, personnalisation, fait manquant ou appel à l'action. Introduire d'abord des règles et préférences explicites dans la mémoire entreprise. Une amélioration est retenue si elle réduit d'au moins 20 % les retouches importantes ou porte à 30 % la part de brouillons acceptés sans retouche sur une cohorte comparable.

## Gate C7 — envoi réel supervisé

C7 devient candidat lorsque les preuves produit suivantes sont réunies :

- au moins 50 recommandations examinées ;
- utilité ≥ 60 % et faux positifs < 15 % ;
- au moins 20 relances manuelles **déclarées** ;
- au moins un signal aval déclaré : réponse, rendez-vous ou opportunité ;
- zéro incident de confiance non résolu.

Avant le premier envoi, il faut également :

- fournisseur UE, domaine et identité d'expéditeur vérifiés ;
- registre de traitement, base légale, information et opposition cadrés ;
- suppression-list non contournable et tombstones de synchronisation ;
- budget global réservé atomiquement et claim de message par worker ;
- états `sending`, `sent`, `failed`, `unknown`, avec réconciliation des timeouts ;
- clé d'idempotence transmise au fournisseur et aucun retry automatique d'un statut `unknown` ;
- kill switch, allowlist pilote, self-test forcé puis confirmation explicite de chaque lot.

Le premier lot réel reste borné à **5 destinataires maximum**. L'autorisation de C7 appartient explicitement à Fathi ; franchir les métriques ne déclenche rien automatiquement.

Le lot R2 n'ajoute pas la suppression-list indépendante exigée ci-dessus. Tant qu'elle n'existe pas et n'est pas recettée, C7 reste fermé même si la scorecard atteint ses objectifs.

## R6 — Mesure observée et autonomie graduelle

C9B remplace progressivement les déclarations par les statuts observés du fournisseur et affiche leurs dénominateurs. Le brief hebdomadaire vient ensuite, s'il s'appuie sur les mêmes faits auditables.

Les séquences C12 ne sont cadrées qu'après au moins **100 envois supervisés**, avec :

- 100 % des oppositions respectées ;
- zéro doublon et zéro envoi non voulu ;
- faux positifs < 5 % sur la cohorte récente ;
- arrêt à la réponse et statut terminal prouvés.

## Parallélisation sûre

| Piste | Peut avancer avec | Condition |
|---|---|---|
| R0 smoke authentifié et recette | Préparation des sessions R1A, R1B et R2 | Aucune mutation concurrente du schéma ou de l'outbox |
| R1A instrumentation | R1B classement | Migrations/API d'un côté, fonction pure/UI de l'autre, un intégrateur final |
| Cadrage connecteur | Fin du pilote R2 | Lecture de documentation et matrice de scopes seulement ; aucun code fournisseur avant le gate |
| R4 apprentissage | R3 connecteur | Le seuil de 30 corrections est déjà atteint et les fichiers sont disjoints |

R2 est maintenant déployé avec son schéma à 20, mais il attend encore la fin de la recette R0 et la promotion supervisée de R1A/R1B avant tout pilote. R5 attend les gates valeur, RGPD et exploitation ; il ne se parallélise pas avec une autre mutation de l'outbox.

## Dix prochains jours ouvrés

1. **J1 — terminé** : commit du worktree complet, PR/CI, fusion dans `main`, déploiement manuel protégé et contrôles publics verts.
2. **J2** : smoke authentifié/RLS, callbacks OAuth et parcours C8/R1A/R1B/R2.
3. **J3** : scorecard mise à jour et promotion supervisée vers l'environnement pilote si R0 est vert.
4. **J4–J5** : recette du play dormant borné, de l'exclusion des vagues antérieures, du snapshot atomique et de la scorecard.
5. **J6–J10** : premières sessions commanditaires, correction des blocages P0/P1 et collecte des 30 premières évaluations.

À J10, la décision attendue n'est pas « quel connecteur préfère-t-on ? », mais : **le play est-il utile, et son principal manque vient-il réellement du contexte email/calendrier ?**

## Hors roadmap immédiate

- deuxième écosystème email ;
- automatisation LinkedIn ;
- enrichissement de masse ;
- CRM complet ou canvas de workflows ;
- attribution complexe et revenu estimé ;
- génération d'images comme priorité produit ;
- campagnes publicitaires réelles ;
- séquences autonomes avant la preuve supervisée.
