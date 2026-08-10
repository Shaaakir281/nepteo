# Maquettes — références historiques de design

## Specs actives

Direction commune décidée le 2026-08-10 : **niveau « Épuré »**. Un écran présente une seule action dominante, une phrase, un bouton ; tout le reste est replié ou déduit. Les garde-fous restent accessibles mais cessent d'occuper le corps de la page.

- `nepteo-onboarding-ux5.html` — **spec du lot UX-5, datée du 2026-08-10.** Écrans `choice` et `example` de l'onboarding : durée annoncée par option, icônes de scénario, garde-fou « mode sûr » réduit à une ligne. 105 mots aujourd'hui contre 38 visés. À grouper avec UX-1.
- `nepteo-campagnes-ux4.html` — **spec du lot UX-4, datée du 2026-08-10.** Écran `Campagnes` : trois onglets internes `Décision · Rapport · Historique` à la place de dix sections empilées, questions analytiques masquées sans données. **Préalable : découper `page.tsx` (1 927 lignes) et `campaign-decision-cockpit.tsx` (1 693 lignes) avant toute retouche visuelle.** Lot le plus lourd, à traiter seul et en dernier.
- `nepteo-mon-entreprise-ux3.html` — **spec du lot UX-3, datée du 2026-08-10.** Onglet `Identité` : jauge de complétude `2/8` à la place des huit justifications, « Analyser mon site » promu en héros, sous-titres de champ en infobulles, cartes vides repliées. Environ 375 mots lisibles aujourd'hui contre 82 visés.
- `nepteo-prise-en-main-ux2.html` — **spec du lot UX-2, datée du 2026-08-10.** Écran `Prise en main` : une mission à la fois au lieu de 11 cartes, complétion déduite au lieu de déclarée, rail de 5 étapes. Environ 470 mots lisibles aujourd'hui contre 55 visés.
- `nepteo-aujourdhui-ux1.html` — **spec du lot UX-1, datée du 2026-08-10.** Bascule « Avant (livré) / Après (proposé) / Consignes Codex » sur l'écran `Aujourd'hui`, tokens copiés à l'identique depuis `app/globals.css`, mesure de densité calculée à l'ouverture. Ce n'est ni une maquette historique ni du code à recopier : Codex transpose hiérarchie, tokens et textes dans les composants existants. Le fichier passe en référence historique une fois le lot recetté.

## Références historiques

Fichiers disponibles :

- `nepteo-prise-en-main.html` — maquette G0 interactive de la prise en main guidée : première arrivée, voies exemple/entreprise réelle, trois scénarios, laboratoire multi-sites simulé, missions, reprise locale et mobile. Cette maquette ne réalise aucun appel réseau.
- `nepteo-onboarding-interactif.html` — prototype onboarding interactif
- `nepteo-cockpit.html` — cockpit historique

Ils restent utiles pour les tokens et les patterns visuels, mais ne décrivent plus exactement la navigation. La structure fonctionnelle actuelle est consignée dans `docs/DECISIONS.md` ; le code de l'application fait foi pour l'état livré.

## Direction Growth Cockpit de Charly

`nepteo-growth-cockpit-v2.html`, fourni par Fathi, est la référence de direction visuelle du lot du 9 août mais n'est pas encore versionné dans ce checkout. La refonte locale reprend ses couleurs principales dans `app/globals.css` : bleu `#2D5BA7`, encre `#1C1713`, vert `#3E6B4F`, cerise `#8A232D` et fond chaud `#F7F4EE`.

Il s'agit d'une adaptation produit, pas d'une copie écran par écran : densité réduite, textes raccourcis et hiérarchie de navigation sont appliqués aux parcours réels. La Story reste rattachée à une campagne et le workspace créatif prérempli ; aucune couleur ou carte de la maquette ne constitue une preuve de connexion fournisseur.
