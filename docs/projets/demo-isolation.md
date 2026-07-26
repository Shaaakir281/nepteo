# Chantier B1 — La démonstration ne doit jamais détruire la vraie fiche

> **Statut** : exécuté le 2026-07-26 (voir `docs/SUIVI.md`).
> **Origine** : ce chantier ne figure pas dans `docs/projets/roadmap-beta.md`. C'est une
> **correction de défaut relevée à l'usage** le 2026-07-26, décidée par Fathi hors roadmap.
> Les « Règles pour tout chantier — anti-erreurs IA » (§2 de la roadmap) s'appliquent
> intégralement.

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
