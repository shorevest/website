targetScope = 'resourceGroup'

@description('Existing workspace-based Application Insights component for recruitment.')
param applicationInsightsName string

@description('Existing Azure Monitor action group resource ID.')
param actionGroupResourceId string

@description('Deploy the alert rules. Explicit opt-in for each environment.')
param enableAlerts bool = false

@description('Location for scheduled query rule resources.')
param location string = resourceGroup().location

resource insights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: applicationInsightsName
}

// Classic Application Insights and workspace-based Application Insights expose
// different table/column names. Project each schema separately before unioning.
var criticalEventsQuery = '''
union isfuzzy=true
  (traces | project EventTime = timestamp, EventMessage = tostring(message)),
  (AppTraces | project EventTime = TimeGenerated, EventMessage = tostring(Message))
| where EventMessage has_any (
    "recruitment_configuration_invalid",
    "recruitment_outbox_configuration_invalid",
    "recruitment_scan_event_retry_requested",
    "recruitment_retention_configuration_invalid",
    "recruitment_retention_purge_failed",
    "recruitment_retention_idempotency_cleanup_failed",
    "finalization_outcome_reconciliation_failed"
  )
| summarize FailureCount = count() by bin(EventTime, 5m)
'''

var repeatedApiFailuresQuery = '''
union isfuzzy=true
  (requests
    | project EventTime = timestamp, RequestName = tostring(name), RequestUrl = tostring(url), ResultCodeText = tostring(resultCode)),
  (AppRequests
    | project EventTime = TimeGenerated, RequestName = tostring(Name), RequestUrl = tostring(Url), ResultCodeText = tostring(ResultCode))
| where RequestName has "recruitment" or RequestUrl has "/recruitment/"
| where toint(ResultCodeText) >= 500
| summarize FailureCount = count() by bin(EventTime, 5m)
'''

var readinessFailuresQuery = '''
union isfuzzy=true
  (requests
    | project EventTime = timestamp, RequestName = tostring(name), RequestUrl = tostring(url), ResultCodeText = tostring(resultCode)),
  (AppRequests
    | project EventTime = TimeGenerated, RequestName = tostring(Name), RequestUrl = tostring(Url), ResultCodeText = tostring(ResultCode))
| where RequestName has "health" or RequestUrl endswith "/recruitment/health"
| where toint(ResultCodeText) >= 500
| summarize FailureCount = count() by bin(EventTime, 10m)
'''

resource criticalProcessingFailures 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = if (enableAlerts) {
  name: 'recruitment-critical-processing-failures-v3'
  location: location
  properties: {
    displayName: 'Recruitment critical processing failure'
    description: 'Alerts on fail-closed configuration, retrying Defender delivery, failed retention purge or finalization reconciliation. Query uses event names and counts only.'
    enabled: true
    severity: 1
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [
      insights.id
    ]
    targetResourceTypes: [
      'Microsoft.Insights/components'
    ]
    criteria: {
      allOf: [
        {
          query: criticalEventsQuery
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        actionGroupResourceId
      ]
    }
    autoMitigate: false
    skipQueryValidation: false
  }
}

resource repeatedApiFailures 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = if (enableAlerts) {
  name: 'recruitment-repeated-api-failures-v3'
  location: location
  properties: {
    displayName: 'Recruitment repeated API failures'
    description: 'Alerts when recruitment endpoints return five or more server errors in five minutes. Query aggregates request metadata only.'
    enabled: true
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [
      insights.id
    ]
    targetResourceTypes: [
      'Microsoft.Insights/components'
    ]
    criteria: {
      allOf: [
        {
          query: repeatedApiFailuresQuery
          timeAggregation: 'Count'
          operator: 'GreaterThanOrEqual'
          threshold: 5
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        actionGroupResourceId
      ]
    }
    autoMitigate: true
    skipQueryValidation: false
  }
}

resource readinessUnavailable 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = if (enableAlerts) {
  name: 'recruitment-readiness-unavailable-v3'
  location: location
  properties: {
    displayName: 'Recruitment readiness unavailable'
    description: 'Alerts when the recruitment readiness endpoint reports repeated dependency or configuration unavailability.'
    enabled: true
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT10M'
    scopes: [
      insights.id
    ]
    targetResourceTypes: [
      'Microsoft.Insights/components'
    ]
    criteria: {
      allOf: [
        {
          query: readinessFailuresQuery
          timeAggregation: 'Count'
          operator: 'GreaterThanOrEqual'
          threshold: 3
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        actionGroupResourceId
      ]
    }
    autoMitigate: true
    skipQueryValidation: false
  }
}

output alertRuleIds array = enableAlerts ? [
  criticalProcessingFailures.id
  repeatedApiFailures.id
  readinessUnavailable.id
] : []
