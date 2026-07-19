/* ==========================================================================
   ShoreVest One — Phase 2B source-level assertions
   Run: node tests/employee-portal-phase2b.test.js

   Static checks over the shell, login, portal entry document, public footers,
   and public-visibility source configuration. Runtime behaviour (screenshots,
   no-JS-error, mobile overflow) is verified separately with a headless browser.
   ========================================================================== */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const count = (hay, needle) => hay.split(needle).length - 1;

let passed = 0;
const failures = [];
function test(name, fn) { try { fn(); passed++; } catch (e) { failures.push({ name, error: e }); } }

const app = read('assets/js/employee-portal/app.js');
const css = read('assets/css/employee-portal.css');
const portalIndex = read('employee-portal/index.html');
const siteConfig = read('assets/js/site-config.js');
const sharedFooter = read('assets/js/shared-footer.js');

/* ── Login ──────────────────────────────────────────────────────────────── */

test('login is a single-profile entry with the approved copy', () => {
  assert.ok(app.indexOf('Enter ShoreVest One') !== -1);
  assert.ok(app.indexOf('One demonstration profile with the full workspace — every section and every tool.') !== -1);
  assert.ok(app.indexOf("text: 'Choose a profile'") === -1, 'no profile selector remains');
  assert.ok(app.indexOf("'Continue as ' + u.firstName") === -1, 'no per-person continue label remains');
  assert.ok(app.indexOf('Synthetic data only. No external actions occur.') !== -1);
});

test('login uses the approved corporate lockup exactly once', () => {
  assert.ok(app.indexOf('sv-lockup-fc-dark.png') !== -1, 'corporate lockup asset');
  assert.strictEqual(count(app, 'login__lockup'), 1, 'exactly one full lockup on login');
});

test('the compact mark (not the corporate lockup) is used in the shell', () => {
  assert.ok(app.indexOf('sv-circle-fullcolor.png') !== -1, 'compact mark asset');
  assert.ok(app.indexOf('SHOREVEST ONE') !== -1, 'SHOREVEST ONE lockup text');
});

test('the entry button is immediately actionable (no profile selection required)', () => {
  assert.ok(app.indexOf("class: 'login__submit', type: 'button' }") !== -1,
    'submit rendered without an initial disabled state');
});

test('login does not contain rejected copy', () => {
  ['Select access role', 'Choose access level', 'Sign in as role',
   'Authorised access only', 'Preview — sign-in simulated', 'Authenticate',
   'Execution Approver'].forEach((bad) => {
    assert.ok(app.indexOf(bad) === -1, 'login contains rejected copy: ' + bad);
  });
});

test('login/shell expose no version, run, or environment identifiers', () => {
  ['RULES_VERSION', 'TEMPLATE_VERSION', 'R-2026', 'T-2026', 'runId', 'batchId ='].forEach((bad) => {
    assert.ok(app.indexOf(bad) === -1, 'shell references identifier: ' + bad);
  });
});

/* ── Top bar & profile ──────────────────────────────────────────────────── */

test('top bar shows Search/Ask, Add and Help — and no notification bell', () => {
  assert.ok(app.indexOf('Search or ask ShoreVest One') !== -1);
  assert.ok(app.indexOf('Add to ShoreVest One') !== -1);
  assert.ok(app.indexOf('Help / Report issue') !== -1);
  assert.ok(!/bell/i.test(app), 'no notification bell');
  assert.ok(app.indexOf('Quick Actions') === -1, 'no Quick Actions');
});

test('Sign out lives inside the profile menu only (no permanent button)', () => {
  assert.ok(app.indexOf('ops-menu__item--signout') !== -1, 'sign out is a menu item');
  assert.strictEqual(count(app, "text: 'Sign out'"), 1, 'Sign out rendered once, inside the menu');
  ['Profile', 'Preferences', 'Help', 'Sign out'].forEach((mi) =>
    assert.ok(app.indexOf(mi) !== -1, 'profile menu item present: ' + mi));
});

