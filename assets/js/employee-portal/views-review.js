/* ==========================================================================
   ShoreVest Operations — Review Exceptions view
   Table-based review of ambiguous, invalid, duplicate, blocked, or
   unmatched records, with a per-row detail drawer and controlled decisions.
   Decisions are recorded with reviewer, timestamp, before/after values,
   reason, and batch version. An edited spreadsheet cell is never treated
   as approval.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var R = root.SVPortalRules;
  var S = root.SVPortalStore;
  var el = U.el, esc = U.esc;

  function rerender() { root.dispatchEvent(new CustomEvent('svops:render')); }

  SVOps.views.exceptions = function (container, user, params) {
    if (!R.can(user.role, 'reviewExceptions')) {
      container.appendChild(U.permissionDenied('review exceptions'));
      return;
    }
    var page = el('div', { class: 'ops-content' });
    var batchId = params[0] || null;

    page.appendChild(frag('<div class="ops-pagehead"><p class="ops-label">Review Exceptions</p>' +
      '<h1 class="ops-h1">Resolve records that could not proceed automatically</h1>' +
      '<p class="ops-lede">Every ambiguous, invalid, duplicate, blocked, or unmatched record is listed here. ' +
      'Resolving an exception records the reviewer, the decision, the reason, and the before and after values.</p></div>'));

    /* Batch scope selector */
    var batches = S.getBatches().filter(function (b) {
      return S.getRows(b.batchId).some(function (r) { return r.reviewStatus === 'Pending' || r.classification !== R.CLASSIFICATION.READY; });
    });
    if (!batches.length) {
      page.appendChild(U.stateScreen('empty', 'No exceptions to review',
        'When a batch produces records that require review, they will appear here.'));
      container.appendChild(page);
      return;
    }
    if (!batchId) batchId = batches[0].batchId;
    var batch = S.getBatch(batchId);

    var scope = U.fieldSelect('exc-batch', 'Batch',
      batches.map(function (b) { return { value: b.batchId, label: b.originalFilename + ' — ' + b.batchId }; }),
      batchId, { onchange: function (e) { location.hash = '#/exceptions/' + e.target.value; } });
    var filterState = el('select', { 'aria-label': 'Filter by status' });
    ['All exceptions', R.CLASSIFICATION.REVIEW_REQUIRED, R.CLASSIFICATION.INVALID,
     R.CLASSIFICATION.DUPLICATE, R.CLASSIFICATION.BLOCKED, R.CLASSIFICATION.SYSTEM_ERROR]
      .forEach(function (opt) { filterState.appendChild(el('option', { value: opt, text: opt })); });

    var filters = el('div', { class: 'filters' });
    scope.style.minWidth = '260px';
    filters.appendChild(scope);
    filters.appendChild(el('div', { class: 'fld' }, [el('label', { text: 'Status' }), filterState]));
    page.appendChild(filters);

    var tableHost = el('div');
    page.appendChild(tableHost);

    function draw() {
      tableHost.innerHTML = '';
      var rows = S.getRows(batchId).filter(function (r) { return r.classification !== R.CLASSIFICATION.READY; });
      var f = filterState.value;
      if (f && f !== 'All exceptions') rows = rows.filter(function (r) { return r.classification === f; });

      var pending = S.getRows(batchId).filter(function (r) { return r.reviewStatus === 'Pending'; }).length;
      tableHost.appendChild(U.notice(pending ? 'warn' : 'ok',
        pending ? '<strong>' + pending + ' record(s) still require a review decision.</strong> ' +
          'All must be resolved before the batch can be approved for any consequential action.'
        : '<strong>All exceptions resolved.</strong> This batch can proceed to approval.'));

      tableHost.appendChild(U.table([
        { key: 'originalRowNumber', label: 'Row', num: true },
        { key: 'contactName', label: 'Contact', html: function (r) { return esc(r.contactName || '—'); } },
        { key: 'company', label: 'Company', html: function (r) { return esc(r.company || '—'); } },
        { key: 'email', label: 'Email', html: function (r) { return '<span class="ops-mono">' + esc(r.email || '—') + '</span>'; } },
        { key: 'country', label: 'Country', html: function (r) { return esc(r.country || '—'); } },
        { key: 'classification', label: 'Exception', html: function (r) { return U.statusHtml(r.classification); } },
        { key: 'errorCode', label: 'Code', html: function (r) { return r.errorCode ? '<span class="ops-mono">' + esc(r.errorCode) + '</span>' : '—'; } },
        { key: 'proposedOwner', label: 'Owner', html: function (r) { return esc(r.proposedOwner || r.currentOwner || '—'); } },
        { key: 'reviewStatus', label: 'Review', html: function (r) {
          var cls = r.reviewStatus === 'Approved' ? 'st--ok' : (r.reviewStatus === 'Rejected' || r.reviewStatus === 'Blocked' ? 'st--fail' : (r.reviewStatus === 'Deferred' ? 'st--neutral' : 'st--warn'));
          return U.statusHtml(r.reviewStatus, cls);
        } }
      ], rows, { emptyText: 'No records match this filter.', onRowClick: function (r) { openDetail(batchId, r.rowId, user); } }));
    }
    filterState.addEventListener('change', draw);
    draw();

    container.appendChild(page);
  };

  function frag(html) { return U.frag(html); }

  function openDetail(batchId, rowId, user) {
    var row = S.getRow(batchId, rowId);
    var batch = S.getBatch(batchId);
    if (!row) return;
    var raw = safeParse(row.rawDataJson, {});
    var norm = safeParse(row.normalisedDataJson, {});
    var exceptions = safeParse(row.exceptionsJson, []);

    var bodyNode = el('div');

    /* Reason for review + warning flags */
    var exWrap = el('section');
    exWrap.appendChild(el('h4', { text: 'Reason for review' }));
    if (exceptions.length) {
      exceptions.forEach(function (ex) {
        exWrap.appendChild(U.notice(ex.category === R.CLASSIFICATION.BLOCKED || ex.category === R.CLASSIFICATION.INVALID ? 'error' : 'warn',
          '<strong>' + esc(ex.code) + '</strong> — ' + esc(ex.message) + '<span class="ops-meta" style="display:block;margin-top:3px">Proposed resolution: ' + esc(ex.resolution) + '</span>'));
      });
    } else {
      exWrap.appendChild(el('p', { class: 'ops-meta', text: 'No exceptions on record.' }));
    }
    bodyNode.appendChild(exWrap);

    /* Salesforce match + prior activity */
    var sf = el('section');
    sf.appendChild(el('h4', { text: 'Salesforce match' }));
    var sfdl = el('dl', { class: 'facts' });
    kv(sfdl, 'Match status', esc(row.matchStatus));
    kv(sfdl, 'Contact', esc(row.salesforceContactId || '—'));
    kv(sfdl, 'Account', esc(row.salesforceAccountName || row.salesforceAccountId || '—'));
    kv(sfdl, 'Current owner', esc(row.currentOwner || '—'));
    kv(sfdl, 'Proposed owner', esc(row.proposedOwner || '—'));
    kv(sfdl, 'Proposed action', esc(row.proposedAction || '—'));
    sf.appendChild(sfdl);
    bodyNode.appendChild(sf);

    /* Raw vs normalised */
    var data = el('section');
    data.appendChild(el('h4', { text: 'Raw and normalised data' }));
    var ddl = el('dl', { class: 'facts' });
    kv(ddl, 'Row number', String(row.originalRowNumber));
    Object.keys(raw).slice(0, 12).forEach(function (k) { kv(ddl, k, esc(raw[k])); });
    data.appendChild(ddl);
    data.appendChild(el('p', { class: 'ops-meta', style: 'margin-top:8px', text:
      'Normalised — name: ' + (norm.firstName || '') + ' ' + (norm.lastName || '') + ' · company: ' +
      (norm.company || '') + ' · email: ' + (norm.email || '') }));
    bodyNode.appendChild(data);

    /* Approval history */
    var hist = el('section');
    hist.appendChild(el('h4', { text: 'Review and approval history' }));
    var events = S.auditForBatch(batchId).filter(function (a) { return a.rowId === rowId; });
    if (events.length) {
      var ul = el('div', { class: 'kv' });
      events.forEach(function (e) {
        ul.appendChild(el('div', {}, [
          el('span', { class: 'k', text: U.fmtDateTime(e.performedAt) }),
          el('span', { html: '<strong>' + esc(e.eventType) + '</strong> — ' + esc(e.performedBy) + (e.reason ? '<br><span class="ops-meta">' + esc(e.reason) + '</span>' : '') })
        ]));
      });
      hist.appendChild(ul);
    } else {
      hist.appendChild(el('p', { class: 'ops-meta', text: 'No review actions recorded yet.' }));
    }
    bodyNode.appendChild(hist);

    /* Decision controls */
    var dec = el('section');
    dec.appendChild(el('h4', { text: 'Review decision' }));
    if (row.classification === R.CLASSIFICATION.BLOCKED) {
      dec.appendChild(U.notice('error', '<strong>Blocked records cannot be approved for outreach here.</strong> ' +
        'Suppression, blocked domains, and blocked accounts are managed in Administration and cannot be overridden in review.'));
    }

    var correctFields = null;
    var reasonInput = el('input', { type: 'text', placeholder: 'Reason (recorded with the decision)' });
    var ownerSelect = el('select', {});
    ownerSelect.appendChild(el('option', { value: '', text: 'Reassign to…' }));
    S.getConfig('owners', []).forEach(function (o) { ownerSelect.appendChild(el('option', { value: o.name, text: o.name })); });

    var decisionSelect = el('select', { 'aria-label': 'Decision' });
    var available = R.REVIEW_DECISIONS.filter(function (d) {
      if (row.classification === R.CLASSIFICATION.BLOCKED) return ['Reject', 'Mark Duplicate', 'Defer', 'Block'].indexOf(d) !== -1;
      return true;
    });
    decisionSelect.appendChild(el('option', { value: '', text: 'Select decision…' }));
    available.forEach(function (d) { decisionSelect.appendChild(el('option', { value: d, text: d })); });

    var extra = el('div', { style: 'margin-top:10px' });
    decisionSelect.addEventListener('change', function () {
      extra.innerHTML = '';
      if (decisionSelect.value === 'Reassign') extra.appendChild(wrapFld('New owner', ownerSelect));
      if (decisionSelect.value === 'Correct and Approve') {
        correctFields = {
          email: el('input', { type: 'text', value: row.email || '' }),
          company: el('input', { type: 'text', value: row.company || '' }),
          contactName: el('input', { type: 'text', value: row.contactName || '' })
        };
        extra.appendChild(wrapFld('Email', correctFields.email));
        extra.appendChild(wrapFld('Company', correctFields.company));
        extra.appendChild(wrapFld('Contact name', correctFields.contactName));
      }
    });

    dec.appendChild(wrapFld('Decision', decisionSelect));
    dec.appendChild(extra);
    dec.appendChild(wrapFld('Reason', reasonInput));

    var apply = el('button', { class: 'btn btn--primary', text: 'Record decision', style: 'margin-top:12px' });
    apply.addEventListener('click', function () {
      var decision = decisionSelect.value;
      if (!decision) { U.toast('Select a decision first.'); return; }
      if (!reasonInput.value.trim() && decision !== 'Approve') { U.toast('A reason is required for this decision.'); return; }
      applyDecision(batchId, rowId, decision, {
        reason: reasonInput.value.trim(),
        newOwner: ownerSelect.value,
        corrections: correctFields ? {
          email: correctFields.email.value.trim(),
          company: correctFields.company.value.trim(),
          contactName: correctFields.contactName.value.trim()
        } : null
      }, user);
    });
    dec.appendChild(apply);
    bodyNode.appendChild(dec);

    U.drawer('Row ' + row.originalRowNumber + ' — ' + (row.contactName || row.email || 'record'), bodyNode);
  }

  function applyDecision(batchId, rowId, decision, opts, user) {
    var row = S.getRow(batchId, rowId);
    var batch = S.getBatch(batchId);
    var changes = {};
    var eventType = 'ReviewDecision';
    var reason = decision + (opts.reason ? ': ' + opts.reason : '');

    switch (decision) {
      case 'Approve':
        changes.reviewStatus = 'Approved';
        changes.classification = R.CLASSIFICATION.READY;
        break;
      case 'Correct and Approve':
        if (opts.corrections) {
          if (opts.corrections.email) changes.email = R.normaliseEmail(opts.corrections.email);
          if (opts.corrections.company) changes.company = opts.corrections.company;
          if (opts.corrections.contactName) changes.contactName = opts.corrections.contactName;
        }
        /* Re-validate the corrected email only; if still invalid, stay in review. */
        if (changes.email && !R.isValidEmail(changes.email)) {
          U.toast('The corrected email is still invalid. Decision not applied.');
          return;
        }
        changes.reviewStatus = 'Approved';
        changes.classification = R.CLASSIFICATION.READY;
        changes.errorCode = null;
        break;
      case 'Reassign':
        if (!opts.newOwner) { U.toast('Choose an owner to reassign to.'); return; }
        changes.proposedOwner = opts.newOwner;
        changes.reviewStatus = 'Approved';
        changes.classification = R.CLASSIFICATION.READY;
        reason = 'Reassigned to ' + opts.newOwner + (opts.reason ? ': ' + opts.reason : '');
        break;
      case 'Reject':
        changes.reviewStatus = 'Rejected';
        changes.classification = R.CLASSIFICATION.INVALID;
        break;
      case 'Mark Duplicate':
        changes.reviewStatus = 'Approved';
        changes.classification = R.CLASSIFICATION.DUPLICATE;
        break;
      case 'Defer':
        changes.reviewStatus = 'Deferred';
        break;
      case 'Block':
        changes.reviewStatus = 'Blocked';
        changes.classification = R.CLASSIFICATION.BLOCKED;
        break;
    }

    S.updateRow(batchId, rowId, changes, user.name, eventType, reason + ' (batch version ' + batch.batchVersion + ')');
    recount(batchId, user);
    U.toast('Decision recorded: ' + decision + '.');
    document.querySelector('.drawer-scrim') && document.querySelector('.drawer-scrim').click();
    rerender();
  }

  /* Recompute batch counts and reconciliation after a review decision. */
  function recount(batchId, user) {
    var rows = S.getRows(batchId);
    var counts = R.countByClassification(rows);
    var batch = S.getBatch(batchId);
    var rec = R.reconcile(batch.totalRows, counts);
    var pending = rows.filter(function (r) { return r.reviewStatus === 'Pending'; }).length;
    S.updateBatch(batchId, {
      readyRows: counts[R.CLASSIFICATION.READY],
      reviewRows: counts[R.CLASSIFICATION.REVIEW_REQUIRED],
      duplicateRows: counts[R.CLASSIFICATION.DUPLICATE],
      blockedRows: counts[R.CLASSIFICATION.BLOCKED],
      invalidRows: counts[R.CLASSIFICATION.INVALID],
      systemErrorRows: counts[R.CLASSIFICATION.SYSTEM_ERROR],
      reconciliationJson: JSON.stringify(rec),
      status: pending === 0 && batch.reviewRows > 0 && batch.status === R.BATCH_STATUS.REVIEW_REQUIRED
        ? R.BATCH_STATUS.AWAITING_APPROVAL : batch.status
    }, user.name, null);
  }

  function kv(dl, k, vHtml) { dl.appendChild(el('dt', { text: k })); dl.appendChild(el('dd', { html: vHtml })); }
  function wrapFld(label, control) {
    return el('div', { class: 'fld', style: 'margin-bottom:10px' }, [el('label', { text: label }), control]);
  }
  function safeParse(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }

})(typeof self !== 'undefined' ? self : this);
