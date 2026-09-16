targetScope = 'resourceGroup'

@description('Existing CV storage account. This template never changes subscription-wide pricing.')
param cvStorageAccountName string

@description('Custom scan-result topic, in the same region as the CV account.')
param topicName string

@description('Existing Function App with the defenderScanResult Function already indexed.')
param functionAppName string

@description('CV storage account region. Cross-region Defender event delivery is unsupported.')
param location string

@description('Explicit opt-in to the paid storage-account plan and on-upload scanning.')
param enablePaidScanning bool = false

@minValue(1)
@maxValue(500)
@description('Monthly scan-volume cap, not a hard billing cap: Azure permits up to 20 GB deviation.')
param capGBPerMonth int = 1

@description('Do not rescan files after the application promotes them to the clean container.')
param cleanContainerName string = 'recruitment-clean'

resource cvStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: cvStorageAccountName
}

resource topic 'Microsoft.EventGrid/topics@2025-02-15' = if (enablePaidScanning) {
  name: topicName
  location: location
  tags: {
    workload: 'recruitment'
    component: 'malware-scan-results'
  }
  properties: {
    inputSchema: 'EventGridSchema'
    publicNetworkAccess: 'Enabled'
  }
}

module delivery './event-grid-subscription.bicep' = if (enablePaidScanning) {
  name: 'recruitment-defender-event-delivery'
  params: {
    topicName: topicName
    functionAppName: functionAppName
  }
  dependsOn: [topic]
}

resource defender 'Microsoft.Security/defenderForStorageSettings@2025-07-01-preview' = if (enablePaidScanning) {
  name: 'current'
  scope: cvStorage
  properties: {
    isEnabled: true
    // Resource-level enablement works without enabling the paid subscription plan.
    overrideSubscriptionLevelSettings: true
    sensitiveDataDiscovery: {
      isEnabled: false
    }
    malwareScanning: {
      automatedResponse: 'None'
      blobScanResultsOptions: 'None'
      onUpload: {
        isEnabled: true
        capGBPerMonth: capGBPerMonth
        filters: {
          excludeBlobsWithPrefix: ['${cleanContainerName}/']
        }
      }
      scanResultsEventGridTopicResourceId: resourceId('Microsoft.EventGrid/topics', topicName)
    }
  }
  // Establish the consumer before scans can publish verdicts.
  dependsOn: [delivery]
}

output enabled bool = enablePaidScanning
output protectedStorageAccountId string = cvStorage.id
