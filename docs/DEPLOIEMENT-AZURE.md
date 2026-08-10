# Déploiement Nepteo — Azure Container Apps

Cette procédure prépare un déploiement Docker vers Azure Container Apps, avec
images dans ACR, région UE et GitHub Actions en OIDC.

> **État au 10 août 2026 — release courante attestée** : la PR #31 est
> fusionnée dans `main` au SHA `7424d2926e6423e1af674c741eb90dc1fcd914a3`.
> Sa CI `31368969929` et le déploiement `31369161993` sont verts. Azure sert à
> 100 % la révision `nepteo-prod--0000023`, latest et ready, état
> `Succeeded`/`Running`, image
> `nepteoacr27de3b.azurecr.io/nepteo:7424d2926e6423e1af674c741eb90dc1fcd914a3`.
> Supabase et l'application restent alignés sur `app_schema_version = 28` ; la
> déconnexion mobile et Afficher/Masquer le mot de passe sont livrés. La recette
> Story, les contrôles JWT/RLS ciblés et le Storage privé/signé restent ceux de
> la PR #29. Le nouvel email et le logout mobile authentifié restent à recetter.
> Le workflow ne lance aucune migration : leur application manuelle et ordonnée
> reste un préalable obligatoire.
>
> **Historique — ne pas confondre avec la release courante** : la PR #29 a été
> attestée sur `nepteo-prod--0000022`, avec la recette Story ciblée. La PR #17 a été
> attestée sur `nepteo-prod--0000011`. La PR #16 avait été attestée sur
> `nepteo-prod--0000010`, au merge
> `21c90f77af0c877e9c99f60a4997c4dad4b1ba84`. La PR #15 a porté la
> reconstruction de la vitrine sur `nepteo-prod--0000009`. La PR #13 avait été promue sur
> `nepteo-prod--0000008` ; le 30 juillet 2026, `nepteo-prod--0000007` servait
> l'image `a2bbc34dcb97ab00951a3efa631c4f7c0a0428ca`.

## 1. Verrou absolu : identifier le bon compte Azure

Ne jamais se fier au compte Azure « par défaut » de la machine. Avant toute
création, récupérer ces trois valeurs depuis **le compte Nepteo** :

- nom exact de la souscription ;
- `subscriptionId` ;
- `tenantId`.

Se connecter explicitement au bon tenant :

```powershell
az login --tenant <TENANT_ID_NEPTEO>
az account set --subscription <SUBSCRIPTION_ID_NEPTEO>
az account show --query "{account:user.name,subscription:name,subscriptionId:id,tenantId:tenantId}" -o table
```

Puis exécuter le garde-fou en lecture seule :

```powershell
.\scripts\azure\verify-target.ps1 `
  -SubscriptionId "<SUBSCRIPTION_ID_NEPTEO>" `
  -TenantId "<TENANT_ID_NEPTEO>" `
  -ExpectedSubscriptionName "<NOM_SOUSCRIPTION_NEPTEO>" `
  -Location "francecentral" `
  -ResourceGroup "nepteo-prod-rg" `
  -AcrName "<ACR_UNIQUE>" `
  -ContainerAppName "nepteo-prod" `
  -AllowMissingResources
```

`-AllowMissingResources` est normal avant le provisioning. Le script ne crée et
ne modifie rien. Si le compte, le tenant ou la souscription diffère, on s’arrête.

## 2. Provisionner l’infrastructure

Valeurs recommandées pour le test :

- région : `francecentral` (ou `westeurope` / `northeurope`) ;
- resource group : `nepteo-prod-rg` ;
- Container Apps Environment : `nepteo-prod-env` ;
- Container App : `nepteo-prod` ;
- image : `nepteo` ;
- ACR Basic : nom globalement unique, uniquement en lettres/chiffres.

Chaque commande conserve `--subscription` pour empêcher un basculement
implicite vers un autre compte.

```powershell
$subscriptionId = "<SUBSCRIPTION_ID_NEPTEO>"
$location = "francecentral"
$resourceGroup = "nepteo-prod-rg"
$acrName = "<ACR_UNIQUE>"

az group create `
  --name $resourceGroup `
  --location $location `
  --subscription $subscriptionId

