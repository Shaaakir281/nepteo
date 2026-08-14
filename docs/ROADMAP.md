# Roadmap — 5 phases

Une phase = un objectif unique + une porte go/no-go. On ne passe pas la porte, on ne passe pas à la suite.

> **Lecture au 2026-08-14** : la phase 3A et le socle Campagnes/Story sont
> déployés. `META-METRICS` et le parcours pilote Meta sont servis par
> `nepteo-prod--0000036` sur le schéma de production 30, mais G1 reste ouvert :
> seule la lecture d'un compte Meta vide a été recettée et aucun échantillon non
> vide campagne/date/dépense/résultat n'a encore été rapproché de Meta. Le
> développement de `BUDGET-RESULTS` avance pendant cette recette ; son gate G2
> ne pourra pas être déclaré vert avant cette comparaison non vide. L'ordre
> opérationnel est défini dans la
> [roadmap Campagnes](projets/roadmap-campagnes-supervisees.md) : vérité des
> métriques, `META-METRICS`, budget/résultats, recommandation Meta et mesure
> avant/après. La [roadmap valeur — tests commanditaires](projets/roadmap-valeur-commanditaires.md)
> continue de gouverner le play Prospects et l'outbound ; elle ne fixe plus la
> priorité globale suivante.

> **Chantier transverse — prise en main** : le parcours guidé est piloté par sa
> [roadmap dédiée](projets/roadmap-prise-en-main.md), distincte de la roadmap
> valeur. Il est fusionné dans `main` ; ses critères de compréhension terrain,
> son déploiement et sa recette restent des preuves séparées à consigner.

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

**Objectif** : fermer une première boucle Campagnes mesurable (brief → budget
prévu → lecture fournisseur réelle → résultats qualifiés → recommandation →
décision humaine → mesure avant/après).

Livrables : le socle créatif existant, puis un contrat explicite pour budget
prévu, budget fournisseur lorsqu'il existe, dépense réelle, résultat déclaré par
Meta, coût par résultat, conversions, revenu, attribution, devise, fuseau,
fraîcheur et provenance ; Meta alimente réellement `ad_metrics` de façon bornée
et idempotente ; le cockpit affiche prévu/réalisé, résultats, tendances 7/30
jours et qualité ; une recommandation Meta est mesurée avant et après. CAC et
ROAS ne sont visibles que si une source aval les justifie.

Le détail exécutable est défini dans la [roadmap Campagnes](projets/roadmap-campagnes-supervisees.md).
CAMP-0, CAMP-1, le socle CAMP-2 et CREATIVE-1 sont acquis. `META-METRICS` et le
parcours pilote Meta sont déployés en lecture seule ; G1 reste ouvert uniquement
faute d'une recette sur données Meta non vides. `BUDGET-RESULTS` est le lot local
en cours et peut être construit sans attendre cette recette, à condition de
laisser G2 ouvert. Une donnée inconnue reste indisponible, un budget prévu sans
rapprochement explicite s'affiche « Budget prévu non rapproché », et aucun
revenu, CAC ou ROAS réel n'est présenté sans source aval vérifiée. La maquette
commerciale décrit une direction, jamais une capacité attestée. `META-RECOMMEND`,
`META-PAUSE`, toute mutation Meta et tout lancement payant restent fermés.

**Porte** : un compte Meta pilote non vide alimente le cockpit avec une
photographie complète rapprochée de l'interface Meta ; budget prévu, budget
fournisseur lorsqu'il existe, dépense réelle, type et coût du résultat sont
traçables. Le déploiement du cockpit, sa recette
technique et sa recette sur données réelles non vides sont trois preuves
distinctes. La recommandation, la mesure et toute mutation Ads possèdent leurs
propres portes ultérieures.

## Phase 5 — Passage à l'échelle

**Objectif** : plusieurs clients, plusieurs connecteurs, autonomie configurable.

Livrables : slider d'autonomie par client, connecteurs additionnels, onboarding self-service, monitoring.

**Porte** : 3 clients actifs sans support quotidien.

## À ne pas faire dans l'ordre immédiat

Salesforce, LinkedIn Ads, automatisation LinkedIn, lancement payant, écritures
fournisseur, attribution complexe, prédictions ambitieuses, campagnes
autonomes, intégration Andromeda directe, multi-agents complexe et ML sans
données. Prouver d'abord : « les données réelles alimentent une recommandation
prudente dont le résultat peut être mesuré ».

## Chantiers transverses cadrés

Deux features ont été cadrées avec Fathi (2026-07-23), chacune avec son document projet. **Cible commune : le solopreneur**. **Contrainte : rester très simple, garder les formulaires existants, ne rien perdre.**

- **Onboarding enrichi par IA — partiellement livré** : philosophie, ingestion de page web, identité synthétisée et diagnostic initial. Les réseaux restent en backlog. Voir `docs/projets/onboarding-ia.md`.
- **Génération de contenu fini par l'IA — déployée et recettée sur son parcours principal** : Story/carré/paysage versionnés et liés à la campagne ; vidéo, variantes conversationnelles et essais de concurrence restent à traiter. Voir `docs/projets/generation-creative-ia.md`.
