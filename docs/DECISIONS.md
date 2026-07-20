# Décisions

## Ouvertes (à trancher avec Charly avant Phase 2)

| # | Décision | Enjeu | Statut |
|---|----------|-------|--------|
| 1 | **Client pilote** | Critique — ses outils déterminent les premiers connecteurs à construire | À trancher |
| 2 | File de jobs : pg-boss vs BullMQ | pg-boss = pas d'infra Redis ; BullMQ = plus riche — à trancher au moment du sync des connecteurs | À trancher |
| 4 | Niveau d'autonomie par défaut au lancement | Confiance client vs valeur démontrée | À trancher |

## Actées

| Date | Décision | Raison |
|------|----------|--------|
| 2026-07 | Positionnement entre expert et grand public ; règle vocabulaire (standard gardé, jargon plateforme coupé) | Résolution tension V2 Charly vs mémo |
| 2026-07 | Stack : Next.js + Supabase EU + Claude API + OAuth officiels | Simplicité, RGPD, un seul déploiement |
| 2026-07 | Validation humaine par défaut ; exécution directe seulement si réversible et faible risque | Cœur du produit |
| 2026-07 | Non négociables : idempotence + journal avant envoi, garde-fous serveur, chiffrement tokens | Fiabilité dès le jour 1 |
| 2026-07 | Hébergement : Docker → Azure Container Apps (région EU), CI/CD GitHub Actions, images dans ACR | Azure déjà connecté au GitHub de Fathi ; scale-to-zero économique |
| 2026-07 | Couche IA multi-fournisseurs via Vercel AI SDK : Anthropic par défaut, OpenAI (et autres) pour tests comparatifs ; modèles choisis par env | Comparer qualité/coût sans réécrire le code agent |
| 2026-07 | **Premiers connecteurs : Google Sheets + Notion, en lecture seule** — base de prospects/contacts la plus simple pour démarrer, sans dépendre d'un CRM installé chez le pilote | Choix de Fathi ; barrière d'entrée minimale pour les premières PME testées |
| 2026-07 | Modèles attribués **par tâche produit** (registre `LLM_TASKS` dans lib/llm.ts, override env `LLM_TASK_*`) ; observabilité et évals **Langfuse** prévues avant la Phase 2 (traces par tâche, tests A/B de modèles) | Le bon modèle au bon endroit ; coûts et qualité mesurables tâche par tâche |

Ajouter chaque nouvelle décision ici (format ADR léger : contexte, décision, conséquences).
