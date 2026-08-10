# Refonte de densité — prompts Codex

Guide d'envoi des lots UX-1 à UX-9. Chaque bloc encadré est à copier-coller tel quel dans une tâche Codex, **une tâche par lot**.

Objectif commun : les testeurs décrochent parce que chaque écran demande de lire avant de comprendre quoi faire. Les neuf specs HTML prévues dans `docs/maquettes/` définissent, écran par écran, la hiérarchie cible, les textes définitifs et un critère de recette chiffré.

| Lot | Écran | Mots lisibles au 1ᵉʳ rendu | Spec |
|---|---|---|---|
| UX-1 | Aujourd'hui | 315 → 42 | `nepteo-aujourdhui-ux1.html` |
| UX-5 | Onboarding | 105 → 38 | `nepteo-onboarding-ux5.html` |
| UX-2 | Prise en main | 470 → 55 | `nepteo-prise-en-main-ux2.html` |
| UX-3 | Mon entreprise | 375 → 82 | `nepteo-mon-entreprise-ux3.html` |
| UX-4 | Campagnes | 262 → 53 | `nepteo-campagnes-ux4.html` |
| UX-6 | Tiroir de validation + sous-blocs | 220 → 60 | `nepteo-validation-ux6.html` |
| UX-7 | Prospects + Journal | 266 → 115 | `nepteo-listes-ux7.html` |
| UX-8 | Catalogue + tunnel + laboratoire | 214 → 86 | `nepteo-brancher-ux8.html` |
| UX-9 | Tunnel campagne + Story | 11 champs → 4 | `nepteo-produire-ux9.html` |

État local au 2026-08-10 : **UX-1 à UX-5 sont terminés et validés**. Les commits de référence sont UX-1 `cf66442`, UX-5 `db97b5e`, intégration UX-1 + UX-5 `a4fede7`, UX-2 `0dc6e40`, UX-3 `c9c8db4` et UX-4 `8a287ec`.

Suite locale : **UX-6**, puis **UX-7**, puis **UX-8**, puis **UX-9**. Le préalable UX-4 d'UX-9 est déjà satisfait. Chaque lot reste indépendant et attend son propre `GO UX-n`.

---

## Avant le prochain lot — état des préalables

1. **UX-1 à UX-5 : fait.** Les cinq specs d'origine sont versionnées et `CLAUDE.md` annonce bien bleu `#2d5ba7`, encre `#1c1713` et cerise `#8a232d`.
2. **UX-6 à UX-9 : specs à ajouter.** Les quatre fichiers `nepteo-validation-ux6.html`, `nepteo-listes-ux7.html`, `nepteo-brancher-ux8.html` et `nepteo-produire-ux9.html` ne sont pas présents dans ce checkout. Ne pas lancer UX-6 tant que sa spec n'a pas été ajoutée localement et relue.
3. **Fins de ligne : risque latent, pas un diff actif.** Le checkout est propre au moment de cette actualisation. Il n'a pas de `.gitattributes` et la configuration Git système utilise `core.autocrlf=true`. Si la normalisation est décidée, ajouter `* text=auto eol=lf` puis renormaliser dans un commit dédié, sans aucun changement UX mélangé.

> L'alerte antérieure portant sur 157 fichiers modifiés uniquement par leurs fins de ligne provenait d'un autre état de checkout. Elle ne doit pas être recopiée comme état courant sans un nouveau `git status` et une comparaison `--ignore-all-space`.

---

## Préambule commun

À coller **en tête de chaque tâche**, avant le bloc du lot.

