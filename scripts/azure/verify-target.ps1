[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string]$TenantId,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedSubscriptionName,

    [Parameter(Mandatory = $true)]
    [ValidateSet('francecentral', 'westeurope', 'northeurope')]
    [string]$Location,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory = $true)]
    [string]$AcrName,

    [Parameter(Mandatory = $true)]
    [string]$ContainerAppName,

    [switch]$AllowMissingResources
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw 'Azure CLI (az) est introuvable.'
}

$accountJson = az account show --subscription $SubscriptionId --output json 2>$null
if ($LASTEXITCODE -ne 0 -or -not $accountJson) {
    throw "Souscription inaccessible. Connecte d'abord le bon compte avec : az login --tenant $TenantId"
}

$account = $accountJson | ConvertFrom-Json
if ($account.id -ne $SubscriptionId) {
    throw "ID inattendu : '$($account.id)' au lieu de '$SubscriptionId'."
}
if ($account.tenantId -ne $TenantId) {
    throw "Tenant inattendu : '$($account.tenantId)' au lieu de '$TenantId'."
}
if ($account.name -ne $ExpectedSubscriptionName) {
    throw "Nom de souscription inattendu : '$($account.name)' au lieu de '$ExpectedSubscriptionName'."
}
if ($account.state -ne 'Enabled') {
    throw "La souscription '$($account.name)' n'est pas active (état : $($account.state))."
}

Write-Host ''
Write-Host 'Cible Azure vérifiée (lecture seule)' -ForegroundColor Green
Write-Host "  Compte       : $($account.user.name)"
Write-Host "  Souscription : $($account.name)"
Write-Host "  ID           : $($account.id)"
Write-Host "  Tenant       : $($account.tenantId)"
Write-Host "  Région       : $Location"
Write-Host ''

$groupExists = az group exists --name $ResourceGroup --subscription $SubscriptionId --output tsv
if ($groupExists -ne 'true') {
    if ($AllowMissingResources) {
        Write-Host "Resource group absent (normal avant provisioning) : $ResourceGroup" -ForegroundColor Yellow
        exit 0
    }
    throw "Resource group introuvable : '$ResourceGroup'."
}

$acrLocation = az acr show `
    --name $AcrName `
    --resource-group $ResourceGroup `
    --subscription $SubscriptionId `
    --query location `
    --output tsv 2>$null
$acrExitCode = $LASTEXITCODE

$appLocation = az containerapp show `
    --name $ContainerAppName `
    --resource-group $ResourceGroup `
    --subscription $SubscriptionId `
    --query location `
    --output tsv 2>$null
$appExitCode = $LASTEXITCODE

if ($AllowMissingResources -and ($acrExitCode -ne 0 -or $appExitCode -ne 0)) {
    Write-Host 'Une ou plusieurs ressources sont absentes (normal avant provisioning).' -ForegroundColor Yellow
    exit 0
}
if ($acrExitCode -ne 0) {
    throw "ACR introuvable : '$AcrName'."
}
if ($appExitCode -ne 0) {
    throw "Container App introuvable : '$ContainerAppName'."
}
if ($acrLocation -ne $Location) {
    throw "L'ACR est en '$acrLocation', pas en '$Location'."
}
if ($appLocation -ne $Location) {
    throw "La Container App est en '$appLocation', pas en '$Location'."
}

Write-Host "  ACR          : $AcrName ($acrLocation)" -ForegroundColor Green
Write-Host "  Container App: $ContainerAppName ($appLocation)" -ForegroundColor Green
Write-Host ''
Write-Host 'Toutes les vérifications sont passées. Ce script ne modifie rien.' -ForegroundColor Green
