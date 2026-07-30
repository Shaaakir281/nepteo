# Nepteo — Cockpit Growth

Copilote marketing IA pour PME et solopreneurs : comprendre, décider et agir en quelques clics.

## Démarrage

Prérequis : Node.js 22+, un projet [Supabase](https://supabase.com) (région EU), une clé LLM (OpenAI et/ou Anthropic).

```bash
npm install
cp .env.example .env.local   # puis remplir les clés
npm run dev
```

Base de données : appliquer **toutes** les migrations de `supabase/migrations/` dans l'ordre, idéalement avec `supabase db push`. La vague `0012` à `0020` a été appliquée manuellement à la production Supabase le 2026-07-30 ; `app_schema_version = 20` y est enregistré depuis `2026-07-30T06:02:14Z`. Ne pas déployer une version applicative sans ses migrations associées.

État fonctionnel déployé : R1A ajoute la preuve terrain structurée dans `value_events` et fige les cohortes de relance à l'approbation ; R1B limite « Aujourd'hui » aux cinq actions les plus proches de la valeur, avec une raison explicite. Le play R2 « prospects dormants » reste supervisé et ne déclenche aucun envoi externe.

État de production au 2026-07-30 : les PR [#7](https://github.com/Shaaakir281/nepteo/pull/7), [#8](https://github.com/Shaaakir281/nepteo/pull/8) et [#9](https://github.com/Shaaakir281/nepteo/pull/9) ont été fusionnées dans `main`. Azure sert l'image immutable `5d03f109e9d06c456781d72c2c0b5ab13eca1a4c`, révision `nepteo-prod--0000006`, avec 100 % du trafic. `/`, `/api/health` et `/api/ready` répondent HTTP 200. L'organisation actuellement présentée aux commanditaires reste volontairement une vitrine alimentée par des données fictives ; le smoke RLS, les callbacks OAuth et les parcours avec mutation se jouent dans des organisations de recette séparées.

Lot livré : les lectures prospects partagent une cohorte complète, les conflits multi-source sont réconciliés prudemment et les snapshots de relance restent stables pendant les synchronisations. L'interface distingue désormais les 24 contacts regroupés pour la lecture des 29 identités conservées par prudence pour les décisions. Les données de la vitrine sont conservées pour illustrer l'agent ; les connexions réelles restent désactivées dans cette organisation afin de ne jamais mélanger fictif et réel. Validation de référence : **341/341 tests**, lint, typecheck et build de production (23 pages/routes) verts.

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
