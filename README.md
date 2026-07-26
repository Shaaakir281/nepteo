# Nepteo — Cockpit Growth

Copilote marketing IA pour PME et solopreneurs : comprendre, décider et agir en quelques clics.

## Démarrage

Prérequis : Node.js 22+, un projet [Supabase](https://supabase.com) (région EU), une clé LLM (OpenAI et/ou Anthropic).

```bash
npm install
cp .env.example .env.local   # puis remplir les clés
npm run dev
```

Base de données : exécuter `supabase/migrations/0001_init.sql` dans l'éditeur SQL Supabase (ou via `supabase db push` avec la CLI).

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

- **CI** (`.github/workflows/ci.yml`) : lint + typecheck + build sur chaque PR et push `main`.
- **Deploy** (`.github/workflows/deploy.yml`) : lancement manuel protégé pour le premier déploiement → image immutable dans ACR → Azure Container Apps (région EU).
- **Mode opératoire complet** : [docs/DEPLOIEMENT-AZURE.md](docs/DEPLOIEMENT-AZURE.md), avec verrou compte/tenant/souscription, Bicep, OIDC, variables, Supabase Auth et smoke test.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — modules et principes non négociables
- [Roadmap](docs/ROADMAP.md) — 5 phases avec portes go/no-go
- [Décisions](docs/DECISIONS.md) — décisions ouvertes et actées
