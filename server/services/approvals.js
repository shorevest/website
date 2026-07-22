'use strict';

/**
 * Approvals service. Approval and execution are deliberately separate: a
 * decision here does not send anything. Execution is a distinct, guarded step.
 */

const { id } = require('../domain/ids');
const { assertTransition } = require('../domain/status');
const { requirePermission } = require('../domain/permissions');
const { NotFoundError, ValidationError } = require('./errors');

class ApprovalsService {
  constructor(ctx) { this.ctx = ctx; }
  get repos() { return this.ctx.repos; }
  now() { return this.ctx.clock.nowIso(); }

  queue() {
    return this.repos.approvalPackages.find({ status: 'submitted' }, { orderBy: 'submitted_at DESC' })
      .map((pkg) => this._decorate(pkg));
  }

  get(packageId) {
    const pkg = this.repos.approvalPackages.get(packageId);
    if (!pkg) throw new NotFoundError('Approval package');
    return this._decorate(pkg);
  }

  _decorate(pkg) {
    const frozen = pkg.frozen_json ? JSON.parse(pkg.frozen_json) : null;
    const decisions = this.repos.approvalDecisions.find({ package_id: pkg.id }, { orderBy: 'created_at DESC' });
    return { ...pkg, frozen, decisions };
  }

  decide(user, packageId, { decision, reason } = {}) {
    requirePermission(user, 'approve_package');
    const pkg = this.repos.approvalPackages.get(packageId);
    if (!pkg) throw new NotFoundError('Approval package');
    if (!['approved', 'returned'].includes(decision)) throw new ValidationError('decision must be approved or returned');

    assertTransition('approvalPackage', pkg.status, decision === 'approved' ? 'approved' : 'returned');
    const now = this.now();
    this.repos.approvalDecisions.insert({
      id: id('dec'), package_id: packageId, decision, decided_by: user.id,
      reason: reason || null, package_version_hash: pkg.version_hash, created_at: now,
    });
    const updated = this.repos.approvalPackages.update(packageId, {
      status: decision === 'approved' ? 'approved' : 'returned', updated_at: now,
    });
    // Resolve the approval work item.
    const items = this.repos.workspaceItems.find({ workspace: 'Approvals', type: 'approval' });
    for (const item of items) {
      const refs = item.source_refs_json ? JSON.parse(item.source_refs_json) : [];
      if (refs.some((r) => r.id === packageId)) {
        this.repos.workspaceItems.update(item.id, { status: decision === 'approved' ? 'Complete' : 'Needs review', updated_at: now });
      }
    }
    this.ctx.audit.record({ actorId: user.id, action: `approval_${decision}`, objectType: 'approval_package', objectId: packageId, previousState: pkg.status, newState: updated.status, reason });
    return updated;
  }
}

module.exports = { ApprovalsService };
