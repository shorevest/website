'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { canTransition, assertTransition, TransitionError } = require('../../server/domain/status');
const { classify, CONCENTRATION_LIMIT } = require('../../server/services/eligibility');
const { parse } = require('../../server/services/searchParser');
const { can, permissionsFor } = require('../../server/domain/permissions');
const { newApp, userByRole } = require('./helpers');

// ── State transitions ──────────────────────────────────────────────────────
test('audience member transitions: proposed→ready allowed, ready→proposed rejected', () => {
  assert.ok(canTransition('audienceMember', 'proposed', 'ready'));
  assert.ok(canTransition('audienceMember', 'held', 'ready'));
  assert.ok(!canTransition('audienceMember', 'ready', 'proposed'));
  assert.throws(() => assertTransition('audienceMember', 'blocked', 'ready'), TransitionError);
});

test('approval package transitions enforce submit→approve→execute path', () => {
  assert.ok(canTransition('approvalPackage', 'draft', 'submitted'));
  assert.ok(canTransition('approvalPackage', 'submitted', 'approved'));
  assert.ok(canTransition('approvalPackage', 'approved', 'execution_requested'));
  assert.ok(canTransition('approvalPackage', 'approved', 'invalidated'));
  assert.ok(!canTransition('approvalPackage', 'draft', 'approved'));
  assert.ok(!canTransition('approvalPackage', 'executed', 'submitted'));
});

test('draft group edit path re-opens accepted group', () => {
  assert.ok(canTransition('draftGroup', 'accepted', 'needs_review'));
  assert.ok(canTransition('draftGroup', 'needs_review', 'accepted'));
  assert.ok(!canTransition('draftGroup', 'draft', 'accepted'));
});

// ── Eligibility / classification ───────────────────────────────────────────
test('eligibility classifies restriction as blocked and missing email as held', () => {
  const people = [
    { id: 'a', restricted: true, email: 'a@x', emailStatus: 'ok', status: 'active', institutionId: 'i1' },
    { id: 'b', restricted: false, email: null, emailStatus: 'missing', status: 'active', institutionId: 'i1' },
    { id: 'c', restricted: false, email: 'c@x', emailStatus: 'ok', status: 'active', institutionId: 'i1' },
  ];
  const { classifications, summary } = classify(people);
  assert.equal(classifications.get('a').outcome, 'blocked');
  assert.equal(classifications.get('a').issueCode, 'restriction');
  assert.equal(classifications.get('b').outcome, 'held');
  assert.equal(classifications.get('c').outcome, 'ready');
  assert.deepEqual(summary, { total: 3, ready: 1, needReview: 1, cannotBeUsed: 1 });
});

test('concentration rule flags contacts beyond the institution limit', () => {
  const people = [];
  for (let i = 0; i < CONCENTRATION_LIMIT + 3; i += 1) {
    people.push({ id: `p${i}`, restricted: false, email: `p${i}@x`, emailStatus: 'ok', status: 'active', institutionId: 'big' });
  }
  const { classifications } = classify(people);
  const flagged = people.filter((p) => classifications.get(p.id).issueCode === 'institution_concentration');
  assert.equal(flagged.length, 3, 'exactly the contacts beyond the limit are flagged');
});

test('duplicate candidate is held with possible_duplicate', () => {
  const { classifications } = classify([{ id: 'd', duplicateOf: 'x', restricted: false, email: 'd@x', emailStatus: 'ok', status: 'active', institutionId: 'i' }]);
  assert.equal(classifications.get('d').issueCode, 'possible_duplicate');
  assert.equal(classifications.get('d').outcome, 'held');
});

// ── NL search parser ───────────────────────────────────────────────────────
test('search parser interprets Denmark and reports unsupported input', () => {
  const ok = parse('active Denmark pension CIOs');
  assert.equal(ok.interpreted, true);
  assert.equal(ok.rules.country, 'Denmark');
  assert.equal(ok.rules.status, 'active');
  const bad = parse('xyzzy nonsense query');
  assert.equal(bad.interpreted, false);
  assert.match(bad.message, /could not interpret/i);
});

// ── Permissions ────────────────────────────────────────────────────────────
test('permissions: approver can approve but not request execution', () => {
  const approver = { role: 'approver' };
  assert.ok(can(approver, 'approve_package'));
  assert.ok(!can(approver, 'request_execution'));
  const associate = { role: 'associate' };
  assert.ok(!can(associate, 'request_execution'));
  assert.ok(permissionsFor('admin').includes('request_execution'));
});

// ── Permission enforced in service before any record access ───────────────
test('associate cannot approve a package (PermissionError before lookup)', () => {
  const { app } = newApp();
  const associate = userByRole(app, 'associate');
  assert.throws(
    () => app.services.approvals.decide(associate, 'pkg_anything', { decision: 'approved' }),
    (err) => err.code === 'PERMISSION_DENIED',
  );
  app.close();
});
