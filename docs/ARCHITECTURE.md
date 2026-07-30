# Architecture

## Modules produit

1. **Mémoire entreprise** — activité, offres, cibles, ton, objectifs, contraintes, documents, observations apprises. Table `company_memory`.
2. **Connecteurs** — CRM, analytics, publicité, email, paiement, fichiers. OAuth officiel uniquement, tokens chiffrés. Table `connectors`.
3. **Moteur d'analyse** — agrégation, calcul d'indicateurs, détection d'anomalies, comparaisons, règles métier.
4. **Moteur de recommandations** — actions priorisées avec constat, raison, données, impact estimé, confiance, risque. La vue « Aujourd'hui » n'en retient que cinq et explique « pourquoi maintenant ».
5. **Génération** — messages, campagnes, scripts, variantes via Vercel AI SDK multi-fournisseurs.
6. **Centre de validation** — approuver / modifier / reporter / refuser / exécuter. Table `actions`.
7. **Journal et preuve terrain** — audit append-only dans `journal` ; verdicts et résultats structurés dans `value_events`.

## Flux agentique

récupérer données → détecter problème/opportunité → analyser causes → proposer action → expliquer → estimer impact → validation si nécessaire → exécuter → mesurer → apprendre.

## Principes non négociables

1. **Idempotence** : `journal` écrit avant toute exécution externe ; `idempotency_key` unique par action exécutée ; reprise sûre après crash.
2. **Garde-fous serveur** : plafonds de dépense, seuils, droits et validations vérifiés dans les route handlers / jobs — l'UI n'est jamais la seule barrière.
3. **Sécurité & RGPD** : tokens OAuth chiffrés au repos, RLS Supabase par organisation, hébergement EU, droit à l'effacement prévu dès le schéma.

## Choix techniques

- **Next.js 16** App Router : UI + API dans un seul déploiement au départ.
- **Supabase** : Postgres + Auth + RLS multi-tenant (une `organization` = un client).
- **Sync planifiée** : route sécurisée `/api/cron/sync` appelée par un scheduler externe au faible volume actuel.
- **Outbound futur** : outbox PostgreSQL, claim atomique et worker borné avant C7. Pas de boucle d'envoi synchrone et pas de Redis tant que le volume ne le justifie pas.
- **IA multi-fournisseurs** : génération et raisonnement via Vercel AI SDK ; modèles configurés par tâche et par environnement. La recherche web OpenAI/Perplexity reste une couche séparée.

## Multi-tenant & rôles

`organizations` ← `memberships` (rôles : admin, marketing, commercial, direction, lecture). Toutes les tables métier portent `organization_id` + policies RLS.

Le contexte serveur courant est centralisé dans `lib/auth/context.ts` : client Supabase, utilisateur, membership propre à l'utilisateur et droit d'édition. Les pages RSC d'un même rendu partagent cette lecture via `cache`. Pour la bêta, la migration `0013` impose au plus une organisation par utilisateur et le contexte bloque toute ambiguïté ; une future ouverture multi-organisation devra d'abord introduire un sélecteur d'organisation active explicite, puis retirer cette contrainte.

Depuis `0014`, `company_memory` n'expose plus aucune écriture au JWT utilisateur. Toute écriture applicative passe par une Server Action utilisant le service role après une autorisation serveur : rôle éditeur pour une organisation existante, ou création initiale de sa propre organisation. `0015` restreint ensuite sa lecture aux rôles admin, marketing, direction et lecture. L'onboarding enrichi applique la garde éditeur.

La matrice de capacités est centralisée dans `lib/auth/roles.ts` et refuse par défaut tout rôle inconnu :

| Rôle | Modifier | Voir les finances | Gérer les campagnes |
|---|---:|---:|---:|
| admin, marketing, direction | oui | oui | oui |
| lecture | non | oui | non |
| commercial | non | non | non |

La migration `0015` applique aussi la frontière financière en base. Une allowlist de types ne suffit pas lorsqu'une ligne porte un `payload` ou un texte libre : le rôle commercial ne lit donc ni mémoire, ni recherche, ni briefing, ni action, ni journal, ni outbox, ni table de montants/campagnes. Il conserve les colonnes normalisées des prospects, le nom de l'organisation et les métadonnées non sensibles des connecteurs CRM/fichiers, tandis que les connecteurs ads/paiement sont exclus. `prospects.raw`, les notes libres, `organizations.activity`, `connectors.config` et `connectors.encrypted_credentials` ne sont pas lisibles avec un JWT utilisateur ; seuls les traitements serveur autorisés y accèdent. `0019` réapplique cette frontière de façon additive pour les bases qui auraient déjà exécuté `0015`/`0016`.

## Isolation de la démonstration

