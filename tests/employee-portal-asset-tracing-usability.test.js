/* ShoreVest One — Asset Tracing usability guidance tests */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failures.push({ name, error: e }); } }

const source = read('assets/js/employee-portal/asset-tracing-usability.js');
const css = read('assets/css/employee-portal-asset-tracing-usability.css');
const index = read('employee-portal/index.html');

test('portal loads usability guidance after the Asset Tracing views', () => {
  const viewAt = index.indexOf('employee-portal/views-asset-tracing-report.js');
  const usabilityAt = index.indexOf('employee-portal/asset-tracing-usability.js');
  const appAt = index.indexOf('employee-portal/app.js');
  assert.ok(viewAt !== -1 && usabilityAt > viewAt);
  assert.ok(appAt !== -1 && usabilityAt < appAt);
  assert.ok(index.includes('employee-portal-asset-tracing-usability.css'));
});

test('each case gets a five-step completion path and one recommended action', () => {
  ['overview', 'sources', 'findings', 'review', 'report'].forEach((stage) => {
    assert.ok(source.includes(stage + ':'), 'missing stage: ' + stage);
  });
  assert.ok(source.includes('Recommended next step'));
  assert.ok(source.includes("tabs.insertAdjacentElement('afterend', guidance)"));
  assert.ok(source.includes("tab.classList.toggle('is-complete'"));
});

test('recommended actions follow the evidence workflow in order', () => {
  const expected = [
    'Add the first subject', 'Log the first evidence source', 'Turn the evidence into a finding',
    'Link every finding to evidence', 'Finish the second-person review',
    'Set the lead score and rationale', 'Clear the remaining approval checks',
    'Approve the case when ready', 'Review the final report'
  ];
  expected.forEach((label) => assert.ok(source.includes(label), 'missing guidance: ' + label));
});

test('case queue makes row behaviour explicit', () => {
  assert.ok(source.includes('Choose any case row to continue'));
  assert.ok(source.includes('Open case →'));
});

test('new-case drawer marks required fields and prevents incomplete submission', () => {
  assert.ok(source.includes("drawer.querySelector('h1, h2, h3, .drawer__title')"));
  assert.ok(source.includes("title !== 'Create asset-tracing case'"));
  assert.ok(source.includes("control.setAttribute('aria-required', 'true')"));
  assert.ok(source.includes('primary.disabled = !ready'));
  assert.ok(source.includes('Choose a reviewer who is different from the owner.'));
  assert.ok(source.includes('Complete '));
  assert.ok(source.includes('Ready to create.'));
});

test('usability layer remains presentation-only', () => {
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon', 'FileReader', 'localStorage.setItem'].forEach((token) => {
    assert.ok(!source.includes(token), 'usability layer contains ' + token);
  });
});

test('usability CSS is responsive and uses ShoreVest One tokens', () => {
  assert.ok(css.includes('@media (max-width: 760px)'));
  assert.ok(css.includes('var(--ops-red)'));
  assert.ok(css.includes('var(--ops-font)'));
  assert.ok(!css.includes('@import'));
});

if (failures.length) {
  console.error('\n✗ ' + failures.length + ' Asset Tracing usability test(s) failed:\n');
  failures.forEach((f) => console.error('  ✗ ' + f.name + '\n    ' + f.error.message));
  process.exit(1);
}
console.log('✓ All ' + passed + ' ShoreVest One Asset Tracing usability tests passed.');
