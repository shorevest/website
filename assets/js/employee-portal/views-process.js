/* ==========================================================================
   ShoreVest Operations — Process a List views
   Step 1 Upload → Step 2 Saved process → Step 3 Instruction →
   Step 4 Controlled settings → Step 5 Interpretation preview →
   Batch status → Results.
   The system never executes an unconfirmed natural-language instruction.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var R = root.SVPortalRules;
  var F = root.SVPortalFiles;
  var S = root.SVPortalStore;
  var W = root.SVPortalWorkflow;
  var el = U.el, esc = U.esc;

  var FIELD_LABELS = {
    firstName: 'First name', lastName: 'Last name', fullName: 'Full name',
    company: 'Company', email: 'Email', country: 'Country', region: 'Region',
    title: 'Title', phone: 'Phone', owner: 'Owner',
    salesforceContactId: 'Salesforce Contact ID', salesforceAccountId: 'Salesforce Account ID'
  };

  function wizardState() {
    if (!SVOps.state.wizard) resetWizard();
    return SVOps.state.wizard;
  }
  function resetWizard() {
    SVOps.state.wizard = {
      step: 1,
      upload: null,
      fileProblems: [],
      savedProcess: null,
      instruction: '',
      interpretation: null,
      ownerAssignments: [],
      settings: R.defaultSettings(),
      confirming: false
    };
  }

  function vocab() {
    return {
      owners: S.getConfig('owners', []),
      regions: S.getConfig('regions', []),
      funds: S.getConfig('funds', []),
      campaigns: S.getConfig('campaigns', []),
      templates: S.getConfig('templates', [])
    };
  }

  /* ── Wizard shell ──────────────────────────────────────────────────────── */

  SVOps.views.process = function (container, user) {
    if (!R.can(user.role, 'submitFiles')) {
      container.appendChild(U.permissionDenied('submit files'));
      return;
    }
    var w = wizardState();
    var page = el('div', { class: 'ops-content' });
    page.appendChild(frag(
      '<div class="ops-pagehead"><p class="ops-label">Process a List</p>' +
      '<h1 class="ops-h1">Upload a list and generate a controlled output</h1>' +
      '<p class="ops-lede">Upload an Excel, CSV, or Salesforce report, confirm how the system has ' +
      'interpreted your request, and run a controlled process. Nothing external happens without ' +
      'explicit settings, confirmation, and approval.</p></div>'));

    var stepNames = ['Upload file', 'Saved process', 'Describe result', 'Controlled settings', 'Confirm interpretation'];
    var steps = el('ol', { class: 'steps' });
    stepNames.forEach(function (name, i) {
      var n = i + 1;
      steps.appendChild(el('li', {
        class: n === w.step ? 'is-current' : (n < w.step ? 'is-done' : ''),
        html: '<span class="n">' + (n < w.step ? '✓' : n) + '</span> ' + esc(name)
      }));
    });
    page.appendChild(steps);

    var body = el('div');
    page.appendChild(body);
    renderStep(body, user);
    container.appendChild(page);
  };

  function rerender() {
    /* Re-route to refresh the whole view. */
    root.dispatchEvent(new CustomEvent('svops:render'));
  }

  function frag(html) { return U.frag(html); }

  function renderStep(body, user) {
    var w = wizardState();
    if (w.step === 1) return stepUpload(body, user);
    if (w.step === 2) return stepSavedProcess(body, user);
    if (w.step === 3) return stepInstruction(body, user);
    if (w.step === 4) return stepSettings(body, user);
    if (w.step === 5) return stepConfirm(body, user);
  }

  function navButtons(body, opts) {
    var w = wizardState();
    var row = el('div', { class: 'ops-actions', style: 'margin-top:18px' });
    if (w.step > 1) {
      row.appendChild(el('button', { class: 'btn', text: 'Back', onclick: function () { w.step--; rerender(); } }));
    }
    if (opts && opts.next) {
      var next = el('button', { class: 'btn btn--primary', text: opts.nextLabel || 'Continue' });
      if (opts.nextDisabled) next.disabled = true;
      next.addEventListener('click', opts.next);
      row.appendChild(next);
    }
    row.appendChild(el('button', { class: 'btn btn--quiet', text: 'Cancel', onclick: function () {
      resetWizard(); location.hash = '#/dashboard';
    } }));
    if (opts && opts.note) row.appendChild(el('p', { class: 'btn-note', text: opts.note }));
    body.appendChild(row);
  }

  /* ── Step 1: Upload ────────────────────────────────────────────────────── */

  function stepUpload(body, user) {
    var w = wizardState();
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Step 1 — Upload a file</h2>' +
      '<span class="ops-meta">Accepted: .xlsx · .xls · .csv</span></div>'));

    var input = el('input', { type: 'file', accept: '.xlsx,.xls,.csv' });
    var drop = el('div', { class: 'drop', role: 'button', tabindex: '0', 'aria-label': 'Upload file' }, [
      el('p', { class: 'drop__title', text: 'Drop Excel, CSV, or Salesforce report here' }),
      el('p', { class: 'drop__sub', text: 'or click to choose a file. No renaming, reformatting, or template-copying is required.' }),
      input
    ]);
    function choose() { input.click(); }
    drop.addEventListener('click', choose);
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-over'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('is-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function () { if (input.files[0]) handleFile(input.files[0]); });

    function handleFile(file) {
      body.innerHTML = '';
      body.appendChild(U.stateScreen('loading', 'Inspecting file', 'Reading, hashing, and analysing "' + file.name + '"…'));
      W.inspectUpload(file).then(function (upload) {
        w.upload = upload;
        w.fileProblems = W.validateUpload(upload, w.savedProcess);
        rerender();
      }).catch(function (e) {
        w.upload = null;
        w.fileProblems = [{ code: 'FILE_READ_ERROR', reason: 'The file could not be read: ' + e.message }];
        rerender();
      });
    }

    panel.appendChild(drop);
    body.appendChild(panel);

    if (w.upload) {
      body.appendChild(uploadFacts(w.upload));
      w.fileProblems.forEach(function (p) {
        body.appendChild(U.notice('error', '<strong>File stopped — ' + esc(p.code) + '.</strong> ' + esc(p.reason)));
      });
      if (w.upload.sheetAmbiguous) {
        body.appendChild(sheetSelector(w.upload));
      }
      if (!w.fileProblems.length && w.upload.mapping) {
        body.appendChild(mappingPanel(w.upload));
      }
    }

    var canContinue = !!w.upload && !w.fileProblems.length && !w.upload.sheetAmbiguousUnresolved &&
      mappingResolved(w.upload);
    navButtons(body, {
      next: function () { w.step = 2; rerender(); },
      nextDisabled: !canContinue,
      note: canContinue ? null : 'Continue is enabled once a valid file is uploaded, any sheet choice is made, and required column mappings are resolved.'
    });
  }

  function uploadFacts(upload) {
    var a = upload.analysis;
    var headerOk = a && a.headerDetection.index !== -1 && !a.headerDetection.ambiguous;
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Detected file details</h2></div>'));
    var dl = el('dl', { class: 'facts' });
    function fact(k, vHtml) {
      dl.appendChild(el('dt', { text: k }));
      dl.appendChild(el('dd', { html: vHtml }));
    }
    fact('Filename', esc(upload.filename));
    fact('File size', esc(F.formatBytes(upload.size)));
    fact('Detected type', esc(upload.fileType === 'csv' ? 'CSV (delimited text)' :
      upload.fileType === 'xlsx' ? 'Excel workbook (.xlsx)' :
      upload.fileType === 'xls' ? 'Legacy Excel workbook (.xls)' : 'Unknown'));
    fact('Sheets detected', upload.sheets ? String(upload.sheets.length) +
      (upload.sheets.length > 1 ? ' — ' + esc(upload.sheets.map(function (s) { return s.name; }).join(', ')) : '') : '—');
    fact('Data rows detected', a ? U.fmtInt(a.totalDataRows) +
      (a.blankRowNumbers.length ? ' <span class="ops-meta">(' + a.blankRowNumbers.length + ' blank rows ignored)</span>' : '') : '—');
    fact('Upload status', upload.sniff.corrupted ? U.statusHtml('Rejected', 'st--fail') : U.statusHtml('Received', 'st--ok'));
    fact('Salesforce export', upload.isSalesforceExport
      ? U.statusHtml('Appears to be a Salesforce report', 'st--ok')
      : '<span class="ops-meta">Not detected as a Salesforce export</span>');
    fact('Header row', headerOk
      ? U.statusHtml('Detected (row ' + (a.headerDetection.index + 1) + ')', 'st--ok')
      : U.statusHtml(a && a.headerDetection.ambiguous ? 'Ambiguous — stopped' : 'Not detected', 'st--fail'));
    fact('File hash (SHA-256)', '<span class="ops-mono">' + esc((upload.hash || '').slice(0, 24)) + '…</span>');
    var sheet = upload.sheets && upload.sheets[upload.sheetIndex];
    if (sheet && (sheet.formulaCells || sheet.mergedRanges.length || sheet.hiddenRowNumbers.length || sheet.hiddenColumns)) {
      fact('Workbook notes', esc([
        sheet.formulaCells ? sheet.formulaCells + ' formula cells (cached values used)' : '',
        sheet.mergedRanges.length ? sheet.mergedRanges.length + ' merged ranges' : '',
        sheet.hiddenRowNumbers.length ? sheet.hiddenRowNumbers.length + ' hidden rows (still processed)' : '',
        sheet.hiddenColumns ? sheet.hiddenColumns + ' hidden columns' : ''
      ].filter(Boolean).join(' · ')));
    }
    panel.appendChild(dl);
    return panel;
  }

  function sheetSelector(upload) {
    var w = wizardState();
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(U.notice('warn', '<strong>Multiple sheets contain data.</strong> Select the worksheet to process — the system does not guess between plausible sheets.'));
    var opts = upload.sheets.map(function (s, i) {
      return { value: String(i), label: s.name + ' (' + s.rows.length + ' rows)' + (s.hidden ? ' — hidden' : '') };
    });
    var f = U.fieldSelect('sheet-pick', 'Worksheet', opts, String(upload.sheetIndex), {
      onchange: function (e) {
        upload.sheetIndex = Number(e.target.value);
        upload.sheetAmbiguous = false; /* resolved by explicit user choice */
        W.analyseActiveSheet(upload);
        w.fileProblems = W.validateUpload(upload, w.savedProcess);
        rerender();
      },
      placeholder: 'Select the worksheet to process'
    });
    if (String(f.input.value) === '') upload.sheetAmbiguousUnresolved = true;
    panel.appendChild(f);
    return panel;
  }

  function mappingResolved(upload) {
    if (!upload || !upload.mapping) return false;
    var m = upload.mapping;
    var required = S.getConfig('requiredColumns', ['email', 'company']);
    return required.every(function (f) {
      if (m.mapped[f]) return true;
      if ((f === 'firstName' || f === 'lastName') && m.mapped.fullName) return true;
      return false;
    });
  }

  function mappingPanel(upload) {
    var w = wizardState();
    var m = upload.mapping;
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Column mapping</h2>' +
      '<span class="ops-meta">Exact aliases map automatically; anything else needs your confirmation.</span></div>'));

    var rows = [];
    Object.keys(m.mapped).forEach(function (f) {
      rows.push({ field: f, column: m.mapped[f].column, state: m.mapped[f].confidence === 'exact' ? 'Mapped automatically' : 'Confirmed' });
    });
    if (rows.length) {
      panel.appendChild(U.table([
        { key: 'field', label: 'Field', text: function (r) { return FIELD_LABELS[r.field] || r.field; } },
        { key: 'column', label: 'Source column' },
        { key: 'state', label: 'Status', html: function (r) { return U.statusHtml(r.state, 'st--ok'); } }
      ], rows));
    }

    Object.keys(m.proposed).forEach(function (f) {
      var p = m.proposed[f];
      var n = U.notice('warn', '<strong>Proposed mapping:</strong> use column “' + esc(p.column) +
        '” as <strong>' + esc(FIELD_LABELS[f] || f) + '</strong>?');
      var confirmBtn = el('button', { class: 'btn btn--sm', text: 'Confirm', style: 'margin-left:auto', onclick: function () {
        m.mapped[f] = { column: p.column, index: p.index, confidence: 'confirmed' };
        delete m.proposed[f];
        upload.mappingAssessment = R.assessMapping(m, S.getConfig('requiredColumns', ['email', 'company']));
        w.fileProblems = W.validateUpload(upload, w.savedProcess);
        rerender();
      } });
      n.appendChild(confirmBtn);
      panel.appendChild(n);
    });

    Object.keys(m.ambiguous).forEach(function (f) {
      var candidates = m.ambiguous[f];
      var n = U.notice('warn', '<strong>' + esc(FIELD_LABELS[f] || f) + ':</strong> multiple possible source columns. Select the correct one — the system will not guess.');
      var sel = el('select', { 'aria-label': 'Select column for ' + f });
      sel.appendChild(el('option', { value: '', text: 'Select column…' }));
      candidates.forEach(function (c) { sel.appendChild(el('option', { value: String(c.index), text: c.column })); });
      sel.addEventListener('change', function () {
        if (sel.value === '') return;
        var c = candidates[sel.selectedIndex - 1];
        m.mapped[f] = { column: c.column, index: c.index, confidence: 'selected' };
        delete m.ambiguous[f];
        upload.mappingAssessment = R.assessMapping(m, S.getConfig('requiredColumns', ['email', 'company']));
        w.fileProblems = W.validateUpload(upload, w.savedProcess);
        rerender();
      });
      n.appendChild(sel);
      panel.appendChild(n);
    });

    if (!mappingResolved(upload)) {
      panel.appendChild(U.notice('error', '<strong>Required columns unresolved.</strong> ' +
        'The process cannot continue until required fields (' +
        esc(S.getConfig('requiredColumns', ['email', 'company']).join(', ')) +
        ') are mapped to source columns.'));
    }
    return panel;
  }

  /* ── Step 2: Saved process ─────────────────────────────────────────────── */

  function stepSavedProcess(body, user) {
    var w = wizardState();
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Step 2 — Select a saved process</h2>' +
      '<span class="ops-meta">Saved processes pre-fill rules and settings; everything stays editable before execution.</span></div>'));

    var procs = S.getSavedProcesses();
    var f = U.fieldSelect('saved-process', 'Choose a saved process',
      procs.map(function (p) { return { value: p.processId, label: p.processName }; }),
      w.savedProcess ? w.savedProcess.processId : '',
      { placeholder: 'Choose a saved process', onchange: function (e) {
        var p = S.getSavedProcess(e.target.value);
        w.savedProcess = p;
        if (p) {
          var defaults = {};
          try { defaults = JSON.parse(p.defaultSettingsJson); } catch (err) { defaults = {}; }
          w.settings = Object.assign(R.defaultSettings(), defaults);
          /* Fail-closed guard: saved processes can never pre-enable
             external actions or disable dry run. */
          R.EXTERNAL_ACTION_KEYS.forEach(function (k) { w.settings[k] = false; });
          w.settings.dryRun = true;
        }
        rerender();
      } });
    panel.appendChild(f);

    if (w.savedProcess) {
      panel.appendChild(U.notice('info', '<strong>' + esc(w.savedProcess.processName) + '.</strong> ' +
        esc(w.savedProcess.description) + ' <span class="ops-meta">Rules version ' +
        esc(w.savedProcess.rulesVersion) + '</span>'));
    }
    body.appendChild(panel);
    navButtons(body, {
      next: function () { w.step = 3; rerender(); },
      nextDisabled: !w.savedProcess,
      note: w.savedProcess ? null : 'Select a saved process (use "Custom Process" for a one-off run).'
    });
  }

  /* ── Step 3: Instruction ───────────────────────────────────────────────── */

  function stepInstruction(body, user) {
    var w = wizardState();
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Step 3 — Describe what you want the system to do</h2></div>'));

    var ta = el('textarea', {
      id: 'instruction',
      placeholder: 'Clean this list, match it against Salesforce, exclude duplicates and previous outreach, ' +
        'assign Asia to Kelvin and Ex-Asia to John, and generate a review workbook. ' +
        'Do not send emails or update Salesforce.'
    });
    ta.value = w.instruction;
    var f = el('div', { class: 'fld' }, [
      el('label', { for: 'instruction', text: 'Describe what you want the system to do' }), ta,
      el('p', { class: 'hint', text: 'Your instruction is translated into proposed structured settings only. It is never executed directly, and it can never switch on emails or Salesforce changes.' })
    ]);
    panel.appendChild(f);
    body.appendChild(panel);

    navButtons(body, {
      next: function () {
        w.instruction = ta.value;
        var interp = R.interpretInstruction(w.instruction, vocab());
        w.interpretation = interp;
        /* Apply only safe proposals to settings; external actions untouched. */
        Object.keys(interp.proposedSettings).forEach(function (k) {
          if (R.EXTERNAL_ACTION_KEYS.indexOf(k) === -1) w.settings[k] = interp.proposedSettings[k];
        });
        w.ownerAssignments = interp.ownerAssignments;
        w.step = 4; rerender();
      },
      nextLabel: 'Interpret and continue'
    });
  }

  /* ── Step 4: Controlled settings ───────────────────────────────────────── */

  function stepSettings(body, user) {
    var w = wizardState();
    var s = w.settings;
    var v = vocab();
    var interp = w.interpretation;

    if (interp) {
      if (interp.warnings.length) {
        interp.warnings.forEach(function (msg) { body.appendChild(U.notice('warn', esc(msg))); });
      }
      interp.externalActionRequests.forEach(function (req) {
        body.appendChild(U.notice('warn', '<strong>Not enabled automatically:</strong> ' + esc(req.note)));
      });
      interp.explicitProhibitions.forEach(function (p) {
        body.appendChild(U.notice('info', '<strong>Instruction noted:</strong> "' + esc(p) + '" is explicitly prohibited for this run and will remain off.'));
      });
    }

    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Step 4 — Controlled settings</h2>' +
      '<span class="ops-meta">Dropdowns are controlled vocabularies managed in Administration.</span></div>'));

    var grid = el('div', { class: 'fld-row' });
    var fType = U.fieldSelect('f-ptype', 'Process type',
      ['Outreach Preparation', 'Weekly Reporting', 'Salesforce Data Quality', 'General List Cleaning', 'Custom'],
      s.processType, { placeholder: 'Select process type…', onchange: function (e) { s.processType = e.target.value; } });
    var fOwner = U.fieldSelect('f-owner', 'Coverage owner',
      v.owners.map(function (o) { return o.name; }), s.coverageOwner,
      { placeholder: 'Assign by region rules…', hint: 'Leave unset to assign by region (Asia → ' +
        esc((v.owners[0] || {}).name || '—') + ', Ex-Asia → ' + esc((v.owners[1] || {}).name || '—') + ').',
        onchange: function (e) { s.coverageOwner = e.target.value; } });
    var fRegion = U.fieldSelect('f-region', 'Region', v.regions, s.region,
      { placeholder: 'All regions', onchange: function (e) { s.region = e.target.value; } });
    var fFund = U.fieldSelect('f-fund', 'Fund', v.funds, s.fund,
      { placeholder: 'Not fund-specific', onchange: function (e) { s.fund = e.target.value; } });
    var fCampaign = U.fieldSelect('f-campaign', 'Campaign or conference', v.campaigns, s.campaign,
      { placeholder: 'None', onchange: function (e) { s.campaign = e.target.value; } });
    var fSender = U.fieldSelect('f-sender', 'Sender',
      S.getConfig('senders', []).map(function (x) { return { value: x.address, label: x.label }; }),
      s.sender, { placeholder: 'No sender (no emails)', onchange: function (e) { s.sender = e.target.value; } });
    var fTemplate = U.fieldSelect('f-template', 'Approved email template',
      v.templates.map(function (t) { return { value: t.id, label: t.name + ' (' + t.version + ')' }; }),
      s.template, { placeholder: 'No template', onchange: function (e) { s.template = e.target.value; } });
    [fType, fOwner, fRegion, fFund, fCampaign, fSender, fTemplate].forEach(function (x) { grid.appendChild(x); });
    panel.appendChild(grid);

    function tgl(id, label, sub, key, opts) {
      var o = opts || {};
      return U.toggleRow(id, label, sub, s[key] === true, Object.assign({
        onchange: function (e) { s[key] = e.target.value === 'yes'; rerender(); }
      }, o));
    }
    panel.appendChild(tgl('t-match', 'Match against Salesforce', 'Rows are matched to existing Contacts and Accounts.', 'matchAgainstSalesforce'));
    panel.appendChild(tgl('t-prev', 'Exclude previous outreach', 'Contacts with prior outreach on record are excluded.', 'excludePreviousOutreach'));
    panel.appendChild(tgl('t-blocked', 'Exclude blocked records', 'Blocked domains and accounts are excluded (cannot be overridden here).', 'excludeBlockedRecords'));
    panel.appendChild(tgl('t-wb', 'Generate review workbook', 'A controlled output workbook is produced from the approved template.', 'generateReviewWorkbook'));
    panel.appendChild(tgl('t-draft', 'Prepare draft emails', 'Defaults to No. Requires an authorised sender, approved template, and execution approval.', 'prepareDraftEmails', { consequential: true }));
    panel.appendChild(tgl('t-sfcreate', 'Create Salesforce actions', 'Defaults to No. Requires execution approval; never inferred from text.', 'createSalesforceActions', { consequential: true }));
    panel.appendChild(tgl('t-sfupdate', 'Update Salesforce', 'Defaults to No. Requires execution approval; never inferred from text.', 'updateSalesforce', { consequential: true }));
    panel.appendChild(tgl('t-dry', 'Dry run', 'Defaults to Yes. While Yes, no external action can execute regardless of other settings.', 'dryRun'));

    var notes = el('textarea', { id: 'f-notes', placeholder: 'Notes recorded with the batch (optional).' });
    notes.value = s.notes || '';
    notes.addEventListener('change', function () { s.notes = notes.value; });
    panel.appendChild(el('div', { class: 'fld', style: 'margin-top:14px' }, [el('label', { for: 'f-notes', text: 'Notes' }), notes]));

    body.appendChild(panel);

    if (w.ownerAssignments.length) {
      var p2 = el('div', { class: 'ops-panel' });
      p2.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Owner assignments from your instruction</h2></div>'));
      p2.appendChild(U.table([
        { key: 'region', label: 'Region' },
        { key: 'owner', label: 'Proposed owner' },
        { key: 'regionRecognised', label: 'Region recognised', html: function (r) { return r.regionRecognised ? U.statusHtml('Yes', 'st--ok') : U.statusHtml('Unrecognised — rows route to review', 'st--warn'); } }
      ], w.ownerAssignments));
      body.appendChild(p2);
    }

    navButtons(body, { next: function () { w.step = 5; rerender(); }, nextLabel: 'Preview interpretation' });
  }

  /* ── Step 5: Interpretation preview ────────────────────────────────────── */

  function stepConfirm(body, user) {
    var w = wizardState();
    var s = w.settings;
    var a = w.upload.analysis;

    var box = el('div', { class: 'interp' });
    box.appendChild(el('h3', { text: 'I understood your request as follows' }));
    var dl = el('dl', { class: 'facts' });
    function fact(k, html) { dl.appendChild(el('dt', { text: k })); dl.appendChild(el('dd', { html: html })); }

    fact('File', esc(w.upload.filename) + ' <span class="ops-meta">(' + esc(w.upload.fileType) + ', ' + U.fmtInt(a.totalDataRows) + ' rows)</span>');
    fact('Detected columns', esc(a.headers.filter(Boolean).join(', ') || '—'));
    fact('Selected process', esc(w.savedProcess ? w.savedProcess.processName : 'Custom Process'));
    fact('Process type', esc(s.processType || '—'));
    fact('Owner', esc(s.coverageOwner || (w.ownerAssignments.length ?
      w.ownerAssignments.map(function (x) { return x.region + ' → ' + x.owner; }).join('; ') : 'By region rules')));
    fact('Region', esc(s.region || 'All regions'));
    fact('Excluded regions', esc(s.excludedRegions || 'None'));
    fact('Salesforce matching', U.yesNo(s.matchAgainstSalesforce));
    fact('Duplicate treatment', s.excludeDuplicates === false ? 'Keep duplicates (flagged)' : 'Exclude duplicates (in-file, in-batch, and across previous batches)');
    fact('Previous outreach', s.excludePreviousOutreach ? 'Excluded' : '<span class="yes">Not excluded</span>');
    fact('Output', s.generateReviewWorkbook ? 'Controlled review workbook' : 'No workbook');
    fact('Template', esc(s.template || 'None'));
    fact('Sender', esc(s.sender ? 'Configured sender (deployment value)' : 'None'));
    fact('Emails prepared', U.yesNo(s.prepareDraftEmails));
    fact('Emails sent', U.yesNo(false) + ' <span class="ops-meta">— sending never occurs from this workflow without separate execution approval</span>');
    fact('Salesforce records created', U.yesNo(s.createSalesforceActions));
    fact('Salesforce records updated', U.yesNo(s.updateSalesforce));
    fact('Dry run', U.yesNo(s.dryRun) + (s.dryRun ? ' <span class="ops-meta">— no external action can execute</span>' : ' <span class="yes">— external actions possible after approvals</span>'));
    box.appendChild(dl);
    body.appendChild(box);

    if (w.interpretation && w.interpretation.matchedPhrases.length) {
      body.appendChild(U.notice('info', '<strong>Interpreted from your instruction:</strong> ' +
        esc(w.interpretation.matchedPhrases.join(' · '))));
    }

    var actions = el('div', { class: 'ops-actions' });
    var confirmBtn = el('button', { class: 'btn btn--primary', text: 'Confirm and Process' });
    confirmBtn.addEventListener('click', function () {
      if (w.confirming) return; /* double-click guard (plus batch lock below) */
      w.confirming = true;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Submitting…';
      var confirmed = {
        upload: w.upload,
        savedProcess: w.savedProcess,
        settings: w.settings,
        instruction: w.instruction,
        interpretation: w.interpretation,
        ownerAssignments: w.ownerAssignments
      };
      W.runBatch(confirmed, user, null).then(function (batch) {
        resetWizard();
        location.hash = '#/batch/' + batch.batchId;
      }).catch(function (e) {
        w.confirming = false;
        U.toast('Processing stopped: ' + e.message);
        rerender();
      });
      /* Navigate to the live status page as soon as the batch exists. */
      setTimeout(function () {
        var latest = S.getBatches()[0];
        if (latest && w.confirming) location.hash = '#/batch/' + latest.batchId;
      }, 400);
    });
    actions.appendChild(confirmBtn);
    actions.appendChild(el('button', { class: 'btn', text: 'Edit Settings', onclick: function () { w.step = 4; rerender(); } }));
    actions.appendChild(el('button', { class: 'btn btn--quiet', text: 'Cancel', onclick: function () { resetWizard(); location.hash = '#/dashboard'; } }));
    body.appendChild(actions);
  }

  /* ── Batch status + results ────────────────────────────────────────────── */

  SVOps.views.batch = function (container, user, params) {
    var batchId = params[0];
    var batch = S.getBatch(batchId);
    var page = el('div', { class: 'ops-content' });
    if (!batch) {
      page.appendChild(U.stateScreen('error', 'Batch not found',
        'No batch with ID "' + batchId + '" exists in this environment.'));
      container.appendChild(page);
      return;
    }

    page.appendChild(frag('<div class="ops-pagehead"><p class="ops-label">Batch status</p>' +
      '<h1 class="ops-h1">' + esc(batch.originalFilename) + '</h1>' +
      '<p class="ops-meta">Batch <span class="ops-mono">' + esc(batch.batchId) + '</span> · version ' +
      batch.batchVersion + ' · submitted by ' + esc(batch.submittedBy) + ' at ' + esc(U.fmtDateTime(batch.submittedAt)) + '</p></div>'));

    var inFlight = R.PROCESSING_STAGES.indexOf(batch.currentStage) !== -1;
    var terminal = ['Complete', 'Failed', 'Failed Reconciliation', 'Review Required', 'Awaiting Approval'].indexOf(batch.status) !== -1;

    /* Facts strip */
    var stats = el('div', { class: 'ops-stats', style: 'margin-bottom:18px' });
    [['Total rows', batch.totalRows], ['Ready', batch.readyRows], ['Review required', batch.reviewRows],
     ['Duplicates', batch.duplicateRows], ['Blocked', batch.blockedRows], ['Invalid', batch.invalidRows],
     ['System errors', batch.systemErrorRows]].forEach(function (pair) {
      stats.appendChild(el('div', { class: 'ops-stat' }, [
        el('p', { class: 'ops-stat__k', text: pair[0] }),
        el('p', { class: 'ops-stat__v', text: U.fmtInt(pair[1]) })
      ]));
    });
    page.appendChild(stats);

    var grid = el('div', { class: 'ops-grid ops-grid--2' });

    /* Stage list */
    var stagePanel = el('div', { class: 'ops-panel' });
    stagePanel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Processing stages</h2>' +
      '<span>' + U.statusHtml(batch.status) + '</span></div>'));
    var list = el('ul', { class: 'stagelist' });
    var currentIdx = R.PROCESSING_STAGES.indexOf(batch.currentStage);
    R.PROCESSING_STAGES.forEach(function (stage, i) {
      var cls = '';
      if (batch.status === 'Failed' || batch.status === 'Failed Reconciliation') {
        cls = i < currentIdx ? 'is-done' : (i === currentIdx ? 'is-failed' : '');
      } else if (terminal) cls = 'is-done';
      else cls = i < currentIdx ? 'is-done' : (i === currentIdx ? 'is-current' : '');
      list.appendChild(el('li', { class: cls, html: '<span class="mk"></span>' + esc(stage) }));
    });
    stagePanel.appendChild(list);
    grid.appendChild(stagePanel);

    /* Batch facts */
    var factsPanel = el('div', { class: 'ops-panel' });
    factsPanel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Batch record</h2></div>'));
    var dl = el('dl', { class: 'facts' });
    function fact(k, v) { dl.appendChild(el('dt', { text: k })); dl.appendChild(el('dd', { html: v })); }
    fact('Saved process', esc(batch.savedProcessName));
    fact('Current stage', esc(batch.currentStage));
    fact('Rules version', esc(batch.rulesVersion));
    fact('Template version', esc(batch.templateVersion));
    fact('Locked', batch.locked ? U.statusHtml('Locked by ' + batch.lockedBy, 'st--warn') : '<span class="ops-meta">No</span>');
    if (batch.errorSummary) fact('Error summary', '<span class="yes">' + esc(batch.errorSummary) + '</span>');
    try {
      var recon = JSON.parse(batch.reconciliationJson || 'null');
      if (recon) fact('Reconciliation', recon.balanced ? U.statusHtml('Balanced', 'st--ok') + ' <span class="ops-meta">' + esc(recon.statement) + '</span>' : U.statusHtml('Mismatch', 'st--fail') + ' ' + esc(recon.statement));
    } catch (e) { /* ignore */ }
    factsPanel.appendChild(dl);
    grid.appendChild(factsPanel);
    page.appendChild(grid);

    if (batch.status === 'Failed Reconciliation') {
      page.appendChild(U.notice('error', '<strong>Failed reconciliation.</strong> Row totals do not balance; execution is disabled and an administrator has been notified.'));
    }

    if (terminal && batch.status !== 'Failed') {
      page.appendChild(resultsPanel(batch, user));
    }

    if (batch.status === 'Failed') {
      var retry = el('div', { class: 'ops-actions' });
      retry.appendChild(el('a', { class: 'btn', href: '#/runs', text: 'Go to Previous Runs' }));
      page.appendChild(retry);
    }

    container.appendChild(page);

    /* Poll while processing so stages advance live. */
    if (inFlight && !terminal && !batch.errorSummary) {
      setTimeout(function () {
        if (location.hash === '#/batch/' + batchId) rerender();
      }, 500);
    }
  };

  function resultsPanel(batch, user) {
    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Processing complete</h2>' +
      '<span>' + U.statusHtml(batch.status) + '</span></div>'));

    var matched = S.getRows(batch.batchId).filter(function (r) { return r.matchStatus === 'Matched' || r.matchStatus === 'Multiple matches'; }).length;
    var sum = el('div', { class: 'result-sum' });
    [[U.fmtInt(batch.totalRows), 'rows received'],
     [U.fmtInt(batch.readyRows), 'ready'],
     [U.fmtInt(matched), 'existing Salesforce records'],
     [U.fmtInt(batch.duplicateRows), 'duplicates'],
     [U.fmtInt(batch.invalidRows), 'invalid'],
     [U.fmtInt(batch.reviewRows), 'require review']].forEach(function (pair) {
      sum.appendChild(el('div', {}, [
        el('p', { class: 'ops-stat__v', text: pair[0] }),
        el('p', { class: 'ops-stat__k', text: pair[1] })
      ]));
    });
    panel.appendChild(sum);

    var approvals = W.getApprovals(batch);
    var apprRow = el('div', { style: 'margin: 0 0 14px' });
    W.APPROVAL_LEVELS.forEach(function (l) {
      var granted = approvals[l.key];
      var line = el('div', { class: 'tgl' }, [
        el('div', { class: 'tgl__text', html: esc(l.label) +
          (granted ? '<span class="sub">Granted by ' + esc(granted.by) + ' at ' + esc(U.fmtDateTime(granted.at)) + '</span>'
                   : '<span class="sub">Not yet granted</span>') })
      ]);
      if (granted) {
        line.appendChild(el('span', { html: U.statusHtml('Granted', 'st--ok') }));
      } else {
        var b = el('button', { class: 'btn btn--sm', text: 'Grant' });
        b.addEventListener('click', function () {
          var res = W.approveBatch(batch.batchId, l.key, user);
          U.toast(res.ok ? l.label + ' granted.' : res.reason);
          rerender();
        });
        line.appendChild(b);
      }
      apprRow.appendChild(line);
    });
    var apprPanel = el('div', {}, [
      frag('<h4 class="ops-panel__title" style="margin:16px 0 6px">Approvals</h4>'),
      el('p', { class: 'ops-meta', text: 'Approvals happen here in the portal (or the controlled Microsoft approval process) — never in an edited spreadsheet cell. All three levels are required before any external action.' }),
      apprRow
    ]);
    panel.appendChild(apprPanel);

    var actions = el('div', { class: 'ops-actions' });
    if (batch.outputText) {
      actions.appendChild(el('button', { class: 'btn btn--primary', text: 'Open Output Workbook', onclick: function () {
        var blob = new Blob([batch.outputText], { type: 'text/plain;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ShoreVest-One-Output-' + batch.batchId + '.txt';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      } }));
    }
    actions.appendChild(el('a', { class: 'btn', href: '#/exceptions/' + batch.batchId, text: 'Review Exceptions' }));
    actions.appendChild(el('a', { class: 'btn', href: '#/runs/' + batch.batchId, text: 'View Audit Log' }));

    ['prepareDraftEmails', 'createSalesforceActions'].forEach(function (actionType) {
      var def = W.ACTION_TYPES[actionType];
      var gate = W.executionGate(batch.batchId, actionType, user);
      var b = el('button', { class: 'btn btn--danger', text: def.label });
      if (!gate.allowed) {
        b.disabled = true;
        b.title = gate.reasons.join(' ');
      } else {
        b.addEventListener('click', function () {
          b.disabled = true; /* double-click guard; execution keys enforce idempotency */
          W.executeAction(batch.batchId, actionType, user).then(function (res) {
            U.toast(res.ok
              ? def.label + ': ' + res.results.executed + ' executed, ' + res.results.alreadyExecuted + ' already executed, ' + res.results.skipped + ' skipped.'
              : res.reasons.join(' '));
            rerender();
          });
        });
      }
      actions.appendChild(b);
    });
    actions.appendChild(el('a', { class: 'btn btn--quiet', href: '#/dashboard', text: 'Return to Dashboard' }));
    panel.appendChild(actions);

    var gates = W.executionGate(batch.batchId, 'prepareDraftEmails', user);
    if (!gates.allowed) {
      panel.appendChild(el('p', { class: 'btn-note', html: '<strong>Consequential actions disabled:</strong> ' + esc(gates.reasons.join(' ')) }));
    }
    return panel;
  }

})(typeof self !== 'undefined' ? self : this);
