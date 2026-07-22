'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { startServer } = require('../../server/index');
const { buildConfig } = require('../../server/config');

async function withServer(fn) {
  const dbFile = path.join(os.tmpdir(), `svone-api-${crypto.randomUUID()}.db`);
  const config = buildConfig({ SHOREVEST_ONE_MODE: 'MOCK', SHOREVEST_ONE_DB: dbFile, SHOREVEST_ONE_PORT: '0' });
  const started = await startServer({ config });
  try {
    await fn(started);
  } finally {
    started.server.close();
    started.app.close();
    fs.rmSync(dbFile, { force: true });
  }
}

function api(base, method, urlPath, body, role = 'director') {
  return fetch(base + urlPath, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-sv-user': role },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
}

test('API: session reports MOCK mode and permissions', async () => {
  await withServer(async ({ url }) => {
    const res = await api(url, 'GET', '/api/session');
    assert.equal(res.status, 200);
    assert.equal(res.json.mode, 'MOCK');
    assert.match(res.json.banner, /Mock connectors/);
    assert.ok(res.json.permissions.includes('request_execution'));
  });
});

test('API: connectors report healthy mock implementations', async () => {
  await withServer(async ({ url }) => {
    const res = await api(url, 'GET', '/api/connectors');
    assert.equal(res.status, 200);
    const sf = res.json.connectors.find((c) => c.name === 'salesforce');
    assert.ok(sf.ok);
    assert.match(sf.detail, /mock/i);
  });
});

test('API: full outreach flow over HTTP', async () => {
  await withServer(async ({ url }) => {
    // Search
    const search = await api(url, 'POST', '/api/outreach/search', { query: 'Denmark contacts', name: 'API Denmark' });
    assert.equal(search.status, 200);
    const audienceId = search.json.audienceId;
    assert.ok(search.json.summary.total >= 40);

    // Review
    const view = await api(url, 'GET', `/api/outreach/audiences/${audienceId}`);
    assert.equal(view.status, 200);
    const ready = view.json.members.filter((m) => m.status === 'ready');
    assert.ok(ready.length > 0);

    // Export only eligible rows
    const exp = await api(url, 'POST', `/api/outreach/audiences/${audienceId}/export`);
    assert.equal(exp.status, 200);
    assert.equal(exp.json.rows, ready.length);

    // Prepare draft group
    const usersRes = await api(url, 'GET', '/api/users');
    const director = usersRes.json.users.find((u) => u.role === 'director');
    const draft = await api(url, 'POST', `/api/outreach/audiences/${audienceId}/drafts`, { name: 'g1', senderId: director.id, subject: 'Hi', body: 'Body' });
    assert.equal(draft.status, 200);
    const dgId = draft.json.draftGroup.id;

    // Accept
    await api(url, 'POST', `/api/outreach/draft-groups/${dgId}/mark`, { status: 'needs_review' });
    await api(url, 'POST', `/api/outreach/draft-groups/${dgId}/mark`, { status: 'accepted' });

    // Package + submit
    const pkg = await api(url, 'POST', `/api/outreach/audiences/${audienceId}/packages`, { senderId: director.id });
    const submit = await api(url, 'POST', `/api/outreach/packages/${pkg.json.package.id}/submit`);
    assert.equal(submit.status, 200);

    // Approve (approver role)
    const approve = await api(url, 'POST', `/api/approvals/${pkg.json.package.id}/decide`, { decision: 'approved' }, 'approver');
    assert.equal(approve.status, 200);

    // Request execution
    const exec = await api(url, 'POST', `/api/outreach/packages/${pkg.json.package.id}/request-execution`, { idempotencyKey: 'api-exec-1' });
    assert.equal(exec.status, 200);
    assert.ok(exec.json.result.sent >= 0);

    // Messages + audit visible over HTTP
    const messages = await api(url, 'GET', `/api/outreach/messages?packageId=${pkg.json.package.id}`);
    assert.ok(messages.json.messages.length > 0);
    const audit = await api(url, 'GET', '/api/audit-events?limit=500');
    assert.ok(audit.json.events.some((e) => e.action === 'execution_requested'));
  });
});

test('API: invalid transition returns 409', async () => {
  await withServer(async ({ url }) => {
    const search = await api(url, 'POST', '/api/outreach/search', { query: 'Denmark', name: 'x' });
    const audienceId = search.json.audienceId;
    const usersRes = await api(url, 'GET', '/api/users');
    const director = usersRes.json.users.find((u) => u.role === 'director');
    const draft = await api(url, 'POST', `/api/outreach/audiences/${audienceId}/drafts`, { senderId: director.id });
    // draft → accepted is not a legal direct transition
    const bad = await api(url, 'POST', `/api/outreach/draft-groups/${draft.json.draftGroup.id}/mark`, { status: 'accepted' });
    assert.equal(bad.status, 409);
    assert.equal(bad.json.error.code, 'INVALID_TRANSITION');
  });
});

test('API: approver forbidden from requesting execution (403)', async () => {
  await withServer(async ({ url }) => {
    const search = await api(url, 'POST', '/api/outreach/search', { query: 'Denmark', name: 'x' });
    const pkg = await api(url, 'POST', `/api/outreach/audiences/${search.json.audienceId}/packages`, {});
    const res = await api(url, 'POST', `/api/outreach/packages/${pkg.json.package.id}/request-execution`, { idempotencyKey: 'z' }, 'approver');
    assert.equal(res.status, 403);
    assert.equal(res.json.error.code, 'PERMISSION_DENIED');
  });
});
