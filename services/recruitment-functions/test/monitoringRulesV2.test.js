'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const template = fs.readFileSync(
  path.join(root, 'infra/recruitment/monitoring-rules.v2.bicep'),
  'utf8'
);

const sourceFiles = [
  'services/recruitment-functions/src/functions/index.js',
  'services/recruitment-functions/src/retention/worker.js',
  'services/recruitment-functions/src/lib/scanDelivery.js',
  'services/recruitment-functions/src/flows/finalizeApplication.js'
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

const criticalEvents = [
  'recruitment_configuration_invalid',
  'recruitment_outbox_configuration_invalid',
  'recruitment_scan_event_retry_requested',
  'recruitment_retention_configuration_invalid',
  'recruitment_retention_purge_failed',
  'recruitment_retention_idempotency_cleanup_failed',
  'finalization_outcome_reconciliation_failed'
];

test('every monitored critical event is emitted by runtime code', () => {
  for (const event of criticalEvents) {
    assert.ok(sourceFiles.includes(event), `${event} is not emitted by runtime code`);
    assert.ok(template.includes(event), `${event} is not monitored by v2 rules`);
  }
});

test('monitoring v2 uses aggregate counts and no candidate fields', () => {
  assert.ok(template.includes('summarize FailureCount = count()'));
  assert.ok(template.includes('bin(TimeGenerated, 5m)'));
  assert.ok(template.includes('bin(TimeGenerated, 10m)'));
  for (const forbidden of [
    'CandidateName',
    'CandidateEmail',
    'CandidateTelephone',
    'CoverNote',
    'OriginalFileName',
    'QuarantineBlobPath',
    'CleanBlobPath'
  ]) {
    assert.ok(!template.includes(forbidden), `${forbidden} must not appear in monitoring queries`);
  }
});

test('monitoring v2 supports both Application Insights table schemas', () => {
  assert.ok(template.includes('union isfuzzy=true traces, AppTraces'));
  assert.ok(template.includes('union isfuzzy=true requests, AppRequests'));
  assert.ok(template.includes('column_ifexists("message"'));
  assert.ok(template.includes('column_ifexists("Message"'));
  assert.ok(template.includes('column_ifexists("resultCode"'));
  assert.ok(template.includes('column_ifexists("ResultCode"'));
});

test('alert deployment is explicit opt-in and routes only to the supplied action group', () => {
  assert.ok(template.includes('param enableAlerts bool = false'));
  assert.ok(template.includes('if (enableAlerts)'));
  assert.ok(template.includes('actionGroupResourceId'));
  assert.ok(!template.includes('/subscriptions/'));
  assert.ok(!template.includes('@shorevest.com'));
});

test('critical failures alert immediately while noisy request failures require repetition', () => {
  assert.ok(template.includes("name: 'recruitment-critical-processing-failures'"));
  assert.ok(template.includes("threshold: 0"));
  assert.ok(template.includes("name: 'recruitment-repeated-api-failures'"));
  assert.ok(template.includes("threshold: 5"));
  assert.ok(template.includes("name: 'recruitment-readiness-unavailable'"));
  assert.ok(template.includes("threshold: 3"));
});
