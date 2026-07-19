/* ==========================================================================
   ShoreVest One — profile (persona) configuration test suite
   Run: node tests/employee-portal-personas.test.js

   The demonstration now runs on ONE neutral profile ("ShoreVest Demo") with the
   full workspace: every section and every tool on the left. This suite covers
   that single profile, its unified navigation, and the combined "motherboard"
   Home that composes the crafted commercial decisions (Red Panda two-attendee,
   Kelvin mainland attendance) and coordination cards. It also keeps the content
   guarantees: animal-based external data, prohibited-name absence, no false-
   green language, no invented internal employees, and no capability-role leak.
   Pure data assertions — no DOM or live tenant required.
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

test('no rejected identity strings are used', () => {
  const blob = JSON.stringify(P.list);
  ['Ex-Asia', 'APAC', 'Execution Approver',
   'Director of Client Solutions — Asia', 'Director of Client Solutions — Americas'].forEach((bad) => {
    assert.ok(blob.indexOf(bad) === -1, 'rejected identity present: ' + bad);
  });
});

/* ── Unified navigation (every section and tool) ────────────────────────── */

const FULL_NAV = ['Home', 'My Work', 'Relationships', 'Outreach', 'Meetings',
  'Diligence & Requests', 'Investor Intelligence', 'Materials & Delivery',
  'Meeting Support', 'Firm', 'Tools'];

test('the demo profile exposes the full unified navigation', () => {
  assert.deepStrictEqual(navLabels(P.byId('demo')), FULL_NAV);
});

