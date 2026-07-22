# Recruitment monitoring v4

`infra/recruitment/monitoring-rules.v4.bicep` is the authoritative recruitment alert template.

Do not deploy:

- `monitoring-rules.bicep`
- `monitoring-rules.v2.bicep`
- `monitoring-rules.v3.bicep`

Those files are retained temporarily only for review history and must be removed before PR #750 is merged.

## Why v4 is authoritative

V4 fixes two material alert-query defects identified during review:

1. Classic Application Insights and workspace-based Application Insights expose different table and timestamp column names. V4 projects each schema into a shared `TimeGenerated` column before unioning.
2. Scheduled-query `Count` aggregation counts rows returned by the KQL query. V4 returns one raw row per matching telemetry record. It does not pre-summarize failures into one row before applying thresholds.

## Alert rules

### Critical processing failures

Severity 1. Fires on any matching event within five minutes:

- `recruitment_configuration_invalid`
- `recruitment_outbox_configuration_invalid`
- `recruitment_scan_event_retry_requested`
- `recruitment_retention_configuration_invalid`
- `recruitment_retention_purge_failed`
- `recruitment_retention_idempotency_cleanup_failed`
- `finalization_outcome_reconciliation_failed`

### Repeated recruitment API failures

Severity 2. Fires when at least five recruitment endpoint requests return HTTP 5xx within five minutes.

### Readiness unavailable

Severity 2. Fires when the recruitment readiness endpoint returns HTTP 5xx at least three times within ten minutes.

## Privacy boundary

The queries use only:

- stable event names;
- request names and URLs;
- HTTP result codes;
- timestamps;
- aggregate counts.

They must not include candidate names, email addresses, telephone numbers, application references, file references, filenames, document hashes or Blob paths.

## Deployment

Alerts are explicit opt-in. `enableAlerts` defaults to `false`.

```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/recruitment/monitoring-rules.v4.bicep \
  --parameters \
    applicationInsightsName=<application-insights> \
    actionGroupResourceId=<action-group-resource-id> \
    enableAlerts=true
```

Before enabling production alerts:

1. Compile and lint the template through the `Recruitment Monitoring V4` workflow.
2. Run each KQL query against the non-production Application Insights resource.
3. Generate one controlled event for each rule.
4. Confirm the action group delivers to the named operational and security owners.
5. Confirm alert payloads contain no candidate PII or document identifiers.
6. Record the test evidence in the deployment change record.

## Rollback

Redeploy with `enableAlerts=false` or disable the three v4 scheduled-query rules. Do not remove Application Insights or the Log Analytics workspace as part of alert rollback.