az deployment group what-if `
  --resource-group $resourceGroup `
  --subscription $subscriptionId `
  --template-file infra/azure/main.bicep `
  --parameters `
    location=$location `
    acrName=$acrName `
    containerAppsEnvironmentName="nepteo-prod-env" `
    containerAppName="nepteo-prod" `
    imageName="nepteo"
```

Lire intégralement le `what-if`. Seulement si la cible et les ressources sont
correctes :

```powershell
az deployment group create `
  --name "nepteo-infra" `
  --resource-group $resourceGroup `
  --subscription $subscriptionId `
  --template-file infra/azure/main.bicep `
  --parameters `
    location=$location `
    acrName=$acrName `
    containerAppsEnvironmentName="nepteo-prod-env" `
    containerAppName="nepteo-prod" `
    imageName="nepteo"
```

Le template crée ACR sans compte administrateur, une identité managée dédiée au
pull ACR, le rôle `AcrPull`, Log Analytics, l’environnement Container Apps et
l’app publique sur le port 3000 avec scale-to-zero.

Le compte qui exécute ce provisioning doit avoir le droit de créer une
attribution de rôle (`Owner` ou `User Access Administrator` en plus des droits
de création de ressources), car le template attribue `AcrPull`.

Après provisioning, relancer `verify-target.ps1` sans
`-AllowMissingResources`.

## 3. Créer l’identité OIDC GitHub

Créer dans **le tenant Nepteo** une App Registration / service principal dédiée,
par exemple `github-nepteo-production`. Elle ne doit pas avoir de mot de passe.

Ajouter une Federated Credential GitHub :

| Champ | Valeur |
|---|---|
| Organization | `Shaaakir281` |
| Repository | `nepteo` |
| Entity | `Environment` |
| Environment | `production` |
| Subject attendu | `repo:Shaaakir281@128485159/nepteo@1305970728:environment:production` |

GitHub émet ici un sujet fondé sur les identifiants immuables du propriétaire et
du dépôt. Utiliser le sujet exact présenté dans l’assertion OIDC ; le fichier
`infra/azure/github-federated-credential.json` contient la valeur validée en
production.

Attribuer au service principal, au moindre périmètre possible :

- `Container Apps Contributor` sur le resource group `nepteo-prod-rg` ;
- `Container Registry Tasks Contributor` sur l’ACR, requis par
  `az acr build` ;
- `Managed Identity Operator` uniquement sur l’identité
  `nepteo-prod-acr-pull`, pour autoriser la Container App à continuer de
  l’utiliser lors de ses mises à jour.

L’identité managée de la Container App, et non GitHub, porte `AcrPull`.

## 4. Configurer l’environnement GitHub `production`

Dans GitHub : **Settings → Environments → New environment → `production`**.
Limiter si possible le déploiement à `main` et ajouter une approbation manuelle.
Les secrets de cet environnement ne sont accessibles au job qu’après ses règles
de protection.

### Variables obligatoires

| Variable | Exemple |
|---|---|
| `ACR_NAME` | `<ACR_UNIQUE>` |
| `IMAGE_NAME` | `nepteo` |
| `RESOURCE_GROUP` | `nepteo-prod-rg` |
| `CONTAINER_APP` | `nepteo-prod` |
| `AZURE_LOCATION` | `francecentral` |
| `APP_URL` | `https://nepteo.bogasolution.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://….supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publishable/anon |
| `LLM_MODEL` | `openai:gpt-5.4` ou modèle choisi |
| `LLM_MODEL_LIGHT` | modèle choisi |
| `LLM_MODEL_PREMIUM` | modèle choisi |

`APP_URL` est l'origine publique utilisée pour les liens d'authentification ;
elle est obligatoire en production afin qu'un proxy ne puisse pas injecter
l'adresse interne du conteneur. Les deux variables `NEXT_PUBLIC_*` sont
publiques par nature et sont injectées au build Next.js **et** au runtime.

### Secrets obligatoires

| Secret | Remarque |
|---|---|
| `AZURE_CLIENT_ID` | client ID de l’identité OIDC dédiée |
| `AZURE_TENANT_ID` | tenant Nepteo vérifié |
| `AZURE_SUBSCRIPTION_ID` | souscription Nepteo vérifiée |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur uniquement |
| `CONNECTOR_TOKEN_ENCRYPTION_KEY` | 32 octets base64 ; ne plus la faire tourner après connexion de connecteurs |
| `CRON_SECRET` | aléatoire, même si le cron reste désactivé au départ |
| `OPENAI_API_KEY` | obligatoire pour cette release : génération Story côté serveur |
| `ANTHROPIC_API_KEY` | obligatoire seulement si un modèle Anthropic est configuré pour le texte |

### Configuration optionnelle

Variables :

- `GOOGLE_OAUTH_CLIENT_ID`, `NOTION_OAUTH_CLIENT_ID` ;
- `RESEARCH_PROVIDER`, `RESEARCH_OPENAI_MODEL`, `PERPLEXITY_PRESET` ;
- `OPENAI_IMAGE_MODEL` — propagé au runtime ; absent = `gpt-image-2` ;
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASE_URL` ;
- les overrides `LLM_TASK_*` listés dans `.env.example`.

