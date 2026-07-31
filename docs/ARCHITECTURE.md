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

## Isolation des scénarios d'exemple

La classification technique `certified-demo` est réservée aux scénarios chargés par un administrateur dans une organisation de test vide de toute donnée apportée par le testeur au moment du premier chargement. Dans la surface produit, elle est présentée comme un « scénario d'exemple Nepteo » contenant des « données d'exemple ». Cette vacuité est une précondition du seed : la vitrine reste ensuite volontairement peuplée par son scénario jusqu'à une réinitialisation ou un remplacement explicite. Un préflight fail-closed contrôle connecteurs, prospects, campagnes, revenus, actions, outbox et briefings. Il s'exécute avant la sauvegarde, l'invalidation du marqueur, le reset ou toute autre mutation ; un conflit renvoie `unsafe_existing_data` sans modifier l'organisation. Les artefacts actuels portent des marqueurs explicites (`demo`, provider et identifiants préfixés) ; les anciens identifiants ne sont reconnus qu'avec un marqueur actif et fiable. Les organisations de recette OAuth/RLS et le futur pilote réel restent distincts du tenant vitrine.

Un environnement de test emprunte une seule de deux voies exclusives : un scénario d'exemple Nepteo certifié, dont les artefacts sont des données d'exemple, ou des données saisies ou importées par le testeur via l'interface, un connecteur ou un CSV. Ces dernières peuvent être réelles ou synthétiques et restent présentées sous le libellé « environnement de test » ; Nepteo ne présume pas leur provenance. Le scénario doit être retiré avant toute saisie ou tout import. La migration `0021` fournit au service role les RPC transactionnelles de remplacement et de retrait CSV ; elles verrouillent la ligne d'organisation, contrôlent rôle et tenant, bornent les données conservées et journalisent la mutation. Les Server Actions les appellent sous `withRealDataMutationLock`, qui détient le verrou distribué `data` pendant le contrôle du mode scénario et la RPC ; tout autre appelant doit conserver cette enveloppe.

Si une page devenue obsolète tente tout de même un chargement et reçoit `unsafe_existing_data`, le panneau pose immédiatement un latch local fail-closed : les trois actions de chargement restent désactivées, même si le rendu serveur initial les autorisait, jusqu'au rafraîchissement et à un nouvel inventaire. Ce latch complète le préflight serveur, qui reste l'autorité et refuse avant mutation.

Un verrou distribué par organisation sérialise chargement, nettoyage, analyse, campagne et mutation de données réelles. Les écritures mémoire/connecteurs prennent le verrou `data`, vérifient le mode démo puis lisent et écrivent dans la même section critique : aucune donnée réelle ne peut apparaître entre le contrôle et la mutation. L'analyse et les campagnes restent dans le scope démo, et le nettoyage est sélectif : il ne supprime jamais une ligne non marquée. Une sauvegarde `__demo_backup` existante est validée avant tout reset ou seed ; une sauvegarde corrompue bloque le chargement. Un verrou orphelin n'est jamais repris automatiquement : sa suppression exige une vérification opératoire, faute de fencing distribué.

La reconstruction opératoire du 2026-07-31 a appliqué ce contrat en production : sauvegarde vérifiée (`sha256:ffa9536fadf70d195cebc9b63c4fcfb73e3745ede0e9a20be31348cd6748e07c`), retrait exact de 48 prospects, 6 connecteurs et 8 rubriques, nom et membres préservés, puis cycles de chargement et d'analyse des trois scénarios. Chaque scénario a produit six propositions avec une console vide ; Atelier Northwind reste l'unique scénario actif. Le gate `reset → reseed → préparation → exécution` reste ouvert.

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
- L'application exige une version de schéma au moins égale à `21`, portée par `0021`.
- Les migrations `0012` à `0021` restent manuelles. Le workflow vérifie le marqueur avant toute mutation Azure, puis `/api/health` et `/api/ready` après déploiement.
- Release applicative courante du 2026-07-31 : la PR #17, head `28781aad52564f02fcee1c0dda4b5ee5291836b8`, a livré le SHA `704efabd80de434ea2619cd993ae87427c114838`. Sa CI de PR `30620564365`, la CI `main` `30620691704` et le déploiement `30620812901` sont verts. Azure sert à 100 % `nepteo-prod--0000011`, latest et ready, état Healthy/Provisioned/RunningAtMaxScale avec une réplique, image `nepteoacr27de3b.azurecr.io/nepteo:704efabd80de434ea2619cd993ae87427c114838`, digest `sha256:fe6cafbe991c45952262e33be965e4ba09239ff421a86dce80231117a3504425` ; l'application est Succeeded/Running et le FQDN est inchangé.
- Les six contrôles de `/`, `/api/health` et `/api/ready` sur le domaine public et le FQDN Azure répondent HTTP 200 ; les corps déclarent respectivement `status=ok, service=nepteo` et `status=ready`. La recette authentifiée confirme « scénario d'exemple » et « données d'exemple » sans ancienne copie, la source du briefing « à partir des données d'exemple du scénario Nepteo », l'identité en lecture seule et la redirection de `/onboarding/identite` vers « Mon entreprise » avec le nouveau message de garde. Atelier Northwind reste actif sans mutation et la console est vide. Le gate `reset → reseed → préparation → exécution` reste ouvert.
- C7 reste fermé : cette release ne réalise aucun envoi externe.
- Étapes historiques : la PR #15 et `nepteo-prod--0000009` ont porté la reconstruction de la vitrine décrite plus haut ; la PR #16 et `nepteo-prod--0000010` ont livré le hotfix de lecture seule et d'explication des cohortes. La PR #17 et `nepteo-prod--0000011` constituent la release courante.
- Validation PR #17 : 385/385 tests, typecheck, lint et build verts, 24 routes construites ; la revue croisée ne relève aucun P1/P2. Le contrat de préflight avant mutation et le latch fail-closed `unsafe_existing_data` sont livrés avec la terminologie des deux voies.
- Jalon historique du 2026-07-30 : les migrations `0012` à `0020` et le code alors associé étaient en production dans l'image `a2bbc34dcb97ab00951a3efa631c4f7c0a0428ca`, révision `nepteo-prod--0000007`.