```
Contexte
Projet Nepteo, dépôt agent_marketing. Lis d'abord CLAUDE.md puis docs/SUIVI.md,
et consigne ta session à la fin de docs/SUIVI.md (entrée datée : fait / décisions /
reste à faire).

Cette tâche fait partie d'une refonte de densité en neuf lots (UX-1 à UX-9). Le
problème : les testeurs décrochent parce que chaque écran demande de lire avant
de comprendre quoi faire. La direction retenue par Fathi le 2026-08-10 est le
niveau « Épuré ».

Diagnostic d'ouverture — avant toute modification, annonce :
- le modèle que tu utilises,
- le chemin du checkout et le HEAD attendu,
- la présence des fichiers sentinelles listés dans le bloc du lot.
Si l'un de ces points ne correspond pas, arrête-toi et signale-le. Ne conclus
jamais à un blocage utilisateur depuis un mauvais checkout.

Règles non négociables pour toute cette refonte
1. Présentation uniquement. Aucune migration, aucun changement de schéma,
   aucune route nouvelle, aucun appel externe, aucune télémétrie, aucun envoi.
2. Les moteurs purs de lib/ ne changent pas. Si un calcul manque (jauge de
   complétude, par exemple), il est ajouté comme fonction pure testable dans
   lib/, jamais dans un composant.
3. Les gardes de rôle et de démo restent intactes : canEdit, canViewFinancials,
   isCommercialSafeActionKind, mutationBlockedByDemo. Un commercial ne doit
   toujours rien voir de financier, y compris dans les nouveaux blocs mis en
   avant.
4. Les composants serveur restent serveur. Ne pas ajouter "use client" pour
   obtenir un accordéon : utiliser <details>/<summary>.
5. Convention du dépôt : un composant par fichier, pas de fichier au-dessus de
   ~200 lignes sans raison. Si un fichier dépasse, le découper d'abord.
6. Les tokens sont ceux de app/globals.css. Ne pas introduire de couleur en dur
   qui n'y figure pas.
7. Textes en français, concis. Ne pas définir le lexique marketing standard
   (prospect, lead, funnel, relance). Pas de sous-titre explicatif à rallonge.

Les cinq règles de densité
1. Une seule action dominante par écran : un seul bouton plein visible sans
   scroller.
2. Aucun bloc au-dessus de la ligne de flottaison ne dépasse 3 lignes de texte.
3. Les garde-fous (« mode sûr », « rien n'est envoyé ») sont une mention de
   confiance, pas du contenu : 11px, en pied ou en pastille — jamais un encart.
4. Tout bloc secondaire est un <details> fermé au premier rendu.
5. Chaque carte commence par un verbe ou un chiffre. Le « pourquoi » vient
   après, ou en repli.

Comment lire la spec
Le fichier HTML indiqué dans le lot s'ouvre dans un navigateur et contient trois
onglets : « Avant (livré) », « Épuré » et « Consignes Codex ». L'onglet
Consignes contient la correspondance bloc par bloc et les critères de recette.
La case « Annotations » fait apparaître les problèmes identifiés sur la version
actuelle.

C'est une spec, pas du code à recopier. Transpose la hiérarchie, les tokens et
les textes dans les composants existants. Ne recopie pas le HTML de la maquette :
il ignore les composants serveur, les gardes de rôle et la structure du dépôt.

Fin de tâche
Termine par un résumé de ce qui a changé, les contrôles passés (npm run lint,
npm run typecheck, npm test, npm run build), une recette responsive sur le PC de
cinq minutes maximum, puis un bloc unique « Commande à copier-coller ». Attends
l'approbation avant toute publication.
```

---

## Tâche 1 — UX-1 + UX-5 — terminé localement

Référence : UX-1 `cf66442`, UX-5 `db97b5e`, intégration `a4fede7`.

