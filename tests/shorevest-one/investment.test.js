'use strict';

/**
 * Investment Toolbox — IC Deck QC.
 * Engine (pure), service (persistence, permissions, audit), and HTTP API.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { newApp, reopen, userByRole } = require('./helpers');
const { startServer } = require('../../server/index');
const { buildConfig } = require('../../server/config');
const { reconcile, summarize } = require('../../server/services/investmentQc');

// ── Pure engine ──────────────────────────────────────────────────────────────

test('reconcile: matches within tolerance are ok; differences are mismatches', () => {
  const metrics = [
    { key: 'bal', label: 'Balance', unit: '£m', format: 'currency', valueNum: 1419.6, valueText: null, tolerance: 0.5 },
    { key: 'irr', label: 'IRR', unit: '%', format: 'percent', valueNum: 17.9, valueText: null, tolerance: 0.05 },
  ];
  const figures = [
    { key: 'bal', label: 'Balance', slide: 5, statedNum: 1420, statedText: null }, // 0.4 <= 0.5 → ok
    { key: 'irr', label: 'IRR', slide: 9, statedNum: 18.4, statedText: null },      // off → mismatch
  ];
  const findings = reconcile({ metrics, figures });
  const byKey = Object.fromEntries(findings.map((f) => [f.metricKey, f]));
  assert.equal(byKey.bal.severity, 'ok');
  assert.equal(byKey.irr.severity, 'mismatch');
  assert.equal(byKey.irr.deckNum, 18.4);
  assert.equal(byKey.irr.modelNum, 17.9);
});

test('reconcile: a value matching an older model version is stale, not a mismatch', () => {
  const metrics = [{ key: 'rec', label: 'Recovery', unit: '%', format: 'percent', valueNum: 62.5, valueText: null, tolerance: 0.05 }];
  const figures = [{ key: 'rec', label: 'Recovery', slide: 8, statedNum: 58.0, statedText: null }];
  const priorVersions = [{ version: 1, metrics: [{ key: 'rec', valueNum: 58.0, tolerance: 0.05 }] }];
  const [f] = reconcile({ metrics, figures, priorVersions });
  assert.equal(f.severity, 'stale');
  assert.equal(f.matchedVersion, 1);
});

test('reconcile: missing (model has it, deck omits) and orphan (deck-only) figures', () => {
  const metrics = [{ key: 'exit', label: 'Exit', unit: '', format: 'number', valueNum: 2031, valueText: null, tolerance: 0 }];
  const figures = [{ key: 'promote', label: 'Promote', slide: 11, statedNum: 6.5, statedText: null }];
  const findings = reconcile({ metrics, figures });
  const byKey = Object.fromEntries(findings.map((f) => [f.metricKey, f]));
  assert.equal(byKey.exit.severity, 'missing');
  assert.equal(byKey.promote.severity, 'orphan');
});

test('reconcile: text metrics compare case-insensitively', () => {
  const metrics = [{ key: 'ccy', label: 'Currency', unit: '', format: 'text', valueNum: null, valueText: 'GBP', tolerance: 0 }];
  assert.equal(reconcile({ metrics, figures: [{ key: 'ccy', label: 'Currency', slide: 2, statedNum: null, statedText: 'gbp' }] })[0].severity, 'ok');
  assert.equal(reconcile({ metrics, figures: [{ key: 'ccy', label: 'Currency', slide: 2, statedNum: null, statedText: 'EUR' }] })[0].severity, 'mismatch');
});

test('summarize: status escalates errors over warnings over clean', () => {
  assert.equal(summarize([{ severity: 'ok' }, { severity: 'ok' }]).status, 'clean');
  assert.equal(summarize([{ severity: 'ok' }, { severity: 'missing' }]).status, 'review_advised');
  assert.equal(summarize([{ severity: 'orphan' }]).status, 'review_advised');
  assert.equal(summarize([{ severity: 'ok' }, { severity: 'mismatch' }]).status, 'issues_found');
  assert.equal(summarize([{ severity: 'stale' }]).status, 'issues_found');
});

// ── Service ──────────────────────────────────────────────────────────────────

function svc(app) { return app.services.investmentQc; }
function admin(app) { return userByRole(app, 'admin'); }

test('service: seed loads deals with a reproduced transcription error', () => {
  const { app, dbFile } = newApp();
  try {
    const deals = svc(app).listDeals();
    const kf = deals.find((d) => d.code === 'PRJ-KINGFISHER');
    assert.ok(kf, 'Kingfisher deal seeded');
    assert.equal(kf.lastRun.status, 'issues_found');
    assert.equal(kf.lastRun.counts.mismatch, 2);
    assert.equal(kf.lastRun.counts.stale, 1);
    assert.equal(kf.lastRun.counts.missing, 1);
    assert.equal(kf.lastRun.counts.orphan, 1);

    const run = svc(app).getRun(kf.lastRun.id);
    const bal = run.findings.find((f) => f.metric_key === 'gross_npl_balance');
    assert.equal(bal.severity, 'mismatch');
    assert.equal(bal.model_num, 1420);
    assert.equal(bal.deck_num, 1240); // the mis-transcribed figure

    const marlin = deals.find((d) => d.code === 'PRJ-MARLIN');
    assert.equal(marlin.lastRun.status, 'clean');
  } finally { app.close(); fs.rmSync(dbFile, { force: true }); }
});

test('service: a QC run and its findings persist across a restart', () => {
  const { app, dbFile } = newApp();
  let runId;
  try {
    const heron = svc(app).listDeals().find((d) => d.code === 'PRJ-HERON');
    assert.equal(heron.lastRun, null, 'Heron has no run until asked');
    const dealId = svc(app).getDeal(heron.id).deal.id;
    const res = svc(app).runQc(admin(app), dealId);
    runId = res.run.id;
    assert.equal(res.run.status, 'issues_found'); // LTV is wrong
    assert.equal(res.run.counts.mismatch, 1);
  } finally { app.close(); }

  const app2 = reopen(dbFile);
  try {
    const run = app2.services.investmentQc.getRun(runId);
    assert.equal(run.findings.length, 4);
    const ltv = run.findings.find((f) => f.metric_key === 'ltv');
    assert.equal(ltv.severity, 'mismatch');
  } finally { app2.close(); fs.rmSync(dbFile, { force: true }); }
});

test('service: findings can be resolved and assigned to My Work', () => {
  const { app, dbFile } = newApp();
  try {
    const kf = svc(app).listDeals().find((d) => d.code === 'PRJ-KINGFISHER');
    const run = svc(app).getRun(kf.lastRun.id);
    const issue = run.findings.find((f) => f.severity === 'mismatch');

    const updated = svc(app).resolveFinding(admin(app), issue.id, { resolution: 'fixed', note: 'corrected in v4' });
    assert.equal(updated.resolution, 'fixed');
    assert.equal(updated.resolved_by, admin(app).id);

    const item = svc(app).assignForReview(admin(app), kf.lastRun.id, {});
    assert.equal(item.workspace, 'investment-qc');
    const mine = app.services.workItems.list({ workspace: 'investment-qc' });
    assert.ok(mine.some((w) => w.id === item.id));

    // Every material action is audited.
    const events = app.repos.auditFor('qc_finding', issue.id);
    assert.ok(events.some((e) => e.action === 'qc_finding_resolved'));
  } finally { app.close(); fs.rmSync(dbFile, { force: true }); }
});

test('service: running QC requires edit_audience (an approver cannot)', () => {
  const { app, dbFile } = newApp();
  try {
    const approver = userByRole(app, 'approver');
    const kf = svc(app).listDeals().find((d) => d.code === 'PRJ-KINGFISHER');
    const dealId = svc(app).getDeal(kf.id).deal.id;
    assert.throws(() => svc(app).runQc(approver, dealId), /Permission denied/);
  } finally { app.close(); fs.rmSync(dbFile, { force: true }); }
});

test('service: re-ingesting a deck goes through the document connector', async () => {
  const { app, dbFile } = newApp();
  try {
    const kf = svc(app).listDeals().find((d) => d.code === 'PRJ-KINGFISHER');
    const deck = svc(app).getDeal(kf.id).decks.find((d) => d.is_current);
    const before = app.repos.deckFigures.count({ deck_id: deck.id });
    const res = await svc(app).ingestDeck(admin(app), deck.id);
    assert.equal(res.figures, before); // deterministic re-extract, same count
    assert.equal(app.repos.deckFigures.count({ deck_id: deck.id }), before);
  } finally { app.close(); fs.rmSync(dbFile, { force: true }); }
});

// ── HTTP API ─────────────────────────────────────────────────────────────────

async function withServer(fn) {
  const dbFile = path.join(os.tmpdir(), `svone-inv-${crypto.randomUUID()}.db`);
  const config = buildConfig({ SHOREVEST_ONE_MODE: 'MOCK', SHOREVEST_ONE_DB: dbFile, SHOREVEST_ONE_PORT: '0' });
  const started = await startServer({ config });
  try { await fn(started); } finally { started.server.close(); started.app.close(); fs.rmSync(dbFile, { force: true }); }
}
function api(base, method, urlPath, body, role = 'director') {
  return fetch(base + urlPath, { method, headers: { 'Content-Type': 'application/json', 'x-sv-user': role }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
}

test('API: list deals, run QC, read findings, resolve one', async () => {
  await withServer(async ({ url }) => {
    const list = await api(url, 'GET', '/api/investment/deals');
    assert.equal(list.status, 200);
    const heron = list.json.deals.find((d) => d.code === 'PRJ-HERON');
    assert.ok(heron);

    const run = await api(url, 'POST', `/api/investment/deals/${heron.id}/qc-runs`, {});
    assert.equal(run.status, 200);
    assert.equal(run.json.run.status, 'issues_found');
    const runId = run.json.run.id;

    const got = await api(url, 'GET', `/api/investment/qc-runs/${runId}`);
    assert.equal(got.status, 200);
    const ltv = got.json.findings.find((f) => f.metric_key === 'ltv');
    assert.equal(ltv.severity, 'mismatch');

    const resolved = await api(url, 'POST', `/api/investment/findings/${ltv.id}/resolve`, { resolution: 'acknowledged' });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.json.finding.resolution, 'acknowledged');
  });
});

test('API: an approver is refused when running QC (403)', async () => {
  await withServer(async ({ url }) => {
    const list = await api(url, 'GET', '/api/investment/deals');
    const kf = list.json.deals.find((d) => d.code === 'PRJ-KINGFISHER');
    const res = await api(url, 'POST', `/api/investment/deals/${kf.id}/qc-runs`, {}, 'approver');
    assert.equal(res.status, 403);
  });
});
