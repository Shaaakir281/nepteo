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

État de production au 2026-07-30 : la PR [#5](https://github.com/Shaaakir281/nepteo/pull/5) a été fusionnée dans `main` au commit `73f7e79`. Azure sert l'image immutable correspondante, révision `nepteo-prod--0000003`, avec 100 % du trafic. `/`, `/api/health` et `/api/ready` répondent HTTP 200. Le smoke public navigateur est propre ; le smoke authentifié/RLS et les callbacks OAuth restent à recetter.

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
