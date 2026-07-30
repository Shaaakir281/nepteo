# Chantier B1 — La démonstration ne doit jamais détruire la vraie fiche

> **Statut** : B1/B2 exécutés le 2026-07-26 ; durcissement B3 implémenté
> localement le 2026-07-29, non déployé (voir `docs/SUIVI.md`).
> **Origine** : ce chantier ne figure pas dans `docs/projets/roadmap-beta.md`. C'est une
> **correction de défaut relevée à l'usage** le 2026-07-26, décidée par Fathi hors roadmap.
> Les « Règles pour tout chantier — anti-erreurs IA » (§2 de la roadmap) s'appliquent
> intégralement.

## Extension B3 — isolation d'une organisation réelle

Le mode démonstration est désormais réservé au rôle `admin` et refuse de se
charger dans une organisation qui contient déjà un connecteur, prospect,
campagne, vente, action, message préparé ou briefing réel. Les artefacts
courants portent des marqueurs explicites (`demo:` ou `payload.demo`) ; les
anciens identifiants ne sont nettoyables que lorsqu'une démo active les rend
fiables. Un retrait sans démo active est un no-op.

Chargement, retrait, analyses, propositions de campagne et mutations de données
réelles partagent un verrou distribué `__demo_lock` typé (`demo`, `analysis`,
`campaign`, `data`). Le token et l'identifiant de ligne empêchent une
libération par un autre propriétaire. Après un crash, le verrou n'est jamais
repris automatiquement : sans fencing distribué, une ligne orpheline exige une
récupération manuelle après vérification que son propriétaire ne travaille plus.
Les écritures de mémoire, onboarding, configuration OAuth/connecteurs et sync
prennent `data`, contrôlent le mode démo puis lisent et écrivent sous le même
verrou : aucune donnée réelle ne peut apparaître entre le contrôle et la
mutation. Un ancien verrou sans type reste volontairement fail-closed. Les
analyses en démo sont scopées aux données fictives et l'enrichissement web
payant y est désactivé. Une sauvegarde `__demo_backup` existante est analysée
avant tout reset/seed ; si elle est corrompue, le chargement s'arrête.

Ce durcissement n'ajoute ni table ni migration. Il rend la démo adaptée à une
organisation de test vide ; il ne transforme pas une organisation cliente
existante en bac à sable.

---

## 1. But

Le mode démonstration doit être **réversible**. Aujourd'hui il ne l'est pas : essayer une
entreprise fictive **détruit définitivement** la fiche entreprise réelle. C'est le pire
défaut possible pour une fonctionnalité dont l'argument de vente est « essayez sans
risque » — et c'est le premier geste que `docs/demo/GUIDE-TEST.md` demande de montrer.

Après ce chantier : charger un scénario, en charger un autre, puis retirer les données ⇒
la fiche d'origine revient **à l'identique**.

---

## 2. Défaut constaté (2026-07-26)

**Défaut principal.** `loadDemoScenario` (`lib/demo/seed.ts`) appelle `seedMemory`, qui
**écrase** les huit sections de `company_memory` avec l'identité du scénario (plus
`organizations.name` et `organizations.activity`). `clearDemoData` ne restaure rien — son
commentaire dit explicitement « sans toucher à la mémoire ». Il n'existe **aucune copie**
de la fiche d'origine : elle est perdue.

**Défaut secondaire 1 — `.maybeSingle()` sur une recherche non unique.**
`ensureDemoConnector` et `clearDemoData` cherchent le connecteur de démo avec
`.maybeSingle()`. Si deux lignes existaient pour le provider `demo`, la lecture
renverrait `null` : les prospects ne seraient **pas** supprimés, et un connecteur de plus
serait inséré à chaque tentative.

> **Fait relevé pendant le chantier, à consigner honnêtement** : la table `connectors`
> porte `unique (organization_id, provider)` (`supabase/migrations/0001_init.sql`, l. 47).
> Le doublon est donc **impossible en base aujourd'hui**, et ce défaut est théorique tant
> que cette contrainte tient. Le code ne doit pas pour autant en dépendre : une contrainte
> peut sauter lors d'une migration future, et `.maybeSingle()` sur une recherche
> multi-lignes est un piège silencieux. Le correctif est donc fait — en sachant que le
> nettoyage de doublons sera un no-op sur la base actuelle.

