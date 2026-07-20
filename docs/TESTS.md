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

1. Vue **Prospects** : 24 lignes, chips de répartition par statut (dont « email manquant » sur 5).
2. **Aujourd'hui** → « Analyser mes données maintenant » → 2 propositions attendues :
   compléter 5 emails manquants + relancer le groupe « Nouveau » (9).
3. Examiner une action (constat/raison/impact/confiance/risque/sources) → **Valider** une, **Refuser** l'autre.
4. **Journal** : vérifier `connector_connected`, `connector_synced`, `action_proposed` (acteur agent), `action_approved/rejected` (acteur vous).
5. Cron local : `Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/cron/sync" -Headers @{Authorization="Bearer TON_CRON_SECRET"}` → nouvelle entrée journal `mode: auto`.

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