Secrets :

- `GOOGLE_OAUTH_CLIENT_SECRET`, `NOTION_OAUTH_CLIENT_SECRET` ;
- `PERPLEXITY_API_KEY` ;
- `LANGFUSE_SECRET_KEY` ;
- `GOOGLE_GENERATIVE_AI_API_KEY`, `MISTRAL_API_KEY`.

Un connecteur OAuth doit toujours avoir son ID **et** son secret. Le workflow
refuse une paire incomplète. Les secrets applicatifs sont enregistrés comme
secrets Container Apps et référencés par `secretref:` ; ils ne sont jamais
intégrés dans l’image.

## 5. Configurer les URLs de production

Récupérer le FQDN :

```powershell
az containerapp show `
  --name "nepteo-prod" `
  --resource-group "nepteo-prod-rg" `
  --subscription "<SUBSCRIPTION_ID_NEPTEO>" `
  --query properties.configuration.ingress.fqdn `
  -o tsv
```

Avec `https://<DOMAINE_PROD>` :

1. Supabase → Authentication → URL Configuration :
   - Site URL : `https://<DOMAINE_PROD>` ;
   - Redirect URL : `https://<DOMAINE_PROD>/auth/confirm`.
2. Supabase → Authentication → Emails → Templates → **Confirm signup** :
   - sujet de production Nepteo en français ;
   - corps synchronisé depuis `supabase/templates/confirm-signup.html` ;
   - conserver exactement `{{ .ConfirmationURL }}` dans chaque lien de confirmation ;
   - après toute correction, demander un **nouvel** email : les liens déjà émis
     conservent leur ancien `redirect_to` et sont immuables.
3. Google OAuth, si activé :
   - `https://<DOMAINE_PROD>/api/connectors/google_sheets/callback`.
4. Notion OAuth, si activé :
   - `https://<DOMAINE_PROD>/api/connectors/notion/callback`.

Sans les deux réglages d'URL Supabase, le lien de confirmation envoyé à un nouvel
inscrit peut revenir sur localhost ou être refusé, et le parcours de l’ami
s’arrête avant `/auth/confirm`. Le modèle d'email est un réglage hébergé séparé :
un déploiement applicatif ne traduit pas automatiquement le modèle Supabase.

Pour la production Nepteo, le domaine principal est
`https://nepteo.bogasolution.com`. Le sous-domaine OVH pointe par CNAME vers le
FQDN Container Apps, et Azure porte un certificat managé validé par CNAME. Le
FQDN `azurecontainerapps.io` reste une adresse technique ; les URLs Supabase et
OAuth doivent utiliser le domaine principal.

## 6. Premier déploiement

### Préalable Supabase

Appliquer manuellement toutes les migrations dans l'ordre. Depuis une base à
`21`, le lot intégré impose `0022` à `0028` sans en sauter. Le projet lié est
déjà vérifié à `28` : ne pas rejouer `0028`. Sur tout autre environnement encore
à 27, exécuter impérativement `0028` d'abord sur une base Supabase de
staging/recette distincte.
Y valider RLS/JWT, quotas et accès concurrents, bucket privé, réconciliation
pending/cron et validation atomique campagne + visuel. La production ne doit
jamais constituer la première exécution de `0028` ; son application reste une
opération séparée soumise à autorisation explicite. Contrôler ensuite avec le
service role :

