'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createBotVerifier } = require('../src/adapters/bot');

test('disabled bot verification fails closed in production', async () => {
  const verifier = createBotVerifier({ mode: 'disabled', environment: 'production' });
  assert.deepEqual(await verifier.verify({}), { ok: false });
});

test('Turnstile verification validates success and hostname', async () => {
  let postedBody = '';
  const verifier = createBotVerifier({
    mode: 'turnstile',
    environment: 'production',
    secretProvider: { async get() { return 'secret'; } },
    secretName: 'turnstile',
    expectedHostname: 'shorevest.com',
    fetchImpl: async (_, options) => {
      postedBody = options.body.toString();
      return {
        ok: true,
        async json() { return { success: true, hostname: 'shorevest.com' }; }
      };
    }
  });

  const result = await verifier.verify({
    botToken: 'valid-turnstile-token',
    _requestContext: { clientIp: '203.0.113.10' }
  });
  assert.deepEqual(result, { ok: true });
  assert.match(postedBody, /secret=secret/);
  assert.match(postedBody, /remoteip=203.0.113.10/);
});

test('Turnstile verification rejects hostname mismatch', async () => {
  const verifier = createBotVerifier({
    mode: 'turnstile',
    environment: 'production',
    secretProvider: { async get() { return 'secret'; } },
    secretName: 'turnstile',
    expectedHostname: 'shorevest.com',
    fetchImpl: async () => ({
      ok: true,
      async json() { return { success: true, hostname: 'attacker.example' }; }
    })
  });
  assert.deepEqual(await verifier.verify({ botToken: 'valid-turnstile-token' }), { ok: false });
});