```
Lot UX-1 + UX-5 — écrans « Aujourd'hui » et « Onboarding ».

Specs : docs/maquettes/nepteo-aujourdhui-ux1.html
        docs/maquettes/nepteo-onboarding-ux5.html
Ouvre les deux et lis l'onglet « Consignes Codex » de chacune.

Fichiers sentinelles :
- app/(cockpit)/page.tsx
- app/(cockpit)/_components/starter-diagnostic.tsx
- app/onboarding/_components/guided-onboarding.tsx

UX-1 — Aujourd'hui
Cible : 42 mots lisibles au premier rendu contre 315, et au plus 1 bloc entre
l'en-tête et la file de décision contre 5.
- Le premier levier du diagnostic devient un héros : titre reformulé à
  l'impératif, un bouton plein, et une entrée « Pourquoi ? » à côté du bouton.
  Précision : c'est le LIBELLÉ « Pourquoi ? » qui doit être visible en
  permanence — jamais dans un accordéon fermé, jamais sous la ligne de
  flottaison. Sa réponse, elle, est repliée dans un <details> et s'ouvre au
  clic. Concrètement : un <details> dont le <summary> est « Pourquoi ? », placé
  à côté du bouton principal.
- Les leviers suivants, « Cette semaine » et « À éviter » deviennent des
  <details> fermés. « Cette semaine » et « À éviter » fusionnent en un seul.
- L'état vide de la file de décision passe de six lignes à une ligne plus un
  bouton outline.
- Le bandeau « Corriger ma fiche / Brancher mes outils » et la note « scénario
  d'exemple » descendent en liens 11px en pied d'écran.
- Ajoute la pastille de progression « 2/5 » en haut : elle lit le même
  localStorage que la prise en main (WALKTHROUGH_STORAGE_KEY,
  WALKTHROUGH_UPDATED_EVENT). Elle prépare le lot UX-2.
- Le comportement avec données (KPI, PlanBanner, DormantPlayLauncher) suit les
  mêmes règles : le héros est alimenté par la première action priorisée.

UX-5 — Onboarding
Cible : 38 mots sur l'écran de choix contre 105.
- Une durée annoncée par option : « 3 min » / « 5 min ».
- L'encart vert « Mode sûr » de quatre lignes devient une ligne de 11.5px
  centrée sous les options. La promesse reste exacte, seule sa place change.
- Une icône par option et par scénario.
- Le sous-titre de l'écran de choix disparaît : il paraphrase les deux options
  qu'il précède.
- Les deux voies restent exclusives et le choix d'un scénario ne le charge
  toujours pas : la confirmation reste un geste distinct dans le cockpit.

Recette responsive sur le PC (5 min)
1. Se connecter sur un compte neuf : l'écran de choix tient sans scroller, deux
   durées visibles, aucun encart de plus d'une ligne.
2. Choisir « Voir Nepteo travailler », créer l'espace, arriver sur Aujourd'hui.
3. Vérifier : un seul bouton plein, la file de décision visible sans scroller,
   aucun accordéon ouvert au chargement, le libellé « Pourquoi ? » visible sans
   scroller.
4. Ouvrir « Le plan de la semaine » : les trois gestes et la mention « À éviter »
   sont bien à l'intérieur.
```

---

## Tâche 2 — UX-2 — terminé localement

Référence : `0dc6e40`.

```
Lot UX-2 — écran « Prise en main ».

Spec : docs/maquettes/nepteo-prise-en-main-ux2.html
Ouvre-la et lis l'onglet « Consignes Codex ».

Fichiers sentinelles :
- app/(cockpit)/prise-en-main/_components/walkthrough-center.tsx
- app/(cockpit)/_components/sidebar.tsx
- lib/onboarding/walkthrough.ts

Cible : 55 mots lisibles au premier rendu contre environ 470.

Le modèle de données ne change pas : mêmes 11 missions, mêmes 5 étapes, même clé
localStorage, même version d'état.

- Une seule mission affichée : la première non complétée, en grand, avec un
  bouton plein. Les dix autres n'existent plus visuellement.
- Sous le héros, les 5 étapes en rail, plus une 6ᵉ ligne grisée « Connecter vos
  outils » (CONNECT_DATA_MISSION).
- Supprime « Marquer comme comprise » (×11). La complétion se déduit du retour
  depuis l'écran cible. « Passer » reste, une seule fois, sur la mission
  courante.
- UNE EXCEPTION, actée le 2026-08-10 : l'étape 1 « Définir le contexte » ne se
  valide pas à la visite mais au remplissage de quatre champs nommés —
  activite, zone, ton, philosophie — soit exactement les champs couverts par
  ses deux missions non optionnelles (activity, voice). Visiter la fiche sans
  rien remplir ne valide pas l'étape. Les étapes 2 à 5 restent en déduction par
  la visite. Si UX-3 n'est pas encore livré au moment où tu traites ce lot,
  écris le prédicat comme une fonction pure dans lib/ et branche-le ; UX-3
  réutilisera la même fonction pour sa jauge x/8.
- Supprime la carte « 0 mission comprise sur 11 · 0 % ». Un écran de démarrage
  ne doit pas ouvrir sur un échec.
- Un seul dénominateur affiché : 5. Les 11 missions restent une mécanique
  interne. La sidebar affiche « Guide · 2/5 », identique à la pastille de
  Aujourd'hui. Une étape est complète quand toutes ses missions non optionnelles
  le sont.
- Le bandeau ambre « Chargez le scénario » devient la mission courante du héros
  quand exampleNeedsLoading est vrai : fond blanc, bouton plein. L'ambre est
  réservé aux vraies alertes.
- Le bandeau « Parcours entreprise réelle » devient une pastille en haut à
  droite.
- « Réinitialiser la progression » descend en lien 11px en pied.
- mission.goal n'est plus rendu visuellement mais reste dans le DOM pour
  l'accessibilité (aria-describedby). La lisibilité au lecteur d'écran ne baisse
  pas.

Recette responsive sur le PC (5 min)
1. Ouvrir le guide : une seule mission visible, un seul bouton plein, aucun
   « 0 % » ni « 0 sur 11 ».
2. Cliquer la mission, revenir : elle passe à ✓ sans clic supplémentaire, la
   mission suivante devient le héros.
3. Vérifier que la sidebar et Aujourd'hui affichent la même valeur « x/5 ».
4. Vérifier que « Réinitialiser » n'est pas atteignable sans scroller.
```

