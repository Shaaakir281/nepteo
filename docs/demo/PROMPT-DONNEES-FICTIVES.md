# Créer votre propre base de prospects fictive

Le mode démonstration de Nepteo couvre trois métiers. Pour tester avec un quatrième — le vôtre, ou celui d'un client type — utilisez le prompt ci-dessous dans n'importe quel assistant IA (ChatGPT, Claude, Mistral…), puis importez le résultat.

## Le format attendu

Nepteo lit cinq colonnes. Les intitulés n'ont pas besoin d'être exacts : un écran de correspondance vous laissera relier vos colonnes aux champs Nepteo à la connexion.

| Colonne | Contenu | Obligatoire |
|---|---|---|
| `Nom` | Prénom + nom du contact | oui |
| `Email` | Adresse email | non — les manques sont voulus |
| `Entreprise` | Société du contact (vide si vous vendez à des particuliers) | non |
| `Statut` | Étape dans votre cycle de vente, avec **vos** mots | non |
| `Notes` | Ce que vous savez de ce contact, en une phrase | non |

## Le prompt à copier

Remplacez ce qui est entre crochets, puis collez le tout dans l'assistant de votre choix.

---

Tu génères une base de prospects **fictive** pour tester un outil marketing. Elle doit être réaliste et **imparfaite**, car l'outil doit justement repérer ces imperfections.

**L'entreprise :** [décrivez en deux ou trois phrases : ce qu'elle vend, à qui, sur quelle zone]

**Ses étapes de vente :** [listez 4 ou 5 étapes avec vos propres mots, ex. : Premier contact, Devis envoyé, Relance faite, Signé, Perdu]

**Produis un tableau CSV de 25 lignes**, séparateur virgule, avec exactement ces colonnes :

```
Nom,Email,Entreprise,Statut,Notes
```

Règles impératives :

1. **Noms et emails entièrement inventés.** Aucune personne ni entreprise réelle. Les emails suivent le format `prenom.nom@domaine.fr`, avec des domaines fictifs.
2. **4 lignes environ sans email** (cellule vide) — l'outil doit proposer de les compléter.
3. **3 lignes environ sans statut** (cellule vide).
4. **Une ligne en double** : le même contact avec le même email, mais un statut différent.
5. **Répartis les statuts de façon déséquilibrée** : une étape doit visiblement stagner avec beaucoup plus de contacts que les autres — c'est le signal que l'outil doit relever.
6. **5 à 6 lignes portent une note** courte et concrète, du genre de ce qu'un dirigeant noterait vraiment : « attend l'accord de son banquier », « rencontré au salon, à rappeler en septembre », « mécontent d'un concurrent ». Les autres cellules `Notes` restent vides.
7. Si l'entreprise vend à des particuliers, laisse toute la colonne `Entreprise` vide.
8. Réponds **uniquement par le CSV**, sans commentaire ni bloc de code.

---

## Importer le résultat

1. Coller le CSV dans une nouvelle feuille **Google Sheets** (Fichier → Importer → Coller, séparateur virgule).
2. Dans Nepteo : **Connecteurs** → Google Sheets → autoriser l'accès → choisir la feuille.
3. Vérifier l'écran **« Correspondance des colonnes »** : Nepteo pré-remplit tout seul, corrigez si besoin, puis **Enregistrer** et **Synchroniser**.
4. Aller sur **Aujourd'hui** → **Analyser**.

## Aller plus loin : campagnes et ventes

Les chiffres de publicité et de revenu ne s'importent pas encore par fichier — ils viennent des scénarios de démonstration ou, plus tard, des vrais connecteurs. Pour un test complet avec un métier sur mesure, le plus simple reste de charger le scénario de démonstration le plus proche, puis d'ajouter votre base de prospects par-dessus : l'agent croisera les deux.
