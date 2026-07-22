'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  sanitizeIdempotencyRecord,
  secureIdempotencyAdapter
} = require('../src/adapters/idempotencySecurity');

test('credential fields are removed from idempotency records and claim wrappers', () => {
  const sanitized = sanitizeIdempotencyRecord({
    state: 'CredentialsIssued',
    result: {
      upload: { url: 'https://blob.example/sas-secret' },
      completionToken: 'signed-secret'
    },
    record: {
      result: {
        upload: { url: 'https://blob.example/other-secret' },
        completionToken: 'other-token'
      }
    },
    stableResult: {
      applicationReference: 'APP-1',
      credentialGeneration: 2
    }
  });

  assert.equal(sanitized.result, undefined);
  assert.equal(sanitized.record.result, undefined);
  assert.deepEqual(sanitized.stableResult, {
    applicationReference: 'APP-1',
    credentialGeneration: 2
  });
  assert.ok(!JSON.stringify(sanitized).includes('sas-secret'));
  assert.ok(!JSON.stringify(sanitized).includes('signed-secret'));
});

test('production credentialsIssued persists only stable metadata', async () => {
  const calls = [];
  const underlying = {
    async claim() {
      return {
        status: 'reserved',
        record: {
          state: 'CredentialsIssued',
          result: { completionToken: 'legacy-secret' },
          stableResult: { applicationReference: 'APP-1' }
        }
      };
    },
    async get() {
      return {
        state: 'CredentialsIssued',
        result: { upload: { url: 'legacy-sas' } },
        stableResult: { applicationReference: 'APP-1' }
      };
    },
    async credentialsIssued(key, credentialResult, stableResult) {
      calls.push({ key, credentialResult, stableResult });
      return { state: 'CredentialsIssued', stableResult };
    }
  };
  const secured = secureIdempotencyAdapter(underlying);

  const claim = await secured.claim('key');
  const record = await secured.get('key');
  assert.equal(claim.record.result, undefined);
  assert.equal(record.result, undefined);

  await secured.credentialsIssued(
    'key',
    {
      completionToken: 'do-not-store',
      upload: { url: 'https://blob.example/write-sas' }
    },
    {
      applicationReference: 'APP-1',
      fileReference: 'FILE-1',
      credentialGeneration: 3,
      lastCredentialExpiryUtc: '2026-07-22T00:10:00.000Z'
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentialResult, null);
  assert.equal(calls[0].stableResult.credentialGeneration, 3);
  assert.ok(!JSON.stringify(calls).includes('do-not-store'));
  assert.ok(!JSON.stringify(calls).includes('write-sas'));
});
