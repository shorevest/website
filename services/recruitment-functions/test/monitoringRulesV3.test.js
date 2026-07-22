'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
const template = fs.readFileSync(
  path.join(root, 'infra/recruitment/monitoring-rules.v3.bicep'),
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
    assert.ok(template.includes(event), `${event} is not monitored by v3 rules`);
  }
});

test('classic and workspace schemas are projected before union', () => {
  assert.ok(template.includes('(traces | project EventTime = timestamp'));
  assert.ok(template.includes('(AppTraces | project EventTime = TimeGenerated'));
  assert.ok(template.includes('(requests'));
  assert.ok(template.includes('EventTime = timestamp'));
  assert.ok(template.includes('(AppRequests'));
  assert.ok(template.includes('EventTime = TimeGenerated'));
  assert.ok(!template.includes('column_ifexists'));
  assert.ok(!template.includes('coalesce('));
});

test('all alert queries aggregate on the normalized EventTime column', () => {
  assert.ok(template.includes('bin(EventTime, 5m)'));
  assert.ok(template.includes('bin(EventTime, 10m)'));
  assert.ok(!template.includes('bin(TimeGenerated'));
  assert.ok(!template.includes('bin(timestamp'));
});

test('monitoring queries contain no candidate or document identifiers', () => {
  for (const forbidden of [
    'CandidateName',
    'CandidateEmail',
    'CandidateTelephone',
    'CoverNote',
    'OriginalFileName',
    'ApplicationReference',
    'FileReference',
    'QuarantineBlobPath',
    'CleanBlobPath'
  ]) {
    assert.ok(!template.includes(forbidden), `${forbidden} must not appear in monitoring v3`);
  }
});

test('alert creation remains explicit opt-in and action-group scoped', () => {
  assert.ok(template.includes('param enableAlerts bool = false'));
  assert.equal((template.match(/if \(enableAlerts\)/g) || []).length, 3);
  assert.ok(template.includes('actionGroupResourceId'));
  assert.ok(!template.includes('/subscriptions/'));
  assert.ok(!template.includes('@shorevest.com'));
});

test('alert thresholds distinguish critical events from repeated request failures', () => {
  assert.ok(template.includes("name: 'recruitment-critical-processing-failures-v3'"));
  assert.ok(template.includes('threshold: 0'));
  assert.ok(template.includes("name: 'recruitment-repeated-api-failures-v3'"));
  assert.ok(template.includes('threshold: 5'));
  assert.ok(template.includes("name: 'recruitment-readiness-unavailable-v3'"));
  assert.ok(template.includes('threshold: 3'));
});
