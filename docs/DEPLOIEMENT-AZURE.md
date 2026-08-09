# Déploiement Nepteo — Azure Container Apps

Cette procédure prépare un déploiement Docker vers Azure Container Apps, avec
images dans ACR, région UE et GitHub Actions en OIDC.

> **État au 31 juillet 2026 — release courante attestée** : la PR #17 est
> fusionnée dans `main` au SHA `704efabd80de434ea2619cd993ae87427c114838`.
> Sa CI `30620564365` est verte sur le head
> `28781aad52564f02fcee1c0dda4b5ee5291836b8` ; la CI `main` `30620691704`
> et le déploiement `30620812901` sont verts. Azure sert à 100 %, avec une
> réplique, la révision `nepteo-prod--0000011`, latest et ready, état
> Healthy/Provisioned/RunningAtMaxScale, image
> `nepteoacr27de3b.azurecr.io/nepteo:704efabd80de434ea2619cd993ae87427c114838`,
> digest `sha256:fe6cafbe991c45952262e33be965e4ba09239ff421a86dce80231117a3504425`.
> Supabase production porte les migrations `0012` à `0021` et
> `app_schema_version = 21`. REL-0 reste local et exige `0022` à `0027`, donc
> `app_schema_version = 27`, avant toute publication. Le workflow ne lance
> aucune migration : leur application manuelle reste un préalable obligatoire à
> tout code qui les exige.
>
> **Historique — ne pas confondre avec la release courante** : la PR #16 a été
> attestée sur `nepteo-prod--0000010`, au merge
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
| `OPENAI_API_KEY` et/ou `ANTHROPIC_API_KEY` | au moins une clé correspondant aux modèles configurés |

### Configuration optionnelle

Variables :

- `GOOGLE_OAUTH_CLIENT_ID`, `NOTION_OAUTH_CLIENT_ID` ;
- `RESEARCH_PROVIDER`, `RESEARCH_OPENAI_MODEL`, `PERPLEXITY_PRESET` ;
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
2. Google OAuth, si activé :
   - `https://<DOMAINE_PROD>/api/connectors/google_sheets/callback`.
3. Notion OAuth, si activé :
   - `https://<DOMAINE_PROD>/api/connectors/notion/callback`.

Sans les deux réglages Supabase, le lien de confirmation envoyé à un nouvel
inscrit peut revenir sur localhost ou être refusé, et le parcours de l’ami
s’arrête avant `/auth/confirm`.

Pour la production Nepteo, le domaine principal est
`https://nepteo.bogasolution.com`. Le sous-domaine OVH pointe par CNAME vers le
FQDN Container Apps, et Azure porte un certificat managé validé par CNAME. Le
FQDN `azurecontainerapps.io` reste une adresse technique ; les URLs Supabase et
OAuth doivent utiliser le domaine principal.

## 6. Premier déploiement

### Préalable Supabase

Appliquer manuellement toutes les migrations dans l'ordre. Pour une base de
production actuellement à `21`, REL-0 impose `0022` à `0027` sans en sauter,
dans cet ordre. Contrôler ensuite avec le service role :

```sql
select version
from public.app_schema_version
where id = 1;
```

La valeur doit être au moins `27` pour REL-0. `0016` introduit ce marqueur et
les migrations ultérieures le font progresser ; `0025` crée les propositions
Campagnes atomiques, `0026` le studio, puis `0027` le cockpit et le cycle de
décision. `0025` exige le schéma 24, `0026` le 25 et `0027` le 26. Ne jamais
modifier le marqueur à la main pour contourner une migration absente.

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
4. vérifie que Supabase est joignable et que `app_schema_version >= 27` ;
5. seulement alors, construit l’image Node 22 dans ACR, taguée avec le SHA Git ;
6. configure secrets et variables runtime ;
7. déploie une révision Container Apps ;
8. teste publiquement `/api/health`, puis `/api/ready`.

Le contrôle du schéma précède ainsi la première mutation Azure. `/api/health`
est un contrôle de liveness du processus et ne touche pas la base ;
`/api/ready` confirme après déploiement l'accès à Supabase et la compatibilité
du schéma. Une réponse 200 de `/api/health` ne compense jamais un échec de
`/api/ready`.

Une fois le premier déploiement validé, on pourra ajouter le trigger
`push: branches: [main]` tout en conservant les contrôles de cible. Le cron
`.github/workflows/sync-cron.yml` reste optionnel. Pour l’activer tel qu’il est
écrit, ajouter `APP_URL` comme **variable de dépôt** et dupliquer
`CRON_SECRET` comme **secret de dépôt** (le job planifié ne lit pas
l’environnement GitHub `production`).

### Preuve de la release courante PR #17 du 31 juillet 2026

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

### Contrat spécifique PR #17 désormais promu

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

Ne lancer `POST /api/llm/status` que si un ping LLM facturé est souhaité.

## 8. Points de contrôle après déploiement

- l’image active porte le SHA Git, jamais `latest` ;
- l’ACR a `adminUserEnabled: false` ;
- le pull ACR passe par l’identité managée ;
- aucun secret n’apparaît dans l’image, le dépôt ou les logs GitHub ;
- la révision est en région `AZURE_LOCATION` ;
- les URLs Supabase et OAuth utilisent exactement le domaine de production ;
- `CONNECTOR_TOKEN_ENCRYPTION_KEY` est sauvegardée durablement ;
- `app_schema_version.version >= 27` ;
- `/api/health` et `/api/ready` répondent tous deux 200.
