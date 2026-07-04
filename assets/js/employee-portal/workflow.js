/* ==========================================================================
   ShoreVest Operations — Workflow Engine (demonstration mode)

   Drives the Process a List pipeline end-to-end in the browser using the
   rules engine, the demo store, and the integration adapters. In
   production the identical sequence runs inside the Power Automate
   processBatch flow; this module is the executable specification of that
   flow. Stage order, classification precedence, reconciliation, locking
   and idempotent execution are the contract.
   ========================================================================== */
(function (root) {
  'use strict';

  var R = root.SVPortalRules;
  var F = root.SVPortalFiles;
  var S = root.SVPortalStore;
  var I = root.SVPortalIntegrations;

  var ASIA_COUNTRIES_DEFAULT = ['china', 'hong kong', 'hong kong sar', 'singapore',
    'japan', 'south korea', 'korea', 'taiwan', 'malaysia', 'thailand', 'indonesia',
    'vietnam', 'philippines', 'india', 'macau'];

  /* ── Upload inspection ─────────────────────────────────────────────────── */

  /**
   * Read and inspect an uploaded File. Resolves an `upload` object used by
   * the wizard: byte sniff, hash, parsed sheets, header detection, column
   * mapping, Salesforce-export heuristic, and any hard rejections.
   */
  function inspectUpload(file) {
    return file.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      var sniff = F.sniffBytes(bytes, file.name);
      var upload = {
        filename: file.name,
        size: file.size,
        bytes: bytes,
        sniff: sniff,
        fileType: sniff.type,
        hash: null,
        sheets: null,            /* [{name, rows, …}] for xlsx */
        sheetIndex: 0,
        sheetAmbiguous: false,
        analysis: null,          /* analyseTable result for the active sheet */
        mapping: null,
        mappingAssessment: null,
        isSalesforceExport: false,
        parseError: null
      };
      return F.sha256Hex(bytes).then(function (hash) {
        upload.hash = hash;
        if (sniff.corrupted || sniff.encrypted) return upload;
        if (sniff.type === 'csv') {
          var text = new TextDecoder('utf-8').decode(bytes);
          var rows = F.parseCsv(text);
          upload.sheets = [{ name: 'CSV', rows: rows, hiddenRowNumbers: [], hiddenColumns: 0, mergedRanges: [], formulaCells: 0 }];
          analyseActiveSheet(upload);
          return upload;
        }
        if (sniff.type === 'xlsx') {
          return F.readXlsx(bytes).then(function (wb) {
            upload.sheets = wb.sheets;
            upload.sniff.hasMacros = upload.sniff.hasMacros || wb.hasMacros;
            upload.sniff.hasExternalLinks = upload.sniff.hasExternalLinks || wb.hasExternalLinks;
            /* Sheet selection: automatic only when unambiguous — exactly
               one visible sheet with data. Otherwise the user chooses. */
            var withData = wb.sheets.map(function (s, i) { return { i: i, sheet: s }; })
              .filter(function (x) { return !x.sheet.hidden && x.sheet.rows.some(function (r) { return !F.isBlankRow(r); }); });
            if (withData.length === 1) {
              upload.sheetIndex = withData[0].i;
            } else if (withData.length > 1) {
              upload.sheetAmbiguous = true;
              upload.sheetIndex = withData[0].i;
            }
            analyseActiveSheet(upload);
            return upload;
          }).catch(function (e) {
            upload.parseError = e.message;
            upload.sniff.corrupted = true;
            return upload;
          });
        }
        /* .xls (legacy binary) is parsed server-side by Office Scripts. */
        return upload;
      });
    });
  }

  function analyseActiveSheet(upload) {
    var sheet = upload.sheets[upload.sheetIndex];
    upload.analysis = F.analyseTable(sheet.rows, R.detectHeaderRow);
    if (upload.analysis.headers.length) {
      upload.isSalesforceExport = R.looksLikeSalesforceExport(upload.analysis.headers);
      var aliasOverrides = configAliases();
      upload.mapping = R.mapColumns(upload.analysis.headers, aliasOverrides);
      upload.mappingAssessment = R.assessMapping(upload.mapping, S.getConfig('requiredColumns', ['email', 'company']));
    } else {
      upload.isSalesforceExport = false;
      upload.mapping = null;
      upload.mappingAssessment = null;
    }
  }

  function configAliases() {
    var extra = S.getConfig('columnAliases', null);
    if (!extra) return null;
    var merged = {};
    Object.keys(R.COLUMN_ALIASES).forEach(function (k) { merged[k] = R.COLUMN_ALIASES[k].slice(); });
    Object.keys(extra).forEach(function (k) {
      merged[k] = (merged[k] || []).concat(extra[k]);
    });
    return merged;
  }

  /** File-level validation for the wizard (exact reasons, fail closed). */
  function validateUpload(upload, savedProcess) {
    var fileMeta = {
      name: upload.filename,
      size: upload.size,
      type: upload.fileType,
      rowCount: upload.analysis ? upload.analysis.totalDataRows : (upload.fileType === 'xls' ? null : 0),
      encrypted: upload.sniff.encrypted,
      corrupted: upload.sniff.corrupted,
      hasMacros: upload.sniff.hasMacros,
      hasExternalLinks: upload.sniff.hasExternalLinks,
      hash: upload.hash,
      uploading: false,
      locked: false
    };
    var problems = R.validateFile(fileMeta, {
      config: {
        maxFileBytes: Number(S.getConfig('maxFileBytes', 25 * 1024 * 1024)),
        maxRows: Number(S.getConfig('maxRows', 50000))
      },
      processedHashes: S.processedHashes(),
      headerDetection: upload.analysis ? upload.analysis.headerDetection : null,
      mappingAssessment: upload.mappingAssessment,
      processCompatible: savedProcess ? true : undefined,
      configurationAvailable: true
    });
    if (upload.fileType === 'xls' && !upload.sniff.encrypted && I.demoMode()) {
      problems.push({
        code: 'FILE_XLS_SERVER_PARSE',
        reason: 'Legacy .xls workbooks are parsed by the Office Scripts integration, which is not connected in demonstration mode. Save the workbook as .xlsx or .csv to continue the demonstration.'
      });
    }
    if (upload.parseError) {
      problems.push({ code: 'FILE_CORRUPTED', reason: 'The workbook could not be read: ' + upload.parseError });
    }
    return problems;
  }

  /* ── Normalisation ─────────────────────────────────────────────────────── */

  function fieldValue(cells, mapping, field) {
    var m = mapping.mapped[field] || mapping.proposed[field];
    if (!m) return '';
    var v = cells[m.index];
    return v == null ? '' : String(v).trim();
  }

  function resolveRegionGroup(row) {
    var explicit = String(row.region || '').trim().toLowerCase();
    if (explicit) return explicit === 'asia' ? 'Asia' : (explicit === 'ex-asia' ? 'Ex-Asia' : row.region);
    var country = String(row.country || '').trim().toLowerCase();
    if (!country) return '';
    var asia = S.getConfig('asiaCountries', ASIA_COUNTRIES_DEFAULT).map(function (c) { return String(c).toLowerCase(); });
    return asia.indexOf(country) !== -1 ? 'Asia' : 'Ex-Asia';
  }

  function resolveOwner(row, settings, ownerAssignments) {
    if (settings.coverageOwner) return settings.coverageOwner;
    var group = resolveRegionGroup(row);
    if (!group) return '';
    var match = (ownerAssignments || []).filter(function (a) {
      return String(a.region).toLowerCase() === String(group).toLowerCase();
    })[0];
    if (match) return match.owner;
    var owners = S.getConfig('owners', []);
    var byRegion = owners.filter(function (o) {
      return (o.regions || []).some(function (r) { return String(r).toLowerCase() === String(group).toLowerCase(); });
    })[0];
    return byRegion ? byRegion.name : '';
  }

  /* ── Pipeline ──────────────────────────────────────────────────────────── */

  /**
   * Create and process a batch from a confirmed wizard state.
   * `confirmed` — { upload, savedProcess, settings, instruction,
   *                 interpretation, ownerAssignments }
   * `onStage(batch)` — progress callback for the status screen.
   * Resolves the final batch.
   */
  function runBatch(confirmed, user, onStage) {
    var upload = confirmed.upload;
    var settings = confirmed.settings;

    var batch = S.createBatch({
      originalFilename: upload.filename,
      fileType: upload.fileType,
      fileHash: upload.hash,
      processType: settings.processType || '',
      savedProcessId: confirmed.savedProcess ? confirmed.savedProcess.processId : null,
      savedProcessName: confirmed.savedProcess ? confirmed.savedProcess.processName : 'Custom Process',
      settings: settings,
      instruction: confirmed.instruction || '',
      interpretation: confirmed.interpretation || null,
      totalRows: upload.analysis.totalDataRows
    }, user.name);

    /* Raw source data is preserved unchanged, once. */
    S.storeSourceFile(batch.batchId, {
      filename: upload.filename,
      headers: upload.analysis.headers,
      rows: upload.analysis.dataRows.map(function (r) { return { n: r.originalRowNumber, cells: r.cells }; })
    });

    var lock = S.lockBatch(batch.batchId, user.name, 'demo-run-' + Date.now());
    if (!lock.acquired) {
      S.updateBatch(batch.batchId, { status: 'Failed', errorSummary: lock.reason }, user.name, 'BatchFailed', lock.reason);
      return Promise.reject(new Error(lock.reason));
    }

    var stages = R.PROCESSING_STAGES.slice(1); /* Uploaded already set */
    var stageDelay = 260;

    function setStage(stage) {
      S.updateBatch(batch.batchId, { status: stage, currentStage: stage }, user.name, 'StageChanged');
      if (onStage) onStage(S.getBatch(batch.batchId));
    }

    return new Promise(function (resolve, reject) {
      var idx = 0;
      var context = null;
      var rows = null;

      function step() {
        try {
          var stage = stages[idx];
          if (stage === undefined) { finish(); return; }
          setStage(stage);

          if (stage === R.BATCH_STATUS.MATCHING_SALESFORCE) {
            var emails = upload.analysis.dataRows.map(function (r) {
              return R.normaliseEmail(fieldValue(r.cells, upload.mapping, 'email'));
            }).filter(Boolean);
            I.Salesforce.matchContacts(emails, S.getDemoSalesforce()).then(function (res) {
              context = context || {};
              context.sfMatch = res;
              idx++; setTimeout(step, stageDelay);
            }).catch(function (e) {
              /* System exception: pause the run, never classify as Ready. */
              failBatch('Salesforce matching failed: ' + e.message, 'E013_SYSTEM_CONNECTION_FAILURE');
            });
            return;
          }

          if (stage === R.BATCH_STATUS.CLASSIFYING_RECORDS) {
            rows = buildRows(batch, upload, settings, confirmed.ownerAssignments, context, user);
          }

          if (stage === R.BATCH_STATUS.RECONCILING_RESULTS) {
            var counts = R.countByClassification(rows);
            var rec = R.reconcile(batch.totalRows, counts);
            S.updateBatch(batch.batchId, {
              readyRows: counts[R.CLASSIFICATION.READY],
              reviewRows: counts[R.CLASSIFICATION.REVIEW_REQUIRED],
              duplicateRows: counts[R.CLASSIFICATION.DUPLICATE],
              blockedRows: counts[R.CLASSIFICATION.BLOCKED],
              invalidRows: counts[R.CLASSIFICATION.INVALID],
              systemErrorRows: counts[R.CLASSIFICATION.SYSTEM_ERROR],
              reconciliationJson: JSON.stringify(rec)
            }, user.name, 'Reconciled', rec.statement);
            if (!rec.balanced) {
              S.addAlert({ severity: 'critical', kind: 'Reconciliation mismatch',
                detail: rec.statement, batchId: batch.batchId });
              S.updateBatch(batch.batchId, {
                status: R.BATCH_STATUS.FAILED_RECONCILIATION,
                currentStage: R.BATCH_STATUS.FAILED_RECONCILIATION,
                errorSummary: rec.statement
              }, user.name, 'BatchFailed', 'Reconciliation mismatch');
              S.unlockBatch(batch.batchId, user.name);
              if (onStage) onStage(S.getBatch(batch.batchId));
              resolve(S.getBatch(batch.batchId));
              return;
            }
          }

          if (stage === R.BATCH_STATUS.GENERATING_WORKBOOK) {
            var doc = generateWorkbookText(S.getBatch(batch.batchId), rows, upload, settings, user);
            S.updateBatch(batch.batchId, { outputText: doc, outputFileUrl: 'demo:workbook' }, user.name, 'WorkbookGenerated');
          }

          idx++;
          setTimeout(step, stageDelay);
        } catch (e) {
          failBatch(e.message, 'E013_SYSTEM_CONNECTION_FAILURE');
        }
      }

      function failBatch(summary, code) {
        S.logError({ batchId: batch.batchId, stage: S.getBatch(batch.batchId).currentStage,
          action: 'runBatch', connector: 'demo', flowRunId: batch.flowRunId,
          errorCode: code, errorMessage: summary,
          externalActionMayHaveSucceeded: false,
          recommendedResolution: 'Retry failed system steps from Previous Runs once the connection is restored.' });
        S.addAlert({ severity: 'critical', kind: 'System failure', detail: summary, batchId: batch.batchId });
        S.updateBatch(batch.batchId, { status: 'Failed', currentStage: 'Failed', errorSummary: summary },
          user.name, 'BatchFailed', summary);
        S.unlockBatch(batch.batchId, user.name);
        if (onStage) onStage(S.getBatch(batch.batchId));
        reject(new Error(summary));
      }

      function finish() {
        S.setRows(batch.batchId, rows);
        var b = S.getBatch(batch.batchId);
        var next = b.reviewRows > 0 ? R.BATCH_STATUS.REVIEW_REQUIRED : R.BATCH_STATUS.COMPLETE;
        S.updateBatch(batch.batchId, { status: next, currentStage: next }, user.name, 'BatchCompleted');
        S.unlockBatch(batch.batchId, user.name);
        if (onStage) onStage(S.getBatch(batch.batchId));
        resolve(S.getBatch(batch.batchId));
      }

      setTimeout(step, stageDelay);
    });
  }

  function buildRows(batch, upload, settings, ownerAssignments, context, user) {
    var mapping = upload.mapping;
    var sf = (context && context.sfMatch) || { contactsByEmail: {}, liveProcessEmails: [] };
    var seenEmails = {};
    upload.analysis.dataRows.forEach(function (r) {
      var e = R.normaliseEmail(fieldValue(r.cells, mapping, 'email'));
      if (e && !Object.prototype.hasOwnProperty.call(seenEmails, e)) seenEmails[e] = r.originalRowNumber;
    });

    var validationContext = {
      settings: settings,
      requiredFields: S.getConfig('requiredColumns', ['email', 'company']).filter(function (f) { return f !== 'email'; }),
      seenEmailsInFile: seenEmails,
      currentBatchEmails: [],
      previousBatchEmails: settings.excludePreviousOutreach === false ? [] : S.previousBatchEmails(batch.batchId),
      previousOutreach: S.getConfig('previousOutreach', []),
      suppressed: S.getConfig('suppressedEmails', []),
      blockedDomains: settings.excludeBlockedRecords === false ? [] : S.getConfig('blockedDomains', []),
      hardBounces: S.getConfig('hardBounces', []),
      salesforce: {
        contactsByEmail: settings.matchAgainstSalesforce === false ? {} : sf.contactsByEmail,
        blockedAccountIds: S.getConfig('blockedAccounts', []),
        liveProcessEmails: sf.liveProcessEmails || []
      },
      coverage: { regionOwners: buildRegionOwnerMap(ownerAssignments) }
    };

    return upload.analysis.dataRows.map(function (r) {
      var raw = {};
      upload.analysis.headers.forEach(function (h, i) { raw[h || ('Column ' + (i + 1))] = r.cells[i] == null ? '' : r.cells[i]; });

      var fullName = fieldValue(r.cells, mapping, 'fullName');
      var split = fullName ? R.splitFullName(fullName) : null;
      var normalised = {
        firstName: R.normaliseName(fieldValue(r.cells, mapping, 'firstName')) || (split ? split.firstName : ''),
        lastName: R.normaliseName(fieldValue(r.cells, mapping, 'lastName')) || (split ? split.lastName : ''),
        company: R.normaliseName(fieldValue(r.cells, mapping, 'company')),
        email: R.normaliseEmail(fieldValue(r.cells, mapping, 'email')),
        country: R.normaliseName(fieldValue(r.cells, mapping, 'country')),
        region: fieldValue(r.cells, mapping, 'region'),
        title: fieldValue(r.cells, mapping, 'title')
      };
      normalised.proposedOwner = resolveOwner(normalised, settings, ownerAssignments);

      var rowForValidation = Object.assign({ originalRowNumber: r.originalRowNumber }, normalised);
      var exceptions = R.validateRow(rowForValidation, validationContext);
      var classification = R.classifyRow(exceptions);

      var match = (validationContext.salesforce.contactsByEmail[normalised.email] || [])[0] || null;
      var primary = exceptions[0] || null;

      return {
        rowId: S.uid('ROW'),
        batchId: batch.batchId,
        originalRowNumber: r.originalRowNumber,
        rawDataJson: JSON.stringify(raw),
        normalisedDataJson: JSON.stringify(normalised),
        contactName: (normalised.firstName + ' ' + normalised.lastName).trim() || fullName || '—',
        company: normalised.company,
        email: normalised.email,
        country: normalised.country || normalised.region,
        salesforceContactId: match ? match.id : null,
        salesforceAccountId: match ? match.accountId : null,
        salesforceAccountName: match ? match.accountName : null,
        salesforceOpportunityId: null,
        matchStatus: (validationContext.salesforce.contactsByEmail[normalised.email] || []).length > 1
          ? 'Multiple matches' : (match ? 'Matched' : 'No match'),
        validationStatus: exceptions.length ? 'Exceptions' : 'Passed',
        classification: classification,
        reviewStatus: classification === R.CLASSIFICATION.REVIEW_REQUIRED ? 'Pending' : 'Not Required',
        executionStatus: 'Not Started',
        errorCode: primary ? primary.code : null,
        errorReason: exceptions.map(function (e) { return e.code + ': ' + e.message; }).join(' | ') || null,
        exceptionsJson: JSON.stringify(exceptions),
        proposedOwner: normalised.proposedOwner || null,
        currentOwner: match ? match.owner : null,
        proposedAction: proposedActionFor(classification, settings),
        approvedBy: null, approvedAt: null,
        executionKey: null, executedAt: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
    });
  }

  function buildRegionOwnerMap(ownerAssignments) {
    var map = {};
    S.getConfig('owners', []).forEach(function (o) {
      (o.regions || []).forEach(function (r) { map[String(r).toLowerCase()] = o.name; });
    });
    (ownerAssignments || []).forEach(function (a) {
      map[String(a.region).toLowerCase()] = a.owner;
    });
    return map;
  }

  function proposedActionFor(classification, settings) {
    if (classification === R.CLASSIFICATION.READY) {
      return settings.prepareDraftEmails ? 'Include in outreach output (draft email on approval)' : 'Include in review workbook';
    }
    if (classification === R.CLASSIFICATION.REVIEW_REQUIRED) return 'Resolve in Review Exceptions';
    if (classification === R.CLASSIFICATION.DUPLICATE) return 'Exclude (duplicate)';
    if (classification === R.CLASSIFICATION.BLOCKED) return 'Exclude (blocked — cannot be overridden here)';
    if (classification === R.CLASSIFICATION.INVALID) return 'Correct data or reject';
    return 'Retry failed system step';
  }

  /* ── Output workbook (demonstration text rendering of the contract) ────── */

  function csvLine(cells) {
    return cells.map(function (c) {
      var s = String(c == null ? '' : c);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }

  function generateWorkbookText(batch, rows, upload, settings, user) {
    var counts = R.countByClassification(rows);
    var rec = R.reconcile(batch.totalRows, counts);
    var out = [];
    function sheet(name) { out.push('', '════════ WORKSHEET: ' + name + ' ════════'); }

    out.push('SHOREVEST OPERATIONS — CONTROLLED OUTPUT (demonstration rendering)');
    out.push('In production this file is a formatted .xlsx generated by the Office');
    out.push('Scripts integration from the approved template: fixed column order,');
    out.push('Excel tables with filters, frozen headers, protected system fields,');
    out.push('no external links, no macros. This text rendering follows the same');
    out.push('worksheet contract. The workbook is an output and review surface —');
    out.push('it is not the workflow database; approvals happen in the portal.');

    sheet('README');
    out.push('Status definitions:');
    out.push('  Ready            — passed all checks; eligible for approved actions only.');
    out.push('  Review Required  — ambiguous; must be resolved in the portal.');
    out.push('  Duplicate        — conclusive duplication; excluded.');
    out.push('  Blocked          — compliance/suppression/blocked record; excluded.');
    out.push('  Invalid          — mandatory data missing or invalid.');
    out.push('  System Error     — technical failure; retry the system step.');

    sheet('BATCH SUMMARY');
    out.push(csvLine(['Batch ID', batch.batchId]));
    out.push(csvLine(['Submitted by', batch.submittedBy]));
    out.push(csvLine(['Processing date', batch.submittedAt]));
    out.push(csvLine(['Source file', batch.originalFilename]));
    out.push(csvLine(['Saved process', batch.savedProcessName]));
    out.push(csvLine(['Rules version', batch.rulesVersion]));
    out.push(csvLine(['Template version', batch.templateVersion]));
    out.push(csvLine(['Batch version', batch.batchVersion]));
    out.push(csvLine(['Reconciliation', rec.statement]));

    var header = ['Original Row', 'Contact Name', 'Company', 'Email', 'Country',
      'Salesforce Contact', 'Salesforce Account', 'Proposed Owner', 'Current Owner',
      'Status', 'Error Code', 'Reason', 'Proposed Action'];
    [[R.CLASSIFICATION.READY, 'READY'],
     [R.CLASSIFICATION.REVIEW_REQUIRED, 'REVIEW REQUIRED'],
     [R.CLASSIFICATION.DUPLICATE, 'DUPLICATES'],
     [R.CLASSIFICATION.BLOCKED, 'BLOCKED'],
     [R.CLASSIFICATION.INVALID, 'INVALID']].forEach(function (pair) {
      sheet(pair[1]);
      out.push(csvLine(header));
      rows.filter(function (r) { return r.classification === pair[0]; }).forEach(function (r) {
        out.push(csvLine([r.originalRowNumber, r.contactName, r.company, r.email, r.country,
          r.salesforceContactId || '', r.salesforceAccountName || '', r.proposedOwner || '',
          r.currentOwner || '', r.classification, r.errorCode || '', r.errorReason || '', r.proposedAction]));
      });
    });

    sheet('SOURCE DATA');
    out.push('Original data preserved unchanged. (Protected in the Excel output.)');
    out.push(csvLine(['Original Row'].concat(upload.analysis.headers)));
    upload.analysis.dataRows.forEach(function (r) {
      out.push(csvLine([r.originalRowNumber].concat(r.cells)));
    });

    sheet('AUDIT LOG');
    out.push(csvLine(['Time', 'Event', 'Performed by', 'Detail']));
    S.auditForBatch(batch.batchId).forEach(function (a) {
      out.push(csvLine([a.performedAt, a.eventType, a.performedBy, a.reason || a.newValue || '']));
    });

    sheet('CONFIG SNAPSHOT');
    out.push(csvLine(['Key', 'Version', 'Value']));
    S.getAllConfig().forEach(function (c) {
      out.push(csvLine([c.key, c.version, c.value]));
    });

    return out.join('\n');
  }

  /* ── Approvals ─────────────────────────────────────────────────────────── */

  var APPROVAL_LEVELS = [
    { key: 'data', label: 'Data approval', capability: 'processBatches' },
    { key: 'owner', label: 'Relationship-owner approval', capability: 'approveCoverage' },
    { key: 'execution', label: 'Execution approval', capability: 'approveExecution' }
  ];

  function getApprovals(batch) {
    try { return JSON.parse(batch.approvalsJson || '{}'); } catch (e) { return {}; }
  }

  function approveBatch(batchId, level, user) {
    var batch = S.getBatch(batchId);
    if (!batch) return { ok: false, reason: 'Batch not found.' };
    if (batch.requiresRevalidation) {
      return { ok: false, reason: 'Configuration changed after this batch was validated. Re-run validation before approving.' };
    }
    var levelDef = APPROVAL_LEVELS.filter(function (l) { return l.key === level; })[0];
    if (!levelDef) return { ok: false, reason: 'Unknown approval level.' };
    if (!R.can(user.role, levelDef.capability)) {
      return { ok: false, reason: 'Your role cannot grant ' + levelDef.label + '.' };
    }
    var pendingReview = S.getRows(batchId).filter(function (r) { return r.reviewStatus === 'Pending'; }).length;
    if (pendingReview > 0) {
      return { ok: false, reason: pendingReview + ' row(s) still require review. All exceptions must be resolved before approval.' };
    }
    var approvals = getApprovals(batch);
    approvals[level] = { by: user.name, at: new Date().toISOString() };
    var allGranted = APPROVAL_LEVELS.every(function (l) { return approvals[l.key]; });
    S.updateBatch(batchId, {
      approvalsJson: JSON.stringify(approvals),
      approvedForExecution: allGranted,
      approvedBatchVersion: allGranted ? batch.batchVersion : batch.approvedBatchVersion,
      configVersionAtApproval: allGranted ? S.configVersionSum() : batch.configVersionAtApproval,
      status: allGranted ? R.BATCH_STATUS.AWAITING_APPROVAL : batch.status
    }, user.name, 'ApprovalGranted', levelDef.label + ' granted by ' + user.name);
    return { ok: true, allGranted: allGranted };
  }

  /* ── Execution (idempotent, fail closed) ───────────────────────────────── */

  var ACTION_TYPES = {
    prepareDraftEmails: { label: 'Prepare Draft Emails', settingKey: 'prepareDraftEmails' },
    createSalesforceActions: { label: 'Create Salesforce Actions', settingKey: 'createSalesforceActions' },
    updateSalesforce: { label: 'Update Salesforce', settingKey: 'updateSalesforce' }
  };

  /**
   * Determine whether an action button may be enabled for a batch, and why
   * not. Buttons are disabled unless every condition is met.
   */
  function executionGate(batchId, actionType, user) {
    var batch = S.getBatch(batchId);
    if (!batch) return { allowed: false, reasons: ['Batch not found.'] };
    var reasons = [];
    var settings = JSON.parse(batch.settingsJson || '{}');
    var def = ACTION_TYPES[actionType];
    if (!def) return { allowed: false, reasons: ['Unknown action.'] };
    if (!R.can(user.role, 'approveExecution') && actionType !== 'prepareDraftEmails') {
      reasons.push('Only an Execution Approver may run Salesforce actions.');
    }
    if (!R.can(user.role, 'processBatches')) reasons.push('Your role cannot execute batch actions.');
    if (!settings[def.settingKey]) reasons.push('"' + def.label + '" was not enabled in the confirmed settings for this run.');
    if (settings.dryRun !== false) reasons.push('This run is a dry run. External actions are disabled.');
    if (!batch.approvedForExecution) reasons.push('The batch has not completed all three approval levels (data, relationship owner, execution).');
    if (batch.requiresRevalidation) reasons.push('Configuration changed after approval; the batch must be revalidated.');
    if (batch.approvedBatchVersion !== batch.batchVersion) reasons.push('The current batch version does not match the approved version.');
    if (batch.locked) reasons.push('The batch is locked by another process.');
    var pendingReview = S.getRows(batchId).filter(function (r) { return r.reviewStatus === 'Pending'; }).length;
    if (pendingReview) reasons.push(pendingReview + ' row(s) still require review.');
    return { allowed: reasons.length === 0, reasons: reasons, batch: batch, settings: settings };
  }

  /**
   * Execute an approved external action across eligible rows with
   * execution-key idempotency. Demo mode simulates and labels results.
   */
  function executeAction(batchId, actionType, user) {
    var gate = executionGate(batchId, actionType, user);
    if (!gate.allowed) return Promise.resolve({ ok: false, reasons: gate.reasons });

    var batch = gate.batch;
    var lock = S.lockBatch(batchId, user.name, 'exec-' + Date.now());
    if (!lock.acquired) return Promise.resolve({ ok: false, reasons: [lock.reason] });

    var settings = gate.settings;
    var results = { executed: 0, alreadyExecuted: 0, skipped: 0, failures: 0 };
    var rows = S.getRows(batchId);

    rows.forEach(function (row) {
      var condition = R.canExecuteRow({
        batchApprovedForExecution: batch.approvedForExecution,
        rowClassification: row.classification,
        reviewStatus: row.reviewStatus,
        dryRun: settings.dryRun,
        executionStatus: row.executionStatus,
        senderAuthorised: !!settings.sender,
        templateApproved: !!settings.template,
        recipientValid: R.isValidEmail(row.email),
        suppressionCheckPassed: (S.getConfig('suppressedEmails', [])).indexOf(row.email) === -1,
        ownerCheckPassed: !!row.proposedOwner,
        duplicateCheckPassed: row.classification !== R.CLASSIFICATION.DUPLICATE,
        batchVersion: batch.batchVersion,
        approvedBatchVersion: batch.approvedBatchVersion
      });
      if (!condition.allowed) { results.skipped++; return; }

      var key = R.buildExecutionKey(batch.batchId, row.rowId, actionType, row.email, batch.templateVersion);
      var check = R.checkExecutionKey(key, S.load().executionRegistry);
      if (!check.allowed) {
        results.alreadyExecuted++;
        S.updateRow(batchId, row.rowId, { executionStatus: 'Already Executed' }, user.name,
          'ExecutionSkipped', 'Execution key already exists — repeat prevented.');
        S.addAlert({ severity: 'warning', kind: 'Duplicate execution attempt',
          detail: 'Key ' + key + ' already executed; repeat prevented.', batchId: batchId });
        return;
      }
      var begin = S.beginExecution(key, { batchId: batchId, rowId: row.rowId,
        executedBy: user.name, actionType: actionType });
      if (!begin.ok) { results.alreadyExecuted++; return; }

      /* DEMO: the external call is simulated. PRODUCTION: the flow performs
         the real action and reports back; on any uncertainty the key stays
         'In Flight' and counts as possibly executed. */
      S.finishExecution(key, { success: true, detail: 'Simulated in demonstration mode — no external system was contacted.' },
        { batchId: batchId, rowId: row.rowId, executedBy: user.name });
      S.updateRow(batchId, row.rowId, {
        executionStatus: 'Executed (simulated)', executionKey: key,
        executedAt: new Date().toISOString()
      }, user.name, 'Executed', ACTION_TYPES[actionType].label + ' (simulated)');
      results.executed++;
    });

    S.unlockBatch(batchId, user.name);
    S.updateBatch(batchId, { status: R.BATCH_STATUS.COMPLETE }, user.name, 'ExecutionCompleted',
      ACTION_TYPES[actionType].label + ': ' + results.executed + ' executed, ' +
      results.alreadyExecuted + ' already executed, ' + results.skipped + ' skipped.');
    return Promise.resolve({ ok: true, results: results });
  }

  /* ── Controlled reruns ─────────────────────────────────────────────────── */

  function newBatchVersion(batchId, user, reason) {
    var batch = S.getBatch(batchId);
    if (!batch) return null;
    /* A completed batch is never changed silently: version increments and
       all approvals reset. */
    return S.updateBatch(batchId, {
      batchVersion: batch.batchVersion + 1,
      approvedForExecution: false,
      approvalsJson: '{}',
      requiresRevalidation: false
    }, user.name, 'BatchVersionCreated', reason || 'New batch version created.');
  }

  function regenerateWorkbook(batchId, user) {
    var batch = S.getBatch(batchId);
    var rows = S.getRows(batchId);
    var src = S.getSourceFile(batchId);
    if (!batch || !src) return { ok: false, reason: 'Batch or source data unavailable.' };
    var upload = {
      analysis: {
        headers: src.headers,
        dataRows: (src.rows || []).map(function (r) { return { originalRowNumber: r.n, cells: r.cells }; })
      }
    };
    var doc = generateWorkbookText(batch, rows, upload, JSON.parse(batch.settingsJson || '{}'), user);
    S.updateBatch(batchId, { outputText: doc }, user.name, 'WorkbookRegenerated');
    return { ok: true };
  }

  return (root.SVPortalWorkflow = {
    inspectUpload: inspectUpload,
    analyseActiveSheet: analyseActiveSheet,
    validateUpload: validateUpload,
    runBatch: runBatch,
    APPROVAL_LEVELS: APPROVAL_LEVELS,
    getApprovals: getApprovals,
    approveBatch: approveBatch,
    ACTION_TYPES: ACTION_TYPES,
    executionGate: executionGate,
    executeAction: executeAction,
    newBatchVersion: newBatchVersion,
    regenerateWorkbook: regenerateWorkbook,
    resolveOwner: resolveOwner,
    resolveRegionGroup: resolveRegionGroup
  });
})(typeof self !== 'undefined' ? self : this);
