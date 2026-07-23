/* ShoreVest One — team sidebar navigation tests */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(rootDir, 'assets/js/employee-portal/sidebar-team-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(rootDir, 'assets/css/employee-portal-sidebar-teams.css'), 'utf8');
const index = fs.readFileSync(path.join(rootDir, 'employee-portal/index.html'), 'utf8');

const persona = { nav: [] };
const browser = { SVPortalPersonas: { list: [persona] } };

vm.runInNewContext(source, { self: browser, Array, Object }, {
  filename: 'sidebar-team-navigation.js'
});

const nav = persona.nav;
const labels = nav.map((item) => item.sep || item.label);
const indexOf = (label) => labels.indexOf(label);
const groups = Array.from(nav.filter((item) => item.sep), (item) => item.sep);

assert.strictEqual(
  JSON.stringify(groups),
  JSON.stringify(['Your work', 'Client Solutions / IR', 'Investment', 'Firm & Operations']),
  'sidebar groups should be ordered by team'
);

assert.ok(indexOf('Home') > indexOf('Your work'));
assert.ok(indexOf('My Work') > indexOf('Home'));
assert.ok(indexOf('Relationships') > indexOf('Client Solutions / IR'));
assert.ok(indexOf('Meeting Support') < indexOf('Investment'));
assert.ok(indexOf('Asset Tracing') > indexOf('Investment'));
assert.ok(indexOf('Asset Tracing') < indexOf('Firm & Operations'));
assert.ok(indexOf('Operations Tools') > indexOf('Firm & Operations'));

const assetTracing = nav.find((item) => item.label === 'Asset Tracing');
assert.strictEqual(assetTracing.hash, '#/workspace/asset-tracing');
const tools = nav.find((item) => item.key === 'tools');
assert.strictEqual(tools.label, 'Operations Tools');
assert.strictEqual(tools.hash, '#/tools');

assert.ok(css.includes('border-top: 1px solid var(--ops-hairline)'));
assert.ok(css.includes('text-transform: uppercase'));
assert.ok(!source.includes('MutationObserver'), 'sidebar grouping should not install a DOM observer');
assert.ok(!source.includes('querySelectorAll'), 'sidebar grouping should not rewrite rendered navigation');

const personasAt = index.indexOf('employee-portal/personas.js');
const teamsAt = index.indexOf('employee-portal/sidebar-team-navigation.js');
const appAt = index.indexOf('employee-portal/app.js');
assert.ok(personasAt !== -1 && teamsAt > personasAt && teamsAt < appAt,
  'team navigation must load after personas and before the shell');
assert.ok(index.includes('employee-portal-sidebar-teams.css'));

['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon', 'localStorage.setItem'].forEach((token) => {
  assert.ok(!source.includes(token), 'team navigation contains prohibited action: ' + token);
});

console.log('✓ ShoreVest One sidebar is clearly grouped by team.');