test('the profile control sits at the sidebar foot', () => {
  assert.ok(/ops-sidebar__foot'[^]*ops-profile/.test(app) || app.indexOf("class: 'ops-profile'") !== -1);
});

/* ── Demonstration notice ───────────────────────────────────────────────── */

test('exactly one restrained demonstration notice is used', () => {
  assert.ok(app.indexOf('Demonstration — Synthetic data only. No external actions occur.') !== -1);
  ['Sign-in simulated', 'Demonstration environment', 'Preview —'].forEach((bad) =>
    assert.ok(app.indexOf(bad) === -1, 'overlapping label present: ' + bad));
});

/* ── Typography / no external font ──────────────────────────────────────── */

test('the portal requests no external font provider', () => {
  ['fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit', 'fonts.adobe.com'].forEach((bad) => {
    assert.ok(portalIndex.indexOf(bad) === -1, 'portal index requests external font: ' + bad);
    assert.ok(css.indexOf(bad) === -1, 'portal css requests external font: ' + bad);
  });
  assert.ok(css.indexOf('@import') === -1, 'portal css has no @import');
});

test('DIN 2014 is loaded from local faces via @font-face', () => {
  assert.ok(css.indexOf('@font-face') !== -1, '@font-face present');
  assert.ok(css.indexOf('"DIN 2014"') !== -1, 'DIN 2014 family');
  assert.ok(css.indexOf('local("DIN 2014') !== -1, 'local() source');
});

/* ── Portal entry document — preview-only noindex ───────────────────────── */

test('the portal preview page carries the full noindex directive', () => {
  const m = portalIndex.match(/name="robots"\s+content="([^"]+)"/);
  assert.ok(m, 'robots meta present');
  ['noindex', 'nofollow', 'noarchive', 'nosnippet'].forEach((d) =>
    assert.ok(m[1].indexOf(d) !== -1, 'missing robots directive: ' + d));
});

/* ── Public visibility hidden (reversible source config) ────────────────── */

test('public visibility is governed by one reversible source flag', () => {
  assert.ok(siteConfig.indexOf('showShoreVestOnePublicLink: false') !== -1, 'flag defaults to false');
  assert.ok(sharedFooter.indexOf('showShoreVestOnePublicLink') !== -1, 'footer honours the flag');
  assert.ok(sharedFooter.indexOf('${shoreVestOneLinkEn}') !== -1, 'footer link is gated');
});

test('robots.txt disallows the portal path without affecting the public site', () => {
  const robots = read('robots.txt');
  assert.ok(/Disallow:\s*\/employee-portal\//.test(robots), 'portal path disallowed');
  assert.ok(/Allow:\s*\//.test(robots), 'public site allowed');
});

test('no public HTML page links to ShoreVest One, and the main site is not noindexed', () => {
  const publicPages = ['home.html', 'firm.html', 'team.html', 'strategy.html',
    'insights.html', 'media.html', 'contact.html', 'important-information.html',
    'investor-portal/index.html'];
  publicPages.forEach((p) => {
    const html = read(p);
    assert.ok(html.indexOf('employee-portal/index.html') === -1, p + ' still links the portal');
    assert.ok(html.indexOf('ShoreVest One') === -1, p + ' still names ShoreVest One');
    assert.ok(!/name="robots"\s+content="[^"]*noindex/.test(html), p + ' must not be noindexed');
  });
});

test('the public footer Access group survives with Investor Portal intact', () => {
  const html = read('home.html');
  assert.ok(html.indexOf('sv-footer__access') !== -1, 'access group present');
  assert.ok(html.indexOf('Investor Portal') !== -1, 'Investor Portal preserved');
  /* No dangling group: the access group should still contain a link. */
  const m = html.match(/sv-footer__access[^]*?<\/span>\s*<\/nav>/);
  assert.ok(m && m[0].indexOf('Investor Portal') !== -1, 'access group not empty');
});

test('the direct preview route file still exists', () => {
  assert.ok(fs.existsSync(path.join(root, 'employee-portal/index.html')), 'portal entry preserved');
});

/* ── Report ─────────────────────────────────────────────────────────────── */

if (failures.length) {
  console.error('\n✗ ' + failures.length + ' Phase 2B test(s) failed:\n');
  failures.forEach((f) => { console.error('  ✗ ' + f.name + '\n    ' + f.error.message); });
  process.exit(1);
} else {
  console.log('✓ All ' + passed + ' ShoreVest One Phase 2B source tests passed.');
}
