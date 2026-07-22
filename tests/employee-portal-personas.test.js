/* ==========================================================================
   ShoreVest One — profile (persona) configuration test suite
   Run: node tests/employee-portal-personas.test.js

   The demonstration runs on ONE neutral profile ("ShoreVest Demo") — the
   "motherboard" — with the full workspace: every section and every tool on the
   left. Home and My Work are two views of ONE shared queue (workItems): Home is
   a short, selective company-wide summary of where attention is needed, and
   every Home line links back to an item My Work carries in full.

   These are pure data assertions — no DOM or live tenant required. They also
   enforce the data rule: every synthetic person uses a dull generic placeholder
   name and no real ShoreVest employee name, investor name, or email appears.
   ========================================================================== */
'use strict';

const assert = require('assert');
const R = require('../assets/js/employee-portal/rules.js');
const P = require('../assets/js/employee-portal/personas.js');

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push({ name, error: e }); }
}

const navLabels = (persona) => persona.nav.filter((n) => !n.sep && !n.divider).map((n) => n.label);

/* ── Single demonstration profile ───────────────────────────────────────── */

test('exactly one demonstration profile is offered', () => {
  assert.strictEqual(P.list.length, 1);
  assert.strictEqual(P.list[0].id, 'demo');
  assert.strictEqual(P.list[0].name, 'ShoreVest Demo');
});

test('the demo profile is a neutral full-access identity, not a real person', () => {
  const d = P.byId('demo');
  assert.strictEqual(d.title, 'Demonstration profile');
  assert.strictEqual(d.coverage, 'Full access');
  assert.strictEqual(d.displayRole, 'Full demonstration access');
  assert.strictEqual(d.photo, null);
  assert.strictEqual(d.initials, 'SV');
});

test('the capability role never leaks into any user-facing identity string', () => {
  const d = P.byId('demo');
  [d.name, d.title, d.coverage, d.displayRole].forEach((s) => {
    assert.ok(String(s).indexOf(P.TOOLS_ROLE) === -1, 'role leaked into: ' + s);
    assert.ok(String(s).indexOf('Administrator') === -1, 'Administrator leaked into: ' + s);
  });
});

/* ── Unified navigation (every section and tool) ────────────────────────── */

const FULL_NAV = ['Home', 'My Work', 'Relationships', 'Outreach', 'Meetings',
  'Diligence & Requests', 'Investor Intelligence', 'Materials & Delivery',
  'Meeting Support', 'Firm', 'Tools'];

test('the demo profile exposes the full unified navigation', () => {
  assert.deepStrictEqual(navLabels(P.byId('demo')), FULL_NAV);
});

test('a Workspaces group heading and a divider separate the structure', () => {
  const nav = P.byId('demo').nav;
  assert.ok(nav.some((n) => n.sep === 'Workspaces'), 'Workspaces separator present');
  assert.ok(nav.some((n) => n.divider), 'divider present before Firm/Tools');
});

test('Tools is the last item and is marked collapsible/secondary', () => {
  const nav = P.byId('demo').nav.filter((n) => !n.sep && !n.divider);
  const last = nav[nav.length - 1];
  assert.strictEqual(last.key, 'tools');
  assert.strictEqual(last.collapsible, true);
});

test('My Work points at the real My Work view (not a preview placeholder)', () => {
  const item = P.byId('demo').nav.filter((n) => n.key === 'my-work')[0];
  assert.ok(item && item.hash === '#/my-work', 'My Work should route to #/my-work');
});

test('the demo profile uses the motherboard Home schema', () => {
  assert.strictEqual(P.byId('demo').homeSchema, 'motherboard');
});

/* ── Shared work-item store ─────────────────────────────────────────────── */

const BUCKETS = ['do-now', 'waiting', 'suggestion', 'on-hold', 'done'];
const HOME_SECTIONS = ['decide', 'do', 'waiting', 'warnings', 'recent'];

test('a single shared work-item store backs both surfaces', () => {
  assert.ok(Array.isArray(P.workItems) && P.workItems.length >= 8, 'workItems store present');
  assert.ok(Array.isArray(P.myWorkBuckets) && P.myWorkBuckets.length === 5, 'five My Work buckets');
  assert.ok(Array.isArray(P.homeSections) && P.homeSections.length >= 3, 'Home sections defined');
  assert.ok(Array.isArray(P.startHere) && P.startHere.length >= 2, 'Start here shortcuts');
});

test('every work item has one action, owner, reason, status, next step and a link', () => {
  const ids = {};
  P.workItems.forEach((it) => {
    ['id', 'bucket', 'action', 'workspace', 'owner', 'reason', 'status', 'nextStep', 'link'].forEach((k) => {
      assert.ok(it[k] && String(it[k]).length, 'item ' + it.id + ' missing ' + k);
    });
    assert.ok(BUCKETS.indexOf(it.bucket) !== -1, 'item ' + it.id + ' bad bucket ' + it.bucket);
    assert.ok(!ids[it.id], 'duplicate item id ' + it.id);
    ids[it.id] = true;
    if (it.home) assert.ok(HOME_SECTIONS.indexOf(it.home.section) !== -1, 'item ' + it.id + ' bad home section');
  });
});

test('My Work is the full queue: every bucket has items and each is reachable', () => {
  BUCKETS.forEach((b) => {
    assert.ok(P.bucketItems(b).length >= 1, 'bucket ' + b + ' has at least one item');
  });
});

/* ── Home is selective, and shares My Work's underlying items ────────────── */

test('Home is short and selective (a handful of attention lines, not the queue)', () => {
  const attention = ['decide', 'do', 'waiting', 'warnings']
    .reduce((n, s) => n + P.homeItems(s).length, 0);
  assert.ok(attention >= 3 && attention <= 8, 'Home shows a selective set: ' + attention);
  assert.ok(attention < P.workItems.length, 'Home shows fewer items than the full queue');
});

