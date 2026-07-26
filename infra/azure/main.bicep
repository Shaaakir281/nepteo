targetScope = 'resourceGroup'

@description('Azure region used by every Nepteo resource.')
@allowed([
  'francecentral'
  'westeurope'
  'northeurope'
])
param location string = 'francecentral'

@description('Globally unique Azure Container Registry name.')
param acrName string

@description('Azure Container Apps managed environment name.')
param containerAppsEnvironmentName string

@description('Azure Container App name.')
param containerAppName string

@description('ACR repository name used by the deployment workflow.')
param imageName string = 'nepteo'

@description('Small public image used only until the first GitHub deployment.')
param bootstrapImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

param tags object = {
  application: 'nepteo'
  environment: 'production'
  managedBy: 'bicep'
  dataRegion: 'EU'
}

var logAnalyticsName = '${containerAppsEnvironmentName}-logs'
var pullIdentityName = '${containerAppName}-acr-pull'

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: pullIdentityName
  location: location
  tags: tags
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, pullIdentity.id, 'AcrPull')
  scope: registry
  properties: {
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    zoneRedundant: false
  }
}

resource app 'Microsoft.App/containerApps@2025-01-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${pullIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        allowInsecure: false
        external: true
        targetPort: 3000
        transport: 'auto'
      }
      registries: [
        {
          identity: pullIdentity.id
          server: registry.properties.loginServer
        }
      ]
    }
    template: {
      containers: [
        {
          image: bootstrapImage
          name: 'nepteo'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        maxReplicas: 1
        minReplicas: 0
      }
    }
  }
  dependsOn: [
    acrPullRole
  ]
}

output acrId string = registry.id
output acrLoginServer string = registry.properties.loginServer
output acrPullIdentityPrincipalId string = pullIdentity.properties.principalId
output containerAppId string = app.id
output containerAppUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output imageRepository string = '${registry.properties.loginServer}/${imageName}'
