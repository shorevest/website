'use strict';

/**
 * Centralized status model + workflow state machine.
 *
 * Statuses are NOT scattered as arbitrary strings across the code. Every
 * transition is defined here and enforced by `assertTransition`. Invalid
 * transitions are rejected by the backend, not merely hidden in the UI.
 */

class TransitionError extends Error {
  constructor(entity, from, to) {
    super(`Invalid ${entity} transition: ${from} → ${to}`);
    this.name = 'TransitionError';
    this.code = 'INVALID_TRANSITION';
    this.status = 409;
    this.entity = entity;
    this.from = from;
    this.to = to;
  }
}

// User-facing status vocabulary (surfaced in the UI).
const USER_FACING = Object.freeze([
  'Ready', 'Needs review', 'Waiting', 'On hold', 'Blocked',
  'Suggested', 'Complete', 'Failed',
]);

// Internal workflow transition tables. Keys are current state; values are the
// set of permitted next states.
const MACHINES = Object.freeze({
  audienceMember: {
    proposed: ['ready', 'held', 'blocked', 'removed'],
    ready: ['held', 'blocked', 'removed'],
    held: ['ready', 'blocked', 'removed'],
    blocked: ['removed'],
    removed: [],
  },
  recordProposal: {
    proposed: ['accepted', 'rejected'],
    accepted: ['applied', 'failed', 'invalidated'],
    rejected: [],
    applied: [],
    failed: ['accepted'], // allow repair/retry of a failed apply
    invalidated: [],
  },
  draftGroup: {
    draft: ['needs_review'],
    needs_review: ['changes_requested', 'accepted'],
    changes_requested: ['needs_review'],
    accepted: ['invalidated', 'needs_review'],
    invalidated: ['needs_review'],
  },
  approvalPackage: {
    draft: ['submitted'],
    submitted: ['approved', 'returned'],
    returned: ['submitted'],
    approved: ['invalidated', 'execution_requested'],
    execution_requested: ['executed', 'failed', 'partial'],
    partial: ['execution_requested'], // repair failed rows → re-request
    executed: [],
    failed: ['execution_requested'],
    invalidated: [],
  },
  executionRequest: {
    queued: ['executed', 'failed', 'partial'],
    executed: [],
    failed: [],
    partial: [],
  },
  message: {
    queued: ['sent', 'failed', 'held'],
    held: ['queued', 'sent', 'failed'],
    sent: [],
    failed: ['queued'],
  },
});

function canTransition(entity, from, to) {
  const machine = MACHINES[entity];
  if (!machine) throw new Error(`Unknown state machine: ${entity}`);
  if (from === to) return true;
  const allowed = machine[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

function assertTransition(entity, from, to) {
  if (!canTransition(entity, from, to)) {
    throw new TransitionError(entity, from, to);
  }
  return to;
}

module.exports = { MACHINES, USER_FACING, canTransition, assertTransition, TransitionError };
