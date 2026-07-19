/* ==========================================================================
   ShoreVest One — role (persona) configuration test suite
   Run: node tests/employee-portal-personas.test.js

   Covers exact identities, the frozen John/Kelvin navigation, the commercial
   Home schema (one Focus Now), My Work, Celestra's preserved coordination Home,
   animal-based external data, prohibited-name absence, and no role leakage.
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

/* ── Exact identities ───────────────────────────────────────────────────── */

test('exactly three demonstration people are offered', () => {
  assert.strictEqual(P.list.length, 3);
  assert.deepStrictEqual(P.list.map((p) => p.name).sort(),
    ['Celestra Gallagher', 'John Jones', 'Kelvin Chan']);
});

test('John has the exact approved title and coverage', () => {
  const j = P.byId('john');
  assert.strictEqual(j.title, 'Director of Client Solutions');
  assert.strictEqual(j.coverage, 'Americas, Europe & Middle East');
  assert.strictEqual(j.displayRole, 'Director of Client Solutions (Americas, Europe & Middle East)');
});

test('Kelvin has the exact approved title and coverage', () => {
  const k = P.byId('kelvin');
  assert.strictEqual(k.title, 'Director of Client Solutions');
  assert.strictEqual(k.coverage, 'Asia-Pacific');
  assert.strictEqual(k.displayRole, 'Director of Client Solutions (Asia-Pacific)');
});

test('Celestra has the exact approved title', () => {
  const c = P.byId('celestra');
  assert.strictEqual(c.title, 'Investor Relations Associate');
  assert.strictEqual(c.displayRole, 'Investor Relations Associate');
});

test('no rejected identity strings are used', () => {
  const blob = JSON.stringify(P.list);
  ['Ex-Asia', 'APAC', 'Execution Approver',
   'Director of Client Solutions — Asia', 'Director of Client Solutions — Americas',
   'Director of Client Solutions — Ex-Asia'].forEach((bad) => {
    assert.ok(blob.indexOf(bad) === -1, 'rejected identity present: ' + bad);
  });
});

test('coverage descriptions always display with parentheses (via displayRole)', () => {
  ['john', 'kelvin'].forEach((id) => {
    const p = P.byId(id);
    assert.ok(/\(.+\)$/.test(p.displayRole), p.name + ' displayRole should carry parentheses');
  });
});

test('only real employee photos are used; Celestra has an initials avatar', () => {
  assert.strictEqual(P.byId('john').photo, '../assets/img/team/john-jones.jpg');
  assert.strictEqual(P.byId('kelvin').photo, '../assets/img/team/kelvin-chan.jpg');
  assert.strictEqual(P.byId('celestra').photo, null);
  assert.strictEqual(P.byId('celestra').initials, 'CG');
});

/* ── Frozen John & Kelvin navigation ────────────────────────────────────── */

const FROZEN_NAV = ['Home', 'My Work', 'Relationships', 'Outreach', 'Meetings',
  'Diligence & Requests', 'Investor Intelligence', 'Firm', 'Tools'];

test('John and Kelvin use the exact frozen navigation', () => {
  assert.deepStrictEqual(navLabels(P.byId('john')), FROZEN_NAV);
  assert.deepStrictEqual(navLabels(P.byId('kelvin')), FROZEN_NAV);
});

test('Weekly Review (and other excluded items) are absent from John/Kelvin nav', () => {
  ['Weekly Review', 'Investor Inbox', 'Tasks', 'Calendar', 'Reports', 'Pipeline',
   'Materials & Delivery', 'Meeting Support', 'Library', 'Approvals', 'Notifications',
   'Settings', 'Administration', 'Monitoring', 'All Workspaces', 'Knowledge',
   'Recent Activity'].forEach((excluded) => {
    ['john', 'kelvin'].forEach((id) => {
      assert.ok(navLabels(P.byId(id)).indexOf(excluded) === -1, id + ' should not have ' + excluded);
    });
  });
});

test('My Work, Diligence & Requests, Investor Intelligence, Firm and Tools are present', () => {
  ['john', 'kelvin'].forEach((id) => {
    const labels = navLabels(P.byId(id));
    ['My Work', 'Diligence & Requests', 'Investor Intelligence', 'Firm', 'Tools'].forEach((l) => {
      assert.ok(labels.indexOf(l) !== -1, id + ' missing ' + l);
    });
  });
});

test('a Workspaces group heading and a divider separate the structure', () => {
  const nav = P.byId('john').nav;
  assert.ok(nav.some((n) => n.sep === 'Workspaces'), 'Workspaces separator present');
  assert.ok(nav.some((n) => n.divider), 'divider present before Firm/Tools');
});

