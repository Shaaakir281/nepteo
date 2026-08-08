# Roadmap — Prise en main guidée

> **Statut au 2026-08-03** : la maquette G0 et la préparation technique sont
> sécurisées dans le dépôt. Après avoir constaté l’absence du tutoriel dans le
> produit déployé, Fathi a autorisé une intégration locale bornée. Une branche
> implémente l’entrée découverte/configuration, le centre de prise en main et la
> progression locale, sans migration ni exécution automatique. Cette décision
> ne vaut ni preuve des critères G1, ni autorisation de push, fusion ou
> déploiement.
>
> Spécification : [`prise-en-main-guidee.md`](prise-en-main-guidee.md).
> Préparation technique :
> [`preparation-integration-prise-en-main.md`](preparation-integration-prise-en-main.md).

## Cap

Construire d'abord une expérience qui apprend Nepteo par l'action, puis utiliser
les observations de cette prise en main pour décider des simplifications et du
futur cycle Campagnes. La roadmap valeur et ses gates de sécurité restent
inchangés.

## Règles d'exécution

1. Un lot à la fois ; la porte du lot doit être franchie avant le suivant.
2. Aucun code produit pendant G0 et G1.
3. Aucun envoi externe, appel payant, déploiement, migration ou mutation de
   données distante pendant les lots de conception.
4. Les scénarios d'exemple existants restent la seule source de données de la
   voie découverte.
5. La maquette n'autorise aucune modification implicite d'une vraie entreprise.
6. Les invariants de démo, rôles, RLS, journal et exécution ne sont jamais
   simplifiés au nom du parcours.
7. Toute divergence entre la maquette et l'état réellement livré est signalée,
   pas masquée par une promesse.

## Vue d'ensemble

| Lot | Objet | Sortie | Autorisation actuelle |
|---|---|---|---|
| G0 | Maquette HTML interactive | prototype autonome + arbitrages | **Produite et sécurisée** |
| G1 | Validation de compréhension | retours Fathi/commanditaire + version retenue | **Critères terrain encore ouverts** |
| G2 | Spécification technique | modèle de progression, événements, sécurité, tests | **Préparation documentée ; revue finale ouverte** |
| G3 | MVP intégré | onboarding découverte + premier walkthrough | **Branche locale autorisée le 2026-08-03** |
| G4 | Recette et mesure | tests de compréhension et funnel d'apprentissage | Après livraison G3 |
| G5 | Parcours Relances | mission avancée sur le play principal | Après preuve G4 |
| G6 | Parcours Campagnes | préparation et évaluation guidées | Après cadrage Campagnes |

## G0 — Maquette interactive autonome

### Objectif

Permettre à Fathi de juger le modèle de prise en main avant toute décision
d'intégration.

### Livrables

- `docs/maquettes/nepteo-prise-en-main.html` ;
- ajout du fichier à `docs/maquettes/README.md` ;
- entrée de session en haut de l'historique de `docs/SUIVI.md` ;
- liste des choix qui nécessitent l'approbation de Fathi.

### Périmètre

- première arrivée ;
- choix « Découvrir avec une entreprise d'exemple » / « Configurer mon
  entreprise » ;
- sélection d'un scénario ;
- missions d'onboarding avec exemples ;
- laboratoire simulé pour préparer le test d’un site public choisi par
  l’utilisateur, sans appel réseau ;
- centre de prise en main inspiré du motif VS Code ;
- walkthrough « Votre première décision avec Nepteo » ;
- progression, reprise, réussite et reset ;
- transition sûre vers les données du testeur ;
- desktop et mobile.

### Interdits

- aucun fichier `app/`, `lib/`, `components/`, `supabase/`, `tests/`, `infra/` ou
  `.github/` ;
- aucune installation de dépendance ;
- aucun appel réseau ;
- aucun accès à Supabase/Azure/GitHub ;
- aucun déploiement ;
- aucun changement de la navigation réelle ;
- aucune nouvelle décision technique présentée comme acquise.

### Porte G0

Fathi peut parcourir la maquette de bout en bout et répondre aux arbitrages
ouverts. Une belle apparence ne suffit pas : les deux voies, la progression et
la différence entre préparé/envoyé doivent être comprises sans explication
orale.

