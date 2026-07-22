'use strict';

/**
 * My Work — a functioning shared queue over WorkspaceItems. Because items point
 * back to the same domain records (audiences, packages), resolving work in one
 * place is reflected everywhere.
 */

const { requirePermission } = require('../domain/permissions');
const { NotFoundError, ValidationError } = require('./errors');

const OPEN_STATUSES = ['Ready', 'Needs review', 'Waiting', 'On hold', 'Blocked', 'Suggested'];

class WorkItemsService {
  constructor(ctx) { this.ctx = ctx; }
  get repos() { return this.ctx.repos; }
  now() { return this.ctx.clock.nowIso(); }

  myWork(user, { includeCompleted = false } = {}) {
    requirePermission(user, 'view_workspace');
    const all = this.repos.workspaceItems.all('updated_at DESC');
    return all.filter((i) => {
      if (!includeCompleted && !OPEN_STATUSES.includes(i.status)) return false;
      // "Mine" = assigned to me OR unassigned queue items I can act on.
      return i.owner_id === user.id || i.owner_id === null;
    }).map((i) => ({ ...i, sourceRefs: i.source_refs_json ? JSON.parse(i.source_refs_json) : [] }));
  }

  list(filter = {}) {
    const where = {};
    if (filter.workspace) where.workspace = filter.workspace;
    return this.repos.workspaceItems.find(where, { orderBy: 'updated_at DESC' })
      .map((i) => ({ ...i, sourceRefs: i.source_refs_json ? JSON.parse(i.source_refs_json) : [] }));
  }

  update(user, itemId, { status, ownerId } = {}) {
    requirePermission(user, 'view_workspace');
    const item = this.repos.workspaceItems.get(itemId);
    if (!item) throw new NotFoundError('Workspace item');
    const patch = { updated_at: this.now() };
    if (status) patch.status = status;
    if (ownerId !== undefined) patch.owner_id = ownerId;
    const updated = this.repos.workspaceItems.update(itemId, patch);
    this.ctx.audit.record({ actorId: user.id, action: 'work_item_updated', objectType: 'workspace_item', objectId: itemId, previousState: item.status, newState: updated.status, meta: { ownerId: updated.owner_id } });
    return updated;
  }

  accept(user, itemId) {
    return this.update(user, itemId, { status: 'Complete', ownerId: user.id });
  }
}

module.exports = { WorkItemsService };