test('Tools is the last item and is marked collapsible/secondary', () => {
  ['john', 'kelvin'].forEach((id) => {
    const nav = P.byId(id).nav.filter((n) => !n.sep && !n.divider);
    const last = nav[nav.length - 1];
    assert.strictEqual(last.key, 'tools');
    assert.strictEqual(last.collapsible, true);
  });
});

/* ── Home schema (commercial: John & Kelvin) ────────────────────────────── */

test('John and Kelvin use the commercial Home schema', () => {
  ['john', 'kelvin'].forEach((id) => assert.strictEqual(P.byId(id).homeSchema, 'commercial'));
});

test('Home contains exactly one Focus Now item (not a three-card grid)', () => {
  ['john', 'kelvin'].forEach((id) => {
    const home = P.byId(id).home;
    assert.ok(home.focus && typeof home.focus === 'object' && !Array.isArray(home.focus),
      id + ' focus should be a single object');
    assert.ok(!('needsYou' in home), id + ' must not carry a needs-you card array');
  });
});

test('Home has Focus, Today, Under Control and optional Around — nothing else', () => {
  ['john', 'kelvin'].forEach((id) => {
    const keys = Object.keys(P.byId(id).home).sort();
    assert.deepStrictEqual(keys, ['around', 'focus', 'situational', 'today', 'underControl']);
  });
});

test('Under Control is a single reassurance line by default', () => {
  ['john', 'kelvin'].forEach((id) => {
    const uc = P.byId(id).home.underControl;
    assert.strictEqual(typeof uc, 'string');
    assert.ok(uc.indexOf('Nothing is overdue') !== -1, id + ' reassurance line');
  });
});

test('Today shows at most three items and never repeats the Focus Now institution', () => {
  ['john', 'kelvin'].forEach((id) => {
    const home = P.byId(id).home;
    assert.ok(home.today.length <= 3, id + ' today length');
    const focusInstitution = home.focus.institution.split(' (')[0];
    home.today.forEach((t) => {
      assert.ok(t.title.indexOf(focusInstitution) === -1,
        id + ' Today must not repeat Focus Now: ' + t.title);
    });
  });
});

test('Around ShoreVest is optional and quiet (at most two items)', () => {
  ['john', 'kelvin'].forEach((id) => {
    const around = P.byId(id).home.around || [];
    assert.ok(around.length <= 2, id + ' around length');
  });
});

test('Focus Now carries the full ten-second-standard content', () => {
  ['john', 'kelvin'].forEach((id) => {
    const f = P.byId(id).home.focus;
    ['title', 'context', 'decision', 'whyYou', 'due', 'recommendation', 'reasoning',
     'evidenceLine', 'evidence', 'policy', 'primary', 'afterConfirm', 'owner'].forEach((k) => {
      assert.ok(f[k] != null && (typeof f[k] !== 'string' || f[k].length), id + ' focus missing ' + k);
    });
    assert.ok(Array.isArray(f.evidence) && f.evidence.length >= 3, id + ' evidence summary');
    assert.ok(/review/i.test(f.primary), id + ' primary action is review-oriented');
  });
});

test('the John example is Red Panda Capital with the two-attendee policy', () => {
  const f = P.byId('john').home.focus;
  assert.ok(f.institution.indexOf('Red Panda Capital') === 0);
  assert.ok(/two ShoreVest attendees/i.test(f.policy));
});

test('the Kelvin example demonstrates the mainland attendance rule with a placeholder attendee', () => {
  const f = P.byId('kelvin').home.focus;
  assert.ok(/mainland/i.test(f.policy) && /Ben/.test(f.policy), 'mainland rule explained');
  assert.strictEqual(f.requiredAttendee, 'Eligible mainland-team attendee required');
});

test('no false-green language appears in Focus Now', () => {
  ['john', 'kelvin'].forEach((id) => {
    const blob = JSON.stringify(P.byId(id).home.focus);
    ['Safe to act', 'Fully verified', 'All clear', 'Everything is safe', 'Verified and approved']
      .forEach((bad) => assert.ok(blob.indexOf(bad) === -1, id + ' false-green: ' + bad));
  });
});

/* ── My Work ────────────────────────────────────────────────────────────── */

test('John and Kelvin have a My Work shell with Needs me / Waiting / Later', () => {
  ['john', 'kelvin'].forEach((id) => {
    const mw = P.byId(id).myWork;
    assert.ok(mw, id + ' has myWork');
    assert.deepStrictEqual(Object.keys(mw).sort(), ['later', 'needsMe', 'waiting']);
    mw.waiting.forEach((w) => {
      ['who', 'when', 'followUp', 'accountable'].forEach((k) =>
        assert.ok(w[k], id + ' waiting item missing ' + k));
    });
  });
});