---

## Tâche 3 — UX-3 — terminé localement

Référence : `c9c8db4`.

```
Lot UX-3 — écran « Mon entreprise », onglet Identité uniquement.

Spec : docs/maquettes/nepteo-mon-entreprise-ux3.html
Ouvre-la et lis l'onglet « Consignes Codex ».

Fichiers sentinelles :
- app/(cockpit)/entreprise/_components/identity-panel.tsx
- app/(cockpit)/entreprise/_components/identity-card.tsx
- app/(cockpit)/entreprise/_components/mem-row.tsx
- app/(cockpit)/entreprise/_components/side-cards.tsx
- app/(cockpit)/entreprise/_components/offers-card.tsx

Cible : 82 mots lisibles au premier rendu contre environ 375.
Les onglets Connecteurs et Agent ne sont pas dans ce lot.

- Ajoute une jauge de complétude « x/8 » en héros. Huit champs comptés :
  activite, zone, offres, ton, philosophie, canaux, communication, objectifs.
  Un champ compte comme rempli s'il a une valeur non vide en mémoire. Le calcul
  est une fonction pure et testable dans lib/, pas dans le composant.
- « Analyser mon site » quitte la colonne de droite pour le héros, à côté de la
  jauge. C'est le geste qui remplit sept champs d'un coup et il est aujourd'hui
  le moins visible de l'écran. La saisie manuelle reste immédiatement dessous.
- Supprime l'intro de page (INTRO.identite) et l'encart ampoule « Remplissez ce
  que vous savez » : ils se suivent et disent la même chose. La seule idée utile
  — « modifiable à tout moment, s'applique immédiatement » — descend en pied
  d'écran en 11px.
- MemRow : la ligne entière ouvre l'édition, le bouton « Modifier » disparaît.
  MemRow.sub n'est plus rendu en permanence : il devient un title sur une
  pastille « ? », accessible au clavier et au lecteur d'écran.
- Les en-têtes de groupe perdent leur sous-titre et deviennent un intertitre
  11px en capitales.
- La carte « Vos offres » devient une ligne de la liste « Ce que je vends ». Le
  formulaire d'ajout est inchangé, il est ouvert par la ligne.
- « Ce que Nepteo a appris » et « Documents & sources » deviennent des <details>
  fermés avec compteur tant qu'ils sont vides. Le laboratoire web va dans le
  second.
- Supprime « + Ajouter un document — bientôt ». Un bouton mort qui annonce une
  fonction inexistante coûte de la crédibilité pour zéro valeur.
- Articulation avec le guide (UX-2), actée le 2026-08-10 : l'étape 1
  « Définir le contexte » passe à ✓ quand QUATRE champs nommés sont remplis —
  activite, zone, ton, philosophie. Ce sont exactement les champs couverts par
  les deux missions non optionnelles de l'étape (activity et voice) ; website
  reste optionnelle et ne compte pas.
  Deux points à respecter :
  a) Pour cette étape seulement, le remplissage l'emporte sur la visite. La
     règle générale d'UX-2 (« complétion déduite du retour depuis l'écran
     cible ») ne s'applique pas ici : visiter la fiche sans rien remplir ne
     valide pas l'étape. Les étapes 2 à 5 restent en déduction par la visite.
  b) Le seuil porte sur quatre champs NOMMÉS, pas sur un score « 4/8 ».
     Remplir offres, canaux, communication et objectifs afficherait aussi 4/8
     sans valider l'étape.
  Un seul calcul dans lib/, deux lectures : la jauge x/8 pour cet écran, le
  prédicat des quatre champs pour le guide. Les deux sont des fonctions pures
  testables.

Ne change pas : le bandeau ambre « Scénario Nepteo actif — identité en lecture
seule » (c'est une vraie alerte, elle a le droit d'interrompre), le message
« Lecture seule — votre rôle ne permet pas la modification », les formulaires,
leurs Server Actions et les gardes canEdit / mutationBlockedByDemo.

Recette responsive sur le PC (5 min)
1. Ouvrir Mon entreprise : la jauge et « Remplir depuis mon site » sont visibles
   sans scroller.
2. Les 8 champs tiennent dans un écran ; aucun bouton désactivé, aucune mention
   « bientôt ».
3. Toucher une ligne : le formulaire s'ouvre, l'enregistrement fonctionne, la
   jauge s'incrémente.
4. Charger un scénario d'exemple : le bandeau ambre de lecture seule s'affiche
   toujours et les mutations sont bien refusées.
```

