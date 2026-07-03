/* ==========================================================================
   ShoreVest Operations — Workflow Store (demonstration mode)
   Models the Dataverse control database entities exactly as specified:
     ProcessingBatch, ProcessingRow, SavedProcess, Configuration, AuditEvent
   plus the execution-key registry and connection-health records.

   In production this module is replaced by the Dataverse adapter in
   integrations.js — the entity shapes and method names are the contract.
   Demonstration mode persists to localStorage so the full workflow can be
   exercised end-to-end without any tenant connection. All reference data
   seeded here is SYNTHETIC (example.com domains) and clearly labelled;
   no real Salesforce data, credentials, or tenant configuration exists
   in this file.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.SVPortalStore = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORE_KEY = 'svops.store.v1';
  var APP_VERSION = '1.0.0';
  var RULES_VERSION = 'R-2026.07';
  var TEMPLATE_VERSION = 'T-2026.07';

  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' +
      Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  /* ── Seed data (synthetic, demonstration only) ─────────────────────────── */

  function seedSavedProcesses() {
    var base = {
      matchAgainstSalesforce: true, excludePreviousOutreach: true,
      excludeBlockedRecords: true, generateReviewWorkbook: true,
      prepareDraftEmails: false, createSalesforceActions: false,
      updateSalesforce: false, sendEmails: false, dryRun: true
    };
    function sp(name, description, overrides) {
      return {
        processId: uid('SP'), processName: name, description: description,
        active: true,
        defaultSettingsJson: JSON.stringify(Object.assign({}, base, overrides || {})),
        rulesVersion: RULES_VERSION,
        createdBy: 'System', updatedBy: 'System',
        createdAt: nowIso(), updatedAt: nowIso()
      };
    }
    return [
      sp('Weekly Outreach and Coverage Snapshot',
         'Generates the ShoreVest Weekly Outreach and Coverage Snapshot from approved source data.',
         { processType: 'Weekly Reporting' }),
      sp('Kelvin Asia Conference Outreach',
         'Conference contact list processed for Asia coverage; review workbook output.',
         { processType: 'Outreach Preparation', coverageOwner: 'Kelvin', region: 'Asia' }),
      sp('John Ex-Asia Reconnect List',
         'Reconnect list processed for Ex-Asia coverage; review workbook output.',
         { processType: 'Outreach Preparation', coverageOwner: 'John', region: 'Ex-Asia' }),
      sp('Existing Contact Reconnect',
         'Keeps rows that match existing Salesforce Contacts for reconnection review.',
         { processType: 'Outreach Preparation', treatExistingContacts: 'include' }),
      sp('Salesforce Contact Quality Audit',
         'Runs contact data-quality checks; no outreach output.',
         { processType: 'Salesforce Data Quality' }),
      sp('Fund III Opportunity Cleanup',
         'Opportunity ownership, next-step and stale-record checks for Fund III.',
         { processType: 'Salesforce Data Quality', fund: 'Fund III' }),
      sp('General List Cleaning',
         'Cleans, normalises and de-duplicates a list without Salesforce actions.',
         { processType: 'General List Cleaning' }),
      sp('Custom Process',
         'Start from fail-closed defaults and configure every setting manually.',
         { processType: 'Custom' })
    ];
  }

  function seedConfiguration() {
    function cfg(key, value, category) {
      return { configurationId: uid('CFG'), key: key, value: value,
               category: category, active: true, version: 1,
               updatedBy: 'System', updatedAt: nowIso() };
    }
    return [
      cfg('owners', JSON.stringify([
        { name: 'Kelvin', regions: ['Asia'] },
        { name: 'John', regions: ['Ex-Asia'] }
      ]), 'Coverage'),
      cfg('regions', JSON.stringify(['Asia', 'Ex-Asia', 'Europe', 'North America', 'Middle East']), 'Coverage'),
      cfg('funds', JSON.stringify(['Fund II', 'Fund III']), 'Funds'),
      cfg('campaigns', JSON.stringify(['Asia Conference 2026', 'Ex-Asia Reconnect 2026', 'AGM 2026 Follow-up']), 'Campaigns'),
      cfg('templates', JSON.stringify([
        { id: 'TPL-INTRO', name: 'Institutional Introduction', version: TEMPLATE_VERSION, approved: true },
        { id: 'TPL-RECONNECT', name: 'Existing Relationship Reconnect', version: TEMPLATE_VERSION, approved: true },
        { id: 'TPL-CONFERENCE', name: 'Conference Follow-up', version: TEMPLATE_VERSION, approved: true }
      ]), 'Templates'),
      cfg('senders', JSON.stringify([
        { address: 'ENV:SVOPS_SENDER_IR', label: 'IR shared mailbox (configured at deployment)', authorised: true }
      ]), 'Senders'),
      /* Synthetic demonstration reference lists — example.com only. */
      cfg('blockedDomains', JSON.stringify(['blocked-domain.example.com', 'competitor.example.com']), 'Compliance'),
      cfg('blockedAccounts', JSON.stringify(['DEMO-ACCT-BLOCKED']), 'Compliance'),
      cfg('suppressedEmails', JSON.stringify(['opted.out@example.com']), 'Compliance'),
      cfg('hardBounces', JSON.stringify(['bounced@example.com']), 'Compliance'),
      cfg('previousOutreach', JSON.stringify(['already.contacted@example.com']), 'Outreach'),
      cfg('maxFileBytes', String(25 * 1024 * 1024), 'Limits'),
      cfg('maxRows', '50000', 'Limits'),
      cfg('requiredColumns', JSON.stringify(['email', 'company']), 'Mapping'),
      cfg('salesforceMatchThreshold', '0.9', 'Matching'),
      cfg('rulesVersion', RULES_VERSION, 'Versions'),
      cfg('templateVersion', TEMPLATE_VERSION, 'Versions'),
      cfg('stuckBatchMinutes', '30', 'Monitoring')
    ];
  }

  /* Synthetic Salesforce index for demonstration matching. Every record is
     fictitious and uses example.com. Replaced by the Salesforce connector
     in production. */
  function seedDemoSalesforce() {
    /* Synthetic CRM index for demonstration matching. The domain is a
       clearly-labelled demo domain chosen NOT to collide with the
       placeholder-data detector, so the "existing contact" and
       "ambiguous match" paths are visible in demo mode. */
    return {
      label: 'DEMONSTRATION DATA — synthetic records, not Salesforce',
      contacts: [
        { id: 'DEMO-C-001', name: 'Demo Contact One', email: 'existing.contact@demo-institution.crm',
          accountId: 'DEMO-A-001', accountName: 'Demo Institution One', owner: 'Kelvin' },
        { id: 'DEMO-C-002', name: 'Demo Contact Two', email: 'ambiguous@demo-institution.crm',
          accountId: 'DEMO-A-002', accountName: 'Demo Institution Two', owner: 'John' },
        { id: 'DEMO-C-003', name: 'Demo Contact Two B', email: 'ambiguous@demo-institution.crm',
          accountId: 'DEMO-A-003', accountName: 'Demo Institution Three', owner: 'Kelvin' },
        { id: 'DEMO-C-004', name: 'Demo Blocked Contact', email: 'blocked.account@demo-institution.crm',
          accountId: 'DEMO-ACCT-BLOCKED', accountName: 'Demo Blocked Institution', owner: 'John' },
        { id: 'DEMO-C-005', name: 'Demo Live Process', email: 'live.process@demo-institution.crm',
          accountId: 'DEMO-A-005', accountName: 'Demo Institution Five', owner: 'Kelvin' }
      ],
      liveProcessEmails: ['live.process@demo-institution.crm']
    };
  }

  function emptyState() {
    return {
      version: 1,
      appVersion: APP_VERSION,
      batches: [],          /* ProcessingBatch[] */
      rows: {},             /* batchId → ProcessingRow[] */
      sourceFiles: {},      /* batchId → { filename, storedAt, rows } (raw, never overwritten) */
      savedProcesses: seedSavedProcesses(),
      configuration: seedConfiguration(),
      auditEvents: [],      /* AuditEvent[] */
      executionRegistry: {},/* executionKey → { result, executedAt, executedBy, flowRunId } */
      alerts: [],
      errorLogs: [],
      connections: null,    /* cached pre-flight results */
      lastEndToEndTest: null
    };
  }

  var state = null;
  var hasLocalStorage = (function () {
    try { return typeof localStorage !== 'undefined'; } catch (e) { return false; }
  })();

  function load() {
    if (state) return state;
    if (hasLocalStorage) {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw) { state = JSON.parse(raw); return state; }
      } catch (e) { /* corrupted store: start clean rather than guess */ }
    }
    state = emptyState();
    save();
    return state;
  }

  function save() {
    if (!hasLocalStorage || !state) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) {
      /* Storage quota exceeded — trim the largest raw source payloads but
         never audit history. */
      try {
        var ids = Object.keys(state.sourceFiles);
        if (ids.length) {
          delete state.sourceFiles[ids[0]].rows;
          state.sourceFiles[ids[0]].truncated = true;
          localStorage.setItem(STORE_KEY, JSON.stringify(state));
        }
      } catch (e2) { /* give up silently; demo-mode only */ }
    }
  }

  function reset() {
    state = emptyState();
    save();
    return state;
  }

  /* ── Audit ─────────────────────────────────────────────────────────────── */

  function audit(event) {
    var s = load();
    var record = {
      auditEventId: uid('AE'),
      batchId: event.batchId || null,
      rowId: event.rowId || null,
      eventType: event.eventType,
      previousValue: event.previousValue != null ? String(event.previousValue) : null,
      newValue: event.newValue != null ? String(event.newValue) : null,
      performedBy: event.performedBy || 'Unknown',
      performedAt: nowIso(),
      reason: event.reason || null,
      flowRunId: event.flowRunId || null,
      executionKey: event.executionKey || null
    };
    s.auditEvents.push(record);
    save();
    return record;
  }

  function auditForBatch(batchId) {
    return load().auditEvents.filter(function (a) { return a.batchId === batchId; });
  }

  /* ── Configuration ─────────────────────────────────────────────────────── */

  function getConfigRecord(key) {
    return load().configuration.filter(function (c) { return c.key === key && c.active; })[0] || null;
  }
  function getConfig(key, fallback) {
    var rec = getConfigRecord(key);
    if (!rec) return fallback;
    try { return JSON.parse(rec.value); } catch (e) { return rec.value; }
  }
  function setConfig(key, value, updatedBy, reason) {
    var s = load();
    var rec = getConfigRecord(key);
    var serialised = typeof value === 'string' ? value : JSON.stringify(value);
    if (rec) {
      audit({ eventType: 'ConfigurationChanged', previousValue: rec.value,
              newValue: serialised, performedBy: updatedBy, reason: reason || ('Configuration key "' + key + '" updated.') });
      rec.value = serialised;
      rec.version += 1;
      rec.updatedBy = updatedBy;
      rec.updatedAt = nowIso();
    } else {
      rec = { configurationId: uid('CFG'), key: key, value: serialised, category: 'Custom',
              active: true, version: 1, updatedBy: updatedBy, updatedAt: nowIso() };
      s.configuration.push(rec);
      audit({ eventType: 'ConfigurationCreated', newValue: serialised, performedBy: updatedBy, reason: reason });
    }
    /* Any configuration change invalidates prior batch approvals: batches
       approved for execution must be revalidated. */
    s.batches.forEach(function (b) {
      if (b.approvedForExecution && !b.requiresRevalidation) {
        b.requiresRevalidation = true;
        b.updatedAt = nowIso();
        audit({ batchId: b.batchId, eventType: 'RevalidationRequired',
                performedBy: 'System',
                reason: 'Configuration changed after approval (key "' + key + '").' });
      }
    });
    save();
    return rec;
  }
  function configVersionSum() {
    return load().configuration.reduce(function (n, c) { return n + c.version; }, 0);
  }

  /* ── Saved processes ───────────────────────────────────────────────────── */

  function getSavedProcesses() { return load().savedProcesses.filter(function (p) { return p.active; }); }
  function getSavedProcess(id) {
    return load().savedProcesses.filter(function (p) { return p.processId === id; })[0] || null;
  }
  function upsertSavedProcess(proc, user) {
    var s = load();
    var existing = proc.processId ? getSavedProcess(proc.processId) : null;
    if (existing) {
      audit({ eventType: 'SavedProcessUpdated', previousValue: existing.defaultSettingsJson,
              newValue: proc.defaultSettingsJson, performedBy: user });
      Object.assign(existing, proc, { updatedBy: user, updatedAt: nowIso() });
      save();
      return existing;
    }
    var created = Object.assign({
      processId: uid('SP'), active: true, rulesVersion: RULES_VERSION,
      createdBy: user, updatedBy: user, createdAt: nowIso(), updatedAt: nowIso()
    }, proc);
    s.savedProcesses.push(created);
    audit({ eventType: 'SavedProcessCreated', newValue: created.processName, performedBy: user });
    save();
    return created;
  }

  /* ── Batches ───────────────────────────────────────────────────────────── */

  function createBatch(input, user) {
    var s = load();
    var batch = {
      batchId: uid('B'),
      submittedBy: user,
      submittedAt: nowIso(),
      originalFilename: input.originalFilename,
      fileType: input.fileType,
      fileHash: input.fileHash || null,
      processType: input.processType || '',
      savedProcessId: input.savedProcessId || null,
      savedProcessName: input.savedProcessName || '',
      settingsJson: JSON.stringify(input.settings || {}),
      instruction: input.instruction || '',
      interpretationJson: JSON.stringify(input.interpretation || null),
      status: 'Uploaded',
      currentStage: 'Uploaded',
      totalRows: input.totalRows || 0,
      readyRows: 0, reviewRows: 0, duplicateRows: 0,
      invalidRows: 0, blockedRows: 0, systemErrorRows: 0,
      outputFileUrl: null,
      errorSummary: null,
      rulesVersion: RULES_VERSION,
      templateVersion: TEMPLATE_VERSION,
      appVersion: APP_VERSION,
      flowVersion: 'demo',
      batchVersion: 1,
      approvedForExecution: false,
      approvedBatchVersion: null,
      requiresRevalidation: false,
      configVersionAtApproval: null,
      locked: false, lockedBy: null, lockedAt: null, flowRunId: null,
      createdAt: nowIso(), updatedAt: nowIso()
    };
    s.batches.unshift(batch);
    audit({ batchId: batch.batchId, eventType: 'BatchCreated',
            newValue: input.originalFilename, performedBy: user });
    save();
    return batch;
  }

  function getBatch(batchId) {
    return load().batches.filter(function (b) { return b.batchId === batchId; })[0] || null;
  }
  function getBatches() { return load().batches.slice(); }

  function updateBatch(batchId, changes, user, eventType, reason) {
    var b = getBatch(batchId);
    if (!b) return null;
    Object.assign(b, changes, { updatedAt: nowIso() });
    if (eventType) {
      audit({ batchId: batchId, eventType: eventType, performedBy: user || 'System',
              newValue: changes.status || changes.currentStage || null, reason: reason });
    }
    save();
    return b;
  }

  function lockBatch(batchId, lockedBy, flowRunId) {
    var b = getBatch(batchId);
    if (!b) return { acquired: false, reason: 'Batch not found.' };
    if (b.locked) {
      return { acquired: false, reason: 'Batch is locked by ' + b.lockedBy + ' since ' + b.lockedAt + '.' };
    }
    b.locked = true; b.lockedBy = lockedBy; b.lockedAt = nowIso(); b.flowRunId = flowRunId;
    b.updatedAt = nowIso();
    audit({ batchId: batchId, eventType: 'BatchLocked', performedBy: lockedBy, flowRunId: flowRunId });
    save();
    return { acquired: true };
  }
  function unlockBatch(batchId, by) {
    var b = getBatch(batchId);
    if (!b) return;
    b.locked = false; b.lockedBy = null; b.lockedAt = null; b.updatedAt = nowIso();
    audit({ batchId: batchId, eventType: 'BatchUnlocked', performedBy: by || 'System' });
    save();
  }

  /* ── Rows ──────────────────────────────────────────────────────────────── */

  function setRows(batchId, rows) {
    var s = load();
    s.rows[batchId] = rows;
    save();
  }
  function getRows(batchId) { return load().rows[batchId] || []; }
  function getRow(batchId, rowId) {
    return getRows(batchId).filter(function (r) { return r.rowId === rowId; })[0] || null;
  }
  function updateRow(batchId, rowId, changes, user, eventType, reason) {
    var r = getRow(batchId, rowId);
    if (!r) return null;
    var prev = JSON.stringify({ classification: r.classification, reviewStatus: r.reviewStatus,
                                executionStatus: r.executionStatus, proposedOwner: r.proposedOwner });
    Object.assign(r, changes, { updatedAt: nowIso() });
    audit({ batchId: batchId, rowId: rowId, eventType: eventType || 'RowUpdated',
            previousValue: prev,
            newValue: JSON.stringify(changes),
            performedBy: user, reason: reason });
    save();
    return r;
  }

  /* Raw source data is stored once and never overwritten. */
  function storeSourceFile(batchId, payload) {
    var s = load();
    if (s.sourceFiles[batchId]) return s.sourceFiles[batchId]; /* immutable */
    s.sourceFiles[batchId] = { storedAt: nowIso(), filename: payload.filename,
                               rows: payload.rows, headers: payload.headers };
    save();
    return s.sourceFiles[batchId];
  }
  function getSourceFile(batchId) { return load().sourceFiles[batchId] || null; }

  /* ── Execution registry (duplicate-action prevention) ──────────────────── */

  function executionKeyExists(key) {
    return Object.prototype.hasOwnProperty.call(load().executionRegistry, key);
  }
  function getExecution(key) { return load().executionRegistry[key] || null; }
  /**
   * Record an execution attempt BEFORE the external call is made, with
   * status 'In Flight'; finalise afterwards. A crash between the two leaves
   * an 'In Flight' record which counts as possibly-executed — fail closed.
   */
  function beginExecution(key, meta) {
    var s = load();
    if (executionKeyExists(key)) return { ok: false, previous: s.executionRegistry[key] };
    s.executionRegistry[key] = {
      status: 'In Flight', startedAt: nowIso(),
      executedBy: meta.executedBy, actionType: meta.actionType,
      flowRunId: meta.flowRunId || null, result: null
    };
    audit({ batchId: meta.batchId, rowId: meta.rowId, eventType: 'ExecutionStarted',
            performedBy: meta.executedBy, executionKey: key, flowRunId: meta.flowRunId });
    save();
    return { ok: true };
  }
  function finishExecution(key, result, meta) {
    var s = load();
    var rec = s.executionRegistry[key];
    if (!rec) return;
    rec.status = result.success ? 'Succeeded' : 'Failed';
    rec.result = result.detail || null;
    rec.finishedAt = nowIso();
    audit({ batchId: meta.batchId, rowId: meta.rowId,
            eventType: result.success ? 'ExecutionSucceeded' : 'ExecutionFailed',
            performedBy: meta.executedBy, executionKey: key, reason: result.detail });
    save();
  }

  /* ── Cross-batch lookups ───────────────────────────────────────────────── */

  function processedHashes() {
    return load().batches
      .filter(function (b) { return b.fileHash && b.status !== 'Failed'; })
      .map(function (b) { return b.fileHash; });
  }
  function previousBatchEmails(excludeBatchId) {
    var s = load(), out = [];
    Object.keys(s.rows).forEach(function (bid) {
      if (bid === excludeBatchId) return;
      s.rows[bid].forEach(function (r) { if (r.email) out.push(r.email); });
    });
    return out;
  }

  /* ── Alerts and error logs (monitoring) ────────────────────────────────── */

  function addAlert(alert) {
    var s = load();
    s.alerts.unshift(Object.assign({ id: uid('AL'), raisedAt: nowIso(), acknowledged: false }, alert));
    if (s.alerts.length > 200) s.alerts.length = 200;
    save();
  }
  function getAlerts() { return load().alerts.slice(); }
  function acknowledgeAlert(id, user) {
    var a = load().alerts.filter(function (x) { return x.id === id; })[0];
    if (a) { a.acknowledged = true; a.acknowledgedBy = user; save(); }
  }

  function logError(entry) {
    var s = load();
    s.errorLogs.unshift(Object.assign({ id: uid('EL'), timestamp: nowIso(), retryCount: 0 }, entry));
    if (s.errorLogs.length > 500) s.errorLogs.length = 500;
    save();
  }
  function getErrorLogs() { return load().errorLogs.slice(); }

  function getDemoSalesforce() {
    var s = load();
    if (!s.demoSalesforce) { s.demoSalesforce = seedDemoSalesforce(); save(); }
    return s.demoSalesforce;
  }

  return {
    APP_VERSION: APP_VERSION,
    RULES_VERSION: RULES_VERSION,
    TEMPLATE_VERSION: TEMPLATE_VERSION,
    uid: uid,
    load: load,
    reset: reset,
    audit: audit,
    auditForBatch: auditForBatch,
    getAllAudit: function () { return load().auditEvents.slice(); },
    getConfig: getConfig,
    getConfigRecord: getConfigRecord,
    getAllConfig: function () { return load().configuration.slice(); },
    setConfig: setConfig,
    configVersionSum: configVersionSum,
    getSavedProcesses: getSavedProcesses,
    getSavedProcess: getSavedProcess,
    upsertSavedProcess: upsertSavedProcess,
    createBatch: createBatch,
    getBatch: getBatch,
    getBatches: getBatches,
    updateBatch: updateBatch,
    lockBatch: lockBatch,
    unlockBatch: unlockBatch,
    setRows: setRows,
    getRows: getRows,
    getRow: getRow,
    updateRow: updateRow,
    storeSourceFile: storeSourceFile,
    getSourceFile: getSourceFile,
    executionKeyExists: executionKeyExists,
    getExecution: getExecution,
    beginExecution: beginExecution,
    finishExecution: finishExecution,
    processedHashes: processedHashes,
    previousBatchEmails: previousBatchEmails,
    addAlert: addAlert,
    getAlerts: getAlerts,
    acknowledgeAlert: acknowledgeAlert,
    logError: logError,
    getErrorLogs: getErrorLogs,
    getDemoSalesforce: getDemoSalesforce
  };
});
