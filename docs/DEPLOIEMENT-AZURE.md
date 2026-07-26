# Déploiement Nepteo — Azure Container Apps

Cette procédure prépare un déploiement Docker vers Azure Container Apps, avec
images dans ACR, région UE et GitHub Actions en OIDC.

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
| Subject attendu | `repo:Shaaakir281/nepteo:environment:production` |

Attribuer au service principal, au moindre périmètre possible :

- `Container Apps Contributor` sur le resource group `nepteo-prod-rg` ;
- `Container Registry Tasks Contributor` sur l’ACR, requis par
  `az acr build`.

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
| `NEXT_PUBLIC_SUPABASE_URL` | `https://….supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publishable/anon |
| `LLM_MODEL` | `openai:gpt-5.4` ou modèle choisi |
| `LLM_MODEL_LIGHT` | modèle choisi |
| `LLM_MODEL_PREMIUM` | modèle choisi |

Les deux variables `NEXT_PUBLIC_*` sont publiques par nature et sont injectées
au build Next.js **et** au runtime.

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

## 6. Premier déploiement

Le workflow `.github/workflows/deploy.yml` est volontairement
`workflow_dispatch` uniquement pour le premier déploiement :

1. GitHub → Actions → **Deploy (Azure Container Apps)** ;
2. **Run workflow** depuis `main` ;
3. recopier l’ID exact de la souscription Nepteo ;
4. approuver l’environnement `production`, s’il est protégé.

Le job :

1. compare la saisie à `AZURE_SUBSCRIPTION_ID` ;
2. se connecte par OIDC ;
3. revalide souscription, tenant et région ;
4. construit l’image Node 22 dans ACR, taguée avec le SHA Git ;
5. configure secrets et variables runtime ;
6. déploie une révision Container Apps ;
7. teste publiquement `/api/health`.

Une fois le premier déploiement validé, on pourra ajouter le trigger
`push: branches: [main]` tout en conservant les contrôles de cible. Le cron
`.github/workflows/sync-cron.yml` reste optionnel. Pour l’activer tel qu’il est
écrit, ajouter `APP_URL` comme **variable de dépôt** et dupliquer
`CRON_SECRET` comme **secret de dépôt** (le job planifié ne lit pas
l’environnement GitHub `production`).

## 7. Smoke test produit obligatoire

Le test public automatique ne remplace pas ce parcours authentifié :

1. créer un nouvel utilisateur avec l’adresse de test de l’ami ;
2. ouvrir l’e-mail de confirmation et vérifier l’arrivée sur
   `/auth/confirm`, puis dans l’app ;
3. terminer l’onboarding ;
4. charger un scénario de démonstration ;
5. lancer **Analyser mes données maintenant** et vérifier les propositions ;
6. dans la même session authentifiée, ouvrir `GET /api/llm/status` et vérifier :
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
- `CONNECTOR_TOKEN_ENCRYPTION_KEY` est sauvegardée durablement.