---

## Tâche 4 — UX-4 — terminé localement

Référence : `8a287ec`. Le découpage préalable a ramené `page.tsx` à 59 lignes et `campaign-decision-cockpit.tsx` à 166 lignes avant la simplification visuelle.

```
Lot UX-4 — écran « Campagnes ». Lot le plus lourd, à traiter seul.

Spec : docs/maquettes/nepteo-campagnes-ux4.html
Ouvre-la et lis l'onglet « Consignes Codex ».

Fichiers sentinelles après livraison :
- app/(cockpit)/campagnes/page.tsx  (59 lignes)
- app/(cockpit)/campagnes/_components/campaign-decision-cockpit.tsx  (166 lignes)

Préalable satisfait dans `8a287ec` : ces deux fichiers ont été découpés avant la
retouche visuelle, chaque section ayant été déplacée vers un composant ou un
module de présentation dédié.

Cible : 53 mots lisibles au premier rendu sur l'onglet Décision. La reproduction
« Avant » de la spec en compte 262, et elle est optimiste : elle ne reprend pas
tous les sous-détails de l'écran livré.

Aucune règle de calcul ne change. Les fenêtres explicites, les dénominateurs,
les seuils de preuve (7 jours distincts, dépense positive, 10 conversions), les
refus motivés, « Validée — non appliquée », l'exclusion d'Ads du claim et de la
finalisation restent intacts. Ce lot décide seulement QUAND chaque section est
visible. Les tests CAMP-1 / CAMP-2 doivent passer sans modification.

- Trois onglets internes : Décision · Rapport · Historique. Un seul visible à la
  fois. La répartition des dix sections est donnée dans le tableau de l'onglet
  Consignes de la spec.
- L'onglet Décision ne contient que : la fenêtre (une ligne 11px), les trois
  indicateurs, la recommandation, deux boutons. Le reste est replié.
- Les vérifications « Reprendre après un contrôle » deviennent un <details>
  fermé « Ce que Nepteo a vérifié · 3 ». La mention « un démarrage journalisé
  n'est pas un succès fournisseur » est conservée en 11px à l'intérieur : c'est
  une garantie, pas du remplissage.
- Les quatre questions analytiques sont MASQUÉES tant que le rapport n'a pas de
  données. Un bouton qui répond « aucune donnée » se lit comme une panne.
- L'état vide global : une phrase et l'action qui débloque la situation
  (brancher un compte, ou charger un scénario d'exemple). Pas dix états vides
  côte à côte.
- Quand l'audit créatif est indisponible, une ligne suffit — pas une carte.

Recette responsive sur le PC (5 min)
1. Ouvrir Campagnes sans données : une phrase, un bouton plein, trois
   accordéons fermés. Aucune question analytique affichée.
2. Basculer sur Rapport puis Historique : un seul contenu à la fois.
3. Charger un scénario d'exemple : l'onglet Décision affiche les trois
   indicateurs et une recommandation, ou son motif de non-recommandation
   derrière « Pourquoi ? ».
4. Vérifier qu'aucune action n'annonce un effet fournisseur.
```