```sql
select version
from public.app_schema_version
where id = 1;
```

La valeur doit être au moins `28` pour le lot créatif. `0016` introduit ce
marqueur ; `0025` crée les propositions Campagnes atomiques, `0026` le studio,
`0027` le cockpit et le cycle de décision, puis `0028` ajoute le bucket privé,
les quotas, les versions et la validation atomique campagne + visuel. Ne jamais
modifier le marqueur à la main pour contourner une migration absente.

Le bucket contient des objets hors des tables PostgreSQL. Avant toute suppression
d'organisation ou de métadonnées créatives, supprimer explicitement les objets
`campaign-creatives` concernés avec le service role, puis les lignes SQL. Les
clés étrangères de `0028` bloquent volontairement une cascade qui laisserait des
JPEG orphelins.

Le cron quotidien appelle aussi la réconciliation créative. Vérifier dans sa
réponse `creative_storage_retention` : un upload interrompu conserve d'abord son
chemin pending, puis le cron supprime l'objet et remet ce chemin à `null`. Un
échec non nul reste un incident Storage à traiter avant de supprimer les lignes.
Tout le travail encore possible est exécuté, puis la route renvoie 503 si une
rétention, la lecture ou la synchronisation d'un connecteur, ou l'analyse
post-sync a échoué. Le workflow planifié passe ainsi au rouge au lieu de masquer
l'incident, tout en conservant les résultats détaillés dans la réponse.

Le workflow `.github/workflows/deploy.yml` est volontairement
`workflow_dispatch` uniquement pour le premier déploiement :

1. GitHub → Actions → **Deploy (Azure Container Apps)** ;
2. **Run workflow** depuis `main` ;
3. recopier l’ID exact de la souscription Nepteo ;
4. approuver l’environnement `production`, s’il est protégé.

Le job :

1. compare la saisie à `AZURE_SUBSCRIPTION_ID` ;
2. se connecte par OIDC ;
3. revalide en lecture seule souscription, tenant et région ;
4. vérifie que Supabase est joignable et que `app_schema_version >= 28` ;
5. seulement alors, construit l’image Node 22 dans ACR, taguée avec le SHA Git ;
6. configure secrets et variables runtime ;
7. déploie une révision Container Apps ;
8. teste publiquement `/api/health`, puis `/api/ready`.

Le contrôle du schéma précède ainsi la première mutation Azure. `/api/health`
est un contrôle de liveness du processus et ne touche pas la base ;
`/api/ready` confirme après déploiement l'accès à Supabase et la compatibilité
du schéma. Une réponse 200 de `/api/health` ne compense jamais un échec de
`/api/ready`.

Le workflow reste volontairement manuel. Toute automatisation future du trigger
`push: branches: [main]` devra conserver les contrôles de cible. Le cron
`.github/workflows/sync-cron.yml` reste optionnel. Pour l’activer tel qu’il est
écrit, ajouter `APP_URL` comme **variable de dépôt** et dupliquer
`CRON_SECRET` comme **secret de dépôt** (le job planifié ne lit pas
l’environnement GitHub `production`).

### Preuve de la release courante PR #31 du 10 août 2026

