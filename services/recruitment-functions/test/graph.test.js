'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  GRAPH_SCOPE,
  IMMUTABLE_ID_PREFERENCE,
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

test('filter values escape OData quotes', () => {
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

test('acknowledgement drafts carry a deterministic extended property and immutable id preference', async () => {
  const calls = [];
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(201, { id: 'immutable-draft-id', isDraft: true });
    }
  });

  const draft = await graph.createDraftMessage(
    'hr@shorevest.com',
    {
      subject: 'Application received',
      body: { contentType: 'Text', content: 'Received.' },
      toRecipients: [{ emailAddress: { address: 'candidate@example.com' } }]
    },
    {
      id: 'String {guid} Name ShoreVestApplicationReference',
      value: 'SV-APP-2026-ABC123'
    }
  );

  assert.equal(draft.id, 'immutable-draft-id');
  assert.ok(calls[0].url.endsWith('/users/hr%40shorevest.com/messages'));
  assert.equal(calls[0].options.headers.Prefer, IMMUTABLE_ID_PREFERENCE);
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.singleValueExtendedProperties[0].value, 'SV-APP-2026-ABC123');
  assert.equal(payload.attachments, undefined);
});

test('acknowledgement reconciliation searches by the extended property', async () => {
  const calls = [];
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, { value: [{ id: 'message-1', isDraft: false, sentDateTime: '2026-07-22T00:02:00Z' }] });
    }
  });

  const found = await graph.findMessagesByExtendedProperty(
    'hr@shorevest.com',
    'String {guid} Name ShoreVestApplicationReference',
    "SV-APP-'1"
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].isDraft, false);
  assert.ok(calls[0].url.includes('singleValueExtendedProperties%2FAny'));
  assert.ok(calls[0].url.includes('SV-APP-%27%271'));
  assert.equal(calls[0].options.headers.Prefer, IMMUTABLE_ID_PREFERENCE);
});

test('draft send uses the immutable message id and no message body', async () => {
  const calls = [];
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(202);
    }
  });

  await graph.sendDraftMessage('hr@shorevest.com', 'immutable/id');
  assert.ok(calls[0].url.endsWith('/users/hr%40shorevest.com/messages/immutable%2Fid/send'));
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.body, undefined);
});

test('missing checkpointed message returns null rather than creating a replacement', async () => {
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async () => response(404, { error: { code: 'ErrorItemNotFound' } })
  });
  assert.equal(await graph.getMessage('hr@shorevest.com', 'missing'), null);
});

test('Graph readiness verifies both selected lists and the scoped mailbox', async () => {
  const calls = [];
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, { id: 'ok', value: [] });
    }
  });

  assert.deepEqual(await graph.health({
    siteId: 'site-id',
    applicationsListId: 'applications-list',
    filesListId: 'files-list',
    mailbox: 'recruitment@shorevest.com'
  }), { ok: true });

  assert.equal(calls.length, 3);
  assert.ok(calls.some((call) => call.url.includes('/sites/site-id/lists/applications-list')));
  assert.ok(calls.some((call) => call.url.includes('/sites/site-id/lists/files-list')));
  assert.ok(calls.some((call) => call.url.includes('/users/recruitment%40shorevest.com/messages')));
  assert.ok(calls.every((call) => call.options.signal !== undefined || typeof AbortSignal.timeout !== 'function'));
});

test('Graph readiness fails permanently when required resource identifiers are missing', async () => {
  const graph = createGraphAdapter({
    credential: credential(),
    fetchImpl: async () => response(200, {})
  });

  await assert.rejects(
    () => graph.health({ siteId: 'site-id' }),
    (error) => error instanceof GraphDeliveryError &&
      error.code === 'GRAPH_HEALTH_CONFIGURATION_INVALID' &&
      error.permanent === true
  );
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
