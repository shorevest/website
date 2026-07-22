/* ShoreVest One — startup guard and cache-busting tests */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failures.push({ name, error: e }); } }

const index = read('employee-portal/index.html');
const guard = read('assets/js/employee-portal/boot-guard.js');

test('entry page exposes one build marker and cache-busts every portal asset with it', () => {
  const marker = index.match(/data-portal-build="([^"]+)"/);
  assert.ok(marker && marker[1], 'entry page is missing its portal build marker');
  const buildKey = marker[1];
  const portalRefs = index.match(/(?:assets\/css\/employee-portal[^"']+|assets\/js\/employee-portal[^"']+|assets\/js\/vendor\/msal-browser[^"']+)/g) || [];
  assert.ok(portalRefs.length > 20, 'expected full portal asset list');
  portalRefs.forEach((ref) => assert.ok(ref.includes('v=' + buildKey), 'stale portal asset key: ' + ref));
});

test('startup guard loads before configuration and application code', () => {
  const guardAt = index.indexOf('employee-portal/boot-guard.js');
  const configAt = index.indexOf('employee-portal/portal-config.js');
  const appAt = index.indexOf('employee-portal/app.js');
  assert.ok(guardAt !== -1 && guardAt < configAt && configAt < appAt);
});

test('shell registers before progressive enhancement layers', () => {
  const appAt = index.indexOf('employee-portal/app.js');
  const accessibilityAt = index.indexOf('employee-portal/asset-tracing-accessibility.js');
  const usabilityAt = index.indexOf('employee-portal/asset-tracing-usability.js');
  assert.ok(appAt < accessibilityAt && accessibilityAt < usabilityAt);
});

test('guard replaces a blank startup with visible recovery actions', () => {
  assert.ok(guard.includes('ShoreVest One did not finish loading'));
  assert.ok(guard.includes('Reload with fresh files'));
  assert.ok(guard.includes('Reset demo session'));
  assert.ok(guard.includes("root.location.replace(freshUrl())"));
  assert.ok(guard.includes("root.sessionStorage.removeItem('svops.session.v2')"));
});

test('guard records browser startup errors without transmitting them', () => {
  assert.ok(guard.includes("root.addEventListener('error'"));
  assert.ok(guard.includes("root.addEventListener('unhandledrejection'"));
  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon'].forEach((token) => {
    assert.ok(!guard.includes(token), 'startup guard contains network action: ' + token);
  });
});

if (failures.length) {
  console.error('\n✗ ' + failures.length + ' ShoreVest One startup test(s) failed:\n');
  failures.forEach((f) => console.error('  ✗ ' + f.name + '\n    ' + f.error.message));
  process.exit(1);
}
console.log('✓ All ' + passed + ' ShoreVest One startup guard tests passed.');
