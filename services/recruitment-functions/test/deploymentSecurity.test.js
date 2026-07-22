'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert');

const repositoryRoot = path.resolve(__dirname, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

test('base recruitment infrastructure remains disabled by default', () => {
  const source = read('infra/recruitment/main.bicep');
  assert.match(source, /name:\s*'RECRUITMENT_API_ENABLED'\s*\n\s*value:\s*'false'/);
  assert.match(source, /param enableDefenderForStorage bool = false/);
  assert.doesNotMatch(source, /name:\s*'RECRUITMENT_API_ENABLED'\s*\n\s*value:\s*'true'/);
});

test('authoritative runtime settings deploy exact Turnstile hostname and action constraints', () => {
  const source = read('infra/recruitment/runtime-settings.bicep');
  assert.match(
    source,
    /param botVerificationHostnames string = 'shorevest\.com,www\.shorevest\.com'/
  );
  assert.match(
    source,
    /param botVerificationAction string = 'recruitment-application'/
  );
  assert.match(
    source,
    /RECRUITMENT_BOT_VERIFICATION_HOSTNAME:\s*botVerificationHostnames/
  );
  assert.match(
    source,
    /RECRUITMENT_BOT_VERIFICATION_ACTION:\s*botVerificationAction/
  );
});

test('runtime settings keep every external and destructive capability off by default', () => {
  const source = read('infra/recruitment/runtime-settings.bicep');
  for (const declaration of [
    'param apiEnabled bool = false',
    'param outboxDeliveryEnabled bool = false',
    'param candidateAcknowledgementEnabled bool = false',
    'param candidateAcknowledgementTemplateApproved bool = false',
    'param hrAccessEnabled bool = false',
    'param platformAuthenticationEnabled bool = false',
    'param retentionEnabled bool = false',
    'param retentionDeletionEnabled bool = false'
  ]) {
    assert.ok(source.includes(declaration), `missing safe default: ${declaration}`);
  }
});

test('local example documents the same Turnstile action without enabling the API', () => {
  const settings = JSON.parse(read('services/recruitment-functions/local.settings.example.json'));
  assert.equal(settings.Values.RECRUITMENT_API_ENABLED, 'false');
  assert.equal(settings.Values.RECRUITMENT_BOT_VERIFICATION_ACTION, 'recruitment-application');
  assert.equal(settings.Values.RECRUITMENT_BOT_VERIFICATION_MODE, 'disabled');
});