---

## Tâche 5 — UX-6 — prête après ajout de la spec

```
Lot UX-6 — tiroir de validation et sous-blocs d'Aujourd'hui.

Spec : docs/maquettes/nepteo-validation-ux6.html
Ouvre-la et lis l'onglet « Consignes Codex ».

Fichiers sentinelles et baselines actuelles :
- app/(cockpit)/_components/validation-drawer.tsx  (650 lignes)
- app/(cockpit)/_components/action-value-feedback.tsx  (302 lignes)
- app/(cockpit)/_components/value-scorecard.tsx  (284 lignes)
- app/(cockpit)/_components/prospect-drafts.tsx  (235 lignes)
- app/(cockpit)/_components/action-draft-editor.tsx  (192 lignes)

Ce lot porte sur le moment de décision — le cœur du produit. UX-1 a replié ces
blocs sans redessiner leur intérieur : dès que l'utilisateur clique
« Examiner », il retrouve la densité d'avant.

Préalable : découper validation-drawer.tsx. Un composant par famille d'action
(relance, campagne, contenu) plus un socle commun.

Cible : 60 mots dans le tiroir au premier rendu contre 220, et un seul bloc
déployé contre une douzaine.

- Le brouillon d'abord, la justification ensuite. Le message remonte juste sous
  l'en-tête et devient directement éditable (plus de bascule « Modifier »).
- Un bloc sans valeur ne s'affiche pas. Les blocs de campagne (Budget, Objectif,
  Audience, Hypothèse, Hooks, Structure, Formats…) ne sont rendus que pour
  kind === "launch_campaign", et regroupés dans un seul <details>.
- Constat, raison, données utilisées, nature des informations et limites vont
  dans un <details> « Sur quoi Nepteo s'appuie », avec le nombre de sources en
  compteur. Ils restent tous présents.
- Impact, confiance et risque deviennent deux pastilles dans l'en-tête plus une
  ligne de contexte chiffré.
- « Personnaliser par prospect » devient un <details> fermé avec compteur.
- Le formulaire de refus n'est plus affiché en permanence : il remplace le pied
  de tiroir au clic sur « Refuser ». La règle serveur (raison de 3 à 500
  caractères) est inchangée.
- Retour terrain : une ligne « C'était utile ? Oui / Non » + <details>
  « Préciser » contenant les trois autres dimensions. Le modèle value_events ne
  change pas — on change l'ordre de saisie, pas le schéma.
- Scorecard : 3 KPI (examinées, jugées utiles, réponses) + <details> « Toutes
  les métriques ». Aucune agrégation inter-organisations.

Recette responsive sur le PC (5 min)
1. Ouvrir une proposition de relance : le message est visible sans scroller.
2. Vérifier qu'aucun bloc « — » ou vide n'est rendu.
3. Refuser sans motif : le refus est bien bloqué avec le message existant.
4. Après décision, le retour terrain tient sur une ligne.
```

---

## Tâche 6 — UX-7 — prête après ajout de la spec