/* ── Celestra preserved ─────────────────────────────────────────────────── */

test('Celestra keeps a distinct coordination Home schema', () => {
  const c = P.byId('celestra');
  assert.strictEqual(c.homeSchema, 'coordination');
  assert.deepStrictEqual(Object.keys(c.home).sort(), ['needsYou', 'today', 'waiting']);
});

test('Celestra keeps her coordination navigation', () => {
  assert.deepStrictEqual(navLabels(P.byId('celestra')),
    ['Home', 'My Work', 'Materials & Delivery', 'Diligence & Requests', 'Meeting Support', 'Tools']);
});

test('Celestra is not forced into the commercial Home structure', () => {
  assert.ok(!('focus' in P.byId('celestra').home), 'Celestra should not have a Focus Now');
});

/* ── External demo data ─────────────────────────────────────────────────── */

const APPROVED_ANIMALS = ['Red Panda Capital', 'Narwhal Pension Fund', 'Quokka Capital',
  'Puffin Asset Management', 'Otter Pension Trust', 'Koala Investment Board',
  'Walrus Holdings', 'Alpaca Foundation'];

test('external institutions use approved animal-based fictional names', () => {
  ['john', 'kelvin'].forEach((id) => {
    const p = P.byId(id);
    const focusInst = p.home.focus.institution.split(' (')[0];
    assert.ok(APPROVED_ANIMALS.indexOf(focusInst) !== -1, id + ' focus institution: ' + focusInst);
    p.home.today.forEach((t) => {
      if (t.title.indexOf('Internal') === 0) return;
      assert.ok(APPROVED_ANIMALS.indexOf(t.title) !== -1, id + ' today institution: ' + t.title);
    });
  });
});

test('prohibited external names are absent from John/Kelvin persona data', () => {
  const blob = JSON.stringify([P.byId('john'), P.byId('kelvin')]);
  ['AIIB', 'MetLife', 'Albourne', 'Eastspring', 'GreenRam', 'GreenVale',
   'NorthBridge', 'Meridian', 'Summit Endowment', 'Harbour Ridge', 'EastGate'].forEach((bad) => {
    assert.ok(blob.indexOf(bad) === -1, 'prohibited name present: ' + bad);
  });
});

test('no invented internal ShoreVest employee appears (only real names / placeholders)', () => {
  /* The only internal people named in John/Kelvin data are Ben (Benjamin Fanger)
     and Yao Fu — both real ShoreVest employees. The mainland requirement uses a
     placeholder, never an invented named employee. */
  const blob = JSON.stringify([P.byId('john'), P.byId('kelvin')]);
  assert.ok(blob.indexOf('mainland-team attendee') !== -1, 'placeholder attendee present');
  ['Alice', 'Bob', 'Jane Doe', 'John Smith'].forEach((invented) => {
    assert.ok(blob.indexOf(invented) === -1, 'invented employee present: ' + invented);
  });
});

/* ── Legacy Tools access + no role leakage ──────────────────────────────── */

test('every persona keeps a capability role that can reach the legacy Tools', () => {
  P.list.forEach((p) => {
    assert.strictEqual(p.role, P.TOOLS_ROLE);
    ['submitFiles', 'reviewExceptions', 'administer', 'viewMonitoring', 'viewAllBatches']
      .forEach((cap) => assert.ok(R.can(p.role, cap), p.name + ' should have ' + cap));
  });
});

test('no synthetic content leaks between John, Kelvin and Celestra', () => {
  const jFocus = JSON.stringify(P.byId('john').home.focus);
  const kFocus = JSON.stringify(P.byId('kelvin').home.focus);
  assert.notStrictEqual(jFocus, kFocus);
  assert.ok(jFocus.indexOf('Koala') === -1, 'John should not carry Kelvin content');
  assert.ok(kFocus.indexOf('Red Panda') === -1, 'Kelvin should not carry John content');
  /* Celestra card ids are namespaced to her. */
  P.byId('celestra').home.needsYou.forEach((c) =>
    assert.ok(c.id.indexOf('celestra-') === 0, 'Celestra card not namespaced: ' + c.id));
});

test('workspace previews exist for every John/Kelvin workspace route', () => {
  ['relationships', 'meetings', 'diligence', 'investor-intelligence', 'firm']
    .forEach((key) => {
      const info = P.workspace(key);
      assert.ok(info && info.title && info.lede, 'missing workspace ' + key);
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