test('every commercial and coordination section is present on the left', () => {
  const labels = navLabels(P.byId('demo'));
  ['Relationships', 'Outreach', 'Meetings', 'Diligence & Requests',
   'Investor Intelligence', 'Materials & Delivery', 'Meeting Support',
   'Firm', 'Tools'].forEach((l) => {
    assert.ok(labels.indexOf(l) !== -1, 'missing section: ' + l);
  });
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

/* ── Combined "motherboard" Home ────────────────────────────────────────── */

test('the demo profile uses the combined Home schema', () => {
  assert.strictEqual(P.byId('demo').homeSchema, 'combined');
});

test('the combined Home composes focus, needs-you, today, waiting and around', () => {
  const keys = Object.keys(P.byId('demo').home).sort();
  assert.deepStrictEqual(keys,
    ['around', 'focus', 'needsYou', 'situational', 'today', 'underControl', 'waiting']);
});

test('Focus Now is an ordered set of commercial decisions', () => {
  const focus = P.byId('demo').home.focus;
  assert.ok(Array.isArray(focus) && focus.length === 2, 'two focus decisions composed');
  focus.forEach((f, i) => {
    ['title', 'context', 'decision', 'whyYou', 'due', 'recommendation', 'reasoning',
     'evidenceLine', 'evidence', 'policy', 'primary', 'afterConfirm', 'owner'].forEach((k) => {
      assert.ok(f[k] != null && (typeof f[k] !== 'string' || f[k].length),
        'focus[' + i + '] missing ' + k);
    });
    assert.ok(Array.isArray(f.evidence) && f.evidence.length >= 3, 'focus[' + i + '] evidence');
    assert.ok(/review/i.test(f.primary), 'focus[' + i + '] primary is review-oriented');
  });
});

test('the Red Panda Capital two-attendee decision is preserved', () => {
  const f = P.byId('demo').home.focus.find((x) => x.institution.indexOf('Red Panda Capital') === 0);
  assert.ok(f, 'Red Panda focus present');
  assert.ok(/two ShoreVest attendees/i.test(f.policy), 'two-attendee policy explained');
});

test('the mainland-attendance decision is preserved with a placeholder attendee', () => {
  const f = P.byId('demo').home.focus.find((x) => /Koala/.test(x.institution));
  assert.ok(f, 'Koala focus present');
  assert.ok(/mainland/i.test(f.policy) && /Ben/.test(f.policy), 'mainland rule explained');
  assert.strictEqual(f.requiredAttendee, 'Eligible mainland-team attendee required');
});

test('no false-green language appears in any Focus Now decision', () => {
  const blob = JSON.stringify(P.byId('demo').home.focus);
  ['Safe to act', 'Fully verified', 'All clear', 'Everything is safe', 'Verified and approved']
    .forEach((bad) => assert.ok(blob.indexOf(bad) === -1, 'false-green: ' + bad));
});

test('coordination Needs You cards are preserved and namespaced', () => {
  const needsYou = P.byId('demo').home.needsYou;
  assert.ok(Array.isArray(needsYou) && needsYou.length >= 3, 'needs-you cards present');
  needsYou.forEach((c) => {
    assert.ok(c.id.indexOf('celestra-') === 0, 'coordination card not namespaced: ' + c.id);
    assert.ok(Array.isArray(c.actions) && c.actions.length, 'card ' + c.id + ' has actions');
  });
});

test('Today merges both regions without exceeding a short list', () => {
  const today = P.byId('demo').home.today;
  assert.ok(today.length >= 4 && today.length <= 6, 'today is a short merged list');
  const zones = today.map((t) => t.zone).filter(Boolean);
  assert.ok(zones.indexOf('ET') !== -1 && zones.indexOf('HKT') !== -1, 'both regions represented');
  /* No duplicated "Internal Investment update" row after the merge. */
  const internal = today.filter((t) => t.title.indexOf('Internal') === 0);
  assert.ok(internal.length <= 1, 'internal update row is not duplicated');
});

test('Under Control is a single reassurance line', () => {
  const uc = P.byId('demo').home.underControl;
  assert.strictEqual(typeof uc, 'string');
  assert.ok(uc.indexOf('Nothing is overdue') !== -1, 'reassurance line preserved');
});

test('Around ShoreVest stays quiet (at most two items)', () => {
  const around = P.byId('demo').home.around || [];
  assert.ok(around.length <= 2, 'around length');
});

/* ── My Work (combined) ─────────────────────────────────────────────────── */

test('the combined My Work has Needs me / Waiting / Later with full waiting detail', () => {
  const mw = P.byId('demo').myWork;
  assert.ok(mw, 'demo has myWork');
  assert.deepStrictEqual(Object.keys(mw).sort(), ['later', 'needsMe', 'waiting']);
  assert.ok(mw.needsMe.length >= 2 && mw.waiting.length >= 2, 'items from both regions merged');
  mw.waiting.forEach((w) => {
    ['who', 'when', 'followUp', 'accountable'].forEach((k) =>
      assert.ok(w[k], 'waiting item missing ' + k));
  });
});

/* ── External demo data ─────────────────────────────────────────────────── */

const APPROVED_ANIMALS = ['Red Panda Capital', 'Narwhal Pension Fund', 'Quokka Capital',
  'Puffin Asset Management', 'Otter Pension Trust', 'Koala Investment Board',
  'Walrus Holdings', 'Alpaca Foundation'];

test('Focus Now institutions use approved animal-based fictional names', () => {
  P.byId('demo').home.focus.forEach((f) => {
    const inst = f.institution.split(' (')[0];
    assert.ok(APPROVED_ANIMALS.indexOf(inst) !== -1, 'focus institution: ' + inst);
  });
});

test('Today institutions are approved animal names or internal items', () => {
  P.byId('demo').home.today.forEach((t) => {
    if (t.title.indexOf('Internal') === 0) return;
    assert.ok(APPROVED_ANIMALS.indexOf(t.title) !== -1, 'today institution: ' + t.title);
  });
});

test('prohibited external names are absent from the persona data', () => {
  const blob = JSON.stringify(P.list);
  ['AIIB', 'MetLife', 'Albourne', 'Eastspring', 'GreenRam', 'GreenVale',
   'NorthBridge', 'Meridian', 'Summit Endowment', 'Harbour Ridge', 'EastGate'].forEach((bad) => {
    assert.ok(blob.indexOf(bad) === -1, 'prohibited name present: ' + bad);
  });
});

test('no invented internal ShoreVest employee appears (only real names / placeholders)', () => {
  /* The only internal people named are Ben (Benjamin Fanger) and Yao Fu — both
     real ShoreVest employees. The mainland requirement uses a placeholder. */
  const blob = JSON.stringify(P.list);
  assert.ok(blob.indexOf('mainland-team attendee') !== -1, 'placeholder attendee present');
  ['Alice', 'Bob', 'Jane Doe', 'John Smith'].forEach((invented) => {
    assert.ok(blob.indexOf(invented) === -1, 'invented employee present: ' + invented);
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
