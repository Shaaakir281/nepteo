# Procédure de test — connecteurs & Phase 2

Jeu de données : `docs/tests/prospects-test.csv` (24 prospects, 5 sans email, statuts variés — conçu pour déclencher les 2 règles d'analyse).

## 0. Prérequis (une fois)

1. **Migration** : ouvrir `supabase/migrations/0002_prospects.sql` dans VS Code → tout copier → Supabase → SQL Editor → coller → **Run**. (« Success. No rows returned » = table `prospects` créée.)
2. **`CONNECTOR_TOKEN_ENCRYPTION_KEY` et `CRON_SECRET`** : ces clés ne se « trouvent » nulle part — **c'est toi qui les fabriques**. Ouvre PowerShell et lance **deux fois** :

   ```powershell
   $b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```

   Chaque exécution affiche une chaîne aléatoire : colle la 1re comme valeur de `CONNECTOR_TOKEN_ENCRYPTION_KEY=`, la 2de comme `CRON_SECRET=`. Ne plus jamais changer la clé de chiffrement ensuite (sinon les connecteurs devront être reconnectés).
3. **Clé IA — tests avec OpenAI** (pas encore de clé Anthropic) : la couche LLM est multi-fournisseurs, il suffit d'ajouter dans `.env.local` :

   ```
   OPENAI_API_KEY=sk-...
   LLM_MODEL=openai:gpt-5.4
   LLM_MODEL_LIGHT=openai:gpt-5.4
   LLM_MODEL_PREMIUM=openai:gpt-5.4
   ```

   (L'analyse utilise la tâche `recommend_action` → niveau premium, d'où les 3 lignes. Quand tu prendras une clé Anthropic : supprime les 3 lignes `LLM_MODEL*`, les défauts Claude reprennent.) Sans aucune clé, l'analyse fonctionne quand même avec des textes templates.
4. Redémarrer `npm run dev` après toute modif d'env.

## 1. Fausse base Google Sheets

1. [sheets.new](https://sheets.new) → Fichier → Importer → Importer un fichier → `prospects-test.csv` → « Remplacer la feuille ».
2. **Google Cloud** ([console.cloud.google.com](https://console.cloud.google.com), projet créé, Sheets API activée) — deux étapes, dans cet ordre :

   **a) Écran de consentement** (obligatoire avant de créer l'ID client) — menu gauche « Écran de consentement OAuth » (parfois « Google Auth Platform » → Commencer) :
   - Nom de l'application : `Nepteo (dev)` · Adresse d'assistance : ton email → Continuer
   - Audience / Type d'utilisateur : **Externe** → Continuer
   - Coordonnées : ton email → Continuer → Accepter → **Créer** (rien d'autre à remplir, pas de scopes à ajouter)
   - Puis section « Audience » (ou « Test users ») → **+ Add users** → `fathimetalsi@gmail.com` → Enregistrer. L'app reste « En mode test » : normal, seul ton email pourra se connecter.

   **b) ID client** — menu « Identifiants » (ou « Clients ») → **+ Créer des identifiants** → **ID client OAuth** :
   - Type : **Application Web** · Nom : `Nepteo dev`
   - « URI de redirection autorisés » → + Ajouter un URI → `http://localhost:3001/api/connectors/google_sheets/callback` → **Créer**
   - Une fenêtre affiche l'**ID client** et le **code secret** : copie-les tout de suite dans `.env.local`.
3. Copier dans `.env.local` : `GOOGLE_OAUTH_CLIENT_ID=` et `GOOGLE_OAUTH_CLIENT_SECRET=`.
4. Dans Nepteo : Connecteurs → Google Sheets → **Connecter** → autoriser → coller l'URL du classeur → Enregistrer → **Synchroniser maintenant**.

## 2. Fausse base Notion

1. Dans Notion : nouvelle page → `/table` → base de données pleine page → Fusionner avec CSV (ou importer `prospects-test.csv` : … → Merge with CSV). Vérifier les propriétés : Nom (Titre), Email (**type Email**), Entreprise (Texte), Statut (**Select**).
2. [notion.so/my-integrations](https://www.notion.so/my-integrations) → Nouvelle intégration → type **Public** →
   Redirect URI : `http://localhost:3001/api/connectors/notion/callback` → récupérer client ID + secret.
3. `.env.local` : `NOTION_OAUTH_CLIENT_ID=` et `NOTION_OAUTH_CLIENT_SECRET=`.
4. Nepteo : Connecteurs → Notion → **Connecter** → dans l'écran Notion, **sélectionner la page/base à partager** → choisir la base dans Nepteo → Enregistrer → Synchroniser.

## 3. Parcours de validation Phase 2

1. Vue **Prospects** : 24 lignes, funnel par statut + **repère de priorité** — résumé en tête (À relancer en priorité **15** · Fiche à compléter **5** · En veille **4**) et un badge par carte (survol = la raison). Le signal se calcule sur le **statut + la complétude** (email, entreprise), sans score inventé.
2. **Aujourd'hui** → « Analyser mes données maintenant » → **3 propositions** attendues :
   compléter 5 emails manquants + relancer le groupe « Nouveau » (9) + **relancer en priorité les 15 prospects prêts** (joignables ET à un statut actif — ni « Client » ni « Perdu »).
3. Examiner une action (constat/raison/impact/confiance/risque/sources) → **Valider** une, **Refuser** une, **Reporter** la troisième, puis la **Reprendre** depuis « Décisions récentes ».
4. **Journal** : vérifier `connector_connected`, `connector_synced`, `action_proposed` (acteur agent), `action_approved/rejected` (acteur vous).
5. Cron local : `Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/cron/sync" -Headers @{Authorization="Bearer TON_CRON_SECRET"}` → nouvelle entrée journal `mode: auto`.

## 4. Langfuse (observabilité LLM) — optionnel

Chaque appel LLM porte déjà un `functionId` par tâche (`recommend_action`, etc.) via le champ `telemetry`. Pour voir les traces dans Langfuse (**AI SDK 7**) :

1. **Paquets** (Node ≥ 22) : `npm i @langfuse/otel @langfuse/vercel-ai-sdk @opentelemetry/sdk-node`
2. **`.env.local`** : `LANGFUSE_PUBLIC_KEY=pk-lf-...`, `LANGFUSE_SECRET_KEY=sk-lf-...`, et pour l'hébergement **EU** `LANGFUSE_BASE_URL=https://cloud.langfuse.com` (⚠️ `LANGFUSE_BASE_URL` **avec underscore** dans le nouveau SDK, plus `LANGFUSE_BASEURL`).
3. Redémarrer `npm run dev`, lancer une analyse (§3.2) → une trace `recommend_action` apparaît dans Langfuse.

Sans paquets ni clés : aucun impact, l'app tourne normalement (no-op silencieux, imports dynamiques).

**Branchement (v7)** : `instrumentation.ts` appelle `registerObservability` (`lib/observability.ts`) qui, si les clés sont là, démarre un `NodeSDK` avec `LangfuseSpanProcessor` (`@langfuse/otel`) puis `registerTelemetry(new LangfuseVercelAiSdkIntegration())` (`@langfuse/vercel-ai-sdk`). ⚠️ L'ancienne voie `@vercel/otel` + `LangfuseExporter` (`langfuse-vercel`) **ne capte plus** les spans de l'AI SDK 7 — ne pas y revenir.

**Si aucune trace n'arrive** : activer `LANGFUSE_LOG_LEVEL=DEBUG`. Des spans OTel dans les logs mais rien dans Langfuse → vérifier clés + `LANGFUSE_BASE_URL` (et, en serverless, un `forceFlush()` avant fin de fonction). Aucun span → l'instrumentation ne s'est pas chargée avant le code applicatif.

## Et en production ?

**Un seul projet Google / une seule intégration Notion pour TOUS les clients.** Les clients ne créent rien : ils cliquent « Connecter » et autorisent Nepteo sur leur propre compte. Avant la mise en prod, une fois :

1. Google : ajouter l'URI de redirection de prod (`https://<domaine>/api/connectors/google_sheets/callback`), puis **publier l'app et passer la validation Google** (scope Sheets = sensible : politique de confidentialité en ligne + domaine vérifié requis, compter quelques jours). Tant que l'app est « en test » : max 100 testeurs déclarés.
2. Notion : ajouter l'URI de prod et soumettre l'intégration publique à l'approbation Notion.
3. Reporter `GOOGLE_*`/`NOTION_*`/`CRON_SECRET`/`CONNECTOR_TOKEN_ENCRYPTION_KEY` dans la config du Container App Azure (jamais dans l'image).

## Dépannage rapide

- **redirect_uri_mismatch** (Google) : l'URI déclarée doit être exactement `http://localhost:3001/...` (port compris).
- **403 Google** : Sheets API non activée, ou ton email absent des testeurs de l'écran de consentement.
- **« Aucune base visible » (Notion)** : la base n'a pas été partagée avec l'intégration lors de l'OAuth — relancer Connecter et cocher la page.
- **« Lecture impossible »** : vérifier `CONNECTOR_TOKEN_ENCRYPTION_KEY` inchangée depuis la connexion (sinon déconnecter/reconnecter).
- Erreur `&&` PowerShell : utiliser `;` comme séparateur.
