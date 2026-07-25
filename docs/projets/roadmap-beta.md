# Roadmap d'exécution — Bêta solide

> **Statut** : prêt à exécuter. Issu de l'audit contradictoire du plan de simplification et de l'évaluation valeur (2026-07-25).
> **Objectif n°1** : une démonstration **solide** à Charly (rien ne casse, l'écran d'accueil dit la vérité).
> **Objectif n°2** : une bêta qui **prouve sa valeur** (l'agent envoie réellement, mesure le résultat, et le montre).
>
> Ce fichier remplace l'ordre du plan `simplification.md` (lots amendés par l'audit) et y ajoute les chantiers valeur. Les moteurs, conventions et non-négociables de `CLAUDE.md` restent la loi.

---

## 0. Mode d'emploi

**Un chantier = une session d'agent = au moins un commit.** Ne jamais mélanger deux chantiers dans une session.

**Une seule session à la fois sur le repo.** Il n'y a pas de branches : deux agents en parallèle écrivent dans le même arbre de travail et se marchent dessus. Enchaîner les chantiers, ne pas les paralléliser — sauf mention « parallélisable » explicite (périmètres de fichiers disjoints), et même là, préférer la séquence si le doute existe.

**Repo propre avant de lancer** : le chantier précédent est commité (le push peut attendre).

**Prompt de lancement** (à coller tel quel dans une nouvelle session, en remplaçant `CX`) :

```
Tu travailles sur le repo Nepteo (C:\dev\agent_marketing).
1. Lis CLAUDE.md et docs/SUIVI.md.
2. Lis docs/projets/roadmap-beta.md : exécute UNIQUEMENT le chantier CX,
   en respectant à la lettre sa section « Interdits » et les
   « Règles pour tout chantier » (§2 du même fichier).
3. À la fin : npm test + npx tsc --noEmit TERMINÉS (exit 0 explicite),
   entrée dans docs/SUIVI.md, commit, liste « Reste (Fathi) ».
Ne touche à rien hors du périmètre du chantier. Si quelque chose te
semble nécessaire hors périmètre, note-le dans SUIVI, ne le fais pas.
```

---

## 1. Quel modèle pour quel chantier

Principe : **l'intelligence est déjà dans l'ordre de mission**. Plus le périmètre est serré (fichiers listés, interdits explicites, critères vérifiables), moins le chantier a besoin d'un grand modèle. Opus 5 fonctionne très bien — le garder pour ce qui est structurel, transversal ou irréversible ; Sonnet 5 suffit pour le reste, à une fraction du coût.

| Chantier | Modèle conseillé | Pourquoi |
|---|---|---|
| C1 Nettoyage invisible | **Sonnet 5** | Suppressions + remplacement mécanique, critères binaires |
| C2 Premier écran honnête | **Sonnet 5** | Déplacement de rendu, composants existants |
| C3 Vocabulaire (CVR/CTR) | **Sonnet 5** | Libellés UI uniquement |
| C4 Structure cible (nav 5 + propositions unifiées) | **Opus 5** | Transversal : navigation, redirects, liens internes, maquette |
| C5 Autonomie en un réglage | **Sonnet 5** | UI seule, aucune logique serveur |
| C6 Mémoire en 3 blocs | **Sonnet 5** | Présentation seule |
| C7 Étape B — envoi réel | **Opus 5** | Externe + irréversible : garde-fous, idempotence, erreurs |
| C8 Le temps dans la relance | **Opus 5** | Schéma + sync + règles, trois couches traversées |
| C9 Compteur de valeur | **Sonnet 5** | Agrégats + un bloc UI |
| C10 Brief du lundi | **Sonnet 5** | Assemblage de briques existantes |
| C11 Diagnostic public | **Sonnet 5** | Page publique sur moteur pur existant |
| C12 Séquences de relance | **Opus 5** | À cadrer avant de coder |

**Haiku 4.5 : ne pas l'utiliser pour modifier ce repo** (TypeScript strict + invariants nombreux) ; il convient pour relire un diff, résumer une session, rédiger un texte.

**Règle d'escalade** : si un chantier confié à Sonnet 5 n'est pas vert après **deux allers-retours**, l'arrêter, revenir au dernier commit propre et relancer le chantier entier avec Opus 5. Ne pas changer de modèle en cours de chantier.

