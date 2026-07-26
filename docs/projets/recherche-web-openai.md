# Chantier R1 — La recherche web sans compte Perplexity

> **Statut** : cadré, prêt à exécuter. Aucun code écrit.
> **Origine** : décision de Fathi (2026-07-26) — la clé OpenAI est déjà active, le compte Perplexity API reste à créer. La recherche web est aujourd'hui **désactivée** en pratique (`PERPLEXITY_API_KEY` absente), ce qui éteint le 2e écran d'onboarding — le premier « waouh » du parcours.
> **Modèle conseillé : Opus 5.** Appel externe **facturé**, avec un risque d'emballement propre à OpenAI (voir « Pièges »). Ce n'est pas un simple adaptateur.
> **Effort : 1 journée.** Indépendant des chantiers C1–C12 ; peut se faire avant ou après la démo. À faire **avant C7** si on veut que l'enrichissement de prospect soit démontrable.

---

## 0. Prompt de lancement

**Avant de coller** — trois choses à vérifier côté Fathi, sinon le chantier ne peut pas s'auto-vérifier :

- [ ] `OPENAI_API_KEY` présente dans `.env.local` (elle l'est déjà).
- [ ] Repo propre et **poussé** (le chantier précédent est commité).
- [ ] Accepter qu'**une poignée d'appels facturés** seront faits pendant les tests (quelques centimes) — c'est le seul moyen de vérifier que les sources remontent vraiment.

À coller tel quel dans une nouvelle session :

```
Tu travailles sur le repo Nepteo (C:\dev\agent_marketing).

1. Lis CLAUDE.md et docs/SUIVI.md.
2. Lis docs/projets/roadmap-beta.md §2 (« Règles pour tout chantier —
   anti-erreurs IA ») : elles s'appliquent intégralement.
3. Exécute UNIQUEMENT le chantier décrit dans
   docs/projets/recherche-web-openai.md, en respectant à la lettre ses
   sections « Interdits » (§6), « Pièges spécifiques » (§7) et
   « Fichiers autorisés » (§8).
4. Vérifie la doc OpenAI en ligne AVANT de coder (§2 du chantier donne
   l'URL) : le nom du modèle à utiliser avec `web_search` et la
   tarification des outils intégrés ont pu changer. Ne code pas de
   mémoire.
5. À la fin : npm test + npx tsc --noEmit TERMINÉS (exit 0 explicite —
   un log vide n'est pas un vert ; sur ce montage `tsc` frôle les 43 s,
   relance plutôt que de conclure), entrée dans docs/SUIVI.md, commit,
   liste « Reste (Fathi) ».

Ne touche à rien hors du périmètre du chantier. Si quelque chose te
semble nécessaire hors périmètre, note-le dans SUIVI, ne le fais pas.
En particulier : ne supprime pas Perplexity, ne modifie pas
l'orchestration de runResearch, et ne fais entrer la recherche ni dans
lib/llm.ts ni dans une dépendance npm.
```

**Modèle conseillé : Opus 5** (cf. en-tête). Si le chantier est confié à Sonnet 5 et n'est pas vert après deux allers-retours, revenir au dernier commit propre et le relancer entier avec Opus 5 (règle d'escalade, `roadmap-beta.md` §1).

---

## 1. But

Rendre la recherche web **fonctionnelle avec la clé OpenAI déjà en place**, sans rien changer à la discipline qui l'entoure (cache, journal avant l'appel, plafonds serveur, RGPD).

**Ce n'est PAS un remplacement de Perplexity.** C'est l'ajout d'un second fournisseur derrière la même interface. Perplexity reste en place, prêt à être rallumé par une variable d'environnement le jour où le compte existe. Les deux doivent pouvoir coexister — c'est ce qui rend la décision réversible, donc peu coûteuse.

---

## 2. Ce que dit la doc OpenAI (vérifiée le 2026-07-26)

Source : <https://developers.openai.com/api/docs/guides/tools-web-search>

- L'outil s'appelle **`web_search`** et passe par la **Responses API** : `POST https://api.openai.com/v1/responses`, avec `tools: [{ "type": "web_search" }]`.
- La réponse contient deux choses utiles :
  - un item `output[]` de type **`web_search_call`**, dont `action.sources` liste **toutes** les URL consultées (à demander via `include: ["web_search_call.action.sources"]`) ;
  - un item `output[]` de type **`message`**, dont le `content[]` porte le texte et des annotations **`url_citation`** (`url`, `title`, positions).
