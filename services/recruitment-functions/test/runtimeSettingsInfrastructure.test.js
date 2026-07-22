'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const template = fs.readFileSync(
  path.resolve(__dirname, '../../../infra/recruitment/runtime-settings.bicep'),
  'utf8'
);

test('all external recruitment capabilities default disabled', () => {
  assert.ok(template.includes('param apiEnabled bool = false'));
  assert.ok(template.includes('param outboxDeliveryEnabled bool = false'));
  assert.ok(template.includes('param candidateAcknowledgementEnabled bool = false'));
  assert.ok(template.includes('param candidateAcknowledgementTemplateApproved bool = false'));
  assert.ok(template.includes('param hrAccessEnabled bool = false'));
  assert.ok(template.includes('param platformAuthenticationEnabled bool = false'));
  assert.ok(template.includes('param retentionEnabled bool = false'));
  assert.ok(template.includes('param retentionDeletionEnabled bool = false'));
});

test('runtime settings use managed identity and no storage connection string', () => {
  assert.ok(template.includes("AzureWebJobsStorage__credential: 'managedidentity'"));
  assert.ok(template.includes('AzureWebJobsStorage__clientId: managedIdentity.properties.clientId'));
  assert.ok(template.includes('RECRUITMENT_MANAGED_IDENTITY_CLIENT_ID: managedIdentity.properties.clientId'));
  assert.ok(!template.includes('AccountKey='));
  assert.ok(!template.includes('SharedAccessSignature='));
});

test('runtime settings centralize SharePoint, acknowledgement, HR and retention gates', () => {
  for (const setting of [
    'RECRUITMENT_SHAREPOINT_SITE_ID',
    'RECRUITMENT_APPLICATIONS_LIST_ID',
    'RECRUITMENT_FILES_LIST_ID',
    'RECRUITMENT_CANDIDATE_ACK_TEMPLATE_APPROVED',
    'RECRUITMENT_HR_ACCESS_ENABLED',
    'RECRUITMENT_PLATFORM_AUTH_ENABLED',
    'RECRUITMENT_HR_REQUIRED_ROLE',
    'RECRUITMENT_RETENTION_ENABLED',
    'RECRUITMENT_RETENTION_DELETION_ENABLED',
    'RECRUITMENT_RETENTION_POLICY_VERSION',
    'RECRUITMENT_RETENTION_ADMIN_ROLE',
    'RECRUITMENT_RETENTION_INCOMPLETE_HOURS',
    'RECRUITMENT_RETENTION_SUBMITTED_DAYS',
    'RECRUITMENT_RETENTION_MALICIOUS_DAYS'
  ]) {
    assert.ok(template.includes(setting));
  }
});
