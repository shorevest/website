/* ShoreVest One — Asset Tracing Phase 1B tests */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failures.push({ name, error: e }); } }

const extensionSource = read('assets/js/employee-portal/asset-tracing-phase1b.js');
const viewSource = read('assets/js/employee-portal/views-asset-tracing-phase1b.js');
const css = read('assets/css/employee-portal-asset-tracing-phase1b.css');
const index = read('employee-portal/index.html');
const install = require('../assets/js/employee-portal/asset-tracing-phase1b.js');

function completeCase() {
  return {
    id: 'case-test', owner: 'Alex Morgan', reviewer: 'Jordan Lee', decisionQuestion: 'Should deeper work be commissioned?',
    score: 2, scoreRationale: 'Current evidence supports targeted verification, subject to stated limitations.',
    sources: [{ id: 's1' }],
    findings: [{ id: 'f1', sourceIds: ['s1'], state: 'Reviewed' }]
  };
}

test('portal loads Phase 1B scripts after the base model and view', () => {
  const modelAt = index.indexOf('employee-portal/asset-tracing.js');
  const extensionAt = index.indexOf('employee-portal/asset-tracing-phase1b.js');
  const viewAt = index.indexOf('employee-portal/views-asset-tracing.js');
  const viewExtensionAt = index.indexOf('employee-portal/views-asset-tracing-phase1b.js');
  assert.ok(modelAt !== -1 && extensionAt > modelAt);
  assert.ok(viewAt !== -1 && viewExtensionAt > viewAt);
  assert.ok(index.includes('employee-portal-asset-tracing-phase1b.css'));
});

test('approval gate passes only a complete second-person reviewed case', () => {
  const checks = install.approvalChecksForCase(completeCase(), {});
  assert.ok(checks.length >= 8);
  assert.ok(checks.every((c) => c.pass));
});

test('approval gate rejects the same owner and reviewer', () => {
  const item = completeCase();
  item.reviewer = item.owner;
  const check = install.approvalChecksForCase(item, {}).find((c) => c.key === 'owner-reviewer');
  assert.strictEqual(check.pass, false);
});

test('approval gate rejects unsourced or unreviewed findings', () => {
  const item = completeCase();
  item.findings[0].sourceIds = [];
  item.findings[0].state = 'Needs review';
  const checks = install.approvalChecksForCase(item, {});
  assert.strictEqual(checks.find((c) => c.key === 'citations').pass, false);
  assert.strictEqual(checks.find((c) => c.key === 'review-state').pass, false);
});

test('wrapped updateReview cannot bypass the hard approval gate', () => {
  const incomplete = completeCase();
  incomplete.findings[0].state = 'Needs review';
  let called = 0;
  const fake = {
    getCase: () => incomplete,
    updateReview: () => { called++; return 'saved'; }
  };
  install({ SVAssetTracing: fake });
  assert.throws(() => fake.updateReview('case-test', { status: 'Approved', score: 2, scoreRationale: 'Reason' }, 'Reviewer'), /Approval blocked/);
  assert.strictEqual(called, 0);
});

test('new controls cover research planning, next steps and finding review', () => {
  ['addCoverage', 'addNextStep', 'setFindingReview', 'approvalChecks'].forEach((name) => assert.ok(extensionSource.includes('A.' + name)));
  assert.ok(viewSource.includes('Add research coverage'));
  assert.ok(viewSource.includes('Add next step'));
  assert.ok(viewSource.includes('Mark reviewed'));
  assert.ok(viewSource.includes('Hard approval gate'));
});

test('Phase 1B contains no network or file-upload implementation', () => {
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon', 'FileReader', "type: 'file'"].forEach((token) => {
    assert.ok(!extensionSource.includes(token), 'model extension contains ' + token);
    assert.ok(!viewSource.includes(token), 'view extension contains ' + token);
  });
});

test('Phase 1B remains synthetic and excludes known confidential terms', () => {
  const combined = [extensionSource, viewSource, css].join('\n').toLowerCase();
  ['pinewood', 'ingots', 'ge hekai', 'dafa', 'sansheng', 'rongbin', 'xuan cheng'].forEach((term) => {
    assert.ok(!combined.includes(term), 'confidential term present: ' + term);
  });
  assert.ok(extensionSource.includes('synthetic demonstration'));
  assert.ok(viewSource.includes('No confidential file contents'));
});

test('Phase 1B CSS is responsive and uses ShoreVest One tokens', () => {
  assert.ok(css.includes('@media (max-width: 760px)'));
  assert.ok(css.includes('var(--ops-red-dark)'));
  assert.ok(css.includes('var(--ops-font)'));
  assert.ok(!css.includes('@import'));
});

if (failures.length) {
  console.error('\n✗ ' + failures.length + ' Asset Tracing Phase 1B test(s) failed:\n');
  failures.forEach((f) => console.error('  ✗ ' + f.name + '\n    ' + f.error.message));
  process.exit(1);
}
console.log('✓ All ' + passed + ' ShoreVest One Asset Tracing Phase 1B tests passed.');
