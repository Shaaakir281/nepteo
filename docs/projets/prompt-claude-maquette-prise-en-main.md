# Prompt de passation — Claude — Maquette « Prise en main »

> Copier le bloc ci-dessous dans une nouvelle tâche Claude ayant accès au dépôt.
> Cette mission est une **maquette HTML uniquement**. Elle n'autorise aucune
> intégration produit.

```text
Tu travailles sur Nepteo, un copilote marketing IA en français destiné aux
solopreneurs et petites équipes. Ta mission est de concevoir une maquette HTML
interactive, très soignée visuellement, pour la nouvelle expérience
« Prise en main ».

Le fondateur, Fathi, a explicitement validé le concept mais n'a PAS autorisé une
modification de l'application. La maquette sert précisément à obtenir son
approbation avant toute intégration.

============================================================
1. À LIRE AVANT TOUTE ACTION
============================================================

Lis intégralement, dans cet ordre :

1. CLAUDE.md
2. docs/SUIVI.md
3. docs/projets/prise-en-main-guidee.md
4. docs/projets/roadmap-prise-en-main.md
5. docs/demo/GUIDE-TEST.md
6. docs/DECISIONS.md
7. lib/demo/scenarios.ts
8. docs/maquettes/README.md
9. docs/maquettes/nepteo-onboarding-interactif.html
10. docs/maquettes/nepteo-cockpit.html
11. app/globals.css
12. app/(cockpit)/_components/nav.tsx
13. app/(cockpit)/_components/coach-bubble.tsx si ce chemin existe ; sinon
    retrouve le composant CoachBubble sans modifier le code.

Avant d'écrire, vérifie l'état du dépôt. Préserve toutes les modifications qui
ne sont pas les tiennes. Ne nettoie, ne déplace et ne reformate aucun fichier
hors périmètre.

============================================================
2. OBJECTIF PRODUIT
============================================================

Créer une expérience de prise en main inspirée du motif « Walkthroughs » de
VS Code : cartes de parcours empilées, état clair, progression visible et
reprise directe.

Ce n'est pas une visite guidée passive. L'utilisateur apprend Nepteo en
réalisant des missions simulées dans un scénario d'exemple :

comprendre la situation → repérer une priorité → comprendre pourquoi →
décider → vérifier ce qui a été préparé.

L'onboarding constitue le niveau 0. Quand Nepteo demande une information sur
l'entreprise, il explique pourquoi, propose une donnée d'exemple cohérente et
montre où elle sera réutilisée.

La gamification doit rester adulte et sobre : progression, coches, missions,
jalons et déblocage. Aucun point, classement, série quotidienne ou score de
compétence marketing.

============================================================
3. LIVRABLES AUTORISÉS
============================================================

Crée uniquement :

- docs/maquettes/nepteo-prise-en-main.html

Mets à jour uniquement :

- docs/maquettes/README.md pour référencer la nouvelle maquette ;
- docs/SUIVI.md avec une entrée en haut de l'historique des sessions indiquant
  ce qui a été maquetté, les décisions proposées, les limites et ce qui attend
  l'approbation de Fathi.

Tu peux, uniquement si une décision de maquette importante doit être conservée,
ajouter une courte section « Propositions issues de la maquette » à
docs/projets/prise-en-main-guidee.md. Ne transforme jamais une proposition en
décision acquise sans validation de Fathi.

Tout autre fichier est interdit.

============================================================
4. INTERDICTIONS ABSOLUES
============================================================

Ne modifie aucun fichier sous :

- app/
- lib/
- components/
- supabase/
- tests/
- infra/
- .github/

Et surtout :

- aucune migration ;
- aucune dépendance npm ;
- aucun appel réseau ;
- aucun accès ou changement Supabase/Azure/GitHub ;
- aucun déploiement ;
- aucune modification de données locales ou distantes ;
- aucun lancement de test payant ou de recherche web ;
- aucun commit/push sauf demande séparée de Fathi ;
- aucune réorganisation de la navigation réelle ;
- aucun envoi ou lancement de campagne ;
- aucune promesse produit non livrée.

La maquette doit être entièrement autonome : HTML, CSS et JavaScript dans un
seul fichier, sans CDN, police distante, bibliothèque, image distante ni autre
asset obligatoire.

============================================================
5. ÉTATS ET PARCOURS À MAQUETTER
============================================================

La maquette doit permettre de parcourir, au minimum, les états suivants :

A. Première arrivée
- titre clair « Prenez en main Nepteo » ;
- proposition de valeur en une phrase ;
- deux choix très distincts :
  1. « Découvrir avec une entreprise d'exemple » — recommandé, 10 minutes ;
  2. « Configurer mon entreprise » ;
- possibilité « Explorer librement » sans piège ni culpabilisation.

B. Choix du scénario
- Menuiserie Dubreuil — artisan/service local ;
- Atelier Northwind — services B2B ;
- Racines & Co — e-commerce ;
- présenter le profil et ce que chaque scénario apprend ;
- empêcher visuellement l'idée qu'on peut mélanger les scénarios.

C. Onboarding guidé — « Préparer l'agent »
Montrer quatre missions :
1. présenter l'entreprise ;
2. décrire les offres ;
3. choisir le ton et la philosophie ;
4. définir les objectifs.

Pour au moins deux missions, concevoir un véritable état interactif avec :
- la question ;
- « Pourquoi Nepteo vous le demande » ;
- la valeur d'exemple du scénario sélectionné ;
- « Utiliser cet exemple », « Saisir mes informations », « Passer » ;
- « Ce que cela change dans Nepteo ».

Pour la mission Ton/Philosophie, montrer un aperçu avant/après d'un brouillon.

Dans la voie « Configurer mon entreprise », un exemple peut être consulté mais
ne doit jamais sembler enregistré automatiquement.

D. Centre « Prise en main »
Reprendre l'esprit du motif VS Code fourni par Fathi :
- cartes empilées ;
- icône simple ;
- libellé de statut éventuel (« Recommandé », « Nouveau », « Terminé ») ;
- barre de progression courte sous chaque carte ;
- CTA ou carte entière cliquable ;
- état visuel clair disponible/en cours/terminé/verrouillé.

Afficher ces parcours :
- Comprendre Nepteo ;
- Préparer une relance ;
- Piloter une campagne ;
- Connecter mes données ;
- Contrôler l'agent.

Seul « Comprendre Nepteo » doit être détaillé complètement. Les autres servent
à juger l'architecture et la progression future.

E. Walkthrough « Votre première décision avec Nepteo »
Représenter cinq étapes :
1. charger le scénario ;
2. lancer/observer l'analyse ;
3. examiner une recommandation ;
4. reporter, refuser ou valider ;
5. préparer puis vérifier l'Historique.

Simuler un écran « Aujourd'hui » crédible, mais ne reproduis pas toute sa
complexité. Le panneau de mission doit expliquer le prochain geste et conduire
vers la zone correspondante. Il ne clique jamais à la place de l'utilisateur.

F. Réussite et reprise
- message « Mission terminée » ;
- explication courte de ce qui vient d'être appris ;
- progression mise à jour ;
- possibilité de quitter puis reprendre ;
- possibilité de rejouer un parcours terminé ;
- bouton de remise à zéro visible pour la démonstration.

G. Passage aux données du testeur
Afficher une confirmation explicite :

« Le scénario et ses données d'exemple seront retirés. Votre progression de
prise en main sera conservée. Aucune donnée d'exemple ne sera mélangée à vos
informations. »

Ne jamais laisser croire qu'un scénario peut être superposé à des données
réelles.

H. Mobile
Au moins les états première arrivée, centre de prise en main et panneau de
mission doivent être réellement utilisables dans une largeur mobile.

============================================================
6. INTERACTIONS DU PROTOTYPE
============================================================

Le prototype doit être navigable sans rechargement et permettre de simuler le
parcours principal.

Il peut utiliser du JavaScript local et localStorage uniquement pour simuler la
reprise. Ajoute un bouton « Réinitialiser la maquette » qui efface uniquement
cet état local. Aucun cookie et aucun appel réseau.

Les interactions attendues :

- choisir la voie A ou B ;
- choisir un scénario ;
- utiliser une valeur d'exemple ;
- passer d'une mission à la suivante ;
- voir la barre progresser ;
- ouvrir/reprendre un walkthrough ;
- accomplir les cinq gestes simulés ;
- voir l'état terminé ;
- simuler la transition vers ses données ;
- réinitialiser.

============================================================
7. DIRECTION VISUELLE
============================================================

Produis une maquette « magnifique », mais fidèle à Nepteo :

- français ;
- Inter/Instrument Sans si elles sont déjà disponibles localement dans les
  références, sinon pile système sans réseau ;
- violet Nepteo, encre sombre, fonds légèrement teintés, cartes claires ;
- rayons et ombres cohérents avec app/globals.css et les maquettes existantes ;
- densité calme ;
- hiérarchie très nette ;
- progression visible mais non envahissante ;
- gamification adulte, aucun style enfantin ;
- pas de faux dashboard surchargé ;
- pas de nouvelle identité de marque.

Tu peux utiliser des icônes SVG inline simples et accessibles. Pas d'emoji comme
seul porteur de sens.

La maquette doit conserver les cinq destinations actuelles lorsqu'un faux
cockpit est montré : Aujourd'hui, Prospects, Campagnes, Mon entreprise,
Journal. Ne propose pas une sixième entrée métier ; la prise en main passe par
une aide « ? », une carte de première arrivée ou un panneau contextuel.

============================================================
8. ACCESSIBILITÉ ET QUALITÉ
============================================================

- HTML sémantique ;
- boutons et liens réels ;
- focus visible ;
- navigation clavier ;
- états non transmis uniquement par la couleur ;
- aria-label/aria-current/aria-live quand utile ;
- contraste lisible ;
- prefers-reduced-motion respecté ;
- aucun scroll horizontal à 375 px ;
- pas d'erreur console ;
- aucune chaîne anglaise visible sauf nom propre justifié.

============================================================
9. VÉRITÉ PRODUIT ET SÉCURITÉ
============================================================

La maquette doit dire explicitement :

- aucun message envoyé ;
- aucune campagne lancée ;
- les actions sont simulées dans un scénario d'exemple ;
- les événements d'exemple ne comptent pas dans la preuve terrain ;
- `préparé` n'est jamais affiché comme `envoyé` ;
- un exemple de formulaire n'est pas une donnée réelle ;
- la progression mesure les missions découvertes, pas la compétence marketing.

N'invente pas une capacité future pour rendre la démonstration plus séduisante.

============================================================
10. ARBITRAGES À PRÉSENTER À FATHI
============================================================

À la fin, fournis des recommandations argumentées — sans les appliquer au
produit — sur :

1. scénario recommandé par défaut ou choix obligatoire ;
2. entrée principale : carte Aujourd'hui, page de bienvenue ou aide « ? » ;
3. barre globale ou uniquement par parcours ;
4. missions strictement séquentielles ou partiellement libres ;
5. meilleur moment pour proposer le passage aux données réelles ;
6. place future du parcours Campagnes ;
7. éléments de l'application qui semblent encore confus même avec le guidage.

Sépare clairement :
- ce que la spécification imposait ;
- tes choix de maquette ;
- les décisions qui attendent Fathi.

============================================================
11. VALIDATION AVANT DE CONCLURE
============================================================

Avant ton rendu final :

1. ouvre la maquette localement ;
2. joue le parcours principal de bout en bout ;
3. rejoue la voie « Configurer mon entreprise » ;
4. vérifie la remise à zéro ;
5. teste une largeur mobile ;
6. vérifie la navigation clavier et le focus ;
7. vérifie la console ;
8. vérifie que seuls les fichiers autorisés ont changé ;
9. ajoute l'entrée SUIVI ;
10. ne lance pas les tests complets du produit : aucun code produit ne doit avoir
    changé. Un contrôle HTML/console et un diff sont suffisants pour G0.

Dans ton rendu final, indique :

- le chemin du HTML ;
- les états interactifs couverts ;
- les fichiers modifiés ;
- les validations réalisées ;
- les arbitrages soumis à Fathi ;
- la confirmation explicite : « Aucun code produit, donnée distante ou
  déploiement n'a été modifié. »

Ne commence pas G1, G2 ou l'intégration. Arrête-toi après G0 et attends la
validation de Fathi.
```
