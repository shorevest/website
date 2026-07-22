targetScope = 'resourceGroup'

@description('Existing workspace-based Application Insights component for recruitment.')
param applicationInsightsName string

@description('Existing Azure Monitor action group resource ID.')
param actionGroupResourceId string

@description('Deploy the alert rules. Explicit opt-in for each environment.')
param enableAlerts bool = false

@description('Location for global scheduled query rule resources.')
param location string = resourceGroup().location

resource insights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: applicationInsightsName
}

var criticalEventsQuery = '''
union isfuzzy=true traces, AppTraces
| extend EventMessage = tostring(coalesce(column_ifexists("message", ""), column_ifexists("Message", "")))
| where EventMessage has_any (
    "recruitment_configuration_invalid",
    "recruitment_outbox_configuration_invalid",
    "recruitment_scan_event_retry_requested",
    "recruitment_retention_configuration_invalid",
    "recruitment_retention_purge_failed",
    "recruitment_retention_idempotency_cleanup_failed",
    "finalization_outcome_reconciliation_failed"
  )
| summarize FailureCount = count() by bin(TimeGenerated, 5m)
'''

var repeatedApiFailuresQuery = '''
union isfuzzy=true requests, AppRequests
| extend RequestName = tostring(coalesce(column_ifexists("name", ""), column_ifexists("Name", "")))
| extend RequestUrl = tostring(coalesce(column_ifexists("url", ""), column_ifexists("Url", "")))
| extend ResultCodeText = tostring(coalesce(column_ifexists("resultCode", ""), column_ifexists("ResultCode", "")))
| where RequestName has "recruitment" or RequestUrl has "/recruitment/"
| where toint(ResultCodeText) >= 500
| summarize FailureCount = count() by bin(TimeGenerated, 5m)
'''

var readinessFailuresQuery = '''
union isfuzzy=true requests, AppRequests
| extend RequestName = tostring(coalesce(column_ifexists("name", ""), column_ifexists("Name", "")))
| extend RequestUrl = tostring(coalesce(column_ifexists("url", ""), column_ifexists("Url", "")))
| extend ResultCodeText = tostring(coalesce(column_ifexists("resultCode", ""), column_ifexists("ResultCode", "")))
| where RequestName has "health" or RequestUrl endswith "/recruitment/health"
| where toint(ResultCodeText) >= 500
| summarize FailureCount = count() by bin(TimeGenerated, 10m)
'''

resource criticalProcessingFailures 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = if (enableAlerts) {
  name: 'recruitment-critical-processing-failures'
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
  name: 'recruitment-repeated-api-failures'
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
  name: 'recruitment-readiness-unavailable'
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
