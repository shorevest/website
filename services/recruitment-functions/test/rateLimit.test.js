'use strict';

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

test('rate limiter enforces a fixed window using a hashed server identity', async () => {
  const limiter = createRateLimiter({
    client: fakeClient(),
    databaseId: 'recruitment',
    enabled: true,
    limit: 2,
    windowSeconds: 300,
    fingerprint: { async hmac() { return 'digest'; } },
    requestContext: { clientIp: '203.0.113.10', userAgent: 'test' },
    now: () => new Date('2026-07-22T12:00:00Z')
  });

  assert.equal((await limiter.check('a')).allowed, true);
  assert.equal((await limiter.check('b')).allowed, true);
  const blocked = await limiter.check('c');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test('disabled rate limiter is explicit and side-effect free', async () => {
  const limiter = createRateLimiter({ enabled: false });
  assert.deepEqual(await limiter.check('anything'), { allowed: true });
});