---

## 2. Règles pour tout chantier — anti-erreurs IA

Les erreurs ci-dessous ont soit déjà eu lieu sur ce repo, soit sont les plus fréquentes chez les agents de code. Chaque agent doit les lire avant de commencer.

1. **Périmètre strict.** Exécuter uniquement le chantier demandé. Aucune « amélioration en passant », aucun refactor opportuniste. Un problème repéré hors périmètre → une ligne dans SUIVI (« constats »), pas un correctif.
2. **Fichiers autorisés.** Chaque chantier liste ses fichiers. Si un fichier non listé s'avère indispensable, le signaler dans le rendu — ne pas improviser en silence.
3. **Rien de nouveau sans mandat** : aucune dépendance npm, aucune migration, aucune variable d'environnement, aucune table qui ne soit prévue par le chantier. (Les appels HTTP se font en `fetch` natif — patron `lib/research/perplexity.ts`.)
4. **Grep avant suppression.** Ne jamais supprimer du code jugé « mort » sans vérifier ses usages. Cas vécu : `lib/types.ts` a l'air d'un réexport, mais `lib/connectors.ts` en importe `ConnectorType`.
5. **Chercher avant de créer.** Helpers (`readMemory` après C1, `dedupeByEmail`, `dedupeContacts`), tokens design (`globals.css`), patrons (`_components/`, actions serveur + journal) : réutiliser, ne pas dupliquer.
6. **Fichiers purs = zéro import**, même relatif (`lib/*-rules.ts`, `plan.ts`, `diagnostic.ts`, `demo-rules.ts`, `memory.ts`…). Les constantes nécessaires s'**injectent en paramètre** (cf. `profile-rules.ts`). Sinon `node:test` casse (type-stripping).
7. **Ne pas « réparer » les invariants volontaires** : trigger `journal` qui refuse UPDATE/DELETE ; échecs Perplexity mis en cache exprès ; `/auth/confirm` en `?code=` (PKCE) ; dédup homonymes assumée ; port 3001 figé ; `proxy.ts` (un `middleware.ts` serait ignoré) ; `revalidatePath` avant `redirect` dans login/logout.
8. **UI en français, code et commits en anglais.** Ne jamais définir le lexique marketing standard (prospect, lead, funnel, relance, ROAS, CAC). Couleurs et rayons via les tokens de `globals.css`, jamais en dur. Patrons visuels : `docs/maquettes/`.
9. **Toute mutation** = server action ou route handler, garde `canEdit`, entrée `journal`. Jamais de mutation côté client, jamais de garde-fou uniquement en UI.
10. **Insertion d'imports** : viser la fin de la déclaration (`} from …`), jamais « la dernière ligne commençant par import ». Un script a déjà cassé un import multi-lignes dans `prospects/page.tsx`.
11. **`localStorage` et hydration** : tout composant client qui lit le navigateur se rend après montage (patron `CoachBubble`), sinon désaccord serveur/navigateur.
12. **Dates** : stocker et comparer en UTC (`toISOString().slice(0, 10)`), formater en `fr-FR` à l'affichage uniquement.
13. **Vérification honnête** : `npm test` et `npx tsc --noEmit` **terminés avec exit 0 explicite**. Le sandbox tue les process vers ~44 s et laisse un log vide : un log vide ou tronqué n'est PAS un vert. `npm run build` se fait côté Fathi (SWC Windows).
14. **Fin de session** : entrée SUIVI (fait / décisions / reste), un commit minimum, liste « Reste (Fathi) » (migrations à passer, push, build). Pas de push depuis le sandbox (pas d'identifiants).
15. **Aucun envoi externe** tant que C7 n'est pas explicitement validé par Fathi. Rien ne contourne l'outbox, le journal-avant, ni les plafonds serveur.
16. **Fichiers courts** : un composant par fichier, ~200 lignes max, pages serveur par défaut (client seulement si nécessaire).
17. **Migrations** : ne jamais modifier une migration existante ; toujours un nouveau numéro (vérifier le prochain libre dans `supabase/migrations/` au moment du chantier — les numéros cités plus bas sont indicatifs) ; RLS systématique sur toute nouvelle table.
18. **Tests** : ne jamais supprimer un test de règles pour « faire passer » ; si un chantier supprime du code couvert, retirer uniquement les cas qui testaient ce code, et le dire dans SUIVI avec le nouveau total attendu.

---

## 3. Jalon 0 — checklist avant la démo (Fathi, à la main)

À faire **avant** de lancer le moindre chantier, et à revérifier la veille de la démo :

- [ ] **Migration `0010_research.sql`** passée dans Supabase — « la seule en attente » dans les quatre entrées SUIVI du 25/07. Sans elle, si `PERPLEXITY_API_KEY` est active, l'assistant d'identité échoue **au premier contact** d'un nouveau compte.
- [ ] Sinon : retirer `PERPLEXITY_API_KEY` de l'env de démo (la recherche se désactive proprement, l'onboarding saute l'étape).
- [ ] **`git push`** — quatre sessions de travail sont locales sur une seule machine.
- [ ] `npm test` et `npm run build` verts en local.
- [ ] Dérouler **une fois soi-même** `docs/demo/GUIDE-TEST.md` de bout en bout sur les trois scénarios, y compris le changement de scénario (vérifier qu'il ne reste rien de l'ancien).
- [ ] Vérifier `GET /api/llm/status` (LLM + `research.perplexity` cohérents avec la décision ci-dessus).

---

# Phase A — avant la démo : solide à montrer

Trois chantiers courts, sans risque structurel. Ordre : **C1 → C2**, C3 quand on veut (fichiers disjoints).

## C1 — Nettoyage invisible *(lot 1 amendé)*

**Modèle : Sonnet 5 · Effort : ½ journée · Aucun changement visible (hors deux boutons démo retirés).**

**But** : supprimer les doublons de données de démo et la triple lecture de la mémoire. Le mode démonstration (`lib/demo/*`) devient le seul chemin de données fictives.

**À faire**
1. Supprimer `lib/ads/mock-provider.ts`, `lib/ads/seed.ts`, `lib/revenue/mock-provider.ts`, `lib/revenue/seed.ts`, ainsi que les actions et boutons qui les appellent (`app/(cockpit)/actions.ts` : `loadRevenueDemo` ; `app/(cockpit)/campagnes/actions.ts` : action de démo ads ; boutons dans `app/(cockpit)/page.tsx` et `campagnes/page.tsx`). Sur l'accueil, remplacer le bouton « Charger le revenu de démo » par un lien sobre vers `/agent` (« Essayer avec une entreprise fictive → »).
2. Créer `lib/memory-store.ts` (côté serveur) : `readMemory(supabase, sections?)` qui fait le `select("section, content")` + `Object.fromEntries`, avec `sections` optionnel (défaut : toutes ; `LLM_MEMORY_SECTIONS` pour les appels prompts). Remplacer les duplications dans : `app/(cockpit)/actions.ts`, `campagnes/actions.ts`, `contenu/actions.ts`, `contenu/page.tsx`, `plan/page.tsx`, `lib/analysis.ts`, `lib/briefing.ts`, `lib/execution.ts`, `app/(cockpit)/entreprise/page.tsx`. **Attention** : ne remplacer que les lectures de `company_memory` — d'autres `Object.fromEntries` (ex. `app/api/llm/status/route.ts`) n'ont rien à voir.
3. Supprimer `lib/types.ts` **après** avoir relogé `ConnectorType` (importé par `lib/connectors.ts` — le déplacer dans `lib/connectors/common.ts` ou directement dans `lib/connectors.ts`). Grep de contrôle avant suppression (règle 4).

**Interdits** : ne PAS créer `lib/rules/` ni déplacer les fichiers de règles (reporté — churn sans gain utilisateur). Ne pas toucher `lib/demo/*`. `readMemory` ne va PAS dans `lib/memory.ts` (fichier pur, zéro import).

**Pièges spécifiques** : `tests/revenue.test.mjs` couvre `mockRevenueEvents` — retirer uniquement les cas du mock supprimé, garder les cas `revenue-rules` (règle 18). Idem côté ads si des tests couvrent le mock.

**Acceptation** : grep `ads/seed|ads/mock-provider|revenue/seed|revenue/mock-provider|lib/types` → 0 résultat hors migrations/docs ; `npm test` vert (total ajusté et consigné) ; `tsc --noEmit` exit 0 ; l'app se comporte à l'identique (scénarios démo inclus).

## C2 — Le premier écran dit la vérité

**Modèle : Sonnet 5 · Effort : ½ journée · Dépend de C1 (`readMemory`).**

**But** : un nouvel utilisateur (ou Charly) qui arrive sur `/` avec une base vide voit le **diagnostic de départ** — pas quatre tirets et une consigne d'onboarding gravée à vie.

**À faire**
1. Extraire le rendu du diagnostic de `app/(cockpit)/plan/page.tsx` en composant partagé `app/(cockpit)/_components/starter-diagnostic.tsx` (props : `StarterDiagnostic`). `/plan` l'utilise, comportement inchangé.
2. Dans `app/(cockpit)/page.tsx` : si 0 prospect ET 0 ligne `ad_metrics`, rendre le diagnostic (via `readMemory` + `buildStarterDiagnostic`) à la place des KPIs vides ; sinon, accueil actuel.
3. Supprimer le paragraphe permanent « Nepteo apprend votre entreprise… » sous « Bonjour » quand des données existent (le garder uniquement dans l'état vide, où il est vrai).
4. Mettre à jour `docs/demo/GUIDE-TEST.md` (le parcours commence désormais sur `/`) et la bulle `CoachBubble id="today"` si son texte y fait référence.

**Interdits** : ne pas retirer le diagnostic de `/plan` (il y reste jusqu'à C4). Ne pas ajouter de composant client — tout est rendu serveur.

**Acceptation** : base vide → diagnostic sur `/` avec les deux CTA (« Corriger ma fiche » / « Brancher mes outils ») ; scénario chargé → accueil actuel sans copie d'onboarding ; `/plan` inchangé ; GUIDE-TEST cohérent.

## C3 — Vocabulaire : deux acronymes, pas quatre *(lot 5 réduit)*

**Modèle : Sonnet 5 · Effort : 1 heure · Parallélisable avec C1/C2 (fichiers disjoints).**

**But** : appliquer la règle vocabulaire de CLAUDE.md, pas plus. La cible est « à l'aise avec leads, CAC, ROAS, funnel » — **ROAS et CAC ne changent pas**.

**À faire** : remplacer les libellés UI `CVR` → « Conversion » et `CTR` → « Taux de clic » partout où ils s'affichent (grep `CVR|CTR` dans `app/` — notamment `campagnes/page.tsx`, en-têtes de tableau et cartes KPI).

**Interdits** : ne pas toucher aux clés de code (`deriveKpis`, types, payloads). Ne pas gloser ROAS/CAC. Ne pas élargir aux textes des moteurs purs.

**Acceptation** : plus aucun « CVR »/« CTR » à l'écran ; `tsc` exit 0 ; tableaux lisibles (largeurs OK).

---

# La démo — points à trancher avec Charly (30 minutes à la fin)

La démo n'est pas qu'une présentation : c'est le moment de fermer les décisions ouvertes. Arriver avec ce papier :

1. **Client pilote** (DECISIONS #1, ouverte depuis des semaines — la plus bloquante : la porte de la Phase 2 « ≥ 1 reco utile/semaine » est infranchissable sans pilote).
2. **Structure cible** (C4) : montrer la maquette papier « nav à 5 entrées + propositions unifiées sur Aujourd'hui ». C'est la maquette V2 de Charly qu'on amende — alignement d'associés, pas validation utilisateur.
3. **Contenu** : d'accord pour retirer l'entrée de navigation et garder l'atelier accessible par lien ?
4. **Journal** : reste en navigation (position de l'audit : c'est l'artefact de confiance) — objection ?
5. **Autonomie par défaut** au lancement (DECISIONS #4) : `suggest` ou `prepare` ?
6. **Étape B (envoi réel)** : accord de principe pour la prioriser juste après la structure (C7).

---

# Phase B — après la démo : la structure

Ordre : **C4 → C5**, C6 quand on veut. Ne rien commencer de la phase B avant la démo : C4 défait de l'ergonomie que le kit de démonstration référence (bulles, GUIDE-TEST).

## C4 — Structure cible : nav à 5, un seul endroit pour les propositions *(lots 3+4 fusionnés)*

**Modèle : Opus 5 · Effort : 2–3 jours · Prérequis : accord Charly (point 2 de la démo).**

**But** : un solopreneur ouvre l'app, il y a UN endroit où l'agent lui parle. Navigation : `Aujourd'hui · Prospects · Campagnes · Mon entreprise · Journal`.

**Cible**
- **Aujourd'hui** = bandeau de cap (l'intro + budget de `buildMarketingPlan`, avec ses 2–3 premiers mouvements condensés et leurs CTA) + file de validation + décisions récentes + KPIs. Les mouvements du plan restent des **conseils avec CTA** (lecture seule), distincts visuellement des **actions à valider** — ne pas les fondre dans la file.
- **`/plan`** : la route redirige vers `/` (redirect permanent). Le moteur `lib/plan.ts` ne bouge pas.
- **Contenu** : entrée de navigation supprimée ; la route `/contenu` **reste vivante** (atelier), atteinte par le CTA « Idées de contenu » du bandeau et un bouton sur `/campagnes`.
- **Mon entreprise** (`/entreprise`) = onglets **Identité · Connecteurs · Agent** qui remontent les contenus actuels des trois pages. `/connecteurs` et `/agent` redirigent vers l'onglet correspondant (les deep links et le panneau démo doivent continuer de fonctionner).
- **Journal** : reste en navigation de premier niveau (décision d'audit — artefact de confiance).

**À faire, dans l'ordre** : (1) recenser TOUS les liens internes (`grep -rn 'href="/(plan|contenu|connecteurs|agent)"' app components lib`) — y compris `ctaHref` dans `lib/plan.ts`, les redirects d'actions serveur, `docs/demo/GUIDE-TEST.md` et les bulles `CoachBubble` (une par écran supprimé/fusionné) ; (2) construire les onglets ; (3) poser les redirects ; (4) refondre `sidebar.tsx` ; (5) mettre à jour guide + bulles ; (6) passer les tests (`tests/plan.test.mjs` vérifie que les CTA pointent vers des routes valides — mettre à jour la liste blanche si besoin).

**Interdits** : aucun moteur pur modifié (`plan.ts`, `diagnostic.ts`, `analysis-rules.ts`…) ; aucune route supprimée sans redirect ; pas de refonte visuelle au-delà de la navigation (tokens et patrons maquettes inchangés).

**Pièges spécifiques** : les actions serveur qui `redirect("/agent")` ou `redirect("/campagnes?proposed=…")` ; l'état vide de `/plan` (diagnostic) disparaît avec la redirection — vérifier que C2 l'a bien installé sur `/` d'abord ; `revalidatePath` après déplacements.

**Acceptation** : 5 entrées de nav ; anciennes URLs toutes redirigées (tester `/plan`, `/contenu` en direct, `/connecteurs`, `/agent`) ; panneau démo fonctionnel dans son onglet ; aucune bulle orpheline ; GUIDE-TEST à jour ; `npm test` + `tsc` verts.

## C5 — L'autonomie en un réglage *(lot 2 amendé)*

**Modèle : Sonnet 5 · Effort : ½–1 journée · Après C4 (la page Agent est devenue un onglet).**

**But** : quatre blocs qui disent « l'agent ne fera rien sans toi » deviennent un réglage + un interrupteur.

**À faire**
1. Onglet Agent : **un curseur à trois crans** — « Propose seulement » (`suggest`) · « Prépare » (`prepare`) · « Envoie » (désactivé, badge « Bientôt ») — + le **bouton d'arrêt**. Les plafonds (`MAX_PER_RUN`, `MAX_PER_DAY`) passent en une ligne de note sous le curseur (« Plafonds serveur : X par exécution, Y par jour — non contournables »). La carte « Mode d'exécution » disparaît (l'info est portée par le cran désactivé).
2. Déplacer « Envois préparés » vers `/journal` (section en tête de page).
3. Déplacer « Mode démonstration » vers l'état vide de l'onglet Connecteurs (« Pas d'outil à brancher ? Essayez avec une entreprise fictive ») — il reste accessible ailleurs via l'URL directe si le guide y renvoie.
4. Le `ExecutionSwitch` d'Aujourd'hui reste (kill switch visible) — un seul composant partagé, pas deux implémentations.

**Interdits** : aucune modification de `execution-rules.ts`, `execution.ts`, ni du modèle `autonomy_level` (toujours `suggest|prepare` en base — le 3e cran est purement visuel). Aucune migration.

**Acceptation** : l'onglet Agent tient en deux notions (curseur + arrêt) ; bascule d'autonomie journalisée comme avant ; envois préparés visibles dans Journal ; démo chargeable depuis Connecteurs ; tests verts.

## C6 — La mémoire en trois blocs *(lot 6)*

**Modèle : Sonnet 5 · Effort : ½ journée · Parallélisable avec C5.**

**But** : huit lignes à remplir deviennent trois blocs lisibles — **Ce que je vends** (activité, offres, zone) · **Comment je parle** (ton, philosophie) · **Ce que je fais déjà** (canaux, présence, objectifs).

**À faire** : regrouper les `MemRow` de `app/(cockpit)/entreprise/_components/identity-card.tsx` sous trois intertitres (même page, même ordre interne).

**Interdits** : aucune migration, aucun changement de `lib/memory.ts` ni des actions. **La sauvegarde reste PAR SECTION** — c'est l'invariant qui garantit qu'une section vide n'écrase jamais l'existant (`applyIdentity` en dépend).

**Acceptation** : trois blocs, huit sections toujours éditables individuellement, philosophie intacte après édition d'une autre section.

---

# Phase C — la valeur : une bêta qui prouve

C'est ici que le produit cesse d'être une promesse. Ordre : **C7 d'abord** (tout le reste s'y branche), puis C8, puis C9/C10 ; C11 indépendant ; C12 en destination.

## C7 — Étape B : l'envoi réel

**Modèle : Opus 5 · Effort : 2–3 jours · LA priorité de la phase. Validation explicite de Fathi requise avant le premier envoi réel.**

**But** : une relance validée puis exécutée **part réellement**. Toute l'architecture non négociable (journal, idempotence, outbox, plafonds) s'amortit ce jour-là.

**Décisions préalables (Fathi, avant de lancer le chantier)** : fournisseur d'envoi EU (Mailjet ou Brevo), compte créé, créds en env (`MAIL_API_KEY`, `MAIL_FROM`…). **Passer par l'API HTTP du fournisseur en `fetch` natif** (patron `perplexity.ts`) — pas de dépendance npm.

**À faire**
1. Migration (prochain numéro libre) : `outbox_messages` + colonnes `sent_at timestamptz`, `error text`, `attempts int default 0` (vérifier l'existant avant — ne créer que ce qui manque).
2. `lib/outbox/send-rules.ts` (pur) : garde d'envoi (ordre : créds configurées > pause org > plafonds jour/run > statut `prepared`), politique de retry (max 2 tentatives, ensuite `failed`).
3. `lib/outbox/send.ts` : sélection des `prepared` → **verrou optimiste** (`update … where id = X and status = 'prepared'`, une ligne affectée sinon on saute — un message ne part JAMAIS deux fois) → journal `send_started` AVANT l'appel → appel API → `sent` + `sent_at` ou `failed` + `error` + journal.
4. UI : le 3e cran du curseur (C5) s'active si les créds sont configurées ; bouton « Envoyer les N messages préparés » avec confirmation explicite (« N emails vont réellement partir ») ; **mode self-test d'abord** : le premier envoi réel est forcé vers l'adresse email du compte, à désactiver ensuite consciemment.
5. Mettre à jour `CLAUDE.md` (section Phase actuelle : étape B) et `docs/DECISIONS.md` (fournisseur retenu, format ADR).

**Interdits** : aucun envoi automatique — l'envoi est toujours un geste utilisateur en bêta ; pas de boucle de retry infinie ; pas d'envoi si la migration n'est pas passée (échec propre journalisé) ; ne pas toucher au flux `prepared` existant (étape A reste le défaut sans créds).

**Pièges spécifiques** : encodage UTF-8 (accents dans sujet/corps) ; `From` = adresse vérifiée chez le fournisseur, sinon tout part en spam ; distinguer erreur réseau (retry) et rejet définitif (failed direct) ; les plafonds comptent les envois **réels**, pas les préparations.

**Acceptation** : parcours complet en self-test (valider → exécuter → envoyer → email reçu, statut `sent`, journal complet avant/après) ; un second clic « Envoyer » n'envoie rien (idempotence) ; pause org bloque l'envoi ; `npm test` étendu sur `send-rules` ; `tsc` vert.

## C8 — Le temps dans la relance

**Modèle : Opus 5 · Effort : 1–2 jours · Indépendant de C7 (mais C9 veut les deux).**

**But** : combler le trou n°1 du produit — la relance ignore **depuis quand** un prospect attend. Le temps fabrique aussi de la nouveauté : chaque semaine, des prospects franchissent les seuils, l'agent a du neuf à dire.

**À faire**
1. Migration (prochain numéro libre) : `prospects.last_contact_at date` (nullable).
2. `FieldMapping` (`lib/connectors/common.ts`) : 5e champ optionnel « Dernier contact » — détection auto par mots-clés (« dernier contact », « relance », « date ») pour Sheets (colonne) et Notion (propriété de type date en priorité) ; parsing tolérant (ISO et `jj/mm/aaaa`), invalide ⇒ `null`, jamais d'erreur de sync. Écran de correspondance : une ligne de plus.
3. Règles (`analysis-rules.ts`, additif) : `prospectPriority` accepte un `lastContactAt?` optionnel — nouveau motif « sans nouvelle depuis N jours » (N = 21) qui renforce la priorité, et garde-fou anti-spam : **ne pas proposer de relancer un prospect contacté il y a moins de 7 jours**. Signature existante préservée (le kanban partage cette fonction) : paramètre optionnel, comportement strictement identique quand la donnée est absente.
4. Après C7 : chaque envoi réel met à jour `last_contact_at` du prospect (dans la même transaction logique que le passage à `sent`).
5. UI : les cartes kanban et les propositions de relance affichent « depuis X jours » quand la donnée existe.

**Interdits** : aucun score inventé (la règle du repo) — uniquement des faits datés ; pas de valeur par défaut fabriquée quand la colonne n'est pas mappée.

**Pièges spécifiques** : comparer des dates en UTC ; `raw` conserve toujours la valeur d'origine ; tests purs avec dates **injectées** (pas de `new Date()` non contrôlé dans les règles — passer `today` en paramètre).

**Acceptation** : sync Sheets et Notion avec colonne date → champ rempli ; sans colonne → comportement actuel à l'identique (tests de non-régression) ; proposition « sans nouvelle depuis 21 jours » visible sur un scénario adapté ; contact < 7 jours jamais proposé.

## C9 — Le compteur de valeur

**Modèle : Sonnet 5 · Effort : 1 journée · Après C7 (la partie « € coupés » peut se faire avant).**

**But** : l'écran d'accueil répond à « pourquoi je paie » — *« Ce mois-ci : 12 relances envoyées, 3 réponses, ~180 € de dépense en perte coupés. »*

**À faire**
1. « A répondu » : statut `replied` sur `outbox_messages` (migration si nécessaire), bouton un-clic sur les envois (Journal / envois), journalisé.
2. Calculs (fichier pur `lib/value-rules.ts`) : relances envoyées 30 j (statut `sent`), réponses (`replied`), **dépense coupée** = pour chaque action `ads_pause` exécutée, la dépense moyenne/jour de la campagne sur ses 30 derniers jours actifs × jours écoulés depuis la pause — étiquetée « estimation ».
3. Bloc « Ce que l'agent vous a apporté » sur Aujourd'hui (masqué tant que tout est à zéro).

**Interdits** : aucune métrique de vanité, aucun chiffre non explicable — chaque nombre a une infobulle « comment c'est calculé ». Ne pas afficher de revenu « attribué » sans attribution réelle.

**Acceptation** : chiffres reproductibles à la main depuis le journal et l'outbox ; bloc absent quand rien à montrer ; tests purs sur `value-rules`.

## C10 — Le brief du lundi

**Modèle : Sonnet 5 · Effort : ½–1 journée · Après C7 (même transport d'email).**

**But** : Nepteo cesse d'être un site à visiter — l'agent écrit chaque lundi : le point, trois propositions en attente, un lien.

**À faire** : route `/api/cron/weekly-brief` (Bearer `CRON_SECRET`, patron `/api/cron/sync`) ; compose briefing existant + propositions `proposed` + compteur de valeur (C9) ; envoi via le transport C7 à l'email du propriétaire ; **idempotence par (org, semaine ISO)** via clé dans le journal — le cron peut repasser sans double envoi ; opt-out (préférence org) ; pas d'envoi si rien à dire.

**Acceptation** : deux appels le même lundi ⇒ un seul email ; contenu en français, ton produit, aucun jargon ; désinscription effective.

## C11 — Le diagnostic public (acquisition)

**Modèle : Sonnet 5 · Effort : 1 journée · Indépendant — peut se faire à tout moment.**

**But** : l'actif le plus démonstratif du produit devient l'aimant à leads : une page publique « Diagnostic marketing gratuit ».

**À faire** : page `/diagnostic` publique (à ajouter aux routes publiques de `proxy.ts` — pas de `middleware.ts` !) ; formulaire 5 champs (activité, clientèle, zone, offre, canaux — mêmes options que la mémoire, **injectées**) → `buildStarterDiagnostic` rendu serveur → CTA « Créer mon compte pour aller plus loin ». **Sans Perplexity** (coût par requête non plafonnable en public) — la variante « collez votre URL » viendra plus tard derrière un cap strict.

**Interdits** : aucune écriture en base, aucun appel externe, aucun cookie nécessaire.

**Acceptation** : accessible déconnecté ; diagnostic identique à celui de l'app à entrées égales ; lighthouse raisonnable ; lien signup fonctionnel.

## C12 — Les séquences de relance *(destination)*

**Modèle : Opus 5 · Prérequis : C7 + C8 · Commencer par une session de CADRAGE (document dans `docs/projets/`), pas par du code.**

La promesse finale en une phrase : **« plus aucun prospect oublié »** — J0, rappel J+7, dernier message J+15, arrêt automatique à la réponse ou au statut terminal. À cadrer : l'utilisateur valide **la séquence** (pas chaque message) — c'est un changement du modèle d'autonomie, donc une décision produit avant d'être un chantier technique.

---

# Récapitulatif — ordre et dépendances

```
Jalon 0 (checklist Fathi)
   │
   ├─ C1 ──► C2          ┐
   ├─ C3 (parallèle)     ├─ Phase A — avant la démo
   │                     ┘
 DÉMO CHARLY (+ 6 décisions à fermer)
   │
   ├─ C4 ──► C5          ┐
   ├─ C6 (parallèle)     ├─ Phase B — structure
   │                     ┘
   ├─ C7 ──► C9 ──► C10  ┐
   ├─ C8 ──┘ (C9 complet)├─ Phase C — valeur
   ├─ C11 (indépendant)  │
   └─ C12 (après C7+C8)  ┘
```

**Définition de « solide » pour la démo** : build vert local, tests verts, `tsc` exit 0, migration 0010 passée, push fait, GUIDE-TEST déroulé de bout en bout par Fathi sur les trois scénarios, zéro écran cassé en parcours nominal, et aucun texte qui promet un envoi réel qui n'existe pas.

**Définition de « bêta qui prouve »** (sortie de phase C) : un pilote réel branché, au moins une relance réellement envoyée et une réponse enregistrée, le compteur de valeur non nul, le brief du lundi reçu deux semaines de suite.

---

## Suivi (journal du chantier roadmap)

- **2026-07-25** — Fichier créé (Claude, Cowork) à partir de l'audit contradictoire du plan `simplification.md` et de l'évaluation valeur. Rien codé. Prochain geste : jalon 0, puis C1.
- **2026-07-25** — **C1 terminé** (Claude, Cowork ; détail dans `docs/SUIVI.md`). Mock/seed ads + revenu supprimés, `lib/memory-store.ts` (`readMemory`) créé et branché sur 9 lectures, `lib/types.ts` supprimé (`ConnectorType` relogé dans `lib/connectors.ts`). Tests 130 → **128**, `tsc` exit 0. Écart assumé : l'état vide de `/campagnes` a reçu le même lien `/agent` que l'accueil. Prochain geste : **C2**.


