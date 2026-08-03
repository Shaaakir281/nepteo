# Roadmap — 5 phases

Une phase = un objectif unique + une porte go/no-go. On ne passe pas la porte, on ne passe pas à la suite.

> **Lecture au 2026-07-30** : la phase 3A est déployée et recettée en lecture, mais la porte de valeur de la phase 2 reste ouverte faute de preuve commanditaire. L'ordre opérationnel des prochains incréments est défini dans la [roadmap valeur — tests commanditaires](projets/roadmap-valeur-commanditaires.md).

> **Chantier transverse — prise en main** : le parcours guidé est piloté par sa
> [roadmap dédiée](projets/roadmap-prise-en-main.md), distincte de la roadmap
> valeur. Au 2026-08-03, une intégration locale est autorisée ; ses critères de
> compréhension terrain restent ouverts et aucun push, fusion ou déploiement
> n’est implicite.

## Phase 1 — Fondations (lecture seule)

**Objectif** : une chaîne de données fiable, en lecture seule.

Livrables : auth + organisations + rôles, schéma DB + RLS, mémoire entreprise (saisie manuelle), 1er connecteur en lecture (choix lié au client pilote), journal append-only, vue « Aujourd'hui » avec données réelles.

**Porte** : les données du client pilote s'affichent juste, tous les jours, sans intervention.

## Phase 2 — Recommandations ← porte terrain encore ouverte

**Objectif** : l'agent détecte et propose (sans exécuter).

Livrables : moteur d'analyse (anomalies, comparaisons), file d'actions proposées avec constat/raison/impact/confiance/risque, tiroir de raisonnement, feedback accepté/refusé journalisé.

**Signal minimal** : ≥ 1 recommandation pertinente par semaine jugée utile par le client pilote.

**Porte de sortie terrain** : après au moins 3 testeurs, 50 recommandations examinées et deux semaines de test, accélérer à partir de 60 % d'utilité avec moins de 15 % de faux positifs ; pivoter sous 40 %.

## Phase 3 — Première exécution réelle — étape A technique déployée

**Objectif** : une action validée est exécutée par l'agent, de bout en bout.

Livrables : 1 ou 2 types d'action réels (ex. email de relance), idempotence + journal avant envoi, garde-fous serveur, bouton d'arrêt, gestion d'erreurs. L'étape A prépare aujourd'hui les messages sans les envoyer ; C8 et les migrations `0012`–`0020` sont en production depuis le 2026-07-30.

**Porte 3A — préparation** : zéro préparation non voulue ; le testeur comprend ce qui est préparé et garde la décision.

**Porte 3B — envoi réel** : le play de relance a d'abord franchi la porte terrain ; suppression-list, budget global, claim worker, états ambigus, fournisseur UE et self-test sont éprouvés ; zéro envoi non voulu. C7 exige une décision explicite de Fathi.

## Phase 4 — Campagnes & contenu

**Objectif** : préparer des campagnes complètes (brief → proposition → validation).

Livrables : modal nouvelle campagne, variantes de messages, typologie (acquisition, retargeting, conversion, nurturing, réactivation…), génération de contenus texte.

**Porte** : une campagne proposée par l'agent est lancée et mesurée.

## Phase 5 — Passage à l'échelle

**Objectif** : plusieurs clients, plusieurs connecteurs, autonomie configurable.

Livrables : slider d'autonomie par client, connecteurs additionnels, onboarding self-service, monitoring.

**Porte** : 3 clients actifs sans support quotidien.

## À ne pas faire au début

Tous les canaux, les deux écosystèmes email en parallèle, attribution complexe, prédictions ambitieuses, campagnes totalement autonomes, multi-agents complexe, ML sans données. Prouver d'abord : « l'agent comprend les données, détecte une priorité et aide à agir. »

## Chantiers transverses cadrés

Deux features ont été cadrées avec Fathi (2026-07-23), chacune avec son document projet. **Cible commune : le solopreneur**. **Contrainte : rester très simple, garder les formulaires existants, ne rien perdre.**

- **Onboarding enrichi par IA — partiellement livré** : philosophie, ingestion de page web, identité synthétisée et diagnostic initial. Les réseaux restent en backlog. Voir `docs/projets/onboarding-ia.md`.
- **Génération de contenu fini par l'IA — non commencée** : génération du visuel, puis vidéo éventuelle plus tard. Voir `docs/projets/generation-creative-ia.md`.
