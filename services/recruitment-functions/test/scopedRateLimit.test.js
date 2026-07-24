'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createRateLimiter } = require('../src/adapters/rateLimit');

function fakeCosmos() {
  const documents = new Map();
  const container = {
    items: {
      async create(document) {
        if (documents.has(document.id)) {
          throw Object.assign(new Error('conflict'), { code: 409 });
        }
        documents.set(document.id, { ...document });
        return { resource: { ...document } };
      }
    },
    item(id) {
      return {
        async patch(operations) {
          const document = documents.get(id);
          if (!document) throw Object.assign(new Error('not found'), { code: 404 });
          for (const operation of operations) {
            if (operation.op === 'incr' && operation.path === '/count') {
              document.count += operation.value;
            }
          }
          documents.set(id, document);
          return { resource: { ...document } };
        }
      };
    }
  };
  return {
    documents,
    database() {
      return { container: () => container };
    }
  };
}

function limiter({ limit = 1 } = {}) {
  const client = fakeCosmos();
  const adapter = createRateLimiter({
    client,
    enabled: true,
    limit,
    windowSeconds: 300,
    databaseId: 'recruitment',
    requestContext: {
      clientIp: '203.0.113.10',
      userAgent: 'Browser/1.0'
    },
    fingerprint: {
      async hmac(value) {
        return Buffer.from(value).toString('base64url');
      }
    },
    now: () => new Date('2026-07-23T00:01:00.000Z')
  });
  return { adapter, client };
}

test('candidate submission IDs cannot create arbitrary initiation buckets', async () => {
  const { adapter, client } = limiter();

  assert.equal((await adapter.check('candidate-controlled-id-1')).allowed, true);
  const second = await adapter.check('different-candidate-controlled-id');
  assert.equal(second.allowed, false);
  assert.equal(second.errorCode, 'RATE_LIMITED');
  assert.equal(client.documents.size, 1);

  const document = [...client.documents.values()][0];
  assert.equal(document.scope, 'initiate');
});

test('complete and finalize use independent fixed server scopes', async () => {
  const { adapter, client } = limiter();

  assert.equal((await adapter.checkScope('complete')).allowed, true);
  assert.equal((await adapter.checkScope('finalize')).allowed, true);
  assert.equal((await adapter.checkScope('complete')).allowed, false);
  assert.equal((await adapter.checkScope('finalize')).allowed, false);

  assert.equal(client.documents.size, 2);
  assert.deepEqual(
    [...client.documents.values()].map((document) => document.scope).sort(),
    ['complete', 'finalize']
  );
});

test('unknown rate-limit scopes fail closed without creating storage records', async () => {
  const { adapter, client } = limiter();
  assert.deepEqual(await adapter.checkScope('candidate-defined-scope'), {
    allowed: false,
    errorCode: 'RATE_LIMITED'
  });
  assert.equal(client.documents.size, 0);
});