```
Lot UX-7 — écrans « Prospects » et « Journal ».

Spec : docs/maquettes/nepteo-listes-ux7.html
Ouvre-la et lis l'onglet « Consignes Codex ».

Fichiers sentinelles et baselines actuelles :
- app/(cockpit)/prospects/page.tsx  (201 lignes)
- app/(cockpit)/prospects/_components/prospects-board.tsx  (190 lignes)
- app/(cockpit)/journal/page.tsx  (168 lignes)
- app/(cockpit)/journal/_components/journal-row.tsx  (35 lignes)
- app/(cockpit)/journal/_components/prepared-outbox.tsx  (103 lignes)

Les deux écrans sont groupés parce qu'ils posent le même problème : une liste
précédée d'explications. Ils doivent partager une grammaire — chiffre en tête,
filtres en pastilles, lignes denses, détail au clic.

Cibles : Prospects 156 → 61 mots ; Journal 110 → 54 mots.

Prospects
- Une ligne de tête : « 128 contacts · 96 relançables (?) ». L'encart
  « Deux comptages, deux usages » passe intégralement dans l'infobulle : cette
  garantie d'exactitude reste atteignable, mais n'est plus première.
- Carte prospect à 3 lignes → une ligne : nom + délai aligné à droite.
- Trois pastilles de filtre : Tous · Relançables · Dormants, appuyées sur les
  cohortes déjà calculées côté serveur, sans nouveau calcul.
- L'intro descend en pied, fusionnée avec la date de dernière synchronisation.

Journal
- Ajoute une table de correspondance event_type → libellé français, en fonction
  pure et testable dans lib/. Un type inconnu retombe sur son nom technique
  plutôt que d'être masqué. Le nom technique et la charge utile restent visibles
  dans le détail, au clic.
- Deux <select> + « Filtrer » + « Réinitialiser » deviennent trois pastilles
  d'acteur qui filtrent au clic. Le filtre par type va dans un accordéon.
- « Envois préparés » devient un accordéon replié avec compteur. Le texte « la
  préparation n'est pas un envoi » est conservé à l'intérieur.

Ne change pas : le journal reste append-only et complet, aucune ligne masquée
ni fusionnée ; la distinction cohorte complète / partielle et le refus
d'afficher un total partiel ; les colonnes expurgées et l'absence de journal
pour le rôle commercial ; la pagination existante.

Recette responsive sur le PC (5 min)
1. Prospects : le nombre total est visible avant toute phrase explicative.
2. L'écart entre les deux comptages reste atteignable au survol et au clavier.
3. Journal : aucune ligne n'affiche un nom technique en libellé principal.
4. Un filtre s'applique en un clic, sans bouton « Filtrer ».
5. Avec un rôle commercial : ni journal, ni colonnes sensibles.
```

---

## Tâche 7 — UX-8 — prête après ajout de la spec

```
Lot UX-8 — parcours « brancher » : catalogue, tunnel d'import, laboratoire web.

Spec : docs/maquettes/nepteo-brancher-ux8.html
Ouvre-la et lis l'onglet « Consignes Codex ».

Fichiers sentinelles et baselines actuelles :
- app/(cockpit)/entreprise/_components/connectors-panel.tsx  (228 lignes)
- app/(cockpit)/connecteurs/_components/connector-card.tsx  (192 lignes)
- app/(cockpit)/connecteurs/[provider]/page.tsx  (238 lignes)
- app/(cockpit)/connecteurs/csv/page.tsx  (227 lignes)
- app/(cockpit)/entreprise/laboratoire-web/_components/  (4 fichiers,
  respectivement 138, 223, 263 et 178 lignes)

Ces trois vues forment un seul parcours et souffrent du même défaut : elles
expliquent les règles avant de proposer le geste.

Cibles : tunnel 113 → 38 mots ; laboratoire 101 → 48 mots.

- Catalogue : champ de recherche + trois pastilles (Tous · Branchés ·
  Disponibles). Les branchés remontent en premier. 22 tuiles d'une ligne
  (pictogramme, nom, pastille d'état) au lieu de 22 cartes à 3-4 lignes.
- Les 22 connecteurs et les 5 catégories restent exactement les mêmes
  (décision CONN-0 du 2026-08-08). Aucun retrait, aucun ajout. Les catégories
  deviennent un filtre, pas des titres empilés.
- Statuts : pastilles Branché · À vérifier · En pause · Erreur · Prévu. Le
  libellé long actuel passe en infobulle. L'honnêteté des états ne change pas.
- Le préambule « Ce catalogue distingue… » passe en infobulle sur « x branchés
  sur 22 ». Texte intégral conservé.
- Import CSV : les 6 contraintes techniques ne sont plus un préambule. Une
  mention « CSV, 900 Ko max (?) » reste à côté du bouton, puis des messages de
  validation précis apparaissent au dépôt. Les gardes serveur de 0021 — bornes,
  mapping non ambigu, remplacement atomique, verrou, journal — ne changent pas.
- Import CSV : 3 étapes, une visible à la fois (déposer → vérifier les colonnes
  → confirmer le remplacement). Le blocage « scénario actif » devient un
  message d'étape. L'exclusivité des voies reste absolue.
- Laboratoire : un titre-question, un champ, un bouton. Les 4 boutons
  « Appliquer cette section » deviennent 4 cases cochées + un bouton « Appliquer
  les 4 ». Chaque ligne indique l'effet. Le laboratoire reste en lecture seule
  et isolé ; rien n'est appliqué automatiquement.

Recette responsive sur le PC (5 min)
1. Trouver un connecteur par son nom prend une frappe, pas un balayage.
2. Les 22 connecteurs et 5 catégories sont toujours là.
3. Déposer un CSV non conforme : message précis, sans préambule de contraintes.
4. Le tunnel CSV n'affiche qu'une étape à la fois.
5. Le laboratoire n'applique rien sans clic.
```

