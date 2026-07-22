/* ==========================================================================
   ShoreVest One — Asset Tracing module source/model tests
   Run: node tests/employee-portal-asset-tracing.test.js
   ========================================================================== */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failures.push({ name, error: e }); } }

const modelSource = read('assets/js/employee-portal/asset-tracing.js');
const viewSource = read('assets/js/employee-portal/views-asset-tracing.js');
const css = read('assets/css/employee-portal-asset-tracing.css');
const portalIndex = read('employee-portal/index.html');
const docs = read('docs/employee-portal/ASSET_TRACING_MODULE.md');

/* Load the CommonJS model without a browser. */
delete require.cache[require.resolve('../assets/js/employee-portal/asset-tracing.js')];
const model = require('../assets/js/employee-portal/asset-tracing.js');

test('portal entry loads the model, view and stylesheet', () => {
  assert.ok(portalIndex.includes('employee-portal-asset-tracing.css'));
  assert.ok(portalIndex.includes('employee-portal/asset-tracing.js'));
  assert.ok(portalIndex.includes('employee-portal/views-asset-tracing.js'));
});

test('module registers a dedicated Asset Tracing workspace', () => {
  assert.ok(modelSource.includes("key: 'asset-tracing'"));
  assert.ok(modelSource.includes("hash: '#/workspace/asset-tracing'"));
  assert.ok(viewSource.includes("params[0] === 'asset-tracing'"));
});

test('all fixtures are explicitly synthetic and structurally complete', () => {
  assert.ok(Array.isArray(model.fixtures) && model.fixtures.length >= 3);
  model.fixtures.forEach((c) => {
    assert.ok(c.projectName && c.decisionQuestion && c.owner && c.reviewer);
    assert.ok(Array.isArray(c.subjects));
    assert.ok(Array.isArray(c.sources));
    assert.ok(Array.isArray(c.findings));
    assert.ok(Array.isArray(c.audit));
  });
  assert.ok(modelSource.includes('every person, company, address, matter and source below is'));
  assert.ok(viewSource.includes('Synthetic demonstration only.'));
});

test('the screening score is restricted to 0–3 with scoped labels', () => {
  assert.deepStrictEqual(Object.keys(model.scoreLabels), ['0', '1', '2', '3']);
  assert.strictEqual(model.scoreLabel(0), 'None identified');
  assert.strictEqual(model.scoreLabel(3), 'Strong');
  assert.strictEqual(model.scoreLabel(null), 'Not scored');
});

test('a finding requires category, title and conclusion', () => {
  assert.throws(() => model.addFinding('missing', {}, 'Test'), /Case not found/);
  assert.ok(modelSource.includes("required(payload.conclusion, 'Conclusion')"));
});

test('the prototype has no external network or upload implementation', () => {
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon', 'FileReader'].forEach((token) => {
    assert.ok(!modelSource.includes(token), 'model contains ' + token);
    assert.ok(!viewSource.includes(token), 'view contains ' + token);
  });
  assert.ok(viewSource.includes('Metadata only.'));
  assert.ok(viewSource.includes('does not upload or retain file contents'));
});

test('no known confidential project or subject names are committed to the module', () => {
  const combined = [modelSource, viewSource, css, docs].join('\n').toLowerCase();
  ['pinewood', 'ingots', 'ge hekai', 'dafa', 'sansheng', 'rongbin', 'xuan cheng'].forEach((term) => {
    assert.ok(!combined.includes(term), 'confidential term present: ' + term);
  });
});

test('the module states the production security boundary', () => {
  assert.ok(docs.includes('Server-side token, role and case-level permission checks.'));
  assert.ok(docs.includes('Everything committed to this public repository is synthetic.'));
  assert.ok(viewSource.includes('No confidential file contents are stored in this prototype.'));
});

test('asset tracing CSS is responsive and uses existing ShoreVest One tokens', () => {
  assert.ok(css.includes('@media (max-width: 760px)'));
  assert.ok(css.includes('var(--ops-red)'));
  assert.ok(css.includes('var(--ops-font)'));
  assert.ok(!css.includes('@import'));
});

if (failures.length) {
  console.error('\n✗ ' + failures.length + ' Asset Tracing test(s) failed:\n');
  failures.forEach((f) => console.error('  ✗ ' + f.name + '\n    ' + f.error.message));
  process.exit(1);
}
console.log('✓ All ' + passed + ' ShoreVest One Asset Tracing tests passed.');
