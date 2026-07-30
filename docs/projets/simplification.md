# Projet — Simplification (usage + code)

> **Statut** : lots C1 à C6 terminés au 2026-07-26 ; vague de simplification technique S0 à S8 implémentée localement le 2026-07-29. Ce document conserve le diagnostic et le plan d'origine ; l'état d'exécution est dans `docs/SUIVI.md` et l'ordre produit courant dans `roadmap-valeur-commanditaires.md`. `roadmap-beta.md` conserve l'historique C1–C12.
> **Axes retenus** : l'app pour l'utilisateur, et le code. Plan écrit d'abord, exécution ensuite, lot par lot.

## Vague technique du 29 juillet 2026

| Lot | Résultat local | Statut |
|---|---|---|
| S0 — nettoyage mécanique | code mort retiré, types communs réutilisés, contrôles `noUnused*` activés | Terminé |
| S1 — contexte auth/organisation | source unique `lib/auth/context.ts`, ambiguïté refusée et invariant mono-org bêta dans `0013` | Terminé localement |
| S2 — ciblage relance | même prédicat pur pour l'aperçu et l'exécution, cas 7 jours couverts | Terminé |
| S3 — écrans concentrés | file de validation 499 → 91 lignes ; fiche connecteur 347 → 181 lignes | Terminé côté UI |
| S4 — accessibilité/responsive | dialogues clavier partagés et navigation mobile à cinq destinations | Terminé |
| S5 — façade Server Actions | façade publique 468 → 99 lignes ; cinq modules métier derrière des wrappers `async` compatibles Next 16 | Terminé |
| S6 — preuve auth/RLS | écriture directe de la mémoire fermée par `0014`, garde éditeur renforcée et smoke RLS reproductible | Terminé localement, smoke distant à jouer |
| S7 — rôles et données sensibles | matrice de capacités unique ; lectures financières, mémoire/offres, recherches, briefings, actions, journal, connecteurs et colonnes libres protégés par `0015` | Terminé localement |
| S8 — concurrence et exploitation | isolation démo et mutations réelles sérialisées, readiness probante `0016`, quota recherche atomique `0017`, décisions/claims/finalisations/réglages transactionnels `0018`, rattrapage additif RLS/privilèges `0019` | Terminé localement |

Les migrations `0012` à `0019` et le smoke authentifié restent à jouer sur un environnement de recette dédié. Un registre de providers ne devient utile qu'avant un troisième connecteur ; aucune hiérarchie de classes ou couche repository générique n'est introduite avec seulement Sheets et Notion.

## État constaté

| | Aujourd'hui |
|---|---|
| Entrées de navigation | **9** (2 groupes) |
| Pages | 14 |
| Sections de mémoire | **8** |
| Fichiers dans `lib/` | **47** (149 exports) |
| Migrations | 10 |

## Distinguer deux complexités

Tout n'est pas à simplifier, et c'est le point le plus important de ce document.

- **Complexité essentielle — à garder.** Idempotence, journal avant exécution, garde-fous serveur, validation humaine. C'est la promesse du produit : un agent à qui on peut confier des actions. La supprimer ferait gagner des lignes et perdre la raison d'être. Elle peut en revanche être **mieux présentée**.
- **Complexité accidentelle — à supprimer.** Deux systèmes de données de démo, trois façons de lire la mémoire, des propositions éparpillées sur trois écrans, un fichier de réexport. Rien de tout cela ne sert le produit.

## Diagnostic — usage

**Le vrai problème : l'agent propose à trois endroits.** « Aujourd'hui » (actions à valider), « Plan du mois » (mouvements priorisés qui renvoient ailleurs), « Contenu » (idées qui produisent un brief). L'utilisateur doit comprendre trois formats de proposition et savoir lequel regarder. Pour un solopreneur, il devrait y avoir **un seul endroit** où vit « ce que l'agent me propose ».

Symptôme voisin : **on crée une campagne depuis deux écrans** (bouton sur Campagnes, renvoi depuis le Plan).

**Trop de réglages pour une seule idée.** Bouton d'arrêt, niveau d'autonomie, plafonds serveur, mode d'exécution : quatre blocs pour dire « l'agent ne fera rien sans toi ».

**Une mémoire en huit sections** présentée en huit lignes à remplir. La richesse est utile ; sa présentation, décourageante.

**Du jargon d'initié à l'écran** : ROAS, CAC, CTR, CVR affichés bruts, alors que la cible assumée est « culture marketing basique à intermédiaire » (CLAUDE.md).

## Diagnostic — code

