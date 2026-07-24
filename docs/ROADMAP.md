# Roadmap — 5 phases

Une phase = un objectif unique + une porte go/no-go. On ne passe pas la porte, on ne passe pas à la suite.

## Phase 1 — Fondations (lecture seule) ← actuelle

**Objectif** : une chaîne de données fiable, en lecture seule.

Livrables : auth + organisations + rôles, schéma DB + RLS, mémoire entreprise (saisie manuelle), 1er connecteur en lecture (choix lié au client pilote), journal append-only, vue « Aujourd'hui » avec données réelles.

**Porte** : les données du client pilote s'affichent juste, tous les jours, sans intervention.

## Phase 2 — Recommandations

**Objectif** : l'agent détecte et propose (sans exécuter).

Livrables : moteur d'analyse (anomalies, comparaisons), file d'actions proposées avec constat/raison/impact/confiance/risque, tiroir de raisonnement, feedback accepté/refusé journalisé.

**Porte** : ≥ 1 recommandation pertinente par semaine jugée utile par le client pilote.

## Phase 3 — Première exécution réelle

**Objectif** : une action validée est exécutée par l'agent, de bout en bout.

Livrables : 1 ou 2 types d'action réels (ex. email de relance), idempotence + journal avant envoi, garde-fous serveur, bouton d'arrêt, gestion d'erreurs.

**Porte** : zéro exécution non voulue ; le client pilote valide et l'action part correctement.

## Phase 4 — Campagnes & contenu

**Objectif** : préparer des campagnes complètes (brief → proposition → validation).

Livrables : modal nouvelle campagne, variantes de messages, typologie (acquisition, retargeting, conversion, nurturing, réactivation…), génération de contenus texte.

**Porte** : une campagne proposée par l'agent est lancée et mesurée.

## Phase 5 — Passage à l'échelle

**Objectif** : plusieurs clients, plusieurs connecteurs, autonomie configurable.

Livrables : slider d'autonomie par client, connecteurs additionnels, onboarding self-service, monitoring.

**Porte** : 3 clients actifs sans support quotidien.

## À ne pas faire au début

Tous les canaux, attribution complexe, prédictions ambitieuses, campagnes totalement autonomes, multi-agents complexe, ML sans données. Prouver d'abord : « l'agent comprend les données, détecte une priorité et aide à agir. »

## Chantiers à venir (cadrés, non commencés)

Deux features cadrées avec Fathi (2026-07-23), chacune avec son document projet (vision + roadmap + suivi). **Cible commune : le solopreneur** — « outil magique, plus besoin de personne ». **Contrainte : rester très simple, garder les formulaires existants, ne rien perdre.**

- **Onboarding enrichi par IA** — encart « philosophie » + ingestion page web (+ réseaux en backlog) → identité synthétisée + première expertise (meilleurs canaux/stratégie) dès l'onboarding. Voir `docs/projets/onboarding-ia.md`. (Rejoint la Phase 5 « onboarding self-service ».)
- **Génération de contenu fini par l'IA** — l'agent génère le visuel (API OpenAI), pas seulement le brief ; vidéo en option plus tard. Le solopreneur n'a besoin de personne. Voir `docs/projets/generation-creative-ia.md`. (Rejoint la Phase 4 « Campagnes & contenu ».)
