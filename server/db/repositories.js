'use strict';

/**
 * Repository layer. The ONLY module that speaks SQL. Services depend on these
 * methods, never on the database directly — so SQLite can later be swapped for
 * Postgres/Dataverse without touching services.
 *
 * Booleans are stored as 0/1 integers in SQLite and mapped here.
 */

const BOOL_COLUMNS = new Set(['active', 'restricted', 'approved', 'is_current']);

function toRow(obj) {
  const row = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'boolean') row[k] = v ? 1 : 0;
    else row[k] = v === undefined ? null : v;
  }
  return row;
}

function fromRow(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (BOOL_COLUMNS.has(k)) out[k] = !!v;
    else out[k] = v;
  }
  return out;
}

class Table {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  insert(obj) {
    const row = toRow(obj);
    const cols = Object.keys(row);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.name} (${cols.join(', ')}) VALUES (${placeholders})`;
    this.db.prepare(sql).run(...cols.map((c) => row[c]));
    return fromRow(row);
  }

  update(id, patch) {
    const row = toRow(patch);
    const cols = Object.keys(row);
    if (cols.length === 0) return this.get(id);
    const setSql = cols.map((c) => `${c} = ?`).join(', ');
    const sql = `UPDATE ${this.name} SET ${setSql} WHERE id = ?`;
    this.db.prepare(sql).run(...cols.map((c) => row[c]), id);
    return this.get(id);
  }

  get(id) {
    return fromRow(this.db.prepare(`SELECT * FROM ${this.name} WHERE id = ?`).get(id));
  }

  find(where = {}, { orderBy, limit } = {}) {
    const keys = Object.keys(where);
    let sql = `SELECT * FROM ${this.name}`;
    const params = [];
    if (keys.length) {
      sql += ' WHERE ' + keys.map((k) => `${k} = ?`).join(' AND ');
      for (const k of keys) {
        const v = where[k];
        params.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
      }
    }
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${Number(limit)}`;
    return this.db.prepare(sql).all(...params).map(fromRow);
  }

  findOne(where) {
    return this.find(where, { limit: 1 })[0] || null;
  }

  all(orderBy) {
    return this.find({}, { orderBy });
  }

  count(where = {}) {
    const keys = Object.keys(where);
    let sql = `SELECT COUNT(*) AS n FROM ${this.name}`;
    const params = [];
    if (keys.length) {
      sql += ' WHERE ' + keys.map((k) => `${k} = ?`).join(' AND ');
      for (const k of keys) params.push(where[k]);
    }
    return this.db.prepare(sql).get(...params).n;
  }
}

class Repositories {
  constructor(db) {
    this.db = db;
    this.users = new Table(db, 'users');
    this.institutions = new Table(db, 'institutions');
    this.people = new Table(db, 'people');
    this.relationships = new Table(db, 'relationships');
    this.opportunities = new Table(db, 'opportunities');
    this.savedSearches = new Table(db, 'saved_searches');
    this.audiences = new Table(db, 'audiences');
    this.audienceMembers = new Table(db, 'audience_members');
    this.recordProposals = new Table(db, 'record_proposals');
    this.signatures = new Table(db, 'signatures');
    this.deliveryPolicies = new Table(db, 'delivery_policies');
    this.draftGroups = new Table(db, 'draft_groups');
    this.draftGroupMembers = new Table(db, 'draft_group_members');
    this.draftVersions = new Table(db, 'draft_versions');
    this.approvalPackages = new Table(db, 'approval_packages');
    this.approvalDecisions = new Table(db, 'approval_decisions');
    this.executionRequests = new Table(db, 'execution_requests');
    this.messages = new Table(db, 'messages');
    this.responses = new Table(db, 'responses');
    this.tasks = new Table(db, 'tasks');
    this.workspaceItems = new Table(db, 'workspace_items');
    this.auditEvents = new Table(db, 'audit_events');
    this.connectorSync = new Table(db, 'connector_sync');
    this.executionKeys = new Table(db, 'execution_keys');

    // Investment Toolbox — IC Deck QC.
    this.deals = new Table(db, 'deals');
    this.dealModels = new Table(db, 'deal_models');
    this.modelMetrics = new Table(db, 'model_metrics');
    this.decks = new Table(db, 'decks');
    this.deckFigures = new Table(db, 'deck_figures');
    this.qcRuns = new Table(db, 'qc_runs');
    this.qcFindings = new Table(db, 'qc_findings');
  }

  /** Run fn inside a transaction; rolls back on throw. */
  transaction(fn) {
    this.db.exec('BEGIN;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  /** Idempotency: claim a key. Returns { fresh, existing }. Keyed by `key`. */
  getExecutionKey(key) {
    return fromRow(this.db.prepare('SELECT * FROM execution_keys WHERE key = ?').get(key));
  }

  claimExecutionKey(key, scope, requestId, nowIso) {
    const existing = this.getExecutionKey(key);
    if (existing) return { fresh: false, existing };
    this.executionKeys.insert({
      key, scope, request_id: requestId, result_json: null, created_at: nowIso,
    });
    return { fresh: true, existing: null };
  }

  setExecutionKeyResult(key, resultJson) {
    this.db.prepare('UPDATE execution_keys SET result_json = ? WHERE key = ?').run(resultJson, key);
  }

  members(audienceId) {
    return this.audienceMembers.find({ audience_id: audienceId }, { orderBy: 'created_at' });
  }

  auditFor(objectType, objectId) {
    return this.auditEvents.find(
      { object_type: objectType, object_id: objectId },
      { orderBy: 'created_at DESC' },
    );
  }

  recentAudit(limit = 100) {
    return this.auditEvents.all('created_at DESC').slice(0, limit);
  }
}

module.exports = { Repositories, Table, toRow, fromRow };
