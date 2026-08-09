# Nepteo — Cockpit Growth

Copilote marketing IA pour PME et solopreneurs : comprendre, décider et agir en quelques clics.

## Démarrage

Prérequis : Node.js 22+, un projet [Supabase](https://supabase.com) (région EU), une clé LLM (OpenAI et/ou Anthropic).

```bash
npm install
cp .env.example .env.local   # puis remplir les clés
npm run dev
```

Base de données : appliquer **toutes** les migrations de `supabase/migrations/` dans l'ordre, idéalement avec `supabase db push`. La dernière release applicative attestée dans la documentation utilisait le schéma `21` ; le projet Supabase lié `hrqnzorapjnosjphftur` est désormais vérifié à `28` après `0022 → 0028`, sans que cela atteste le déploiement de l'application fusionnée. Le contrôle en lecture seule du 2026-08-09 confirme les deux tables créatives, le bucket privé et les cinq RPC de génération, sélection et nettoyage. Pour tout autre environnement, `0028` doit d'abord être exécutée sur une base Supabase de staging/recette distincte au schéma 27, puis y passer les smokes RLS/JWT, quotas et concurrence, bucket privé, réconciliation pending/cron et validation atomique. Ne jamais déployer une version applicative sans ses migrations associées ni modifier le marqueur à la main.

Dernier état fonctionnel déployé attesté : R1A ajoute la preuve terrain structurée dans `value_events` et fige les cohortes de relance à l'approbation ; R1B limite « Aujourd'hui » aux cinq actions les plus proches de la valeur, avec une raison explicite. Le play R2 « prospects dormants » reste supervisé. C7 demeure fermé et aucun envoi externe n'est activé. CAMP-0/1/2, CONN-0/1 et META-READ sont fusionnés dans `main`, tandis que le design allégé et la Story campagne-first restent locaux ; leur disponibilité en ligne doit être attestée séparément.

Dernier état de production attesté dans la documentation, au 2026-07-31 : la PR [#17](https://github.com/Shaaakir281/nepteo/pull/17) a livré le SHA applicatif `704efabd80de434ea2619cd993ae87427c114838`. Azure sert l'image immutable `nepteoacr27de3b.azurecr.io/nepteo:704efabd80de434ea2619cd993ae87427c114838`, digest `sha256:fe6cafbe991c45952262e33be965e4ba09239ff421a86dce80231117a3504425`, sur la révision `nepteo-prod--0000011` avec 100 % du trafic. `/`, `/api/health` et `/api/ready` répondent HTTP 200 ; le contrôle navigateur de surface est vert.

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
- **Deploy** (`.github/workflows/deploy.yml`) : lancement manuel protégé ; pour le lot créatif local, préflight du schéma Supabase `>= 28` avant toute mutation Azure → image immutable dans ACR → Azure Container Apps (région EU) → contrôles `/api/health` et `/api/ready`.
- **Mode opératoire complet** : [docs/DEPLOIEMENT-AZURE.md](docs/DEPLOIEMENT-AZURE.md), avec verrou compte/tenant/souscription, Bicep, OIDC, variables, Supabase Auth et smoke test.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — modules et principes non négociables
- [Roadmap](docs/ROADMAP.md) — 5 phases avec portes go/no-go
- [Décisions](docs/DECISIONS.md) — décisions ouvertes et actées
- [Audit du 29 juillet 2026](docs/AUDIT-2026-07-29.md) — valeur, risques, priorités et état de preuve
- [Scorecard commanditaire](docs/tests/SCORECARD-COMMANDITAIRE.md) — protocole commun pour les tests
