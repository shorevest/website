'use strict';

/**
 * Central execution guard. The ONLY path to an external write (or its mock
 * simulation). Every condition below must hold. In MOCK mode the same guard
 * runs and execution flows through the mock connectors — there is no demo
 * shortcut.
 *
 * Conditions (all required):
 *  1. environment permits execution (MOCK simulates; CONNECTED_READ_ONLY blocks)
 *  2. user has the request_execution permission
 *  3. package carries a valid approval matching its current version hash
 *  4. the approved version has not been invalidated
 *  5. the execution idempotency key has not already been used
 *  6. the relevant connector is healthy
 *  7. each record is revalidated as still eligible at execution time
 */

const { MODES } = require('../config');
const { requirePermission } = require('../domain/permissions');
const { ConflictError, ValidationError } = require('./errors');

class ExecutionGuard {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /** True when the environment allows execution at all (real or simulated). */
  environmentPermitsExecution() {
    const { mode } = this.ctx.config;
    return mode === MODES.MOCK || mode === MODES.CONNECTED_CONTROLLED;
  }

  /** Package-level authorization. Throws on any failed condition. */
  async authorizeExecution({ user, pkg }) {
    if (!this.environmentPermitsExecution()) {
      throw new ConflictError(
        `Execution is disabled in ${this.ctx.config.mode} mode. External execution is off.`,
      );
    }
    requirePermission(user, 'request_execution'); // condition 2

    if (!pkg) throw new ValidationError('Package is required for execution.');

    // condition 3 + 4: a valid, non-invalidated approval for the current version
    if (pkg.status === 'invalidated') {
      throw new ConflictError('Approval package has been invalidated. Re-submit for approval.');
    }
    if (!['approved', 'execution_requested', 'partial', 'failed'].includes(pkg.status)) {
      throw new ConflictError(`Package must be approved before execution (status: ${pkg.status}).`);
    }
    const decision = this.ctx.repos.approvalDecisions.find(
      { package_id: pkg.id, decision: 'approved' },
      { orderBy: 'created_at DESC', limit: 1 },
    )[0];
    if (!decision) {
      throw new ConflictError('No approval decision found for this package.');
    }
    if (decision.package_version_hash !== pkg.version_hash) {
      throw new ConflictError('Approved version no longer matches the current package (it was edited). Re-submit for approval.');
    }

    // condition 6: connector health
    const mailHealth = await this.ctx.connectors.mail.health();
    if (!mailHealth.ok) {
      throw new ConflictError(`Mail connector is not healthy: ${mailHealth.detail}`);
    }
    return { ok: true };
  }

  /**
   * Condition 5: reserve the idempotency key. Returns { fresh, existing }.
   * A repeated request with the same key returns the stored result — it never
   * executes twice.
   */
  reserveIdempotency(key, scope, requestId) {
    if (!key) throw new ValidationError('Idempotency key is required for execution.');
    return this.ctx.repos.claimExecutionKey(key, scope, requestId, this.ctx.clock.nowIso());
  }

  storeIdempotentResult(key, result) {
    if (this.ctx.repos.getExecutionKey(key)) {
      this.ctx.repos.setExecutionKeyResult(key, JSON.stringify(result));
    }
  }

  /** Condition 7: per-recipient final eligibility revalidation. */
  revalidateRecipient(member, person) {
    if (!member || member.status !== 'ready') {
      return { eligible: false, reason: 'not_ready' };
    }
    if (!person) return { eligible: false, reason: 'missing_person' };
    if (person.restricted) return { eligible: false, reason: 'restricted' };
    if (person.status === 'departed') return { eligible: false, reason: 'departed_contact' };
    if (person.email_status === 'bounced') return { eligible: false, reason: 'hard_bounce' };
    if (!person.email) return { eligible: false, reason: 'missing_email' };
    return { eligible: true, reason: null };
  }
}

module.exports = { ExecutionGuard };
