targetScope = 'resourceGroup'

@description('Environment name, e.g. dev/test/prod.')
param environmentName string
@description('Short globally unique name prefix. No real subscription or tenant IDs are committed.')
param namePrefix string
@description('Location for all resources.')
param location string = resourceGroup().location
@description('Paid Microsoft Defender for Storage malware scanning. Explicit opt-in only.')
param enableDefenderForStorage bool = false
@allowed(['Enabled', 'Disabled'])
param cvStoragePublicNetworkAccess string = 'Enabled'

var tags = { workload: 'recruitment', phase: '2B.1A', environment: environmentName }
var functionName = '${namePrefix}-recruit-fn-${environmentName}'
var identityName = '${namePrefix}-recruit-mi-${environmentName}'
var appSettings = [
  { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
  { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
  { name: 'RECRUITMENT_ENVIRONMENT', value: environmentName }
  { name: 'RECRUITMENT_API_ENABLED', value: 'false' }
  { name: 'RECRUITMENT_ALLOWED_ORIGINS', value: 'https://shorevest.com,https://www.shorevest.com' }
  { name: 'RECRUITMENT_COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
  { name: 'RECRUITMENT_COSMOS_DATABASE', value: db.name }
  { name: 'RECRUITMENT_COSMOS_SUBMISSIONS_CONTAINER', value: submissions.name }
  { name: 'RECRUITMENT_COSMOS_IDEMPOTENCY_CONTAINER', value: idempotency.name }
  { name: 'RECRUITMENT_COSMOS_RATE_LIMIT_CONTAINER', value: rateLimits.name }
  { name: 'RECRUITMENT_STORAGE_ACCOUNT_URL', value: 'https://${cvStorage.name}.blob.core.windows.net' }
  { name: 'RECRUITMENT_UPLOAD_STORAGE_ACCOUNT_NAME', value: cvStorage.name }
  { name: 'RECRUITMENT_QUARANTINE_CONTAINER', value: quarantine.name }
  { name: 'RECRUITMENT_CLEAN_CONTAINER', value: clean.name }
  { name: 'RECRUITMENT_KEYVAULT_URL', value: vault.properties.vaultUri }
  { name: 'RECRUITMENT_COMPLETION_TOKEN_SECRET_NAME', value: 'recruitment-completion-token' }
  { name: 'RECRUITMENT_FINGERPRINT_SECRET_NAME', value: 'recruitment-fingerprint' }
  { name: 'RECRUITMENT_RATE_LIMIT_SECRET_NAME', value: 'recruitment-rate-limit-hmac' }
  { name: 'RECRUITMENT_RATE_LIMIT_ENABLED', value: 'true' }
  { name: 'RECRUITMENT_RATE_LIMIT_COUNT', value: '5' }
  { name: 'RECRUITMENT_RATE_LIMIT_WINDOW_SECONDS', value: '300' }
  { name: 'RECRUITMENT_BOT_VERIFICATION_MODE', value: 'provider-required' }
  { name: 'RECRUITMENT_MANAGED_IDENTITY_CLIENT_ID', value: mi.properties.clientId }
  { name: 'AZURE_CLIENT_ID', value: mi.properties.clientId }
  { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: ai.properties.ConnectionString }
  { name: 'AzureWebJobsStorage__accountName', value: hostStorage.name }
  { name: 'AzureWebJobsStorage__credential', value: 'managedidentity' }
  { name: 'AzureWebJobsStorage__clientId', value: mi.properties.clientId }
]

resource log 'Microsoft.OperationalInsights/workspaces@2023-09-01' = { name: '${namePrefix}-recruit-law-${environmentName}' location: location tags: tags properties: { sku: { name: 'PerGB2018' } retentionInDays: 30 } }
resource ai 'Microsoft.Insights/components@2020-02-02' = { name: '${namePrefix}-recruit-ai-${environmentName}' location: location tags: tags kind: 'web' properties: { Application_Type: 'web' WorkspaceResourceId: log.id } }
resource mi 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = { name: identityName location: location tags: tags }
resource deployStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = { name: toLower('${namePrefix}fnpkg${environmentName}') location: location tags: tags sku: { name: 'Standard_LRS' } kind: 'StorageV2' properties: { allowBlobPublicAccess: false allowSharedKeyAccess: false minimumTlsVersion: 'TLS1_2' supportsHttpsTrafficOnly: true } }
resource hostStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = { name: toLower('${namePrefix}fnhost${environmentName}') location: location tags: tags sku: { name: 'Standard_LRS' } kind: 'StorageV2' properties: { allowBlobPublicAccess: false allowSharedKeyAccess: false minimumTlsVersion: 'TLS1_2' supportsHttpsTrafficOnly: true } }
resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = { name: '${deployStorage.name}/default/function-packages' properties: { publicAccess: 'None' } }
resource cvStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = { name: toLower('${namePrefix}cv${environmentName}') location: location tags: tags sku: { name: 'Standard_ZRS' } kind: 'StorageV2' properties: { allowBlobPublicAccess: false allowSharedKeyAccess: false minimumTlsVersion: 'TLS1_2' supportsHttpsTrafficOnly: true publicNetworkAccess: cvStoragePublicNetworkAccess } }
resource quarantine 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = { name: '${cvStorage.name}/default/recruitment-quarantine' properties: { publicAccess: 'None' } }
resource clean 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = { name: '${cvStorage.name}/default/recruitment-clean' properties: { publicAccess: 'None' } }
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = { name: '${namePrefix}-recruit-cosmos-${environmentName}' location: location tags: tags kind: 'GlobalDocumentDB' properties: { databaseAccountOfferType: 'Standard' locations: [{ locationName: location failoverPriority: 0 isZoneRedundant: false }] disableLocalAuth: true capabilities: [{ name: 'EnableServerless' }] } }
resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = { parent: cosmos name: 'recruitment' properties: { resource: { id: 'recruitment' } } }
resource submissions 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = { parent: db name: 'submissions' properties: { resource: { id: 'submissions' partitionKey: { paths: ['/applicationReference'] kind: 'Hash' } indexingPolicy: { indexingMode: 'consistent' automatic: true } } } }
resource idempotency 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = { parent: db name: 'idempotency' properties: { resource: { id: 'idempotency' partitionKey: { paths: ['/idempotencyKey'] kind: 'Hash' } } } }
resource rateLimits 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = { parent: db name: 'rateLimits' properties: { resource: { id: 'rateLimits' partitionKey: { paths: ['/key'] kind: 'Hash' } defaultTtl: 3600 } } }
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = { name: '${namePrefix}-recruit-kv-${environmentName}' location: location tags: tags properties: { tenantId: tenant().tenantId sku: { family: 'A' name: 'standard' } enableRbacAuthorization: true enabledForTemplateDeployment: false enableSoftDelete: true softDeleteRetentionInDays: 90 enablePurgeProtection: true } }
resource topic 'Microsoft.EventGrid/topics@2023-12-15-preview' = { name: '${namePrefix}-recruit-scan-${environmentName}' location: location tags: tags properties: { publicNetworkAccess: 'Enabled' } }
resource deadLetter 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = { name: '${deployStorage.name}/default/eventgrid-deadletter' properties: { publicAccess: 'None' } }
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = { name: '${namePrefix}-recruit-flex-${environmentName}' location: location tags: tags sku: { name: 'FC1' tier: 'FlexConsumption' } kind: 'functionapp' properties: { reserved: true } }
resource fn 'Microsoft.Web/sites@2024-04-01' = { name: functionName location: location tags: tags kind: 'functionapp,linux' identity: { type: 'UserAssigned' userAssignedIdentities: { '${mi.id}': {} } } properties: { serverFarmId: plan.id httpsOnly: true functionAppConfig: { runtime: { name: 'node' version: '24' } deployment: { storage: { type: 'blobContainer' value: '${deployStorage.properties.primaryEndpoints.blob}${deploymentContainer.name}' authentication: { type: 'UserAssignedIdentity' userAssignedIdentityResourceId: mi.id } } } scaleAndConcurrency: { maximumInstanceCount: 40 instanceMemoryMB: 2048 } } siteConfig: { appSettings: appSettings } } }
resource scanSubscription 'Microsoft.EventGrid/eventSubscriptions@2023-12-15-preview' = { name: '${topic.name}-defender-function' scope: topic properties: { destination: { endpointType: 'AzureFunction' properties: { resourceId: '${fn.id}/functions/defenderScanResult' } } retryPolicy: { maxDeliveryAttempts: 10 eventTimeToLiveInMinutes: 1440 } deadLetterDestination: { endpointType: 'StorageBlob' properties: { resourceId: deployStorage.id blobContainerName: 'eventgrid-deadletter' } } } }
resource cosmosData 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = { parent: cosmos name: guid(cosmos.id, mi.id, 'cosmos-data') properties: { principalId: mi.properties.principalId roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002' scope: cosmos.id } }
resource blobDataCv 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(cvStorage.id, mi.id, 'blob-data-contributor') scope: cvStorage properties: { principalId: mi.properties.principalId principalType: 'ServicePrincipal' roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') } }
resource blobDataDeploy 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(deployStorage.id, mi.id, 'blob-data-deploy') scope: deployStorage properties: { principalId: mi.properties.principalId principalType: 'ServicePrincipal' roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') } }
resource blobDataHost 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(hostStorage.id, mi.id, 'blob-data-host') scope: hostStorage properties: { principalId: mi.properties.principalId principalType: 'ServicePrincipal' roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') } }
resource kvSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(vault.id, mi.id, 'kv-secrets-user') scope: vault properties: { principalId: mi.properties.principalId principalType: 'ServicePrincipal' roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6c') } }
resource defender 'Microsoft.Security/defenderForStorageSettings@2022-12-01-preview' = if (enableDefenderForStorage) { name: '${cvStorage.name}/current' properties: { isEnabled: true malwareScanning: { onUpload: { isEnabled: true capGBPerMonth: 500 } scanResultsEventGridTopicResourceId: topic.id } } }

output functionAppName string = fn.name
