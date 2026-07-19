# Architecture

## Modules produit

1. **Mémoire entreprise** — activité, offres, cibles, ton, objectifs, contraintes, documents, observations apprises. Table `company_memory`.
2. **Connecteurs** — CRM, analytics, publicité, email, paiement, fichiers. OAuth officiel uniquement, tokens chiffrés. Table `connectors`.
3. **Moteur d'analyse** — agrégation, calcul d'indicateurs, détection d'anomalies, comparaisons, règles métier.
4. **Moteur de recommandations** — actions priorisées avec constat, raison, données, impact estimé, confiance, risque.
5. **Génération** — messages, campagnes, scripts, variantes (Claude API).
6. **Centre de validation** — approuver / modifier / reporter / refuser / exécuter. Table `actions`.
7. **Journal** — append-only : décisions, actions, résultats, apprentissage. Table `journal`.

## Flux agentique

récupérer données → détecter problème/opportunité → analyser causes → proposer action → expliquer → estimer impact → validation si nécessaire → exécuter → mesurer → apprendre.

## Principes non négociables

1. **Idempotence** : `journal` écrit avant toute exécution externe ; `idempotency_key` unique par action exécutée ; reprise sûre après crash.
2. **Garde-fous serveur** : plafonds de dépense, seuils, droits et validations vérifiés dans les route handlers / jobs — l'UI n'est jamais la seule barrière.
3. **Sécurité & RGPD** : tokens OAuth chiffrés au repos, RLS Supabase par organisation, hébergement EU, droit à l'effacement prévu dès le schéma.

## Choix techniques

- **Next.js 16** App Router : UI + API dans un seul déploiement au départ.
- **Supabase** : Postgres + Auth + RLS multi-tenant (une `organization` = un client).
- **Jobs async** : nécessaire à partir des syncs de connecteurs (Phase 1 fin). Candidats : pg-boss (reste dans Postgres, simple) vs BullMQ (Redis, plus riche). Décision en attente — voir DECISIONS.md.
- **Claude API** : génération et raisonnement ; modèle configuré par env, jamais en dur.

## Multi-tenant & rôles

`organizations` ← `memberships` (roles : admin, marketing, commercial, direction, lecture). Toutes les tables métier portent `organization_id` + policies RLS. Le rôle `commercial` (mode Claire) masque budgets et création de campagne — appliqué côté serveur.
