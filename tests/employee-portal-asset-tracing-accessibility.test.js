/* ShoreVest One — Asset Tracing accessibility hardening tests */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failures.push({ name, error: e }); } }

const source = read('assets/js/employee-portal/asset-tracing-accessibility.js');
const index = read('employee-portal/index.html');


test('portal loads accessibility hardening after the shell registers', () => {
  const viewAt = index.indexOf('employee-portal/views-asset-tracing-report.js');
  const appAt = index.indexOf('employee-portal/app.js');
  const hardeningAt = index.indexOf('employee-portal/asset-tracing-accessibility.js');
  assert.ok(viewAt !== -1 && appAt > viewAt, 'shell loads after Asset Tracing views');
  assert.ok(hardeningAt > appAt, 'hardening registers after the shell startup listener');
});

test('dynamic form fields receive programmatic labels and hint relationships', () => {
  assert.ok(source.includes("label.setAttribute('for', control.id)"));
  assert.ok(source.includes("control.setAttribute('aria-describedby'"));
  assert.ok(source.includes("control.setAttribute('aria-label', label.textContent.trim())"));
});

test('body-level drawers are included in field hardening', () => {
  assert.ok(source.includes(".at-workspace .fld, .drawer .fld"));
  assert.ok(source.includes("observer.observe(body, { childList: true, subtree: true })"));
});

test('active tabs and data tables expose navigation and header semantics', () => {
  assert.ok(source.includes("tab.setAttribute('aria-current', 'page')"));
  assert.ok(source.includes("th.setAttribute('scope', 'col')"));
});

test('clickable case rows have keyboard-compatible accessible names', () => {
  assert.ok(source.includes("node.querySelectorAll('.at-workspace .rowlink')"));
  assert.ok(source.includes("row.setAttribute('aria-label', label)"));
});

test('visually disabled controls are genuinely disabled', () => {
  assert.ok(source.includes("button.disabled = true"));
  assert.ok(source.includes("button.setAttribute('aria-disabled', 'true')"));
});

test('the hardening survives routed-view and drawer replacement', () => {
  assert.ok(source.includes('MutationObserver'));
  assert.ok(source.includes("root.addEventListener('svops:render'"));
  assert.ok(source.includes("harden(root.document)"));
});

test('the hardening performs no data or network action', () => {
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon', 'FileReader', 'localStorage.setItem'].forEach((token) => {
    assert.ok(!source.includes(token), 'accessibility hardening contains ' + token);
  });
});

if (failures.length) {
  console.error('\n✗ ' + failures.length + ' Asset Tracing accessibility test(s) failed:\n');
  failures.forEach((f) => console.error('  ✗ ' + f.name + '\n    ' + f.error.message));
  process.exit(1);
}
console.log('✓ All ' + passed + ' ShoreVest One Asset Tracing accessibility tests passed.');
