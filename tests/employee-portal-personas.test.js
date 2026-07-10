/* ==========================================================================
   ShoreVest One — role (persona) configuration test suite
   Run: node tests/employee-portal-personas.test.js
   Covers role selection, navigation by role, Home data by role, legacy Tools
   access, and no role leakage between John, Kelvin, and Celestra. Pure data
   assertions — no DOM or live tenant required.
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

const navLabels = (persona) => persona.nav.filter((n) => !n.sep).map((n) => n.label);
const cardIds = (persona) => persona.home.needsYou.map((c) => c.id);

/* ── Role selection ─────────────────────────────────────────────────────── */

test('at least four canonical demonstration people are offered', () => {
  assert.ok(P.list.length >= 4);
  assert.deepStrictEqual(P.list.map((p) => p.name).sort(),
    ['Celestra Gallagher', 'John Jones', 'Kelvin Chan', 'Nico Jacques']);
});

test('the generic Execution Approver identity is gone', () => {
  const roles = P.list.map((p) => p.displayRole).concat(P.list.map((p) => p.name));
  roles.forEach((r) => assert.ok(!/execution approver/i.test(r), 'unexpected: ' + r));
});

test('each person has the expected display role', () => {
  assert.strictEqual(P.byId('john').displayRole, 'Director of Client Solutions, Ex-Asia');
  assert.strictEqual(P.byId('kelvin').displayRole, 'Director of Client Solutions, Asia');
  assert.strictEqual(P.byId('celestra').displayRole, 'Investor Relations Associate / IR Operations');
  assert.strictEqual(P.byId('nico').displayRole, 'Outreach Owner / Outreach Operator');
});

test('byId returns null for an unknown persona', () => {
  assert.strictEqual(P.byId('nobody'), null);
});

/* ── Navigation by role ─────────────────────────────────────────────────── */

test('all personas share the canonical navigation structure', () => {
  const canonical = ['Home', 'My Work', 'Relationships', 'Outreach', 'Meetings', 'Diligence & Requests', 'Investor Intelligence', 'Reporting', 'Approvals', 'Firm', 'Tools'];
  P.list.forEach((p) => assert.deepStrictEqual(navLabels(p), canonical));
});

test('Outreach parent has the three canonical submenu entries', () => {
  P.list.forEach((p) => {
    const outreach = p.nav.find((n) => n.key === 'outreach');
    assert.deepStrictEqual(outreach.children.map((n) => n.label), ['Find or add people', 'Draft messages', 'Sent & responses']);
  });
});

test('every persona ends on Tools and begins on Home', () => {
  P.list.forEach((p) => {
    const labels = navLabels(p);
    assert.strictEqual(labels[0], 'Home');
    assert.strictEqual(labels[labels.length - 1], 'Tools');
  });
});

test('Tools is top-level and not hidden under Workspace', () => {
  P.list.forEach((p) => {
    assert.ok(p.nav.every((n) => !n.sep), p.name + ' should not have Workspace separators');
    assert.ok(navLabels(p).includes('Investor Intelligence'));
    assert.ok(navLabels(p).includes('Reporting'));
    assert.ok(navLabels(p).includes('Approvals'));
  });
});

/* ── Legacy Tools access ────────────────────────────────────────────────── */

test('every persona keeps a capability role that can reach the legacy Tools', () => {
  P.list.forEach((p) => {
    assert.strictEqual(p.role, P.TOOLS_ROLE);
    ['submitFiles', 'reviewExceptions', 'administer', 'viewMonitoring', 'viewAllBatches']
      .forEach((cap) => assert.ok(R.can(p.role, cap), p.name + ' should have ' + cap));
  });
});

/* ── Home data by role ──────────────────────────────────────────────────── */

test('every Home has exactly the three permitted sections and nothing else', () => {
  P.list.forEach((p) => {
    assert.deepStrictEqual(Object.keys(p.home).sort(), ['needsYou', 'today', 'waiting']);
  });
});

test('Today and Waiting elsewhere never exceed three items', () => {
  P.list.forEach((p) => {
    assert.ok(p.home.today.length <= 3, p.name + ' today');
    assert.ok(p.home.waiting.length <= 3, p.name + ' waiting');
  });
});

test('each card asks one question with at most three actions and a primary', () => {
  P.list.forEach((p) => {
    p.home.needsYou.forEach((card) => {
      assert.ok(card.title && card.recommendation, card.id + ' needs a title and recommendation');
      assert.ok(card.actions.length >= 1 && card.actions.length <= 3, card.id + ' action count');
      assert.strictEqual(card.actions[0].intent, 'primary', card.id + ' first action is primary');
      assert.ok(card.detail, card.id + ' has a "why am I seeing this" detail');
    });
  });
});

test('John and Kelvin receive different synthetic content', () => {
  assert.notDeepStrictEqual(cardIds(P.byId('john')), cardIds(P.byId('kelvin')));
  assert.notDeepStrictEqual(
    P.byId('john').home.today.map((t) => t.title),
    P.byId('kelvin').home.today.map((t) => t.title));
});

test('“challenge” is never used as a control label', () => {
  P.list.forEach((p) => {
    p.home.needsYou.forEach((card) => {
      card.actions.forEach((a) => assert.ok(!/challenge/i.test(a.label), card.id + ': ' + a.label));
    });
  });
});

/* ── No role leakage ────────────────────────────────────────────────────── */

test('no Needs-you card is shared between two different people', () => {
  const seen = {};
  P.list.forEach((p) => p.home.needsYou.forEach((c) => {
    assert.ok(!seen[c.id], 'card id reused across personas: ' + c.id);
    seen[c.id] = p.id;
  }));
});

test('each card id is namespaced to its owner', () => {
  P.list.forEach((p) => p.home.needsYou.forEach((c) => {
    assert.ok(c.id.indexOf(p.id + '-') === 0, c.id + ' should start with ' + p.id + '-');
  }));
});

/* ── Preview shells ─────────────────────────────────────────────────────── */

test('canonical navigation routes directly to product areas, not preview-only labels', () => {
  P.list.forEach((p) => {
    p.nav.filter((n) => !n.sep).forEach((n) => assert.ok(n.hash.indexOf('#/preview/') !== 0, n.label));
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
