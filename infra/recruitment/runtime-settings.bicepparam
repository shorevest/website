using 'runtime-settings.bicep'

param functionAppName = 'svplaceholder-recruit-fn-dev'
param managedIdentityName = 'svplaceholder-recruit-mi-dev'
param hostStorageAccountName = 'svplaceholderfnpkgdev'
param cosmosAccountName = 'svplaceholder-recruit-cosmos-dev'
param cvStorageAccountName = 'svplaceholdercvdev'
param keyVaultName = 'svplaceholder-recruit-kv-dev'
param applicationInsightsName = 'svplaceholder-recruit-ai-dev'
param environmentName = 'dev'

param apiEnabled = false
param outboxDeliveryEnabled = false
param candidateAcknowledgementEnabled = false
param candidateAcknowledgementTemplateApproved = false
param hrAccessEnabled = false
param platformAuthenticationEnabled = false

param sharePointSiteId = ''
param applicationsListId = ''
param filesListId = ''
param candidateAcknowledgementMailbox = ''
