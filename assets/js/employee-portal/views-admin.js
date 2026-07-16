/* ==========================================================================
   ShoreVest Operations — Previous Runs, Administration, Monitoring, and the
   Weekly Reporting / Salesforce Data Quality / Outreach Preparation modules.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var R = root.SVPortalRules;
  var S = root.SVPortalStore;
  var W = root.SVPortalWorkflow;
  var I = root.SVPortalIntegrations;
  var el = U.el, esc = U.esc;
  function frag(html) { return U.frag(html); }
  function rerender() { root.dispatchEvent(new CustomEvent('svops:render')); }

  /* ── Previous Runs ─────────────────────────────────────────────────────── */

  SVOps.views.runs = function (container, user, params) {
    var page = el('div', { class: 'ops-content' });
    if (params && params[0]) { return runDetail(container, user, params[0]); }

    page.appendChild(frag('<div class="ops-pagehead"><p class="ops-label">Previous Runs</p>' +
      '<h1 class="ops-h1">Batch history, outputs, exceptions, and audit</h1>' +
      '<p class="ops-lede">Search prior batches and open their outputs, audit history, and errors. ' +
      'Completed batches are never silently overwritten — controlled reruns create a new batch version.</p></div>'));

    var all = S.getBatches();
    /* Employees see only their own batches; operations/admin/auditor see all. */
    if (!R.can(user.role, 'viewAllBatches')) {
      all = all.filter(function (b) { return b.submittedBy === user.name; });
    }

    var filters = el('div', { class: 'filters' });
    var qUser = el('input', { type: 'search', placeholder: 'Submitted by' });
    var qProc = el('select', {}); qProc.appendChild(el('option', { value: '', text: 'All processes' }));
    S.getSavedProcesses().forEach(function (p) { qProc.appendChild(el('option', { value: p.processName, text: p.processName })); });
    var qStatus = el('select', {}); qStatus.appendChild(el('option', { value: '', text: 'All statuses' }));
    ['Complete', 'Review Required', 'Awaiting Approval', 'Failed', 'Failed Reconciliation'].forEach(function (s) {
      qStatus.appendChild(el('option', { value: s, text: s })); });
    var qType = el('select', {}); qType.appendChild(el('option', { value: '', text: 'All source types' }));
    ['csv', 'xlsx', 'xls'].forEach(function (t) { qType.appendChild(el('option', { value: t, text: t.toUpperCase() })); });
    filters.appendChild(el('div', { class: 'fld' }, [el('label', { text: 'User' }), qUser]));
    filters.appendChild(el('div', { class: 'fld' }, [el('label', { text: 'Process' }), qProc]));
    filters.appendChild(el('div', { class: 'fld' }, [el('label', { text: 'Status' }), qStatus]));
    filters.appendChild(el('div', { class: 'fld' }, [el('label', { text: 'Source' }), qType]));
    page.appendChild(filters);

    var host = el('div');
    page.appendChild(host);

    function draw() {
      host.innerHTML = '';
      var rows = all.filter(function (b) {
        if (qUser.value && b.submittedBy.toLowerCase().indexOf(qUser.value.toLowerCase()) === -1) return false;
        if (qProc.value && b.savedProcessName !== qProc.value) return false;
        if (qStatus.value && b.status !== qStatus.value) return false;
        if (qType.value && b.fileType !== qType.value) return false;
        return true;
      });
      host.appendChild(U.table([
        { key: 'batchId', label: 'Batch ID', html: function (b) { return '<span class="ops-mono">' + esc(b.batchId) + '</span>'; } },
        { key: 'submittedAt', label: 'Date', html: function (b) { return esc(U.fmtDate(b.submittedAt)); } },
        { key: 'submittedBy', label: 'Submitted by', html: function (b) { return esc(b.submittedBy); } },
        { key: 'originalFilename', label: 'Source file', html: function (b) { return esc(b.originalFilename); } },
        { key: 'savedProcessName', label: 'Process', html: function (b) { return esc(b.savedProcessName); } },
        { key: 'status', label: 'Status', html: function (b) { return U.statusHtml(b.status); } },
        { key: 'totalRows', label: 'Rows', num: true, html: function (b) { return U.fmtInt(b.totalRows); } },
        { key: 'exceptions', label: 'Exceptions', num: true, html: function (b) { return U.fmtInt(b.reviewRows + b.invalidRows + b.blockedRows + b.duplicateRows); } },
        { key: 'rulesVersion', label: 'Rules', html: function (b) { return esc(b.rulesVersion); } }
      ], rows, { emptyText: 'No batches match these filters.', onRowClick: function (b) { location.hash = '#/runs/' + b.batchId; } }));
    }
    [qUser, qProc, qStatus, qType].forEach(function (c) { c.addEventListener('input', draw); c.addEventListener('change', draw); });
    draw();
    container.appendChild(page);
  };

  function runDetail(container, user, batchId) {
    var batch = S.getBatch(batchId);
    var page = el('div', { class: 'ops-content' });
    if (!batch) {
      page.appendChild(U.stateScreen('error', 'Batch not found', 'No batch "' + batchId + '" in this environment.'));
      container.appendChild(page);
      return;
    }
    page.appendChild(frag('<div class="ops-pagehead"><p class="ops-label">Previous Runs</p>' +
      '<h1 class="ops-h1">' + esc(batch.originalFilename) + '</h1>' +
      '<p class="ops-meta"><span class="ops-mono">' + esc(batch.batchId) + '</span> · version ' + batch.batchVersion +
      ' · ' + esc(U.fmtDateTime(batch.submittedAt)) + ' · ' + esc(batch.submittedBy) + '</p></div>'));

    var actions = el('div', { class: 'ops-actions', style: 'margin-bottom:18px' });
    actions.appendChild(el('a', { class: 'btn', href: '#/batch/' + batchId, text: 'Open batch status' }));
    if (batch.reviewRows || batch.invalidRows || batch.blockedRows) {
      actions.appendChild(el('a', { class: 'btn', href: '#/exceptions/' + batchId, text: 'Review errors' }));
    }
    if (R.can(user.role, 'processBatches')) {
      actions.appendChild(actionBtn('Retry failed system steps', function () {
        if (batch.status !== 'Failed') { U.toast('This batch has no failed system steps to retry.'); return; }
        S.updateBatch(batchId, { status: R.BATCH_STATUS.APPLYING_RULES }, user.name, 'RetryRequested', 'Retry of failed system steps requested.');
        U.toast('Retry queued (demonstration). In production this re-invokes the failed flow steps idempotently.');
        rerender();
      }));
      actions.appendChild(actionBtn('Regenerate output workbook', function () {
        var res = W.regenerateWorkbook(batchId, user);
        U.toast(res.ok ? 'Output workbook regenerated.' : res.reason);
        rerender();
      }));
      actions.appendChild(actionBtn('Reprocess corrected rows (new version)', function () {
        W.newBatchVersion(batchId, user, 'New batch version for reprocessing corrected rows.');
        U.toast('New batch version created. Approvals reset; corrected rows can be reprocessed.');
        rerender();
      }));
    }
    var src = S.getSourceFile(batchId);
    if (src && src.rows) {
      actions.appendChild(actionBtn('Download source file', function () {
        var lines = [(['Row'].concat(src.headers)).join(',')].concat(
          src.rows.map(function (r) { return ([r.n].concat(r.cells)).join(','); }));
        downloadText('source-' + batchId + '.csv', lines.join('\n'));
      }));
    }
    page.appendChild(actions);

    /* Config snapshot (immutable record) */
    var snap = el('div', { class: 'ops-panel' });
    snap.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Configuration snapshot</h2>' +
      '<span class="ops-meta">Versions in effect when this batch ran</span></div>'));
    var kv = el('div', { class: 'kv' });
    row(kv, 'Rules version', batch.rulesVersion);
    row(kv, 'Template version', batch.templateVersion);
    row(kv, 'App version', batch.appVersion);
    row(kv, 'Flow version', batch.flowVersion);
    row(kv, 'Batch version', String(batch.batchVersion));
    row(kv, 'File hash', batch.fileHash || '—');
    snap.appendChild(kv);
    page.appendChild(snap);

    /* Audit history */
    var audit = el('div', { class: 'ops-panel' });
    audit.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Audit history</h2></div>'));
    var events = S.auditForBatch(batchId);
    audit.appendChild(U.table([
      { key: 'performedAt', label: 'Time', html: function (a) { return esc(U.fmtDateTime(a.performedAt)); } },
      { key: 'eventType', label: 'Event', html: function (a) { return '<strong>' + esc(a.eventType) + '</strong>'; } },
      { key: 'performedBy', label: 'By', html: function (a) { return esc(a.performedBy); } },
      { key: 'rowId', label: 'Row', html: function (a) { return a.rowId ? '<span class="ops-mono">' + esc(a.rowId.slice(-6)) + '</span>' : '—'; } },
      { key: 'reason', label: 'Detail', html: function (a) { return esc(a.reason || a.newValue || '—'); } }
    ], events, { emptyText: 'No audit events.' }));
    page.appendChild(audit);

    container.appendChild(page);
  }

  function actionBtn(label, onClick) {
    return el('button', { class: 'btn', text: label, onclick: onClick });
  }

  /* ── Administration ────────────────────────────────────────────────────── */

  var ADMIN_SECTIONS = [
    { key: 'templates', label: 'Email templates', config: 'templates' },
    { key: 'owners', label: 'Coverage owners', config: 'owners' },
    { key: 'regions', label: 'Regions', config: 'regions' },
    { key: 'funds', label: 'Funds', config: 'funds' },
    { key: 'campaigns', label: 'Campaigns', config: 'campaigns' },
    { key: 'blockedDomains', label: 'Blocked domains', config: 'blockedDomains' },
    { key: 'suppressedEmails', label: 'Suppression list', config: 'suppressedEmails' },
    { key: 'previousOutreach', label: 'Previous outreach', config: 'previousOutreach' },
    { key: 'columnAliases', label: 'Column aliases', config: null },
    { key: 'requiredColumns', label: 'Required columns', config: 'requiredColumns' },
    { key: 'matching', label: 'Matching thresholds', config: 'salesforceMatchThreshold' },
    { key: 'processes', label: 'Saved processes', config: null },
    { key: 'roles', label: 'User roles', config: null },
    { key: 'connections', label: 'Connection status', config: null }
  ];

  SVOps.views.admin = function (container, user, params) {
    if (!R.can(user.role, 'administer')) {
      container.appendChild(U.permissionDenied('administration'));
      return;
    }
    var page = el('div', { class: 'ops-content' });
    page.appendChild(frag('<div class="ops-pagehead"><p class="ops-label">Administration</p>' +
      '<h1 class="ops-h1">Approved templates, owners, rules, and permissions</h1>' +
      '<p class="ops-lede">Every configuration change is written to the audit log. If configuration changes after a batch ' +
      'has been approved, that batch is flagged for revalidation before it can execute.</p></div>'));

    var section = (params && params[0]) || 'templates';
    var subnav = el('div', { class: 'subnav' });
    ADMIN_SECTIONS.forEach(function (s) {
      subnav.appendChild(el('a', { class: section === s.key ? 'is-active' : '', href: '#/admin/' + s.key, text: s.label }));
    });
    page.appendChild(subnav);

    var host = el('div');
    page.appendChild(host);
    renderAdminSection(host, section, user);
    container.appendChild(page);
  };

  function renderAdminSection(host, section, user) {
    if (section === 'processes') return adminProcesses(host, user);
    if (section === 'roles') return adminRoles(host, user);
    if (section === 'connections') return adminConnections(host, user);
    if (section === 'columnAliases') return adminAliases(host, user);
    if (section === 'owners') return adminOwners(host, user);
    if (section === 'templates') return adminTemplates(host, user);
    if (section === 'matching') return adminScalar(host, user, 'salesforceMatchThreshold', 'Salesforce match threshold', 'A value between 0 and 1. Higher requires stronger matches before a row is treated as an existing contact.');
    if (section === 'requiredColumns') return adminList(host, user, 'requiredColumns', 'Required columns', 'Fields that must be mapped before a file can be processed.');
    /* Simple list-backed sections */
    var def = ADMIN_SECTIONS.filter(function (s) { return s.key === section; })[0];
    return adminList(host, user, def.config, def.label, 'Managed list. Changes are audited and may require batch revalidation.');
  }

  function adminList(host, user, configKey, label, help) {
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">' + esc(label) + '</h2></div>'));
    panel.appendChild(el('p', { class: 'ops-meta', style: 'margin:0 0 12px', text: help }));
    var values = S.getConfig(configKey, []);
    if (!Array.isArray(values)) values = [];

    var list = el('div', { class: 'kv' });
    if (!values.length) list.appendChild(el('div', {}, [el('span', { class: 'ops-meta', text: 'Empty.' })]));
    values.forEach(function (v, i) {
      var rowNode = el('div', {}, [
        el('span', { class: 'k', text: '#' + (i + 1) }),
        el('span', { html: esc(typeof v === 'string' ? v : JSON.stringify(v)) })
      ]);
      var rm = el('button', { class: 'btn btn--sm btn--danger', text: 'Remove', style: 'margin-left:auto', onclick: function () {
        var next = values.slice(); next.splice(i, 1);
        S.setConfig(configKey, next, user.name, 'Removed entry from ' + label + '.');
        rerender();
      } });
      rowNode.appendChild(rm);
      list.appendChild(rowNode);
    });
    panel.appendChild(list);

    var input = el('input', { type: 'text', placeholder: 'Add new value' });
    var add = el('button', { class: 'btn btn--sm', text: 'Add', onclick: function () {
      if (!input.value.trim()) return;
      var next = values.concat([input.value.trim()]);
      S.setConfig(configKey, next, user.name, 'Added entry to ' + label + '.');
      rerender();
    } });
    panel.appendChild(el('div', { class: 'ops-actions', style: 'margin-top:12px' }, [input, add]));
    host.appendChild(panel);
  }

  function adminScalar(host, user, key, label, help) {
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">' + esc(label) + '</h2></div>'));
    panel.appendChild(el('p', { class: 'ops-meta', style: 'margin:0 0 12px', text: help }));
    var input = el('input', { type: 'text', value: String(S.getConfig(key, '')) });
    var save = el('button', { class: 'btn btn--sm', text: 'Save', onclick: function () {
      S.setConfig(key, input.value.trim(), user.name, label + ' updated.');
      U.toast(label + ' saved.');
      rerender();
    } });
    panel.appendChild(el('div', { class: 'ops-actions' }, [input, save]));
    host.appendChild(panel);
  }

  function adminOwners(host, user) {
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Coverage owners</h2></div>'));
    var owners = S.getConfig('owners', []);
    panel.appendChild(U.table([
      { key: 'name', label: 'Owner' },
      { key: 'regions', label: 'Regions', html: function (o) { return esc((o.regions || []).join(', ')); } }
    ], owners, { emptyText: 'No owners configured.' }));

    var name = el('input', { type: 'text', placeholder: 'Owner name' });
    var regions = el('input', { type: 'text', placeholder: 'Regions (comma-separated, e.g. Asia)' });
    var add = el('button', { class: 'btn btn--sm', text: 'Add owner', onclick: function () {
      if (!name.value.trim()) return;
      var next = owners.concat([{ name: name.value.trim(), regions: regions.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean) }]);
      S.setConfig('owners', next, user.name, 'Added coverage owner ' + name.value.trim() + '.');
      rerender();
    } });
    panel.appendChild(el('div', { class: 'ops-actions', style: 'margin-top:12px' }, [name, regions, add]));
    host.appendChild(panel);
  }

  function adminTemplates(host, user) {
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Approved email templates</h2></div>'));
    var templates = S.getConfig('templates', []);
    panel.appendChild(U.table([
      { key: 'id', label: 'ID', html: function (t) { return '<span class="ops-mono">' + esc(t.id) + '</span>'; } },
      { key: 'name', label: 'Name' },
      { key: 'version', label: 'Version' },
      { key: 'approved', label: 'Approved', html: function (t) { return t.approved ? U.statusHtml('Approved', 'st--ok') : U.statusHtml('Draft', 'st--warn'); } }
    ], templates, { emptyText: 'No templates.' }));
    panel.appendChild(el('p', { class: 'ops-meta', style: 'margin-top:10px', text:
      'Template bodies are stored in SharePoint and versioned; only approved templates can be selected for a run. Template version ' + S.TEMPLATE_VERSION + '.' }));
    host.appendChild(panel);
  }

  function adminAliases(host, user) {
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Column aliases</h2></div>'));
    panel.appendChild(el('p', { class: 'ops-meta', style: 'margin:0 0 12px', text:
      'Approved aliases map source column names to canonical fields. Built-in aliases always apply; additions here extend them.' }));
    var built = R.COLUMN_ALIASES;
    var rows = Object.keys(built).map(function (f) { return { field: f, aliases: built[f].join(', ') }; });
    panel.appendChild(U.table([
      { key: 'field', label: 'Canonical field' },
      { key: 'aliases', label: 'Recognized aliases (built-in)' }
    ], rows));
    host.appendChild(panel);
  }

  function adminProcesses(host, user) {
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Saved processes</h2></div>'));
    panel.appendChild(U.table([
      { key: 'processName', label: 'Process' },
      { key: 'description', label: 'Description', html: function (p) { return esc(p.description); } },
      { key: 'rulesVersion', label: 'Rules' },
      { key: 'active', label: 'Active', html: function (p) { return p.active ? U.statusHtml('Active', 'st--ok') : U.statusHtml('Inactive', 'st--neutral'); } }
    ], S.getSavedProcesses(), { emptyText: 'No saved processes.' }));
    panel.appendChild(el('p', { class: 'ops-meta', style: 'margin-top:10px', text:
      'Saved processes populate default rules and settings but never pre-enable external actions or disable dry run.' }));
    host.appendChild(panel);
  }

  function adminRoles(host, user) {
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Roles and permissions</h2>' +
      '<span class="ops-meta">Mapped from Microsoft Entra ID app roles</span></div>'));
    var caps = ['submitFiles', 'viewAllBatches', 'processBatches', 'reviewExceptions', 'approveCoverage', 'approveExecution', 'administer', 'viewAudit', 'viewMonitoring'];
    var capLabels = { submitFiles: 'Submit', viewAllBatches: 'View all', processBatches: 'Process', reviewExceptions: 'Review', approveCoverage: 'Owner approve', approveExecution: 'Exec approve', administer: 'Admin', viewAudit: 'Audit', viewMonitoring: 'Monitor' };
    var roles = Object.keys(R.PERMISSIONS);
    var cols = [{ key: 'role', label: 'Role', html: function (r) { return '<strong>' + esc(r.role) + '</strong>'; } }];
    caps.forEach(function (c) {
      cols.push({ key: c, label: capLabels[c], html: function (r) { return R.PERMISSIONS[r.role][c] ? '✓' : '<span class="ops-meta">—</span>'; } });
    });
    panel.appendChild(U.table(cols, roles.map(function (r) { return { role: r }; })));
    panel.appendChild(el('p', { class: 'ops-meta', style: 'margin-top:10px', text:
      'Role assignment is managed in Entra ID (app-role assignment to security groups). The portal reads role claims from the signed-in token; it does not grant access itself.' }));
    host.appendChild(panel);
  }

  function adminConnections(host, user) {
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Connection status</h2>' +
      '<span class="ops-meta">Pre-flight health of managed connections</span></div>'));
    var placeholder = el('div');
    placeholder.appendChild(U.stateScreen('loading', 'Checking connections', 'Running pre-flight checks…'));
    panel.appendChild(placeholder);
    host.appendChild(panel);

    I.preflightAll().then(function (report) {
      placeholder.innerHTML = '';
      placeholder.appendChild(U.table([
        { key: 'name', label: 'Connection' },
        { key: 'ok', label: 'Status', html: function (r) { return r.ok ? U.statusHtml('Available', 'st--ok') : U.statusHtml('Unavailable', 'st--fail'); } },
        { key: 'detail', label: 'Detail', html: function (r) { return esc(r.detail); } }
      ], report.results));
      placeholder.appendChild(U.notice(report.allOk ? 'ok' : 'warn',
        report.allOk ? '<strong>All required connections available.</strong> Execution is permitted (subject to approvals).'
        : '<strong>One or more connections are unavailable.</strong> Execution is disabled until connections are restored.'));
      if (I.demoMode()) {
        placeholder.appendChild(U.notice('info', '<strong>Demonstration mode.</strong> Connections are simulated locally. ' +
          'Resolve the placeholders in <span class="ops-mono">portal-config.js</span> and set mode to "production" to connect to the tenant.'));
      }
    });
  }

  /* ── Monitoring (Administrator dashboard) ──────────────────────────────── */

  SVOps.views.monitoring = function (container, user) {
    if (!R.can(user.role, 'viewMonitoring')) {
      container.appendChild(U.permissionDenied('monitoring'));
      return;
    }
    var page = el('div', { class: 'ops-content' });
    page.appendChild(frag('<div class="ops-pagehead"><p class="ops-label">Monitoring</p>' +
      '<h1 class="ops-h1">Operational health and alerts</h1></div>'));

    var batches = S.getBatches();
    var stuckMin = Number(S.getConfig('stuckBatchMinutes', 30));
    var now = Date.now();
    var processing = batches.filter(function (b) { return R.PROCESSING_STAGES.indexOf(b.currentStage) !== -1 && b.status !== 'Complete'; });
    var stuck = processing.filter(function (b) { return (now - new Date(b.updatedAt).getTime()) > stuckMin * 60000; });
    var failed = batches.filter(function (b) { return b.status === 'Failed'; });
    var reconFail = batches.filter(function (b) { return b.status === 'Failed Reconciliation'; });
    var awaitingReview = batches.reduce(function (n, b) { return n + b.reviewRows; }, 0);

    var stats = el('div', { class: 'ops-stats', style: 'margin-bottom:18px' });
    [['Processing', processing.length], ['Stuck > ' + stuckMin + 'm', stuck.length],
     ['Failed', failed.length], ['Reconciliation failures', reconFail.length],
     ['Rows awaiting review', awaitingReview], ['Total batches', batches.length]].forEach(function (p) {
      stats.appendChild(el('div', { class: 'ops-stat' }, [
        el('p', { class: 'ops-stat__k', text: p[0] }),
        el('p', { class: 'ops-stat__v', text: U.fmtInt(p[1]) })
      ]));
    });
    page.appendChild(stats);

    /* Alerts */
    var alerts = S.getAlerts();
    var alertPanel = el('div', { class: 'ops-panel' });
    alertPanel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Alerts</h2></div>'));
    if (!alerts.length) {
      alertPanel.appendChild(el('p', { class: 'ops-meta', text: 'No alerts raised.' }));
    } else {
      alertPanel.appendChild(U.table([
        { key: 'severity', label: 'Severity', html: function (a) { return U.statusHtml(a.severity, a.severity === 'critical' ? 'st--fail' : 'st--warn'); } },
        { key: 'kind', label: 'Alert' },
        { key: 'detail', label: 'Detail', html: function (a) { return esc(a.detail); } },
        { key: 'raisedAt', label: 'Raised', html: function (a) { return esc(U.fmtDateTime(a.raisedAt)); } },
        { key: 'ack', label: '', html: function (a) { return a.acknowledged ? '<span class="ops-meta">Acknowledged</span>' : ''; } }
      ], alerts));
    }
    page.appendChild(alertPanel);

    /* Error rate by code */
    var logs = S.getErrorLogs();
    var byCode = {};
    logs.forEach(function (l) { byCode[l.errorCode] = (byCode[l.errorCode] || 0) + 1; });
    var errPanel = el('div', { class: 'ops-panel' });
    errPanel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Error rate by code</h2></div>'));
    var codeRows = Object.keys(byCode).map(function (c) { return { code: c, count: byCode[c] }; });
    errPanel.appendChild(U.table([
      { key: 'code', label: 'Error code', html: function (r) { return '<span class="ops-mono">' + esc(r.code) + '</span>'; } },
      { key: 'count', label: 'Occurrences', num: true }
    ], codeRows, { emptyText: 'No system errors logged.' }));
    page.appendChild(errPanel);

    /* Volume by process + last E2E test */
    var byProc = {};
    batches.forEach(function (b) { byProc[b.savedProcessName] = (byProc[b.savedProcessName] || 0) + 1; });
    var volPanel = el('div', { class: 'ops-panel' });
    volPanel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Volume by process</h2></div>'));
    volPanel.appendChild(U.table([
      { key: 'proc', label: 'Process' },
      { key: 'count', label: 'Batches', num: true }
    ], Object.keys(byProc).map(function (p) { return { proc: p, count: byProc[p] }; }), { emptyText: 'No batches yet.' }));
    volPanel.appendChild(el('p', { class: 'ops-meta', style: 'margin-top:10px', text:
      'Last successful end-to-end test: ' + (S.load().lastEndToEndTest ? U.fmtDateTime(S.load().lastEndToEndTest) : 'not run in this environment') + '.' }));
    page.appendChild(volPanel);

    container.appendChild(page);
  };

  /* ── Weekly Reporting / Salesforce Data Quality / Outreach Preparation ─── */

  function moduleLauncher(title, label, lede, processName, checklist) {
    return function (container, user) {
      var page = el('div', { class: 'ops-content ops-content--narrow' });
      page.appendChild(el('div', { class: 'ops-pagehead' }, [
        el('p', { class: 'ops-label', text: label }),
        el('h1', { class: 'ops-h1', text: title }),
        el('p', { class: 'ops-lede', text: lede })
      ]));
      var panel = el('div', { class: 'ops-panel' });
      panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">What this process does</h2></div>'));
      var ul = el('ul', { style: 'margin:0;padding-left:18px;color:var(--ops-body);font:400 14px/1.7 var(--ops-font)' });
      checklist.forEach(function (c) { ul.appendChild(el('li', { text: c })); });
      panel.appendChild(ul);
      page.appendChild(panel);

      var proc = S.getSavedProcesses().filter(function (p) { return p.processName === processName; })[0];
      var actions = el('div', { class: 'ops-actions' });
      var start = el('button', { class: 'btn btn--primary', text: 'Start ' + label + ' run', onclick: function () {
        if (!R.can(user.role, 'submitFiles')) { U.toast('Your role cannot submit files.'); return; }
        SVOps.state.wizardPreset = proc ? proc.processId : null;
        location.hash = '#/process';
      } });
      actions.appendChild(start);
      actions.appendChild(el('a', { class: 'btn', href: '#/runs', text: 'View previous runs' }));
      page.appendChild(actions);
      page.appendChild(U.notice('info', 'This launches Process a List with the "' + esc(processName) + '" saved process pre-selected. ' +
        'You confirm the interpretation and settings before anything runs.'));
      container.appendChild(page);
    };
  }

  SVOps.views.weekly = moduleLauncher(
    'Weekly Outreach and Coverage Snapshot', 'Weekly Reporting',
    'Generate the ShoreVest Weekly Outreach and Coverage Snapshot from approved source data.',
    'Weekly Outreach and Coverage Snapshot',
    ['Reads approved source data for the reporting period.',
     'Matches against Salesforce for coverage and ownership.',
     'Excludes previous outreach and blocked records.',
     'Produces the controlled snapshot workbook for review.']);

  SVOps.views.dataquality = moduleLauncher(
    'Salesforce Data Quality', 'Salesforce Data Quality',
    'Run contact, account, opportunity, ownership, next-step, stale-record, and data-completeness checks.',
    'Salesforce Contact Quality Audit',
    ['Contact and account completeness and formatting checks.',
     'Opportunity ownership and next-step presence.',
     'Stale-record detection against the configured thresholds.',
     'No outreach output — findings route to Review Exceptions.']);

  SVOps.views.outreach = moduleLauncher(
    'Outreach Preparation', 'Outreach Preparation',
    'Prepare outreach review files, identify existing contacts, exclude prior outreach, assign coverage, and generate draft-ready outputs.',
    'Existing Contact Reconnect',
    ['Identifies existing Salesforce contacts and accounts.',
     'Excludes prior outreach and suppressed recipients.',
     'Assigns coverage by region rules or your instruction.',
     'Generates a draft-ready review workbook (no emails sent without approval).']);

  /* ── helpers ───────────────────────────────────────────────────────────── */
  function row(kv, k, v) { kv.appendChild(el('div', {}, [el('span', { class: 'k', text: k }), el('span', { html: esc(v) })])); }
  function downloadText(name, text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

})(typeof self !== 'undefined' ? self : this);
