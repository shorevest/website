targetScope = 'resourceGroup'

@description('Existing recruitment Azure Function App.')
param functionAppName string

@description('Existing user-assigned managed identity.')
param managedIdentityName string

@description('Existing storage account used by the Functions host.')
param hostStorageAccountName string

@description('Existing Cosmos DB account.')
param cosmosAccountName string

@description('Existing CV Blob Storage account.')
param cvStorageAccountName string

@description('Existing recruitment Key Vault.')
param keyVaultName string

@description('Existing Application Insights component.')
param applicationInsightsName string

@description('Runtime environment name.')
param environmentName string

@description('Public candidate API enablement. Must remain false until final launch approval.')
param apiEnabled bool = false

@description('Allowed public website origins.')
param allowedOrigins string = 'https://shorevest.com,https://www.shorevest.com'

@description('Key Vault completion-token secret name.')
param completionTokenSecretName string = 'recruitment-completion-token-key'

@description('Key Vault fingerprint secret name.')
param fingerprintSecretName string = 'recruitment-fingerprint-key'

@description('Key Vault Turnstile secret name.')
param botVerificationSecretName string = 'recruitment-turnstile-secret'

@description('Expected Turnstile hostname.')
param botVerificationHostname string = 'shorevest.com'

@minValue(1)
param rateLimitCount int = 5

@minValue(60)
param rateLimitWindowSeconds int = 300

@minValue(1024)
param maxBodyBytes int = 65536

@description('Outbox delivery enablement. Must remain false until SharePoint and mailbox grants are verified.')
param outboxDeliveryEnabled bool = false

@minValue(60)
param outboxLeaseSeconds int = 300

@minValue(60)
param outboxRetrySeconds int = 900

@minValue(1)
param outboxMaxAttempts int = 10

@description('Immutable SharePoint site ID.')
param sharePointSiteId string = ''

@description('Immutable RecruitmentApplications list ID.')
param applicationsListId string = ''

@description('Immutable RecruitmentFiles list ID.')
param filesListId string = ''

@description('Candidate acknowledgement enablement.')
param candidateAcknowledgementEnabled bool = false

@description('Explicit HR/Legal approval of the acknowledgement template.')
param candidateAcknowledgementTemplateApproved bool = false

@description('Mailbox allowed to send recruitment acknowledgements.')
param candidateAcknowledgementMailbox string = ''

@description('Candidate-facing privacy notice URL.')
param candidateAcknowledgementPrivacyUrl string = 'https://shorevest.com/privacy-policy/'

@description('Entra-protected HR clean-document access enablement.')
param hrAccessEnabled bool = false

@description('Confirms App Service Authentication is deployed and verified.')
param platformAuthenticationEnabled bool = false

@description('Required Entra application role for clean-document access.')
param hrRequiredRole string = 'Recruitment.HR'

@minValue(60)
@maxValue(300)
param hrReadSasSeconds int = 300

@description('Retention policy assignment and legal-hold administration enablement.')
param retentionEnabled bool = false

@description('Destructive retention purge enablement. Must remain false until policy approval and non-production verification.')
param retentionDeletionEnabled bool = false

@description('Approved immutable retention policy version. Required when retention is enabled.')
param retentionPolicyVersion string = ''

@description('Required Entra application role for retention and legal-hold administration.')
param retentionAdminRole string = 'Recruitment.RetentionAdmin'

@minValue(1)
param retentionIncompleteHours int = 48

@minValue(1)
param retentionSubmittedDays int = 365

@minValue(1)
param retentionMaliciousDays int = 30

@minValue(1)
@maxValue(100)
param retentionBatchSize int = 10

@minValue(60)
param retentionLeaseSeconds int = 300

@minValue(60)
param retentionRetrySeconds int = 900

resource functionApp 'Microsoft.Web/sites@2024-04-01' existing = {
  name: functionAppName
}

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: managedIdentityName
}

resource hostStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: hostStorageAccountName
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource cvStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: cvStorageAccountName
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource insights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: applicationInsightsName
}

