'use strict';

const crypto = require('crypto');
const test = require('node:test');
const assert = require('node:assert');
const { createRateLimiter } = require('../src/adapters/rateLimit');

function fakeClient() {
  const records = new Map();
  let etag = 0;
  const container = {
    items: {
      async create(document) {
        if (records.has(document.id)) throw Object.assign(new Error('conflict'), { code: 409 });
        const stored = { ...document, _etag: String(++etag) };
        records.set(document.id, stored);
        return { resource: stored };
      }
    },
    item(id) {
      return {
        async read() {
          return { resource: records.get(id) || null };
        },
        async replace(document, options) {
          const current = records.get(id);
          if (!current || options.accessCondition.condition !== current._etag) {
            throw Object.assign(new Error('precondition failed'), { code: 412 });
          }
          const stored = { ...document, _etag: String(++etag) };
          records.set(id, stored);
          return { resource: stored };
        }
      };
    }
  };
  return {
    database() {
      return { container() { return container; } };
    }
  };
}

function fingerprint(inputs = []) {
  return {
    async hmac(canonical) {
      inputs.push(canonical);
      return crypto.createHash('sha256').update(canonical).digest('hex');
    }
  };
}

function limiter({ client, requestContext, limit = 2, inputs = [] }) {
  return createRateLimiter({
    client,
    databaseId: 'recruitment',
    enabled: true,
    limit,
    windowSeconds: 300,
    fingerprint: fingerprint(inputs),
    requestContext,
    now: () => new Date('2026-07-22T12:00:00Z')
  });
}

test('rate limiter enforces a fixed window using only the trusted client IP', async () => {
  const inputs = [];
  const rateLimiter = limiter({
    client: fakeClient(),
    inputs,
    requestContext: { clientIp: '203.0.113.10', userAgent: 'test' }
  });

  assert.equal((await rateLimiter.check('submission-a')).allowed, true);
  assert.equal((await rateLimiter.check('submission-b')).allowed, true);
  const blocked = await rateLimiter.check('submission-c');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
  assert.equal(new Set(inputs).size, 1);
  assert.deepEqual(JSON.parse(inputs[0]), {
    scope: 'application-initiate',
    identity: { clientIp: '203.0.113.10' }
  });
});

test('rotating user agents does not create new rate-limit buckets', async () => {
  const client = fakeClient();
  const first = limiter({
    client,
    requestContext: { clientIp: '203.0.113.10', userAgent: 'agent-a' }
  });
  const second = limiter({
    client,
    requestContext: { clientIp: '203.0.113.10', userAgent: 'agent-b' }
  });

  assert.equal((await first.check('a')).allowed, true);
  assert.equal((await second.check('b')).allowed, true);
  assert.equal((await first.check('c')).allowed, false);
});

test('missing platform IPs share one conservative bucket rather than attacker-chosen IDs', async () => {
  const inputs = [];
  const rateLimiter = limiter({
    client: fakeClient(),
    inputs,
    requestContext: {}
  });

  assert.equal((await rateLimiter.check('attacker-chosen-a')).allowed, true);
  assert.equal((await rateLimiter.check('attacker-chosen-b')).allowed, true);
  assert.equal((await rateLimiter.check('attacker-chosen-c')).allowed, false);
  assert.equal(new Set(inputs).size, 1);
  assert.deepEqual(JSON.parse(inputs[0]), {
    scope: 'application-initiate',
    identity: { clientIp: 'unknown-app-service-client' }
  });
});

test('different trusted client IPs use independent buckets', async () => {
  const client = fakeClient();
  const first = limiter({ client, limit: 1, requestContext: { clientIp: '203.0.113.10' } });
  const second = limiter({ client, limit: 1, requestContext: { clientIp: '203.0.113.11' } });

  assert.equal((await first.check()).allowed, true);
  assert.equal((await first.check()).allowed, false);
  assert.equal((await second.check()).allowed, true);
});

test('disabled rate limiter is explicit and side-effect free', async () => {
  const rateLimiter = createRateLimiter({ enabled: false });
  assert.deepEqual(await rateLimiter.check('anything'), { allowed: true });
});
