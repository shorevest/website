'use strict';

/**
 * Composition root. Wires database → repositories → connectors → services into
 * a single application context. This is where dependency injection happens; the
 * API layer receives the ready-made context and the connector implementations
 * are chosen purely by environment mode.
 */

const { openDatabase } = require('../db/database');
const { Repositories } = require('../db/repositories');
const { buildConnectors, healthAll } = require('../connectors');
const { AuditService } = require('./audit');
const { ExecutionGuard } = require('./executionGuard');
const { OutreachService } = require('./outreach');
const { ApprovalsService } = require('./approvals');
const { WorkItemsService } = require('./workItems');

function createApp(config, { clock } = {}) {
  const realClock = clock || { nowIso: () => new Date().toISOString() };
  const db = openDatabase(config.databaseFile);
  const repos = new Repositories(db);

  const connectors = buildConnectors(config, { repos, config });

  const ctx = { config, repos, connectors, clock: realClock };
  ctx.audit = new AuditService(repos, realClock);
  ctx.guard = new ExecutionGuard(ctx);

  const services = {
    outreach: new OutreachService(ctx),
    approvals: new ApprovalsService(ctx),
    workItems: new WorkItemsService(ctx),
    audit: ctx.audit,
  };

  return {
    config, db, repos, connectors, ctx, services,
    async health() { return healthAll(connectors); },
    close() { db.close(); },
  };
}

module.exports = { createApp };