---

## Tâche 8 — UX-9 — prête après ajout de la spec

Le préalable UX-4 est satisfait localement par `8a287ec`.

```
Lot UX-9 — parcours « produire » : tunnel de création de campagne et atelier
Story.

Spec : docs/maquettes/nepteo-produire-ux9.html
Ouvre-la et lis l'onglet « Consignes Codex ».

Fichiers sentinelles et baselines actuelles :
- app/(cockpit)/campagnes/_components/new-campaign-modal.tsx  (439 lignes)
- app/(cockpit)/campagnes/_components/campaign-brief-form.tsx  (309 lignes)
- app/(cockpit)/campagnes/_components/campaign-proposal-review.tsx  (540 lignes)
- app/(cockpit)/contenu/page.tsx  (197 lignes)
- app/(cockpit)/contenu/_components/creative-workspace.tsx  (530 lignes)

Cibles : brief 11 champs visibles → 4 ; proposition 166 → 71 mots ; Story
67 → 39 mots.

- Brief : 4 champs visibles — objectif, budget par jour, audience, offre — tous
  préremplis depuis la mémoire d'entreprise. Les 7 autres (type, hypothèse,
  canal, durée, métrique, seuil, contexte) vont dans un <details> « Affiner »,
  préremplis eux aussi. Le préremplissage lit la mémoire en lecture seule.
- Le titre « l'agent construit, vous arbitrez » devient « Nouvelle campagne » +
  un rail 1/3.
- Proposition : une phrase chiffrée + la liste des adsets + l'accroche retenue.
  Les 8 blocs étiquetés passent dans deux <details>. Le bloc « Récapitulatif
  complet » disparaît puisqu'il répète les blocs précédents.
- « Coût / conversion — confiance de l'estimation » devient une pastille
  « Estimation indisponible (?) ». Le motif complet — 7 jours distincts,
  dépense positive, 10 conversions — reste dans l'infobulle. Ne jamais le
  remplacer par un benchmark de canal.
- Hooks : l'accroche retenue visible, les 5 autres repliées. La règle « au moins
  un hook avant soumission » est inchangée.
- Trois boutons de pied deviennent « Ajouter à la file » plein + « Modifier le
  brief » outline. La proposition de créer un visuel apparaît après l'ajout à la
  file, pas pendant.
- Atelier Story : la campagne récente est présélectionnée, le format déduit du
  canal, l'aperçu occupe le haut de l'écran. Suggestions et création libre sont
  repliées. La Story reste rattachée à une campagne.

Ne change pas : les règles CAMP-0/1/2, le budget total redérivé, les clés de
soumission et d'exécution distinctes, l'action launch_campaign créée en proposed
avec son journal unique et atomique, « Validée — non lancée », l'absence de
bouton Exécuter, le seuil de preuve, chaque génération explicite et bornée, le
versionnement du visuel et l'absence de publication automatique.

Recette responsive sur le PC (5 min)
1. Ouvrir « Nouvelle campagne » avec une fiche entreprise renseignée : 4 champs
   visibles, tous préremplis.
2. Construire la proposition : elle tient sur un écran jusqu'aux boutons.
3. Vérifier qu'aucun chiffre n'est inventé quand l'estimation est indisponible.
4. Ouvrir l'atelier Story : une zone d'aperçu avant toute configuration.
5. Vérifier qu'aucune action n'annonce un effet fournisseur.
```

---

## Protocole

Conforme à la décision du 2026-08-08 :

- `GO UX-n` ouvre et lance le travail **local** dans une nouvelle tâche.
- `PUBLIER UX-n` autorise uniquement les opérations externes préalablement énumérées.
- `VERT UX-n + GO UX-m` consigne le verdict et enchaîne sur le lot suivant.

Une réponse courte ne doit jamais étendre involontairement l'autorisation : lancement local, publication et verdict restent trois gestes séparés.
