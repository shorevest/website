'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  GRAPH_SCOPE,
  GraphDeliveryError,
  escapeFilterString,
  createGraphAdapter
} = require('../src/adapters/graph');

function response(status, body = null, headers = {}) {
  return {
    status,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] || (body ? 'application/json' : '');
      }
    },
    async json() {
      return body;
    }
  };
}

function credential() {
  return {
    scopes: [],
    async getToken(scope) {
      this.scopes.push(scope);
      return { token: 'test-token' };
    }
  };
}

test('filter values escape SharePoint OData quotes', () => {
  assert.equal(escapeFilterString("APP-'1"), "APP-''1");
});

test('list upsert creates when no indexed item exists', async () => {
  const calls = [];
  const auth = credential();
  const graph = createGraphAdapter({
    credential: auth,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === 'GET') return response(200, { value: [] });
      return response(201, { id: '42' });
    }
  });

  const result = await graph.upsertListItem({
    siteId: 'site,one',
    listId: 'applications',
    keyField: 'ApplicationReference',
    keyValue: "APP-'1",
    fields: { Title: "APP-'1", ApplicationReference: "APP-'1" }
  });

  assert.deepEqual(result, { itemId: '42', created: true });
  assert.ok(calls[0].url.includes('%24filter=fields%2FApplicationReference+eq+%27APP-%27%271%27'));
  assert.equal(JSON.parse(calls[1].options.body).fields.ApplicationReference, "APP-'1");
  assert.ok(auth.scopes.every((scope) => scope === GRAPH_SCOPE));
});

test('list upsert patches an existing item', async () => {
  const calls = [];
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === 'GET') return response(200, { value: [{ id: '7' }] });
      return response(200, { ApplicationReference: 'APP-1' });
    }
  });

  const result = await graph.upsertListItem({
    siteId: 'site',
    listId: 'applications',
    keyField: 'ApplicationReference',
    keyValue: 'APP-1',
    fields: { TechnicalStatus: 'Ready' }
  });

  assert.deepEqual(result, { itemId: '7', created: false });
  assert.equal(calls[1].options.method, 'PATCH');
  assert.ok(calls[1].url.endsWith('/items/7/fields'));
});

test('duplicate SharePoint projection targets fail permanently', async () => {
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async () => response(200, { value: [{ id: '1' }, { id: '2' }] })
  });

  await assert.rejects(
    () => graph.findListItem('site', 'list', 'ApplicationReference', 'APP-1'),
    (error) => error instanceof GraphDeliveryError && error.permanent === true && error.code === 'GRAPH_DUPLICATE_LIST_ITEM'
  );
});

test('candidate mail uses the configured mailbox and has no attachments', async () => {
  const calls = [];
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(202);
    }
  });

  await graph.sendMail('hr@shorevest.com', {
    subject: 'Application received',
    body: { contentType: 'Text', content: 'Received.' },
    toRecipients: [{ emailAddress: { address: 'candidate@example.com' } }]
  });

  assert.ok(calls[0].url.endsWith('/users/hr%40shorevest.com/sendMail'));
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.saveToSentItems, true);
  assert.equal(payload.message.attachments, undefined);
});

test('Graph throttling is retryable and preserves Retry-After', async () => {
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async () => response(429, { error: { code: 'TooManyRequests' } }, { 'retry-after': '3' })
  });

  await assert.rejects(
    () => graph.request('/sites/test'),
    (error) => error.code === 'GRAPH_RATE_LIMITED' && error.permanent === false && error.retryAfterMs === 3000
  );
});
