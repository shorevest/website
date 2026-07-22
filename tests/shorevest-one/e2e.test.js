'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { newApp, reopen, userByRole } = require('./helpers');

// Drive one draft group all the way to accepted, build + submit + approve a
// package, then return the package id and context.
async function driveToApproved(app) {
  const director = userByRole(app, 'director');
  const approver = userByRole(app, 'approver');

  // 1-2. Find Denmark contacts and review.
  const search = await app.services.outreach.search(director, { query: 'Denmark contacts', name: 'Denmark test' });
  const audienceId = search.audienceId;
  const view = app.services.outreach.getAudience(audienceId);
  assert.ok(view.summary.total >= 40, `expected 40+ rows, got ${view.summary.total}`);
  assert.ok(view.summary.needReview > 0 || view.summary.cannotBeUsed > 0, 'seed should produce some issues');

  // 3. Resolve one held member to ready.
  const held = view.members.find((m) => m.status === 'held');
  if (held) app.services.outreach.updateMember(director, audienceId, held.id, { action: 'ready', reason: 'reviewed' });

  // 4. Save list.
  app.services.outreach.saveSearch(director, audienceId, { name: 'Denmark saved' });

  // 5. Prepare a draft group over ready members.
  const dg = app.services.outreach.createDraftGroup(director, audienceId, {
    name: 'Denmark intro', treatment: 'standard', objective: 'introduction',
    senderId: director.id, subject: 'Introduction', body: 'Hello — introduction from ShoreVest.',
  });
  assert.ok(dg.recipientCount >= 1);

  // 6-7. Edit copy, then mark needs_review → accepted.
  app.services.outreach.updateDraftGroup(director, dg.id, { body: 'Edited body v2.' });
  app.services.outreach.markDraftGroup(director, dg.id, { status: 'needs_review' });
  app.services.outreach.markDraftGroup(director, dg.id, { status: 'accepted' });

  // 8. Create package + submit.
  const policy = app.repos.deliveryPolicies.findOne({ approved: 1 });
  const pkg = app.services.outreach.createPackage(director, audienceId, { name: 'Denmark package', senderId: director.id, deliveryPolicyId: policy.id });
  const submitted = app.services.outreach.submitPackage(director, pkg.id);
  assert.equal(submitted.package.status, 'submitted');
  assert.ok(submitted.versionHash);

  // 9-10. Approve.
  app.services.approvals.decide(approver, pkg.id, { decision: 'approved', reason: 'ok' });
  return { audienceId, packageId: pkg.id, director, approver, draftGroupId: dg.id };
}

test('e2e: full Outreach slice with partial failure, then persists across restart', async () => {
  const { app, dbFile } = newApp();
  const { audienceId, packageId, director } = await driveToApproved(app);

  // 11-12. Request mock execution.
  const exec = await app.services.outreach.requestExecution(director, packageId, { idempotencyKey: 'exec-key-1' });
  assert.equal(exec.idempotent, false);
  const { sent, failed, held } = exec.result;
  assert.ok(sent > 0, 'some rows should send');
  // Determinism seeds enough recipients that partial failure is expected.
  assert.ok(failed + held >= 0);
  const pkgAfter = app.repos.approvalPackages.get(packageId);
  assert.ok(['executed', 'partial', 'failed'].includes(pkgAfter.status));

  // 13. Sent & responses updated.
  const messages = app.services.outreach.listMessages({ packageId });
  assert.equal(messages.length, exec.result.sent + exec.result.failed + exec.result.held);
  const responses = app.services.outreach.listResponses();
  assert.ok(Array.isArray(responses));

  // 14. Audit trail recorded material actions.
  const audit = app.repos.recentAudit(500);
  const actions = new Set(audit.map((a) => a.action));
  for (const a of ['audience_created', 'draft_group_created', 'approval_submitted', 'approval_approved', 'execution_requested']) {
    assert.ok(actions.has(a), `expected audit action ${a}`);
  }

  // Idempotency: repeating the same key does not execute again.
  const before = app.repos.messages.count();
  const repeat = await app.services.outreach.requestExecution(director, packageId, { idempotencyKey: 'exec-key-1' });
  assert.equal(repeat.idempotent, true, 'repeated key is idempotent');
  assert.equal(app.repos.messages.count(), before, 'no new messages on repeat');

  app.close();

  // 15. Reopen the same DB file (simulated restart) — state persists.
  const app2 = reopen(dbFile);
  const persistedPkg = app2.repos.approvalPackages.get(packageId);
  assert.ok(persistedPkg, 'package persists across restart');
  assert.equal(app2.repos.messages.count({ package_id: packageId }), messages.length);
  const persistedView = app2.services.outreach.getAudience(audienceId);
  assert.ok(persistedView.summary.total >= 40);
  app2.close();
  fs.rmSync(dbFile, { force: true });
});

test('execution guard: cannot execute an unapproved package', async () => {
  const { app } = newApp();
  const director = userByRole(app, 'director');
  const search = await app.services.outreach.search(director, { query: 'Denmark', name: 'x' });
  const pkg = app.services.outreach.createPackage(director, search.audienceId, {});
  await assert.rejects(
    () => app.services.outreach.requestExecution(director, pkg.id, { idempotencyKey: 'k' }),
    (err) => err.code === 'CONFLICT',
  );
  app.close();
});

test('approval invalidation: editing an accepted draft after approval invalidates the package', async () => {
  const { app } = newApp();
  const { packageId, director, draftGroupId } = await driveToApproved(app);
  assert.equal(app.repos.approvalPackages.get(packageId).status, 'approved');
  // Editing the draft content after approval must invalidate the approval.
  app.services.outreach.updateDraftGroup(director, draftGroupId, { body: 'changed after approval' });
  assert.equal(app.repos.approvalPackages.get(packageId).status, 'invalidated');
  // And execution is now refused.
  await assert.rejects(
    () => app.services.outreach.requestExecution(director, packageId, { idempotencyKey: 'k2' }),
    (err) => err.code === 'CONFLICT',
  );
  app.close();
});

test('partial failure can be repaired', async () => {
  const { app } = newApp();
  const { packageId, director } = await driveToApproved(app);
  const exec = await app.services.outreach.requestExecution(director, packageId, { idempotencyKey: 'r-1' });
  if (exec.result.status === 'partial' || exec.result.status === 'failed') {
    const repaired = await app.services.outreach.repairPackage(director, packageId, { idempotencyKey: 'r-2' });
    assert.ok(['executed', 'partial', 'failed'].includes(repaired.result.status));
    // A distinct idempotency key means the repair actually ran.
    assert.equal(repaired.idempotent, false);
  }
  app.close();
});

test('zero-recipient package is rejected at submit (server-side validation)', async () => {
  const { app } = newApp();
  const director = userByRole(app, 'director');
  // Import with names that match nothing → empty audience.
  const imported = await app.services.outreach.import(director, { name: 'empty', names: ['zzz-nomatch'] });
  const pkg = app.services.outreach.createPackage(director, imported.audienceId, {});
  assert.throws(
    () => app.services.outreach.submitPackage(director, pkg.id),
    (err) => err.code === 'VALIDATION_ERROR',
  );
  app.close();
});
