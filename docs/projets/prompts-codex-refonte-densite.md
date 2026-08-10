# Refonte de densité — prompts Codex

Guide d'envoi des lots UX-1 à UX-5. Chaque bloc encadré est à copier-coller tel quel dans une tâche Codex, **une tâche par lot**.

Objectif commun : les testeurs décrochent parce que chaque écran demande de lire avant de comprendre quoi faire. Les cinq specs HTML de `docs/maquettes/` définissent, écran par écran, la hiérarchie cible, les textes définitifs et un critère de recette chiffré.

| Lot | Écran | Mots lisibles au 1ᵉʳ rendu | Spec |
|---|---|---|---|
| UX-1 | Aujourd'hui | 315 → 42 | `nepteo-aujourdhui-ux1.html` |
| UX-5 | Onboarding | 105 → 38 | `nepteo-onboarding-ux5.html` |
| UX-2 | Prise en main | 470 → 55 | `nepteo-prise-en-main-ux2.html` |
| UX-3 | Mon entreprise | 375 → 82 | `nepteo-mon-entreprise-ux3.html` |
| UX-4 | Campagnes | 262 → 53 | `nepteo-campagnes-ux4.html` |

Ordre d'envoi : **UX-1 + UX-5 ensemble**, puis UX-2, puis UX-3, puis UX-4 seul.

---

## Avant le premier envoi — deux corrections à faire soi-même

1. **Committer et pousser les specs.** Les cinq fichiers `docs/maquettes/*-ux*.html` et le `README.md` mis à jour sont actuellement non suivis. Sans push, Codex ne peut pas les lire et travaillera à l'aveugle.
2. **Corriger `CLAUDE.md` ligne 57.** Elle annonce encore `violet #5a4fe0, ink #191731` alors que `app/globals.css` est passé au bleu `#2d5ba7` / encre `#1c1713` / cerise `#8a232d`. Codex lit `CLAUDE.md` en priorité : non corrigée, cette ligne produira la mauvaise palette.

> Attention en committant : `docs/maquettes/nepteo-prise-en-main.html` apparaît modifié avec 1981 insertions / 1981 suppressions. C'est un changement de fins de ligne (CRLF/LF), pas une modification réelle. Ne pas l'inclure dans le commit des specs.

---

## Préambule commun

À coller **en tête de chaque tâche**, avant le bloc du lot.

```
Contexte
Projet Nepteo, dépôt agent_marketing. Lis d'abord CLAUDE.md puis docs/SUIVI.md,
et consigne ta session à la fin de docs/SUIVI.md (entrée datée : fait / décisions /
reste à faire).

Cette tâche fait partie d'une refonte de densité en cinq lots (UX-1 à UX-5). Le
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
npm run typecheck, npm test, npm run build), une recette téléphone de cinq
minutes maximum, puis un bloc unique « Commande à copier-coller ». Attends
l'approbation avant toute publication.
```

---

## Tâche 1 — UX-1 + UX-5 (à envoyer ensemble)

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

Recette téléphone (5 min)
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

## Tâche 2 — UX-2

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

Recette téléphone (5 min)
1. Ouvrir le guide : une seule mission visible, un seul bouton plein, aucun
   « 0 % » ni « 0 sur 11 ».
2. Cliquer la mission, revenir : elle passe à ✓ sans clic supplémentaire, la
   mission suivante devient le héros.
3. Vérifier que la sidebar et Aujourd'hui affichent la même valeur « x/5 ».
4. Vérifier que « Réinitialiser » n'est pas atteignable sans scroller.
```

---

## Tâche 3 — UX-3

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

Recette téléphone (5 min)
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

## Tâche 4 — UX-4 (seul, en dernier)

```
Lot UX-4 — écran « Campagnes ». Lot le plus lourd, à traiter seul.

Spec : docs/maquettes/nepteo-campagnes-ux4.html
Ouvre-la et lis l'onglet « Consignes Codex ».

Fichiers sentinelles :
- app/(cockpit)/campagnes/page.tsx  (1 927 lignes)
- app/(cockpit)/campagnes/_components/campaign-decision-cockpit.tsx  (1 693 lignes)

Préalable non négociable : découper ces deux fichiers AVANT toute retouche
visuelle. La convention du dépôt est ~200 lignes par fichier ; on est à 10×.
Chaque section devient un composant dans campagnes/_components/. Si le découpage
seul suffit à remplir la tâche, arrête-toi là et rends-le : la partie visuelle
fera une tâche distincte.

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

Recette téléphone (5 min)
1. Ouvrir Campagnes sans données : une phrase, un bouton plein, trois
   accordéons fermés. Aucune question analytique affichée.
2. Basculer sur Rapport puis Historique : un seul contenu à la fois.
3. Charger un scénario d'exemple : l'onglet Décision affiche les trois
   indicateurs et une recommandation, ou son motif de non-recommandation
   derrière « Pourquoi ? ».
4. Vérifier qu'aucune action n'annonce un effet fournisseur.
```

---

## Protocole

Conforme à la décision du 2026-08-08 :

- `GO UX-n` ouvre et lance le travail **local** dans une nouvelle tâche.
- `PUBLIER UX-n` autorise uniquement les opérations externes préalablement énumérées.
- `VERT UX-n + GO UX-m` consigne le verdict et enchaîne sur le lot suivant.

Une réponse courte ne doit jamais étendre involontairement l'autorisation : lancement local, publication et verdict restent trois gestes séparés.
