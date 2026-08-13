# Audit de priorisation — boucle Campagnes — 12 août 2026

## Verdict exécutif

Le moteur d'analyse Campagnes existe déjà, mais la boucle produit réelle n'est
pas fermée. Le retard prioritaire porte sur l'alimentation de `ad_metrics` par
des données Meta complètes, la vérité sémantique des indicateurs, le lien entre
budget prévu et dépense, puis la mesure traçable d'une recommandation.

La prochaine étape recommandée est **META-METRICS**, pas Salesforce, pas une
pause Meta et pas un lancement payant.

## Sources et niveau de preuve

Audit documentaire et statique réalisé sans secret, appel fournisseur,
migration, déploiement ni écriture produit à partir de :

- la tâche Codex `019ff58a-afa6-7600-84f7-1fdd7ec669df`, dont l'audit conclut
  que le produit est surtout en retard sur les données réelles, l'arbitrage et
  la mesure, et non sur le moteur d'analyse ;
- `main` au commit `40d4e03` dans le checkout audité ;
- `docs/projets/roadmap-campagnes-supervisees.md`, `docs/SUIVI.md`,
  `docs/DECISIONS.md` et `docs/ARCHITECTURE.md` ;
- `supabase/migrations/0007_ad_metrics.sql`, `lib/connectors/meta-ads.ts`,
  `lib/connectors/sync.ts`, `lib/ads/analysis.ts`,
  `lib/ads/metrics-rules.ts`, `lib/campaign-evidence.ts`,
  `lib/campaign-cockpit.ts` et le cockpit Campagnes ;
- l'audit connecteurs du 12 août 2026 visible dans le commit local `0091a12`.

Le commit `0091a12` atteste la recette OAuth Google Sheets/Notion et complète
l'audit connecteurs. Il n'est pas supposé fusionné dans le HEAD audité et ne
prouve ni OAuth Meta réel, ni ingestion Meta vers `ad_metrics`.

## Ce qui est acquis

- CAMP-0/1 préparent, expliquent et font valider une campagne sans la lancer.
- CAMP-2 agrège `ad_metrics`, compare des fenêtres et rattache actions/journal.
- Le moteur de preuve possède déjà des seuils prudents avant projection.
- META-READ utilise `ads_read`, borne les pages et minimise le snapshot.
- Les propositions `ads_pause_*` sont non exécutables et n'ouvrent aucun appel
  Ads.
- Le contrôle humain, le journal et les frontières de rôle sont déjà des
  invariants du produit.

## Écarts prioritaires

### P0 — sémantique financière insuffisante

`ad_metrics` porte actuellement `spend`, `conversions` et `revenue` avec des
valeurs par défaut à zéro, sans devise, fuseau, type de résultat, attribution ni
origine aval. Le cockpit peut alors calculer CAC et ROAS à partir de lignes dont
la preuve métier est indéterminée.

**Décision** : inconnue, absence et zéro observé doivent devenir trois états
distincts. Aucun ROAS réel n'est affiché sans revenu rapproché et vérifiable.

### P0 — META-READ n'alimente pas le cockpit

L'audit connecteurs constate que META-READ persiste un snapshot dans
`connectors.config`, tandis que le cockpit consomme `ad_metrics`. La lecture du
connecteur n'est donc pas encore une chaîne de valeur métrique complète.

**Décision** : META-METRICS ferme le flux compte → campagnes → insights
quotidiens → photographie complète `ad_metrics`.

### P0 — recommandations historiques fondées sur un ROAS non prouvé

Le moteur historique sait proposer l'examen d'une pause lorsque le revenu est
inférieur à la dépense. Cette règle est cohérente sur les scénarios contrôlés,
mais ne doit pas s'appliquer à des lignes réelles tant que la provenance du
revenu n'est pas vérifiée.

**Décision** : les premières recommandations réelles comparent des campagnes
Meta sur un type de résultat homogène et un coût par résultat déclaré par Meta.
CAC, revenu et ROAS restent indisponibles jusqu'au lot OUTCOME-PROOF.

### P1 — budget prévu non rapproché

Le Studio possède une intention de budget, mais le dépôt ne prouve pas une
correspondance durable entre cette intention et une campagne Meta distante.

**Décision** : « prévu/réalisé » exige identifiant de rapprochement, période et
devise. À défaut, le cockpit affiche `Budget prévu non rapproché`.

### P1 — avant/après non lié à une recommandation

Le cockpit sait comparer des périodes, mais ne fige pas encore une baseline,
une version de recommandation et une fenêtre après associées à la même décision.

**Décision** : RECOMMENDATION-MEASURE crée cette trace avant toute mutation Ads.

### P1 — photographie fournisseur à fiabiliser

L'audit connecteurs relève les risques génériques de snapshot partiel, de
pagination, de longue lecture réseau, de journal non atomique et de persistance
des jetons. Les correctifs CONN-BASE visibles dans `0091a12` sont une référence,
pas une hypothèse à importer aveuglément dans ce checkout.

**Décision** : lecture distante bornée hors transaction longue, puis application
atomique et idempotente d'une photographie complète. Toute page manquante ou
persistance ambiguë invalide le run.

## Ordre retenu

1. contrat de vérité des indicateurs ;
2. META-METRICS ;
3. cockpit BUDGET-RESULTS ;
4. META-RECOMMEND ;
5. RECOMMENDATION-MEASURE ;
6. OUTCOME-PROOF seulement avec une source aval justifiée ;
7. readiness puis pause Meta supervisée ;
8. Google Ads en lecture ;
9. arbitrage Meta ↔ Google.

Salesforce, LinkedIn, lancement payant, écritures fournisseur, automatisation
avancée et intégration Andromeda directe sont hors de l'ordre immédiat.

## Porte de sécurité

Les preuves suivantes sont indépendantes :

```text
lecture réelle → analyse honnête → recommandation prudente → mesure traçable
                                                      │
                                                      └─ ne donne aucun droit d'écriture

scope d'écriture + readiness + autorisation explicite → mutation supervisée
```

La première chaîne doit être verte avant d'ouvrir la seconde. Le catalogue, une
maquette ou une action validée `non appliquée` ne franchissent aucune porte.
