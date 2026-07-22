'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { loadConfig, validateConfig } = require('../src/lib/config');
const {
  originAllowed,
  readJson,
  requestContext,
  candidate,
  unavailable
} = require('../src/lib/http');

function req({
  origin = 'https://shorevest.com',
  contentType = 'application/json',
  body = '{}',
  forwardedFor = '',
  userAgent = ''
} = {}) {
  const values = {
    origin,
    'content-type': contentType,
    'x-forwarded-for': forwardedFor,
    'user-agent': userAgent
  };
  return {
    headers: { get: (key) => values[key.toLowerCase()] || null },
    text: async () => body,
    method: 'POST'
  };
}

test('API disabled response performs no durable work', () => {
  const config = loadConfig({
    RECRUITMENT_API_ENABLED: 'false',
    RECRUITMENT_ENVIRONMENT: 'local',
    RECRUITMENT_ALLOWED_ORIGINS: 'https://shorevest.com'
  });
  const result = unavailable(req(), config);
  assert.equal(result.status, 503);
});

test('production requests require an approved Origin header', () => {
  const config = loadConfig({
    RECRUITMENT_ENVIRONMENT: 'production',
    RECRUITMENT_ALLOWED_ORIGINS: 'https://shorevest.com'
  });
  assert.equal(originAllowed(req({ origin: '' }), config), false);
  assert.equal(originAllowed(req({ origin: 'https://evil.example' }), config), false);
  assert.equal(originAllowed(req(), config), true);
});

test('origin and content validation', async () => {
  const config = loadConfig({
    RECRUITMENT_API_ENABLED: 'true',
    RECRUITMENT_ENVIRONMENT: 'local',
    RECRUITMENT_ALLOWED_ORIGINS: 'https://shorevest.com',
    RECRUITMENT_MAX_BODY_BYTES: '10'
  });
  assert.equal(originAllowed(req({ origin: 'https://evil.example' }), config), false);
  assert.equal((await readJson(req({ contentType: 'multipart/form-data' }), config)).error.status, 415);
  assert.equal((await readJson(req({ body: 'x'.repeat(11) }), config)).error.status, 413);
});

test('request context uses the first proxy address and bounds the user agent', () => {
  const context = requestContext(req({
    forwardedFor: '203.0.113.10, 10.0.0.1',
    userAgent: 'x'.repeat(600)
  }));
  assert.equal(context.clientIp, '203.0.113.10');
  assert.equal(context.userAgent.length, 512);
});

test('candidate response sanitizes internal fields', () => {
  const output = candidate({
    success: true,
    applicationReference: 'a',
    fileReference: 'f',
    quarantineBlobPath: 'secret',
    cleanBlobPath: 'secret2',
    aggregateVersion: 3,
    upload: {
      url: 'https://acct.blob.core.windows.net/c/b?sas',
      method: 'PUT',
      requiredHeaders: {}
    }
  });
  assert.equal(output.quarantineBlobPath, undefined);
  assert.equal(output.aggregateVersion, undefined);
  assert.ok(output.upload.url);
});

test('enabled production API fails configuration validation without abuse controls and managed identity', () => {
  const config = loadConfig({
    RECRUITMENT_API_ENABLED: 'true',
    RECRUITMENT_ENVIRONMENT: 'production',
    RECRUITMENT_ALLOWED_ORIGINS: 'https://shorevest.com',
    RECRUITMENT_COSMOS_ENDPOINT: 'https://example.documents.azure.com',
    RECRUITMENT_COSMOS_DATABASE: 'recruitment',
    RECRUITMENT_STORAGE_ACCOUNT_URL: 'https://example.blob.core.windows.net',
    RECRUITMENT_KEYVAULT_URL: 'https://example.vault.azure.net',
    RECRUITMENT_COMPLETION_TOKEN_SECRET_NAME: 'completion',
    RECRUITMENT_FINGERPRINT_SECRET_NAME: 'fingerprint'
  });
  const shape = validateConfig(config);
  assert.equal(shape.ok, false);
  assert.ok(shape.missing.includes('managedIdentityClientId'));
  assert.ok(shape.invalid.includes('rateLimit.enabled'));
  assert.ok(shape.invalid.includes('botVerification.mode'));
});

test('enabled production API validates when identity and abuse controls are configured', () => {
  const config = loadConfig({
    RECRUITMENT_API_ENABLED: 'true',
    RECRUITMENT_ENVIRONMENT: 'production',
    RECRUITMENT_ALLOWED_ORIGINS: 'https://shorevest.com',
    RECRUITMENT_MANAGED_IDENTITY_CLIENT_ID: '00000000-0000-0000-0000-000000000001',
    RECRUITMENT_COSMOS_ENDPOINT: 'https://example.documents.azure.com',
    RECRUITMENT_COSMOS_DATABASE: 'recruitment',
    RECRUITMENT_STORAGE_ACCOUNT_URL: 'https://example.blob.core.windows.net',
    RECRUITMENT_KEYVAULT_URL: 'https://example.vault.azure.net',
    RECRUITMENT_COMPLETION_TOKEN_SECRET_NAME: 'completion',
    RECRUITMENT_FINGERPRINT_SECRET_NAME: 'fingerprint',
    RECRUITMENT_RATE_LIMIT_ENABLED: 'true',
    RECRUITMENT_BOT_VERIFICATION_MODE: 'turnstile',
    RECRUITMENT_BOT_VERIFICATION_SECRET_NAME: 'turnstile'
  });
  assert.deepEqual(validateConfig(config), { ok: true, missing: [], invalid: [] });
});
