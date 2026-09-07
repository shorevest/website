'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert');

const root = path.resolve(__dirname, '../../..');
const template = fs.readFileSync(
  path.join(root, 'infra/recruitment/scanner.bicep'),
  'utf8'
);
const runbook = fs.readFileSync(
  path.join(root, 'docs/recruitment/MALWARE_SCANNING_CLAMAV.md'),
  'utf8'
);

test('scanner is private, identity-based and scoped to quarantine BlobCreated events', () => {
  assert.ok(template.includes("resource scanner 'Microsoft.App/containerApps@2025-01-01'"));
  assert.ok(template.includes("type: 'UserAssigned'"));
  assert.ok(!template.includes('connectionString'));
  assert.ok(!template.includes('accountKey'));
  assert.ok(template.includes('accountName: cvStorage.name'));
  assert.ok(template.includes('identity: mi.id'));
  assert.doesNotMatch(template, /^\s*ingress:/m);
  assert.ok(template.includes("'Microsoft.Storage.BlobCreated'"));
  assert.ok(template.includes("subjectBeginsWith: '/blobServices/default/containers/recruitment-quarantine/blobs/recruitment/'"));
});

test('scanner cannot silently discard exhausted messages', () => {
  assert.ok(template.includes("param scanPoisonQueueName string = 'recruitment-scan-poison'"));
  assert.ok(template.includes("name: 'RECRUITMENT_SCAN_POISON_QUEUE_URL'"));
  assert.ok(runbook.includes('before the original queue message is deleted'));
});

test('deployment runbook requires an immutable image digest', () => {
  assert.ok(template.includes('@sha256:<digest>'));
  assert.ok(runbook.includes('immutable `@sha256:...` digest'));
  assert.ok(!runbook.includes('containerImage=$REG/recruitment-clamav:1'));
});
