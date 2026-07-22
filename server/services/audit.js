'use strict';

/**
 * Audit service. Every material action creates a persistent audit event with
 * actor, action, object, previous/new state, reason, source and timestamp.
 * Services call `audit.record(...)` as part of the same operation.
 */

const { id } = require('../domain/ids');

class AuditService {
  constructor(repos, clock) {
    this.repos = repos;
    this.clock = clock;
  }

  record({ actorId, action, objectType, objectId, previousState = null, newState = null, reason = null, source = 'shorevest-one', meta = null }) {
    return this.repos.auditEvents.insert({
      id: id('aud'),
      actor_id: actorId || null,
      action,
      object_type: objectType,
      object_id: objectId,
      previous_state: previousState,
      new_state: newState,
      reason,
      source,
      meta_json: meta ? JSON.stringify(meta) : null,
      created_at: this.clock.nowIso(),
    });
  }

  for(objectType, objectId) {
    return this.repos.auditFor(objectType, objectId);
  }

  recent(limit) {
    return this.repos.recentAudit(limit);
  }
}

module.exports = { AuditService };
