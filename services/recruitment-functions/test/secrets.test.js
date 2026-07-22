'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  FINALIZATION_AUDIENCE,
  validatePayloadForSigning,
  createSecretProvider,
  createTokenAdapter,
  createFingerprintAdapter
} = require('../src/adapters/secrets');

test('missing production secrets fail closed', async () => {
  const provider = createSecretProvider({ client: { getSecret: async () => ({}) } });
  await assert.rejects(() => createFingerprintAdapter(provider, 'fp').hmac('x'), /secret missing/);
  await assert.rejects(() => createTokenAdapter(provider, 'tok').sign({}), /secret missing|token payload invalid/);
});

test('separate token and fingerprint keys work without test fallback', async () => {
  const provider = createSecretProvider({
    client: { getSecret: async (name) => ({ value: name === 'fp' ? 'a' : 'b' }) },
    ttlMs: 1
  });
  assert.equal(
    await createFingerprintAdapter(provider, 'fp').hmac('x'),
    require('crypto').createHmac('sha256', 'a').update('x').digest('hex')
  );
  const token = await createTokenAdapter(provider, 'tok').sign({ x: 1 });
  assert.deepEqual(await createTokenAdapter(provider, 'tok').verify(token), { x: 1 });
});

test('finalization token signing requires a verified upload timestamp', async () => {
  assert.throws(
    () => validatePayloadForSigning({
      audience: FINALIZATION_AUDIENCE,
      applicationReference: 'APP-1'
    }),
    (error) => error.code === 'SUBMISSION_IN_PROGRESS'
  );

  assert.doesNotThrow(() => validatePayloadForSigning({
    audience: FINALIZATION_AUDIENCE,
    applicationReference: 'APP-1',
    uploadVerifiedAtUtc: '2026-07-22T00:00:00.000Z'
  }));
});

test('token adapter refuses to sign stale finalization state before reading Key Vault', async () => {
  let secretReads = 0;
  const provider = {
    async get() {
      secretReads += 1;
      return 'secret';
    }
  };
  await assert.rejects(
    () => createTokenAdapter(provider, 'tok').sign({ audience: FINALIZATION_AUDIENCE }),
    (error) => error.code === 'SUBMISSION_IN_PROGRESS'
  );
  assert.equal(secretReads, 0);
});
