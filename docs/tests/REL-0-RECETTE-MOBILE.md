# REL-0 — Recette mobile CAMP-0/1/2

> À utiliser seulement après une publication autorisée de REL-0. Cette recette
> ne connecte aucun fournisseur et ne lance ni campagne, ni pause Ads, ni email.

## Préparation

- Ouvrir `https://nepteo.bogasolution.com/campagnes` avec un compte **éditeur**
  dans une organisation de recette sans scénario actif.
- Les parcours CAMP-0 et CAMP-1 créent et valident seulement une proposition
  Nepteo. Ils ne requièrent ni compte Ads ni moyen de paiement.
- Si une étape dépend de métriques absentes, relever le message affiché au lieu
  d'inventer une donnée ou un statut fournisseur.

## CAMP-0 — Brief et proposition non lancée (moins de cinq minutes)

1. Toucher **« + Nouvelle campagne »**. Vérifier que les choix, budget, durée,
   métrique et seuil sont vides : aucun choix n'est pris à votre place.
2. Renseigner un brief de recette court : choisir un objectif, un type et un
   canal ; saisir `PME industrielles France`, `Audit express` et `Une preuve
   client génère des demandes` ; indiquer `10` € par jour, `7 jours`, une
   métrique et un seuil de `1`. Le contexte peut rester vide.
3. Toucher **« Construire la proposition »**. Attendu : une construction ou une
   limite de données honnête, jamais une campagne lancée. Si une proposition est
   disponible, son budget total doit afficher `70 €` (= 10 × 7).
4. Toucher **« Relire le récapitulatif »**, puis **« Ajouter à ma file — sans
   lancer »**. Un double toucher involontaire ne doit afficher qu'une
   proposition ou le message qu'elle est déjà dans la file.
5. Attendu : **« Campagne proposée ✓ »** et le texte indiquant qu'aucune
   campagne, publication ou dépense n'a été lancée. Une erreur doit dire
   explicitement qu'aucun état partiel n'a été conservé.

## CAMP-1 — Studio arbitrable et validation non lancée (moins de cinq minutes)

1. Lors de la proposition CAMP-0, sur l'étape **« Studio »**, modifier un seul
   hook ou l'audience d'un adset. Ne pas lancer de recherche concurrentielle.
2. Vérifier que les adsets, hooks retenus et formats restent éditables et que
   les limites journalière et de durée sont visibles.
3. Enregistrer la proposition avec **« Ajouter à ma file — sans lancer »**.
4. Ouvrir **« Aujourd'hui »**, toucher cette proposition dans **« À valider »**
   puis choisir **Valider**.
5. Attendu : le détail indique **« Validée — non lancée »**. Il ne doit exister
   aucun bouton **Exécuter**, aucune confirmation Ads et aucune demande de
   paiement.

## CAMP-2 — Cockpit et décision non appliquée (moins de cinq minutes)

1. Revenir à **Campagnes** et vérifier le titre **« Cockpit de décision »**.
2. Si des métriques sont visibles, choisir un canal ou un statut dans les
   filtres ; sinon garder l'état vide et vérifier qu'il dit qu'aucune campagne
   observée n'est disponible, sans afficher `Active` ou `Terminée`.
3. Si un filtre ne trouve rien, vérifier **« Aucun résultat pour ces filtres »**
   puis le retirer.
4. Ouvrir une recommandation `ads_pause_*` seulement si elle existe et la
   valider ; sinon ne pas en créer artificiellement.
5. Attendu : une validation de pause affiche **« Validée — non appliquée »**.
   Le bas de page rappelle que CAMP-2 ne lance, ne met en pause et ne dépense
   rien.

## Verdict à renvoyer

```text
VERT REL-0 + GO CONN-0
```

En cas de problème, envoyer plutôt une capture et :

```text
À CORRIGER REL-0 : [écran ou comportement observé]
```
