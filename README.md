# Nepteo — Cockpit Growth

Copilote marketing IA pour PME et solopreneurs : comprendre, décider et agir en quelques clics.

## Démarrage

Prérequis : Node.js 22+, un projet [Supabase](https://supabase.com) (région EU), une clé LLM (OpenAI et/ou Anthropic).

```bash
npm install
cp .env.example .env.local   # puis remplir les clés
npm run dev
```

Base de données : appliquer **toutes** les migrations de `supabase/migrations/` dans l'ordre, idéalement avec `supabase db push`. La production attestée porte aujourd'hui les migrations `0012` à `0021` et `app_schema_version = 21`. REL-0 est seulement local : il ajoute `0022` à `0027` et l'application locale exige le schéma `27`. Avant sa publication, appliquer exactement `0022 → 0023 → 0024 → 0025 → 0026 → 0027`, contrôler `app_schema_version = 27`, puis seulement déployer l'application. Ne jamais déployer une version applicative sans ses migrations associées ni modifier le marqueur à la main.

État fonctionnel déployé : R1A ajoute la preuve terrain structurée dans `value_events` et fige les cohortes de relance à l'approbation ; R1B limite « Aujourd'hui » aux cinq actions les plus proches de la valeur, avec une raison explicite. Le play R2 « prospects dormants » reste supervisé. C7 demeure fermé et aucun envoi externe n'est activé.

État de production au 2026-07-31 : la PR [#13](https://github.com/Shaaakir281/nepteo/pull/13) a livré le SHA applicatif `813d2e0f3d49f19ec4d2c5094fe1e5f95af281ae`, qui est celui déployé. Azure sert l'image immutable `nepteoacr27de3b.azurecr.io/nepteo:813d2e0f3d49f19ec4d2c5094fe1e5f95af281ae`, digest `sha256:73b9566dcdafe12d01b472fa02c7ed1108bf042f7154631ec9ed01fa9283eca9`, sur la révision `nepteo-prod--0000008` avec 100 % du trafic. `/`, `/api/health` et `/api/ready` répondent HTTP 200 ; le contrôle navigateur de surface est vert.

Deux voies de test sont possibles, mais jamais simultanément dans une organisation : **(A)** l'un des trois scénarios Nepteo V2 certifiés, seul cas affiché comme « données fictives » ; **(B)** des données autorisées apportées par le testeur via connecteur ou fichier CSV, affichées comme « environnement de test ». Il faut retirer le scénario avant tout import et les événements fictifs restent exclus des preuves terrain. Le CSV V1 exige UTF-8, accepte au plus 900 Ko et 5 000 lignes, détecte sans réutiliser une colonne les six champs utiles, ignore les autres colonnes, conserve des identifiants stables et remplace ou retire l'import dans une RPC PostgreSQL atomique, verrouillée et journalisée.

Validation de ce lot : **359/359 tests**, typecheck, lint et build Next.js de production (24 pages/routes) verts. La migration `0021` est appliquée ; ses RPC CSV ont été recettées réellement le 2026-07-31 sur les fixtures synthétiques dédiées `E2E_RLS_CSV_OWN` et `E2E_RLS_CSV_OTHER` : refus inter-tenant, import, rollback tardif, rejeu idempotent et retrait sont verts.

Jalon historique du 2026-07-30 : le lot précédent partageait déjà une cohorte complète entre les lectures prospects, réconciliait prudemment les conflits multi-source et stabilisait les snapshots de relance pendant les synchronisations. L'interface distinguait les 24 contacts regroupés pour la lecture des 29 identités conservées par prudence pour les décisions. Sa validation de référence comptait **341/341 tests**, lint, typecheck et build de production (23 pages/routes) verts.

## Structure

```
app/                  App Router (pages, API)
lib/                  clients supabase & claude, types domaine
supabase/migrations/  schéma SQL
docs/                 ARCHITECTURE, ROADMAP, DECISIONS
CLAUDE.md             instructions projet pour Claude Code
```

## Docker

```bash
docker build -t nepteo \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... .
docker run -p 3000:3000 --env-file .env.local nepteo
```

## Déploiement (GitHub → Azure)

Le workflow a promu le lot schéma 20 le 2026-07-30. La release schéma 21 issue de la PR #13 a été promue le 2026-07-31 avec les mêmes contrôles, par build ACR puis mise à jour directe de Container Apps.

- **CI** (`.github/workflows/ci.yml`) : tests + lint + typecheck + build sur chaque PR et push `main`.
- **Deploy** (`.github/workflows/deploy.yml`) : lancement manuel protégé ; pour REL-0, préflight du schéma Supabase `>= 27` avant toute mutation Azure → image immutable dans ACR → Azure Container Apps (région EU) → contrôles `/api/health` et `/api/ready`.
- **Mode opératoire complet** : [docs/DEPLOIEMENT-AZURE.md](docs/DEPLOIEMENT-AZURE.md), avec verrou compte/tenant/souscription, Bicep, OIDC, variables, Supabase Auth et smoke test.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — modules et principes non négociables
- [Roadmap](docs/ROADMAP.md) — 5 phases avec portes go/no-go
- [Décisions](docs/DECISIONS.md) — décisions ouvertes et actées
- [Audit du 29 juillet 2026](docs/AUDIT-2026-07-29.md) — valeur, risques, priorités et état de preuve
- [Scorecard commanditaire](docs/tests/SCORECARD-COMMANDITAIRE.md) — protocole commun pour les tests