**Défaut secondaire 2 — suppressions muettes.** Les cinq `delete` de `clearDemoData`
(prospects, `ad_metrics`, `revenue_events`, plus les trois de `resetCockpitState`)
n'inspectent **aucune** erreur. Un retrait partiel est totalement silencieux : l'écran
affiche « Données de démonstration retirées » alors qu'il reste des données.

---

## 3. À faire

### 3.1 Sauvegarde / restauration de la mémoire

- **Section réservée** `__demo_backup` dans `company_memory`. **Aucune migration** :
  `company_memory.section` est un `text` **sans contrainte de check** (confirmé
  migration 0001 et SUIVI, session 2026-07-25). C'est une **convention de stockage**,
  pas une section de produit — d'où le préfixe `__`, hors de `MEMORY_SECTIONS`.
- **Avant le premier `seedMemory`** : si aucune sauvegarde n'existe déjà, copier les
  sections réelles dans la section de sauvegarde (contenu = les sections d'origine).
- **Enchaîner les scénarios n'écrase jamais la sauvegarde initiale** : la copie est
  conditionnée à l'absence de sauvegarde. Charger A, puis B, puis retirer ⇒ fiche
  d'origine, jamais A.
- **`clearDemoData`** restaure les sections sauvegardées, **supprime** celles que le
  scénario a ajoutées et qui n'existaient pas avant, puis **supprime la sauvegarde**
  (le retrait suivant n'aura donc rien à restaurer — c'est correct).
- Une organisation dont la mémoire est **vide** produit une sauvegarde vide mais
  **existante** : au retrait, les huit sections du scénario sont supprimées et on
  retombe bien sur une fiche vide.

### 3.2 Doublons de connecteur `demo`

Traiter **tous** les connecteurs du provider : supprimer les prospects de chacun, n'en
garder qu'un (le plus ancien), nettoyer les doublons éventuels. Plus de `.maybeSingle()`
sur cette recherche.

### 3.3 Erreurs de suppression

Chaque suppression de `clearDemoData` (et de `resetCockpitState`) vérifie son erreur et
la remonte à l'appelant. L'échec doit être **visible à l'écran** et **au journal** — pas
un retrait partiel muet annoncé comme réussi.

### 3.4 Panneau de démonstration

Une ligne d'avertissement **avant le chargement** :

> « Votre fiche entreprise sera remplacée le temps de la démonstration, puis restaurée
> quand vous retirerez les données. »

Ajouter la phrase. **Ne pas réorganiser le panneau** (C5 et C6 viennent d'être livrés).

---

## 4. Interdits

- Aucune migration, aucune dépendance npm, aucune table, aucune variable d'environnement.
- Ne pas toucher `lib/memory.ts` (fichier pur, zéro import) ni `MEMORY_SECTIONS` : la
  section de sauvegarde est une convention de stockage, pas une section de produit.
- Ne pas modifier les données de démonstration elles-mêmes (`lib/demo/demo-rules.ts`,
  `lib/demo/scenarios.ts`).
- Ne pas rouvrir C5 ni C6 : au point 3.4, **ajouter** la phrase, ne rien réorganiser.
- **L'invariant de sauvegarde PAR SECTION reste intact** : `applyIdentity` en dépend —
  une section vide n'écrase jamais l'existant.

---

## 5. Pièges spécifiques

- **`readMemory(client)` sans filtre remonte TOUTES les sections.** La sauvegarde ne doit
  fuiter nulle part. Trois écrans à vérifier : `/entreprise` (boucle sur les entrées de la
  mémoire), `/` et `/plan` (passent la mémoire à `diagnosticInputFromMemory`).
- La table `journal` refuse UPDATE/DELETE (trigger volontaire) — un nouvel événement doit
  garder son libellé pour toujours (`lib/journal.ts`).
- Dates en UTC ; textes produit en français, code et commits en anglais.
- Fichier pur = **zéro import**, même relatif (règle 6) : la logique de sauvegarde va dans
  un fichier de règles séparé, l'I/O reste dans `seed.ts`.

---

## 6. Fichiers autorisés

| Fichier | Nature |
|---|---|
| `lib/demo/memory-backup-rules.ts` | **nouveau** — logique pure (sauvegarde/restauration) |
| `lib/demo/memory-backup.ts` | **nouveau** — I/O de la fiche : sauvegarde, restauration |
| `lib/demo/db.ts` | **nouveau** — `Admin` + `ensureOk`, partagés par les deux fichiers d'I/O |
| `lib/demo/seed.ts` | modifié — connecteurs en double, erreurs de suppression, appels sauvegarde/restauration |
| `lib/memory-store.ts` | modifié — `readMemory` masque les sections réservées |
| `app/(cockpit)/agent/actions.ts` | modifié — échec de retrait remonté + journal |
| `app/(cockpit)/agent/_components/demo-panel.tsx` | modifié — avertissement + message d'échec du retrait |
| `lib/journal.ts` | modifié — libellé du nouvel événement |
| `tests/demo-memory-backup.test.mjs` | **nouveau** — tests purs |
| `docs/projets/demo-isolation.md` | **nouveau** — ce fichier |
| `docs/SUIVI.md` | entrée de session |

---

## 7. Critères d'acceptation

1. Fiche remplie (même minimale : les 2 champs d'onboarding) → charger un scénario →
   l'identité est celle du scénario → retirer → **la fiche d'origine est revenue à
   l'identique**.
2. Charger A **puis** B **puis** retirer ⇒ fiche d'origine, **pas** A.
3. Retirer supprime bien prospects, campagnes, ventes, actions, briefings et envois
   préparés — y compris avec deux connecteurs `demo` en base.
4. **Aucune trace** de la section de sauvegarde dans `/entreprise`, `/`, `/plan`.
5. Un retrait qui échoue **le dit** (écran + journal).
6. Tests purs sur la logique de sauvegarde/restauration ; `npm test` et
   `npx tsc --noEmit` **terminés avec exit 0 explicite** (un log vide n'est pas un vert ;
   `tsc` frôle les 43 s sur ce montage — relancer plutôt que conclure).

---

## 8. Hors périmètre — à ne pas faire ici

- Sauvegarder/restaurer `organizations.name` et `organizations.activity` : `seedMemory`
  les écrase aussi. **Traité** (même mécanique, même sauvegarde) — voir SUIVI ; toute
  extension au-delà (documents, apprentissages) est hors périmètre.
- Rendre la sauvegarde visible ou éditable par l'utilisateur.
- Toucher au contenu des scénarios, à l'ordre des cartes, ou à la structure du panneau.

# Chantier B2 — Une action validée doit pouvoir être supprimée

> **Statut** : exécuté le 2026-07-26 (voir `docs/SUIVI.md`).
> **Origine** : ce chantier ne figure pas dans `docs/projets/roadmap-beta.md`. C'est une
> **correction bloquante relevée pendant la recette B1**, décidée par Fathi hors roadmap.
> Les « Règles pour tout chantier — anti-erreurs IA » (§2 de la roadmap) s'appliquent
> intégralement.

---

## 1. But

Le mode démonstration doit pouvoir remettre le cockpit à zéro même après l'exécution
d'une action validée. Aujourd'hui, une telle action devient impossible à supprimer dès
qu'une entrée du journal la référence. `resetCockpitState` échoue alors, ce qui bloque
à la fois le chargement d'un autre scénario et le retrait des données de démonstration.

Après ce chantier : valider puis exécuter une action en mode sûr, charger un scénario,
puis retirer les données ⇒ les deux opérations passent, le journal reste append-only et
ses entrées historiques restent lisibles.

---

## 2. Défaut constaté (2026-07-26)

`journal.action_id` est une clé étrangère vers `actions(id)` avec
`on delete set null` (`supabase/migrations/0001_init.sql`). Le trigger
`journal_no_update` interdit volontairement tout `update or delete` sur `journal`.
Supprimer une action référencée demande donc à Postgres de mettre `action_id` à `null`,
mais cette mise à jour est rejetée avec « journal is append-only ».

Le grep complet avant chantier établit que :

- les six écritures applicatives de `journal.action_id` sont toutes dans
  `lib/execution.ts` ;
- aucun code applicatif ne lit ni ne déréférence `journal.action_id` ;
- les journaux de `/` et `/journal` sélectionnent et affichent l'événement, l'acteur,
  le payload et la date, sans jointure vers `actions` : une action absente ne rend donc
  pas son entrée illisible ;
- la seule suppression directe de `actions` est celle de `resetCockpitState`
  (`lib/demo/seed.ts`) ;
- `outbox_messages.action_id` est une autre relation, volontairement en
  `on delete cascade` (`0006_execution.sql`) : elle ne provoque aucune mutation du
  journal et ne doit pas changer.

---

## 3. À faire

### 3.1 Corriger la relation historique

Ajouter une nouvelle migration `0011` qui supprime uniquement la contrainte
`journal_action_id_fkey`, en gardant la colonne `journal.action_id`.

**Décision retenue** : un journal est un historique autonome. Son identifiant d'action
reste utile comme trace même lorsque l'entité opérationnelle a disparu ; il doit donc
pouvoir devenir une référence orpheline. Retirer la contrainte exprime cette sémantique
sans affaiblir l'invariant append-only.

L'alternative consistant à ne plus supprimer les actions est écartée : elle obligerait
à introduire une nouvelle convention d'archivage et à filtrer tous les écrans du cockpit,
alors que le besoin explicite de `resetCockpitState` est de retirer l'état opérationnel
du scénario précédent.

### 3.2 Vérifier les lecteurs

Contrôler tous les usages de `action_id` et l'affichage du journal. Corriger uniquement
si un lecteur suppose que l'action existe. Au recensement initial, aucun lecteur ne fait
cette hypothèse ; aucune modification applicative n'est donc attendue.

### 3.3 Vérifier les deux parcours

Après une action exécutée en mode sûr :

1. charger un scénario de démonstration ;
2. retirer les données de démonstration ;
3. confirmer que les entrées du journal antérieures sont toujours rendues ;
4. confirmer que la fiche entreprise d'origine revient à l'identique (invariant B1).

La migration doit être appliquée manuellement dans Supabase par Fathi avant la recette
réelle. Les vérifications automatisables dans le dépôt doivent néanmoins être exécutées
ici avec un exit explicite.

---

## 4. Interdits

- Ne pas toucher au trigger `journal_no_update`, à la fonction
  `forbid_journal_mutation` ni au caractère append-only du journal.
- Ne pas retirer les `ensureOk` de `lib/demo/seed.ts` ni atténuer la remontée d'erreur
  ajoutée par B1.
- Ne pas modifier une migration existante ; utiliser le prochain numéro libre.
- Ne pas modifier `outbox_messages.action_id` ni son `on delete cascade`.
- Aucune dépendance npm, aucune variable d'environnement, aucune nouvelle table.
- Ne pas toucher aux données de démonstration (`lib/demo/demo-rules.ts`,
  `lib/demo/scenarios.ts`) ni à `lib/memory.ts`.

---

## 5. Pièges spécifiques

- La migration `0011` devra être passée à la main dans Supabase par Fathi.
- `0010_research.sql` est déjà passée d'après `docs/SUIVI.md` (vérification du
  2026-07-26) : elle n'est plus en attente.
- Une entrée de journal peut désormais conserver un `action_id` sans ligne correspondante
  dans `actions` : c'est volontaire, pas une corruption à « réparer ».
- Dates en UTC ; textes produit en français, code et commit en anglais.
- `npm test` et `npx tsc --noEmit` doivent se terminer avec exit 0 explicite. Le build
  reste à faire côté Fathi sous Windows (SWC).

---

## 6. Fichiers autorisés

| Fichier | Nature |
|---|---|
| `supabase/migrations/0011_drop_journal_action_fk.sql` | **nouveau** — retire uniquement la FK du journal |
| `tests/journal-action-deletion.test.mjs` | **nouveau si utile** — garde de régression du schéma |
| `docs/projets/demo-isolation.md` | modifié — ordre de mission B2 |
| `docs/SUIVI.md` | modifié — entrée de session |

---

## 7. Critères d'acceptation

1. Une action exécutée et référencée par le journal peut être supprimée.
2. Charger un scénario après cette exécution réussit.
3. « Retirer les données de démonstration » réussit ensuite et restaure la fiche
   d'origine à l'identique.
4. Les entrées historiques restent lisibles même si leur `action_id` ne correspond plus
   à une ligne de `actions`.
5. Le trigger append-only et la FK cascade de `outbox_messages` sont inchangés.
6. `npm test` et `npx tsc --noEmit` se terminent avec exit 0 explicite.

---

## 8. Hors périmètre — à ne pas faire ici

- Ajouter un écran, un état d'archivage ou un filtre pour les actions supprimées.
- Modifier le flux d'exécution, le contenu de l'outbox ou les plafonds serveur.
- Nettoyer ou réécrire les anciennes entrées du journal.
- Modifier les données, la structure ou la présentation du mode démonstration.