resource appSettings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: functionApp
  name: 'appsettings'
  properties: {
    FUNCTIONS_EXTENSION_VERSION: '~4'
    FUNCTIONS_WORKER_RUNTIME: 'node'
    AzureWebJobsStorage__accountName: hostStorage.name
    AzureWebJobsStorage__credential: 'managedidentity'
    AzureWebJobsStorage__clientId: managedIdentity.properties.clientId
    AZURE_CLIENT_ID: managedIdentity.properties.clientId
    APPLICATIONINSIGHTS_CONNECTION_STRING: insights.properties.ConnectionString
    RECRUITMENT_MANAGED_IDENTITY_CLIENT_ID: managedIdentity.properties.clientId
    RECRUITMENT_API_ENABLED: string(apiEnabled)
    RECRUITMENT_ENVIRONMENT: environmentName
    RECRUITMENT_ALLOWED_ORIGINS: allowedOrigins
    RECRUITMENT_REQUIRE_ORIGIN: 'true'
    RECRUITMENT_MAX_BODY_BYTES: string(maxBodyBytes)
    RECRUITMENT_COSMOS_ENDPOINT: cosmos.properties.documentEndpoint
    RECRUITMENT_COSMOS_DATABASE: 'recruitment'
    RECRUITMENT_STORAGE_ACCOUNT_URL: cvStorage.properties.primaryEndpoints.blob
    RECRUITMENT_UPLOAD_STORAGE_ACCOUNT_NAME: cvStorage.name
    RECRUITMENT_QUARANTINE_CONTAINER: 'recruitment-quarantine'
    RECRUITMENT_CLEAN_CONTAINER: 'recruitment-clean'
    RECRUITMENT_KEYVAULT_URL: vault.properties.vaultUri
    RECRUITMENT_COMPLETION_TOKEN_SECRET_NAME: completionTokenSecretName
    RECRUITMENT_FINGERPRINT_SECRET_NAME: fingerprintSecretName
    RECRUITMENT_RATE_LIMIT_ENABLED: 'true'
    RECRUITMENT_RATE_LIMIT_COUNT: string(rateLimitCount)
    RECRUITMENT_RATE_LIMIT_WINDOW_SECONDS: string(rateLimitWindowSeconds)
    RECRUITMENT_BOT_VERIFICATION_MODE: 'turnstile'
    RECRUITMENT_BOT_VERIFICATION_SECRET_NAME: botVerificationSecretName
    RECRUITMENT_BOT_VERIFICATION_HOSTNAME: botVerificationHostname
    RECRUITMENT_OUTBOX_DELIVERY_ENABLED: string(outboxDeliveryEnabled)
    RECRUITMENT_OUTBOX_LEASE_SECONDS: string(outboxLeaseSeconds)
    RECRUITMENT_OUTBOX_RETRY_SECONDS: string(outboxRetrySeconds)
    RECRUITMENT_OUTBOX_MAX_ATTEMPTS: string(outboxMaxAttempts)
    RECRUITMENT_GRAPH_ENDPOINT: 'https://graph.microsoft.com/v1.0'
    RECRUITMENT_SHAREPOINT_SITE_ID: sharePointSiteId
    RECRUITMENT_APPLICATIONS_LIST_ID: applicationsListId
    RECRUITMENT_FILES_LIST_ID: filesListId
    RECRUITMENT_CANDIDATE_ACK_ENABLED: string(candidateAcknowledgementEnabled)
    RECRUITMENT_CANDIDATE_ACK_TEMPLATE_APPROVED: string(candidateAcknowledgementTemplateApproved)
    RECRUITMENT_CANDIDATE_ACK_MAILBOX: candidateAcknowledgementMailbox
    RECRUITMENT_CANDIDATE_ACK_PRIVACY_URL: candidateAcknowledgementPrivacyUrl
    RECRUITMENT_HR_ACCESS_ENABLED: string(hrAccessEnabled)
    RECRUITMENT_PLATFORM_AUTH_ENABLED: string(platformAuthenticationEnabled)
    RECRUITMENT_HR_REQUIRED_ROLE: hrRequiredRole
    RECRUITMENT_HR_READ_SAS_SECONDS: string(hrReadSasSeconds)
    RECRUITMENT_RETENTION_ENABLED: string(retentionEnabled)
    RECRUITMENT_RETENTION_DELETION_ENABLED: string(retentionDeletionEnabled)
    RECRUITMENT_RETENTION_POLICY_VERSION: retentionPolicyVersion
    RECRUITMENT_RETENTION_ADMIN_ROLE: retentionAdminRole
    RECRUITMENT_RETENTION_INCOMPLETE_HOURS: string(retentionIncompleteHours)
    RECRUITMENT_RETENTION_SUBMITTED_DAYS: string(retentionSubmittedDays)
    RECRUITMENT_RETENTION_MALICIOUS_DAYS: string(retentionMaliciousDays)
    RECRUITMENT_RETENTION_BATCH_SIZE: string(retentionBatchSize)
    RECRUITMENT_RETENTION_LEASE_SECONDS: string(retentionLeaseSeconds)
    RECRUITMENT_RETENTION_RETRY_SECONDS: string(retentionRetrySeconds)
  }
}

output appSettingsId string = appSettings.id
output publicApiEnabled bool = apiEnabled
output externalDeliveryEnabled bool = outboxDeliveryEnabled
output hrDocumentAccessEnabled bool = hrAccessEnabled
output retentionEnabled bool = retentionEnabled
output retentionDeletionEnabled bool = retentionDeletionEnabled