- PR [#31](https://github.com/Shaaakir281/nepteo/pull/31) fusionnée dans `main`
  au SHA `7424d2926e6423e1af674c741eb90dc1fcd914a3` ;
- CI de PR verte, run `31368969929` : 574/574 tests, lint, typecheck et build
  de 29 pages/routes ;
- workflow de déploiement vert, run `31369161993`, après approbation de
  l'environnement `production` ;
- Container Apps : `latestRevisionName` et `latestReadyRevisionName` valent
  `nepteo-prod--0000023`, état `Succeeded`/`Running`, révision active,
  Healthy/Provisioned/RunningAtMaxScale avec une réplique, 100 % du trafic,
  image
  `nepteoacr27de3b.azurecr.io/nepteo:7424d2926e6423e1af674c741eb90dc1fcd914a3` ;
- Supabase : `app_schema_version = 28` inchangé ; aucune migration ni aucun
  connecteur modifié par ce lot ;
- domaine public : `/` aboutit à `/login` en 200 ; `/login`, `/signup`,
  `/api/health` et `/api/ready` répondent 200. Health/readiness sont aussi verts
  sur le FQDN Azure ;
- recette navigateur : Afficher/Masquer est présent sur connexion et inscription,
  fait passer le champ de `password` à `text` et conserve la valeur saisie ;
- configuration Auth Supabase : Site URL de production, unique callback
  `/auth/confirm` et modèle Confirm signup français publiés. Un nouvel email et
  le parcours Déconnexion puis Retour en session mobile restent à exécuter.

### Historique — preuve de la release PR #29 du 9 août 2026

- PR [#29](https://github.com/Shaaakir281/nepteo/pull/29) fusionnée dans `main`
  au SHA `c5e7148ad62908a52536f6b2b52fd32ed0c357c0` ;
- CI de PR verte, run `31332578671` : 571/571 tests, lint, typecheck et build ;
- workflow de déploiement vert, run `31332676182`, après approbation de
  l'environnement `production` ;
- Container Apps : `latestRevisionName` et `latestReadyRevisionName` valent
  `nepteo-prod--0000022`, état `Succeeded`/`Running`, 100 % du trafic, image
  `nepteoacr27de3b.azurecr.io/nepteo:c5e7148ad62908a52536f6b2b52fd32ed0c357c0` ;
- Supabase : `app_schema_version = 28`, tables créatives accessibles et bucket
  `campaign-creatives` privé, JPEG uniquement, limite 12 Mo ;
- contrôles directs sur le domaine public : `/` répond 307 vers `/login`, puis
  la réponse finale est 200 ; `/api/health` et `/api/ready` répondent 200.
  Health/readiness sont également verts sur le FQDN Azure ;
- contrôle responsive desktop/mobile sans débordement, puis un unique parcours
  authentifié : campagne préremplie, Story 9:16 `gpt-image-2` 1008 × 1792,
  persistance par URL signée, sélection et validation atomique campagne + visuel ;
- garde-fous JWT : asset propre lisible, requêtes internes et update direct
  refusés en `42501`, accès Storage direct refusé en 404 ;
- nettoyage : objet, asset, requête de génération, action/campagne et acteur du
  run supprimés ; aucune donnée Connecteurs, prospects, outbox ou Ads modifiée.
  L'organisation-coquille et le journal append-only sont conservés ; l'acteur
  CSV dédié a été reprovisionné et le smoke CSV officiel est de nouveau vert.

Cette preuve ferme la promotion technique et la recette Story ciblée de PR #29.
Les callbacks/lectures OAuth réels, le smoke inter-tenant/concurrence complet et
le gate `reset → reseed → préparation → exécution` restent ouverts. C7 reste fermé.

### Historique — preuve de la release PR #17 du 31 juillet 2026

- PR [#17](https://github.com/Shaaakir281/nepteo/pull/17) fusionnée dans
  `main` au SHA `704efabd80de434ea2619cd993ae87427c114838` ;
- CI de PR verte, run `30620564365`, sur le head
  `28781aad52564f02fcee1c0dda4b5ee5291836b8` ;
- CI `main` verte, run `30620691704` ;
- workflow de déploiement vert, run `30620812901` ;
- validation automatisée : 385/385 tests, typecheck, lint et build verts,
  24 pages/routes générées ; relecture finale sans défaut P1 ni P2 ;
- Container Apps : `latestRevisionName` et `latestReadyRevisionName` valent
  `nepteo-prod--0000011`, état Healthy/Provisioned/RunningAtMaxScale, une
  réplique et 100 % du trafic, image
  `nepteoacr27de3b.azurecr.io/nepteo:704efabd80de434ea2619cd993ae87427c114838`,
  digest attesté
  `sha256:fe6cafbe991c45952262e33be965e4ba09239ff421a86dce80231117a3504425` ;
- Supabase : migrations `0012` à `0021`, `app_schema_version = 21` ;
- six contrôles HTTP 200 : `/`, `/api/health` et `/api/ready` sur le domaine
  public, puis sur le FQDN Azure ;
- recette authentifiée : les surfaces emploient « scénario d'exemple Nepteo »
  et « données d'exemple » et les anciens libellés ont disparu ; le briefing
  attribue explicitement sa source aux données d'exemple du scénario Nepteo ;
  l'identité reste en lecture seule et l'accès direct à
  `/onboarding/identite` est redirigé vers « Mon entreprise » avec le message
  de garde ; Northwind reste actif sans mutation de ses données pendant la
  recette ; console navigateur vide ;
- garde historique : PR #16 / `nepteo-prod--0000010` est la release attestée
  précédente et ne décrit plus l'état courant de production ;
- étape historique PR #15 / `nepteo-prod--0000009` : reconstruction de
  production appliquée après sauvegarde
  (`sha256:ffa9536fadf70d195cebc9b63c4fcfb73e3745ede0e9a20be31348cd6748e07c`) :
  48 prospects, 6 connecteurs et 8 rubriques retirés, nom et membres préservés ;
  les cycles de chargement et d'analyse des trois scénarios avaient produit six
  propositions chacun.

Cette preuve ferme la promotion technique et la recette ciblée de PR #17. Le
gate complet `reset → reseed → préparation → exécution` reste ouvert ; le smoke
RLS multi-rôles complet, les OAuth réels et les parcours terrain commanditaires
restent à jouer avant de déclarer le pilote entièrement recetté. C7 reste fermé.

> **Note non bloquante** : le déploiement vert signale la dépréciation future
> du runtime Node 20 utilisé par certaines actions GitHub. Ce warning n'affecte
> ni l'artefact ni la révision ; mettre à niveau les actions concernées avant le
> retrait effectif de ce runtime.

### Historique — contrat spécifique PR #17

La voie Nepteo expose désormais uniquement « scénario d'exemple Nepteo » et
« données d'exemple » ; `certified-demo` reste un marqueur technique. La voie
apportée par le testeur reste « environnement de test » et précise que ses
données peuvent être réelles ou synthétiques. La couverture automatisée vérifie
aussi le refus `unsafe_existing_data` avant toute mutation et le latch UI
fail-closed lorsque l'inventaire rendu devient obsolète.

## 7. Smoke test produit obligatoire

Le test public automatique ne remplace pas ce parcours authentifié :

1. vérifier que `GET /api/health` et `GET /api/ready` répondent tous deux 200 ;
2. créer un nouvel utilisateur avec l’adresse de test de l’ami ;
3. ouvrir l’e-mail de confirmation et vérifier l’arrivée sur
   `/auth/confirm`, puis dans l’app ;
4. terminer l’onboarding dans une organisation de test neuve et vide ;
5. avec le rôle admin, charger un scénario de démonstration ;
6. lancer **Analyser mes données maintenant** et vérifier les propositions ;
7. dans la même session authentifiée, ouvrir `GET /api/llm/status` et vérifier :
   - HTTP 200 ;
   - modèles `light`, `standard`, `premium` attendus ;
   - clé du fournisseur sélectionné à `true` ;
   - fournisseur de recherche attendu ou `null` s’il est volontairement
     désactivé.
8. préparer une campagne, ouvrir la Story préremplie, générer deux versions,
   en sélectionner une puis approuver ; vérifier le journal, la miniature et
   l'absence de publication fournisseur ;
9. recetter ensuite les connecteurs : Google Sheets/Notion, pause/reprise/
   révocation, puis lecture Meta bornée sans écriture Ads ni alimentation
   implicite de `ad_metrics`.

Ne lancer `POST /api/llm/status` que si un ping LLM facturé est souhaité.

## 8. Points de contrôle après déploiement

- l’image active porte le SHA Git, jamais `latest` ;
- l’ACR a `adminUserEnabled: false` ;
- le pull ACR passe par l’identité managée ;
- aucun secret n’apparaît dans l’image, le dépôt ou les logs GitHub ;
- la révision est en région `AZURE_LOCATION` ;
- les URLs Supabase et OAuth utilisent exactement le domaine de production ;
- un nouvel email de confirmation est en français, ne contient jamais
  `0.0.0.0` et passe par `/auth/confirm` ;
- en session mobile authentifiée, Déconnexion redirige vers `/login` et le
  bouton Retour ne restaure pas le cockpit ;
- `CONNECTOR_TOKEN_ENCRYPTION_KEY` est sauvegardée durablement ;
- `app_schema_version.version >= 28` pour le lot créatif ;
- `/api/health` et `/api/ready` répondent tous deux 200.