test('every Home line is one of the shared work items (no duplicate records)', () => {
  HOME_SECTIONS.forEach((s) => {
    P.homeItems(s).forEach((it) => {
      assert.strictEqual(P.itemById(it.id), it, 'Home item ' + it.id + ' is a shared work item');
      assert.ok(it.home && it.home.summary, 'Home item ' + it.id + ' has a summary line');
      assert.ok(it.link, 'Home item ' + it.id + ' links back to its record');
    });
  });
});

test('Home surfaces at least one Decide, one Warning and Recent work', () => {
  assert.ok(P.homeItems('decide').length >= 1, 'a decision is surfaced');
  assert.ok(P.homeItems('warnings').length >= 1, 'a warning is surfaced');
  assert.ok(P.homeItems('recent').length >= 1, 'recent work is surfaced');
});

/* ── Preserved decisions (as detailed Do-now items) ─────────────────────── */

test('the Red Panda Capital two-attendee decision is preserved with detail', () => {
  const f = P.itemById('redpanda-meeting');
  assert.ok(f && f.bucket === 'do-now', 'Red Panda decision is a Do-now item');
  assert.ok(f.detail && /two ShoreVest attendees/i.test(f.detail.policy), 'two-attendee policy explained');
  assert.ok(Array.isArray(f.detail.evidence) && f.detail.evidence.length >= 3, 'evidence present');
});

test('the mainland-attendance decision is preserved with detail', () => {
  const f = P.itemById('koala-mainland');
  assert.ok(f && f.detail && /mainland/i.test(f.detail.policy), 'mainland rule explained');
});

test('no false-green language appears in any decision detail', () => {
  const blob = JSON.stringify(P.workItems);
  ['Safe to act', 'Fully verified', 'All clear', 'Everything is safe', 'Verified and approved']
    .forEach((bad) => assert.ok(blob.indexOf(bad) === -1, 'false-green: ' + bad));
});

/* ── Data rule: generic placeholder names, no real people or emails ─────── */

const APPROVED_OWNERS = ['Jane Brown', 'Mark Davis', 'Susan Clark', 'Linda Moore',
  'Bob Smith', 'Paul Wilson', 'Tom Harris', 'Karen Allen'];

test('every owner is a dull generic placeholder; waiting-on is a placeholder or a generic team', () => {
  const TEAMS = ['Investment team', 'Legal team', 'Finance team', 'Compliance team'];
  P.workItems.forEach((it) => {
    assert.ok(APPROVED_OWNERS.indexOf(it.owner) !== -1, 'non-placeholder owner: ' + it.owner);
    if (it.waitingOn) {
      assert.ok(APPROVED_OWNERS.indexOf(it.waitingOn) !== -1 || TEAMS.indexOf(it.waitingOn) !== -1,
        'non-placeholder / non-team waitingOn: ' + it.waitingOn);
    }
  });
});

test('no real ShoreVest employee names appear anywhere in persona data', () => {
  const blob = JSON.stringify([P.list, P.workItems, P.startHere, P.homeSections, P.myWorkBuckets]);
  ['John Jones', 'Kelvin Chan', 'Nico Jacques', 'Benjamin Fanger', 'Celestra',
   'Yao Fu', ' John', 'Kelvin', ' Ben ', 'Fanger', 'Jacques'].forEach((bad) => {
    assert.ok(blob.indexOf(bad) === -1, 'real / prior name present: ' + bad);
  });
});

test('no real email addresses appear in persona data', () => {
  const blob = JSON.stringify([P.workItems, P.startHere]);
  assert.ok(blob.indexOf('@shorevest.com') === -1, 'a @shorevest.com address is present');
  assert.ok(!/@[a-z]+\.(com|org|net)\b/i.test(blob), 'a real-looking email domain is present');
});

test('institutions are fictional (no prohibited real-sounding names)', () => {
  const blob = JSON.stringify(P.workItems);
  ['AIIB', 'MetLife', 'Albourne', 'Eastspring', 'GreenRam', 'GreenVale',
   'NorthBridge', 'Meridian', 'Summit Endowment', 'Harbour Ridge', 'EastGate'].forEach((bad) => {
    assert.ok(blob.indexOf(bad) === -1, 'prohibited institution present: ' + bad);
  });
});

/* ── Legacy Tools access + destinations ─────────────────────────────────── */

test('the demo profile keeps a capability role that can reach every legacy tool', () => {
  const p = P.byId('demo');
  assert.strictEqual(p.role, P.TOOLS_ROLE);
  ['submitFiles', 'reviewExceptions', 'administer', 'viewMonitoring', 'viewAllBatches']
    .forEach((cap) => assert.ok(R.can(p.role, cap), 'demo should have ' + cap));
});

test('a workspace destination exists for every workspace route', () => {
  ['relationships', 'outreach', 'meetings', 'diligence', 'investor-intelligence', 'firm']
    .forEach((key) => {
      const info = P.workspace(key);
      assert.ok(info && info.title && info.lede, 'missing workspace ' + key);
    });
});

test('a preview destination exists for every preview route in the nav', () => {
  ['materials', 'meeting-support'].forEach((key) => {
    const info = P.preview(key);
    assert.ok(info && info.title && info.lede, 'missing preview ' + key);
  });
});

/* ── Report ─────────────────────────────────────────────────────────────── */

if (failures.length) {
  console.error('\n✗ ' + failures.length + ' persona test(s) failed:\n');
  failures.forEach((f) => { console.error('  ✗ ' + f.name + '\n    ' + f.error.message); });
  process.exit(1);
} else {
  console.log('✓ All ' + passed + ' ShoreVest One persona tests passed.');
}