## G1 — Validation produit et compréhension

### Objectif

Choisir le modèle d'expérience avant de spécifier la technique.

### Testeurs

- Fathi, sans lire la spécification pendant le test ;
- le commanditaire ;
- au moins une personne ne connaissant pas Nepteo.

### Questions observées

1. Comprend-elle ce que Nepteo va lui apprendre ?
2. Choisit-elle sans hésiter entre découverte et vraie entreprise ?
3. Comprend-elle pourquoi chaque information est demandée ?
4. Sait-elle reprendre une mission ?
5. Distingue-t-elle proposé, validé, préparé et envoyé ?
6. Comprend-elle comment quitter les données d'exemple ?

### Porte G1

- 3/3 distinguent données d'exemple et données du testeur ;
- 3/3 distinguent préparé et envoyé ;
- au moins 2/3 terminent le parcours essentiel sans aide ;
- aucun geste n'est interprété comme un envoi ou lancement réel ;
- Fathi valide explicitement le placement, les libellés et le rythme.

## G2 — Spécification technique séparée

### Objectif

Définir l'intégration sans la coder.

### Questions à fermer

- stockage par utilisateur et organisation ;
- liste/version des parcours et étapes ;
- événements qui valident automatiquement chaque mission ;
- lecture des gestes existants sans créditer un autre membre ;
- reprise, rejeu et reset sans répéter une mutation ;
- comportement par rôle ;
- accessibilité et mobile ;
- données minimales de mesure et durée de conservation ;
- stratégie de migration et RLS si une table devient nécessaire ;
- articulation avec `CoachBubble` et absence de deux systèmes de guidage
  concurrents.
- séparation entre analyse multi-sites de test, profil réel de l’entreprise et
  scénario d’exemple ;
- confirmation de coût, cache, quota et sources pour la recherche réelle.

### Porte G2

Spécification relue, menaces de mélange démo/réel couvertes, modèle RLS testé sur
papier, périmètre de fichiers explicite et critères automatisables définis.

## G3 — MVP intégré

### Périmètre maximal

- entrée découverte/configuration ;
- onboarding guidé ;
- un scénario d'exemple cohérent ;
- parcours essentiel en cinq gestes ;
- progression personnelle ;
- aide accessible sans sixième entrée métier ;
- reset/rejeu ;
- aucune nouvelle capacité d'exécution.

### Porte G3

- tests, typecheck, lint et build verts ;
- aucune régression du préflight démo ;
- aucun mélange de données ;
- aucun envoi ;
- parcours clavier/mobile ;
- reprise multi-session conforme à la spécification.

## G4 — Recette et mesure

Mesurer seulement des événements de parcours minimisés. Aucun contenu métier.

Décision :

- si les blocages se concentrent sur le guidage, itérer le parcours ;
- s'ils persistent sur un écran après guidage, simplifier cet écran avec une
  preuve précise ;
- ne pas lancer une refonte générale à partir d'une impression isolée.

## G5 — Parcours Relances

À ouvrir après le MVP : priorité, dernier contact, exclusions, personnalisation,
préparation et vérification. Il doit rester aligné sur le play de valeur et les
gates terrain existants.

## G6 — Parcours Campagnes

À ouvrir après le cadrage du deuxième pilier Campagnes : objectif, audience,
offre, hypothèse, budget, mesure, diagnostic, décision et apprentissage. La prise
en main ne doit pas apprendre des capacités qui ne sont pas encore livrées.

Ce lot ne constitue pas la roadmap de construction des campagnes. La phase 4 de
`docs/ROADMAP.md` donne le cap stratégique et la
[roadmap Campagnes supervisées et intégrateurs](roadmap-campagnes-supervisees.md)
porte désormais les micro-lots de construction. G6 n'apprend que les capacités
déjà livrées et recettées ; il n'anticipe ni connexion ni exécution fournisseur.

## Ordre de décision

```text
G0 Maquette
   ↓ validation Fathi
G1 Test de compréhension
   ↓ modèle retenu
G2 Spécification technique
   ↓ autorisation explicite
G3 MVP intégré
   ↓ preuve d'usage
G4 Itération fondée sur les blocages
   ├── G5 Relances
   └── G6 Campagnes, après son propre cadrage
```