Le mode démonstration est réservé aux administrateurs et à une organisation de test sans donnée réelle. Un préflight fail-closed contrôle connecteurs, prospects, campagnes, revenus, actions, outbox et briefings. Les artefacts actuels portent des marqueurs explicites (`demo`, provider et identifiants préfixés) ; les anciens identifiants ne sont reconnus qu'avec un marqueur de démo actif et fiable.

Un verrou distribué par organisation sérialise chargement, nettoyage, analyse, campagne et mutation de données réelles. Les écritures mémoire/connecteurs prennent le verrou `data`, vérifient le mode démo puis lisent et écrivent dans la même section critique : aucune donnée réelle ne peut apparaître entre le contrôle et la mutation. L'analyse et les campagnes restent dans le scope démo, et le nettoyage est sélectif : il ne supprime jamais une ligne non marquée. Une sauvegarde `__demo_backup` existante est validée avant tout reset ou seed ; une sauvegarde corrompue bloque le chargement. Un verrou orphelin n'est jamais repris automatiquement : sa suppression exige une vérification opératoire, faute de fencing distribué.

## Quotas et transitions atomiques

- `research_runs` reste le stockage/cache par sujet. Seul un résultat `status = ok` peut être réutilisé pendant 30 jours.
- La migration `0017` ajoute un compteur quotidien UTC distinct et une RPC de réservation atomique. Elle verrouille la ligne d'organisation avant de lire la pause : une pause gagnante bloque sans coût ; une réservation gagnante constitue le claim payé. Une recherche forcée ou un appel fournisseur qui échoue consomme sa réservation ; une indisponibilité du quota bloque l'appel externe.
- La migration `0018` rend atomiques les décisions humaines : transition conditionnelle (`proposed` vers décision, `postponed` vers reprise) et journal partagent une transaction.
- L'exécution verrouille l'organisation, vérifie pause et autonomie, revendique une action `approved` sans `idempotency_key` et journalise son départ dans une seule RPC. La finalisation `executed | failed` et son journal sont également atomiques ; les états ambigus ou claims détenus demandent une reprise explicite.
- Les changements de pause et d'autonomie passent par une RPC commune qui met à jour la garde et son événement d'audit dans la même transaction.

## Priorisation et preuve terrain

- R1B classe uniquement les propositions déjà visibles pour le rôle courant et en retient au plus cinq. L'ordre privilégie proximité de la valeur et actionnabilité, puis ancienneté réelle du contact, âge de la proposition, confiance et risque ; chaque carte expose une justification factuelle « Pourquoi maintenant ».
- La migration `0020` crée `value_events`, une preuve terrain structurée et append-only : verdict utile/pas utile/faux positif, niveau de retouche du brouillon, relance manuelle déclarée, réponse, rendez-vous et opportunité. Les déclarations locales utilisent la source `manual` ; `gmail` et `microsoft` sont réservées à de futures observations issues d'un connecteur.
- L'approbation d'une relance fige atomiquement sa cohorte dans `action_target_snapshots` et `action_target_snapshot_members`. Les résultats aval sont ensuite rattachés au prospect de cette cohorte, afin qu'une déclaration ne soit pas interprétée comme le résultat de tout un lot.
- La RPC `record_value_event` contrôle organisation, rôle, action, prospect, cohorte et idempotence. Les utilisateurs authentifiés autorisés lisent les événements ; les écritures passent par le service role et aucune mise à jour en place n'est accordée.

## Frontières de code

- Les règles pures restent sans I/O et sont testées directement avec `node:test`. `matchesRelaunchTarget` est la source commune de l'aperçu et de l'exécution.
- La fiche connecteur sépare chargement distant, états `success | empty | error` et composants de présentation. Les credentials sont déchiffrés une seule fois par chargement de métadonnées.
- `validation-queue.tsx` orchestre seulement la sélection ; le tiroir, le brouillon et les détails campagne sont isolés.
- `app/(cockpit)/actions.ts` reste la façade publique des Server Actions, mais délègue à six modules métier bornés. Next 16 impose ici des wrappers `async` : les réexports directs d'un fichier `"use server"` ne sont pas compatibles avec l'instrumentation Turbopack.
- La navigation desktop et mobile consomme une liste unique de cinq destinations.
- Les dialogues partagent le hook clavier `components/ui/use-dialog-focus.ts`.

## État d'exploitation

- Production Azure Container Apps en région EU, domaine HTTPS actif.
- `/api/health` est un contrôle de liveness sans accès base ; `/api/ready` vérifie Supabase et le marqueur de compatibilité de schéma introduit par `0016`.
- Le code local exige désormais une version de schéma au moins égale à `20`, portée par `0020`.
- Les migrations `0012` à `0020` restent manuelles. Le workflow vérifie le marqueur avant toute mutation Azure, puis `/api/health` et `/api/ready` après déploiement.
- Cette vague est uniquement locale : ni le code ni les migrations `0012` à `0020` ne sont déployés ou appliqués à la production.