1. **Deux systèmes de données de démo qui font double emploi.** `lib/ads/mock-provider.ts`, `lib/ads/seed.ts`, `lib/revenue/mock-provider.ts`, `lib/revenue/seed.ts` sont entièrement couverts par `lib/demo/*` depuis les scénarios. Ils survivent avec leurs boutons (« Charger la démo Meta Ads », « Charger le revenu de démo »).
2. **Trois façons de lire la mémoire** : `.in(LLM_MEMORY_SECTIONS)`, un `select` complet, puis `memoText`/`philosophyText`. Le `Object.fromEntries(...)` est recopié dans huit fichiers.
3. **Deux moteurs de conseil** : `lib/plan.ts` (avec données) et `lib/diagnostic.ts` (sans données) répondent à la même question à deux stades, sans rien partager.
4. **Cinq fichiers de « règles pures » dispersés** à la racine de `lib/` : `draft-template`, `creative-template`, `campaign-plan`, `plan`, `diagnostic`. Le patron est bon, la dispersion moins.
5. **`lib/types.ts`** ne fait que réexporter d'autres modules.
6. **`tsc` de plus en plus lent** — conséquence du graphe, pas une cause.

## Lots proposés (indépendants, réversibles, du plus sûr au plus engageant)

### Lot 1 — Nettoyage invisible *(aucun changement pour l'utilisateur)*
- Supprimer les quatre fichiers de démo redondants et les deux boutons associés ; le mode démonstration devient le seul chemin.
- Un seul helper `readMemory(client, orgId): Promise<Partial<MemoryContent>>`, utilisé partout.
- Supprimer `lib/types.ts`.
- Regrouper les règles pures sous `lib/rules/`.

**Gain** : ~6 fichiers en moins, une notion en moins, huit duplications supprimées. **Risque** : quasi nul, couvert par les tests.

### Lot 2 — Un seul réglage d'autonomie
Fusionner les quatre blocs de `/agent` en **un curseur à trois crans** (Propose seulement · Prépare · Envoie — *bientôt*) plus l'interrupteur d'arrêt. Les plafonds passent en note sous le curseur : ils rassurent, ils n'ont pas à occuper une carte.

**Gain** : quatre notions → deux. **Risque** : faible, aucune logique serveur touchée.

### Lot 3 — Navigation à cinq entrées
`Aujourd'hui · Prospects · Campagnes · Mon entreprise · Journal`, où **Mon entreprise** regroupe en onglets la mémoire, les connecteurs et les réglages de l'agent.

**Gain** : 9 → 5. **Risque** : moyen, beaucoup de liens internes à reprendre.

### Lot 4 — Un seul endroit pour les propositions
« Plan du mois » devient le **bandeau de cap** en tête d'Aujourd'hui ; « Contenu » devient un **type de proposition** parmi les autres. Un seul format, un seul flux de validation.

**Gain** : c'est le lot qui règle la sensation de complication. **Risque** : le plus élevé — il défait de l'ergonomie récente et s'écarte de `docs/maquettes/`. **À valider avec Charly avant d'y toucher.**

### Lot 5 — Vocabulaire en clair
Libellé principal en français, acronyme en second : « Retour sur dépense publicitaire *(ROAS)* — 2,4× pour 1 € investi ». Idem CAC, CTR, CVR.

**Gain** : accessibilité réelle. **Risque** : nul.

### Lot 6 — Mémoire en trois blocs
Même modèle de données (aucune migration), autre présentation : **Ce que je vends** (activité, offres, zone) · **Comment je parle** (ton, philosophie) · **Ce que je fais déjà** (canaux, présence, objectifs).

**Gain** : huit lignes → trois blocs. **Risque** : faible.

## Ce qu'on ne simplifie pas

Journal, idempotence, garde-fous serveur, plafonds, validation humaine, séparation règles pures / orchestration (elle est ce qui rend le cœur testable sans build). Et les tests : 130 aujourd'hui, ils sont le filet qui rend tous ces lots réalisables sans peur.

## Ordre conseillé

**1 → 2 → 5 → 6 → 3 → 4.** On commence par ce qui ne se voit pas et ne casse rien, on garde pour la fin ce qui touche à la maquette validée. Les lots 1, 2 et 5 sont faisables avant la démonstration à Charly ; les lots 3 et 4 après ses retours — ils bénéficieraient justement de son avis.

## Questions ouvertes

- Le lot 4 vaut-il d'attendre le retour de Charly, ou sa sensation de complication risque-t-elle d'être la même que celle de Fathi ?
- « Journal » doit-il rester une entrée de navigation ou devenir un onglet de Mon entreprise ?
- Faut-il conserver « Contenu » comme écran autonome pour ceux qui viennent chercher une idée sans passer par une proposition ?

## Suivi (journal des sessions)

- **2026-07-25** — Chantier cadré avec Fathi (axes : usage + code ; plan d'abord). Rien codé.
