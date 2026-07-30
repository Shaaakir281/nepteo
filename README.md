# Nepteo — Cockpit Growth

Copilote marketing IA pour PME et solopreneurs : comprendre, décider et agir en quelques clics.

## Démarrage

Prérequis : Node.js 22+, un projet [Supabase](https://supabase.com) (région EU), une clé LLM (OpenAI et/ou Anthropic).

```bash
npm install
cp .env.example .env.local   # puis remplir les clés
npm run dev
```

Base de données : appliquer **toutes** les migrations de `supabase/migrations/` dans l'ordre, idéalement avec `supabase db push`. La vague `0012` à `0020` a été appliquée manuellement à la production Supabase le 2026-07-30 ; `app_schema_version = 20` y est enregistré depuis `2026-07-30T06:02:14Z`. Le lot local suivant ajoute `0021_atomic_csv_import.sql` et exige donc le schéma 21 avant déploiement. Ne pas déployer une version applicative sans ses migrations associées.

État fonctionnel déployé : R1A ajoute la preuve terrain structurée dans `value_events` et fige les cohortes de relance à l'approbation ; R1B limite « Aujourd'hui » aux cinq actions les plus proches de la valeur, avec une raison explicite. Le play R2 « prospects dormants » reste supervisé et ne déclenche aucun envoi externe.

État de production au 2026-07-30 : les lots cohortes puis vitrine ont été fusionnés jusqu'à la PR [#11](https://github.com/Shaaakir281/nepteo/pull/11). Azure sert l'image immutable `a2bbc34dcb97ab00951a3efa631c4f7c0a0428ca`, révision `nepteo-prod--0000007`, avec 100 % du trafic. `/`, `/api/health` et `/api/ready` répondent HTTP 200. L'organisation actuellement présentée aux commanditaires est un **environnement de test** ; le smoke RLS et les mutations inter-tenants utilisent toujours des organisations de recette dédiées.

Deux voies de test sont possibles, mais jamais simultanément dans une organisation : **(A)** l'un des trois scénarios Nepteo V2 certifiés, seul cas affiché comme « données fictives » ; **(B)** des données autorisées apportées par le testeur via connecteur ou fichier CSV, affichées comme « environnement de test ». Il faut retirer le scénario avant tout import et les événements fictifs restent exclus des preuves terrain. Le CSV V1 exige UTF-8, accepte au plus 900 Ko et 5 000 lignes, détecte sans réutiliser une colonne les six champs utiles, ignore les autres colonnes, conserve des identifiants stables et remplace ou retire l'import dans une RPC PostgreSQL atomique, verrouillée et journalisée.

Validation locale de ce lot : **359/359 tests**, typecheck, lint et build Next.js de production (24 pages/routes) verts. La migration `0021` doit encore être appliquée et recettée avant la promotion de l'application.

Lot déployé : les lectures prospects partagent une cohorte complète, les conflits multi-source sont réconciliés prudemment et les snapshots de relance restent stables pendant les synchronisations. L'interface distingue les 24 contacts regroupés pour la lecture des 29 identités conservées par prudence pour les décisions. Validation de référence de cette release : **341/341 tests**, lint, typecheck et build de production (23 pages/routes) verts.

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

Ce chemin a promu le lot schéma 20 en production le 2026-07-30.

- **CI** (`.github/workflows/ci.yml`) : tests + lint + typecheck + build sur chaque PR et push `main`.
- **Deploy** (`.github/workflows/deploy.yml`) : lancement manuel protégé ; préflight du schéma Supabase avant toute mutation Azure → image immutable dans ACR → Azure Container Apps (région EU) → contrôles `/api/health` et `/api/ready`.
- **Mode opératoire complet** : [docs/DEPLOIEMENT-AZURE.md](docs/DEPLOIEMENT-AZURE.md), avec verrou compte/tenant/souscription, Bicep, OIDC, variables, Supabase Auth et smoke test.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — modules et principes non négociables
- [Roadmap](docs/ROADMAP.md) — 5 phases avec portes go/no-go
- [Décisions](docs/DECISIONS.md) — décisions ouvertes et actées
- [Audit du 29 juillet 2026](docs/AUDIT-2026-07-29.md) — valeur, risques, priorités et état de preuve
- [Scorecard commanditaire](docs/tests/SCORECARD-COMMANDITAIRE.md) — protocole commun pour les tests
