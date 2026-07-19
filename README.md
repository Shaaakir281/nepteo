# Nepteo — Cockpit Growth

Copilote marketing IA pour PME et solopreneurs : comprendre, décider et agir en quelques clics.

## Démarrage

Prérequis : Node.js 20+, un projet [Supabase](https://supabase.com) (région EU), une clé API Anthropic.

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
- **Deploy** (`.github/workflows/deploy.yml`) : push `main` → build image dans ACR → déploiement Azure Container Apps (région EU).

Prérequis à configurer une fois côté Azure/GitHub :

1. ACR + Container App créés (adapter `ACR_NAME`, `RESOURCE_GROUP`, `CONTAINER_APP` dans deploy.yml).
2. App registration avec federated credential OIDC sur ce repo → secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
3. Variables repo `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Secrets runtime (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`…) : dans la config du Container App, pas dans l'image.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — modules et principes non négociables
- [Roadmap](docs/ROADMAP.md) — 5 phases avec portes go/no-go
- [Décisions](docs/DECISIONS.md) — décisions ouvertes et actées