- **`search_context_size`** (`low` / `medium` / `high`) borne la quantité de contexte web injectée avant génération. C'est le levier de coût le plus direct.
- **`filters.allowed_domains`** (jusqu'à 100 domaines, sans préfixe `https://`, sous-domaines inclus) permet de restreindre la recherche.
- **`return_token_budget`** : laisser le défaut. `unlimited` n'a de sens que pour de la deep research.

**Points de calendrier à ne pas rater** :

- `gpt-4o-search-preview` et `gpt-4o-mini-search-preview` sont **arrêtés depuis le 2026-07-23**. Ne pas les utiliser.
- `web_search_preview` est **legacy** : il ne supporte ni `filters`, ni `external_web_access`, ni `return_token_budget`. Utiliser `web_search`.
- Sur Chat Completions, l'équivalent est `gpt-5-search-api` (le modèle cherche **toujours** avant de répondre). **On ne prend pas ce chemin** : la Responses API donne les sources structurées et le contrôle du coût.

**À vérifier au moment de coder** (la doc bouge, ne pas recopier de mémoire) : le nom exact du modèle à utiliser avec `web_search`, et la tarification des outils intégrés sur <https://developers.openai.com/api/docs/pricing#built-in-tools>.

---

## 3. Pourquoi c'est un petit chantier

Toute la partie difficile est déjà écrite et ne bouge pas :

| Brique existante | Sort |
|---|---|
| `runResearch` (`lib/research/research.ts`) — cache → garde-fous → journal AVANT → appel → upsert + journal | **Inchangée**, sauf la ligne qui appelle le fournisseur |
| `guardResearch`, `subjectKey`, `isFresh`, `CACHE_DAYS`, `MAX_RESEARCH_PER_DAY` | **Inchangés** |
| Table `research_runs` + RLS (migration 0010, **passée**) | **Inchangée — aucune migration** |
| `buildCompanyQuery`, `buildProspectCompanyQuery` (RGPD inclus) | **Inchangées** |
| `renderResearch`, `ResearchAnswer`, `ResearchSource` | **Inchangés** |

C'est exactement le bénéfice de la décision du 25/07 (« la recherche vit hors de `lib/llm.ts` ») : changer de fournisseur ne touche qu'un adaptateur et un parseur.

---

## 4. À faire, dans l'ordre

### 4.1 — Parseur pur (`lib/research/research-rules.ts`, additif)

Ajouter **`parseOpenAiSearchResponse(payload: unknown): ResearchAnswer`**.

- Lit `output[]` : items `message` → `content[].text` pour le texte ; annotations `url_citation` **et** `web_search_call.action.sources` pour les sources.
- Réutilise `pushSource` (dédoublonnage par URL, bornage `MAX_SOURCES`, titre par défaut = URL) et `MAX_ANSWER_CHARS`.
- Ne lève jamais ; payload inexploitable ⇒ `{ text: "", sources: [] }`.

> ⚠️ **Ne pas essayer de faire avaler la forme OpenAI à `parseResearchResponse`.** Les deux formes se ressemblent (`output[]`, `type: "message"`, `content[].text`) au point que le parseur Perplexity extrairait *le texte* d'une réponse OpenAI — mais **pas les sources**, qui sont ailleurs. Une fusion « astucieuse » produirait des recherches sans source, silencieusement. Deux fonctions, deux jeux de tests.

Ajouter aussi la traduction de profondeur, **pure** :

```
openaiSearchContext(kind: ResearchKind): "low" | "medium" | "high"
```

`ResearchPreset` (`fast|low|medium|high|xhigh`) reste la notion **produit**, calée sur Perplexity. On ne la remplace pas : on la traduit au bord. Proposition de départ — `company_profile` → `medium`, `prospect_company` → `low`.

### 4.2 — Adaptateur (`lib/research/openai-search.ts`, nouveau)

Calqué **trait pour trait** sur `lib/research/perplexity.ts` :

- `fetch` natif, **aucune dépendance npm** (règle 3) ;
- `AbortSignal.timeout(45_000)`, `cache: "no-store"` ;
- **ne lève jamais** — tout ressort en `{ ok: false, reason }` ;
- en cas de `!response.ok`, **le statut seul** (`http_429`), jamais le corps d'erreur ;
- `reason` réutilise le vocabulaire existant : `no_key`, `empty_query`, `empty_answer`, `timeout`, `network_error`.

Corps de requête : `model`, `input` (la requête), `tools: [{ type: "web_search" }]`, `include: ["web_search_call.action.sources"]`, et `search_context_size` issu de `openaiSearchContext`.

### 4.3 — Sélecteur de fournisseur (`lib/research/provider.ts`, nouveau)

C'est le cœur de la réversibilité. Expose :

- `researchProvider(): "openai" | "perplexity" | null` — `RESEARCH_PROVIDER` si valide et sa clé présente ; sinon le premier fournisseur dont la clé existe ; sinon `null`.
- `researchConfigured(): boolean` — **déménage ici** depuis `perplexity.ts`.
- `askResearch({ kind, query })` — dispatche vers `askPerplexity` ou `askOpenAiSearch`.

**`researchConfigured` est importé depuis `@/lib/research/perplexity` en 4 endroits** — tous à mettre à jour, aucun autre :

```
lib/research/research.ts
app/onboarding/actions.ts
app/onboarding/identite/page.tsx
app/api/llm/status/route.ts
```

Garder un ré-export dans `perplexity.ts` serait plus rapide et **plus sale** : deux chemins pour la même question. On déplace franchement.

### 4.4 — Branchement (`lib/research/research.ts`)

Une seule substitution : `askPerplexity({ query, preset: RESEARCH_PRESETS[kind] })` devient `askResearch({ kind, query })`. **Rien d'autre ne bouge dans ce fichier** — ni l'ordre cache/garde/journal, ni l'upsert, ni les événements.

### 4.5 — Observabilité

- `GET /api/llm/status` : `research` passe de `{ perplexity: boolean }` à `{ provider, perplexity, openai }` (présence des clés, **jamais leur valeur**).
- Le journal gagne le fournisseur dans le `payload` de `research_started` / `research_succeeded` / `research_failed`. **Ne pas créer de nouvel événement** : les libellés de `lib/journal.ts` restent tels quels.

### 4.6 — Documentation

- **`docs/DECISIONS.md`** : l'entrée ADR est **déjà écrite** (2026-07-26). La compléter si le chantier tranche autrement.
- `CLAUDE.md` § Stack : une ligne sur les deux fournisseurs et `RESEARCH_PROVIDER`.
- `docs/demo/GUIDE-TEST.md` : le 2e écran d'onboarding **redevient visible** dès qu'une clé est présente — vérifier que le guide le décrit encore correctement.

---

## 5. Variables d'environnement (mandat explicite — règle 3)

| Variable | Obligatoire | Rôle |
|---|---|---|
| `OPENAI_API_KEY` | oui (déjà présente) | Réutilisée telle quelle. **Ne pas en créer une seconde.** |
| `RESEARCH_PROVIDER` | non | `openai` ou `perplexity`. Absente ⇒ détection par présence de clé. |
| `RESEARCH_OPENAI_MODEL` | non | Modèle de recherche, avec un défaut en dur dans le code. Permet de suivre les sorties de modèles sans redéployer. |
| `PERPLEXITY_API_KEY`, `PERPLEXITY_PRESET` | non | Inchangées. |

**Aucune migration. Aucune dépendance npm. Aucune table.**

---

## 6. Interdits

1. **Ne pas supprimer `lib/research/perplexity.ts`** ni `PERPLEXITY_PRESET`. Le but est d'avoir deux fournisseurs, pas d'en troquer un contre l'autre.
2. **Ne pas toucher à l'orchestration de `runResearch`** : ordre cache → garde-fous → journal AVANT → appel → upsert, plafonds, mise en cache des échecs. C'est un invariant volontaire (`docs/DECISIONS.md`, 2026-07-25).
3. **Ne pas faire entrer la recherche dans `lib/llm.ts`.** La décision du 25/07 tient : chercher ≠ rédiger. Ne pas ajouter de tâche `LLM_TASKS` pour la recherche, ne pas passer par le Vercel AI SDK pour cet appel.
4. **Ne pas élargir le périmètre RGPD** : les requêtes continuent d'interdire les informations sur des personnes physiques. Ne pas ajouter de recherche sur un contact nommé.
5. **Ne pas modifier `parseResearchResponse`** (forme Perplexity) — additif seulement.
6. **Ne pas utiliser** `web_search_preview`, `gpt-4o-search-preview`, `gpt-4o-mini-search-preview` (legacy / arrêtés), ni le chemin Chat Completions.
7. **Ne pas déclencher de recherche automatique.** Elle reste explicite et facturée (`draftForProspect(..., enrich)` garde son défaut `false`).
8. Aucune migration, aucune dépendance npm, aucune table (règle 3 de `roadmap-beta.md`).

---

## 7. Pièges spécifiques

- **Une requête ≠ une recherche facturée.** C'est le piège n°1, et il est propre à OpenAI. En mode agentique, un modèle de raisonnement peut enchaîner **plusieurs dizaines** de recherches dans un seul appel, chacune facturée. Le plafond `MAX_RESEARCH_PER_DAY = 30` compte des *appels `runResearch`*, pas des *recherches OpenAI* — il ne protège donc plus le budget de la même façon qu'avec Perplexity. **Conséquence à assumer dans le chantier** : viser un comportement borné (`search_context_size` bas, pas de raisonnement élevé) et **le vérifier sur un appel réel** avant de conclure. Si le nombre de `web_search_call` par requête n'est pas maîtrisable, le dire dans SUIVI plutôt que de laisser le plafond mentir.
- **Sources vides = régression silencieuse.** Sans `include: ["web_search_call.action.sources"]`, la réponse reste plausible mais l'écran d'identité perd ses sources cliquables — or « le diagnostic doit être contestable » est un principe du produit. Tester explicitement qu'au moins une source remonte.
- **`empty_answer` doit rester un échec.** `askPerplexity` renvoie `{ ok: false, reason: "empty_answer" }` quand le texte est vide. Garder ce contrat : sinon on met en cache une recherche vide pendant 30 jours.
- **Les échecs sont mis en cache exprès** (invariant, `docs/SUIVI.md` § Pièges connus). Ne pas « réparer » ce comportement en découvrant qu'une clé invalide n'est pas retentée.
- **Le 2e écran d'onboarding se rallume tout seul** dès que `researchConfigured()` devient vrai. C'est l'effet recherché, mais c'est un changement **visible en démo** : dérouler le parcours `signup → philosophie → écran identité → proposition → correction → /entreprise` avant de considérer le chantier fini.
- **Coût du test.** Chaque essai est facturé. Utiliser une vraie entreprise et **laisser jouer le cache** (le même sujet ne repaie pas dans les 30 jours) ; `force: true` ne s'utilise qu'à bon escient.
- **UTF-8** : les requêtes sont en français et accentuées. Vérifier que le texte revient propre (pas de mojibake) avant de l'écrire dans `research_runs`.

---

## 8. Fichiers autorisés

```
lib/research/research-rules.ts     (additif : parseOpenAiSearchResponse, openaiSearchContext)
lib/research/openai-search.ts      (nouveau)
lib/research/provider.ts           (nouveau)
lib/research/perplexity.ts         (retrait de researchConfigured uniquement)
lib/research/research.ts           (une ligne : askResearch)
app/onboarding/actions.ts          (import)
app/onboarding/identite/page.tsx   (import)
app/api/llm/status/route.ts        (import + forme de `research`)
tests/research.test.mjs            (cas ajoutés)
CLAUDE.md · docs/DECISIONS.md · docs/SUIVI.md · docs/demo/GUIDE-TEST.md
```

Tout fichier hors de cette liste qui s'avérerait indispensable doit être **signalé dans le rendu**, pas modifié en silence (règle 2).

---

## 9. Critères d'acceptation

- [ ] Avec `OPENAI_API_KEY` seule : `GET /api/llm/status` → `research.provider = "openai"`, et le 2e écran d'onboarding est **accessible**.
- [ ] Une recherche réelle sur une entreprise existante renvoie un texte **et au moins une source cliquable** ; la ligne `research_runs` porte `status = 'ok'` et un `sources` non vide.
- [ ] **Idempotence du cache** : relancer la même recherche ne crée **aucun** appel OpenAI (vérifiable au journal : pas de second `research_started`).
- [ ] Le journal montre `research_started` **avant** `research_succeeded`, avec le fournisseur dans le payload.
- [ ] Le bouton d'arrêt (pause org) **bloque** la recherche (`research_blocked`, reason `paused`).
- [ ] Avec `RESEARCH_PROVIDER=perplexity` et sans clé Perplexity : dégradation propre (`no_key`), aucun écran cassé.
- [ ] Sans aucune clé : comportement d'aujourd'hui à l'identique (onboarding qui saute l'étape).
- [ ] **Nombre de `web_search_call` par requête mesuré et consigné** dans SUIVI (cf. Pièges).
- [ ] `npm test` vert, total ajusté et consigné ; `npx tsc --noEmit` **exit 0 explicite** (viser `timeout 43`, cf. SUIVI § Pièges connus).

---

## 10. Hors périmètre — à ne pas faire ici

- **Génération d'images** (<https://platform.openai.com/playground/images>). Sujet distinct, déjà cadré dans **`docs/projets/generation-creative-ia.md`** (l'agent produit le visuel fini, pas seulement le brief — Phase 4). Ne pas mélanger : un chantier « recherche » et un chantier « création » n'ont ni les mêmes garde-fous, ni le même risque, ni le même modèle de validation.
- Le **diagnostic public** (C11) reste **sans recherche web** — coût par requête non plafonnable sur une page publique. La variante « collez votre URL » viendra plus tard, derrière un cap strict.
- Remplacer Perplexity partout / le supprimer.
