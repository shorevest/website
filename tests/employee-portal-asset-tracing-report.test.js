/* ShoreVest One — Asset Tracing report-lineage tests */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failures.push({ name, error: e }); } }

const view = read('assets/js/employee-portal/views-asset-tracing-report.js');
const css = read('assets/css/employee-portal-asset-tracing-report.css');
const index = read('employee-portal/index.html');

test('portal loads the report enhancement after the asset-tracing views', () => {
  const base = index.indexOf('employee-portal/views-asset-tracing.js');
  const phase1b = index.indexOf('employee-portal/views-asset-tracing-phase1b.js');
  const report = index.indexOf('employee-portal/views-asset-tracing-report.js');
  assert.ok(base !== -1 && phase1b > base && report > phase1b);
  assert.ok(index.includes('employee-portal-asset-tracing-report.css'));
});

test('report enhancement exposes exact source lineage and source register', () => {
  assert.ok(view.includes('Finding-to-source lineage'));
  assert.ok(view.includes('Exact reference / page'));
  assert.ok(view.includes('Source register'));
  assert.ok(view.includes("label: 'S' + (index + 1)"));
});

test('report print is browser-local and introduces no external action', () => {
  assert.ok(view.includes('Print synthetic draft'));
  assert.ok(view.includes('root.print'));
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon', 'FileReader'].forEach((token) => assert.ok(!view.includes(token)));
});

test('report styles include a controlled print layout', () => {
  assert.ok(css.includes('@media print'));
  assert.ok(css.includes('.ops-sidebar'));
  assert.ok(css.includes('var(--ops-font)'));
  assert.ok(!css.includes('@import'));
});

test('report enhancement excludes known confidential terms', () => {
  const combined = (view + '\n' + css).toLowerCase();
  ['pinewood', 'ingots', 'ge hekai', 'dafa', 'sansheng', 'rongbin', 'xuan cheng'].forEach((term) => assert.ok(!combined.includes(term), term));
});

if (failures.length) {
  console.error('\n✗ ' + failures.length + ' Asset Tracing report test(s) failed:\n');
  failures.forEach((f) => console.error('  ✗ ' + f.name + '\n    ' + f.error.message));
  process.exit(1);
}
console.log('✓ All ' + passed + ' ShoreVest One Asset Tracing report tests passed.');
