/* ==========================================================================
   ShoreVest Operations — Rules Engine
   Pure, deterministic business rules for the Employee Portal:
   error codes, column mapping, file/row validation, classification,
   reconciliation, execution keys, execution conditions, and the
   natural-language instruction interpreter.

   This module contains NO network calls, NO DOM access, and NO state.
   It is loaded both in the browser (window.SVPortalRules) and in Node
   for the test suite (module.exports).

   Central operating principle:
     The system may stop unnecessarily, but it must never continue
     incorrectly. Ambiguity always routes to review; nothing is guessed.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.SVPortalRules = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ────────────────────────────────────────────────────────────────────────
     1. Constants
     ──────────────────────────────────────────────────────────────────────── */

  var CLASSIFICATION = {
    READY: 'Ready',
    REVIEW_REQUIRED: 'Review Required',
    DUPLICATE: 'Duplicate',
    BLOCKED: 'Blocked',
    INVALID: 'Invalid',
    SYSTEM_ERROR: 'System Error'
  };

  /* Classification precedence, applied strictly in this order. */
  var CLASSIFICATION_ORDER = [
    CLASSIFICATION.BLOCKED,
    CLASSIFICATION.INVALID,
    CLASSIFICATION.DUPLICATE,
    CLASSIFICATION.REVIEW_REQUIRED,
    CLASSIFICATION.SYSTEM_ERROR
  ];

  var BATCH_STATUS = {
    UPLOADED: 'Uploaded',
    VALIDATING_FILE: 'Validating File',
    DETECTING_COLUMNS: 'Detecting Columns',
    MAPPING_COLUMNS: 'Mapping Columns',
    NORMALISING_DATA: 'Normalising Data',
    CHECKING_DUPLICATES: 'Checking Duplicates',
    MATCHING_SALESFORCE: 'Matching Salesforce',
    APPLYING_RULES: 'Applying Rules',
    CLASSIFYING_RECORDS: 'Classifying Records',
    RECONCILING_RESULTS: 'Reconciling Results',
    GENERATING_WORKBOOK: 'Generating Workbook',
    REVIEW_REQUIRED: 'Review Required',
    AWAITING_APPROVAL: 'Awaiting Approval',
    EXECUTING: 'Executing Approved Actions',
    COMPLETE: 'Complete',
    FAILED: 'Failed',
    FAILED_RECONCILIATION: 'Failed Reconciliation'
  };

  var PROCESSING_STAGES = [
    BATCH_STATUS.UPLOADED,
    BATCH_STATUS.VALIDATING_FILE,
    BATCH_STATUS.DETECTING_COLUMNS,
    BATCH_STATUS.MAPPING_COLUMNS,
    BATCH_STATUS.NORMALISING_DATA,
    BATCH_STATUS.CHECKING_DUPLICATES,
    BATCH_STATUS.MATCHING_SALESFORCE,
    BATCH_STATUS.APPLYING_RULES,
    BATCH_STATUS.CLASSIFYING_RECORDS,
    BATCH_STATUS.RECONCILING_RESULTS,
    BATCH_STATUS.GENERATING_WORKBOOK
  ];

  var REVIEW_DECISIONS = [
    'Approve', 'Reject', 'Correct and Approve', 'Reassign',
    'Mark Duplicate', 'Defer', 'Block'
  ];

  var ROLES = {
    EMPLOYEE: 'Employee',
    IR_OPERATIONS: 'IR Operations',
    RELATIONSHIP_MANAGER: 'Relationship Manager',
    EXECUTION_APPROVER: 'Execution Approver',
    ADMINISTRATOR: 'Administrator',
    AUDITOR: 'Management / Auditor'
  };

  /* Capability matrix. Every UI surface and action gate checks these —
     never the role name directly. */
  var PERMISSIONS = {};
  PERMISSIONS[ROLES.EMPLOYEE] = {
    submitFiles: true, viewOwnBatches: true, viewAllBatches: false,
    processBatches: false, reviewExceptions: false, approveCoverage: false,
    approveExecution: false, administer: false, viewAudit: false, viewMonitoring: false
  };
  PERMISSIONS[ROLES.IR_OPERATIONS] = {
    submitFiles: true, viewOwnBatches: true, viewAllBatches: true,
    processBatches: true, reviewExceptions: true, approveCoverage: false,
    approveExecution: false, administer: false, viewAudit: true, viewMonitoring: false
  };
  PERMISSIONS[ROLES.RELATIONSHIP_MANAGER] = {
    submitFiles: false, viewOwnBatches: true, viewAllBatches: false,
    processBatches: false, reviewExceptions: true, approveCoverage: true,
    approveExecution: false, administer: false, viewAudit: false, viewMonitoring: false
  };
  PERMISSIONS[ROLES.EXECUTION_APPROVER] = {
    submitFiles: false, viewOwnBatches: true, viewAllBatches: true,
    processBatches: false, reviewExceptions: true, approveCoverage: false,
    approveExecution: true, administer: false, viewAudit: true, viewMonitoring: false
  };
  PERMISSIONS[ROLES.ADMINISTRATOR] = {
    submitFiles: true, viewOwnBatches: true, viewAllBatches: true,
    processBatches: true, reviewExceptions: true, approveCoverage: false,
    approveExecution: false, administer: true, viewAudit: true, viewMonitoring: true
  };
  PERMISSIONS[ROLES.AUDITOR] = {
    submitFiles: false, viewOwnBatches: true, viewAllBatches: true,
    processBatches: false, reviewExceptions: false, approveCoverage: false,
    approveExecution: false, administer: false, viewAudit: true, viewMonitoring: true
  };

  function can(role, capability) {
    var caps = PERMISSIONS[role];
    return !!(caps && caps[capability]);
  }

  /* ────────────────────────────────────────────────────────────────────────
     2. Error codes
     Every exception carries a machine-readable code, a plain-English
     explanation, a proposed resolution, and the classification category
     it drives (used by the precedence rules).
     ──────────────────────────────────────────────────────────────────────── */

  var ERROR_CODES = {
    E001_MISSING_EMAIL: {
      category: CLASSIFICATION.INVALID,
      message: 'The row has no email address.',
      resolution: 'Add an email address, or reject the row.'
    },
    E002_INVALID_EMAIL: {
      category: CLASSIFICATION.INVALID,
      message: 'The email address is not in a valid format.',
      resolution: 'Correct the email address, or reject the row.'
    },
    E003_DUPLICATE_IN_FILE: {
      category: CLASSIFICATION.DUPLICATE,
      message: 'The same email address appears more than once in the uploaded file.',
      resolution: 'Keep the first occurrence; later occurrences are marked duplicate.'
    },
    E004_DUPLICATE_PREVIOUS_BATCH: {
      category: CLASSIFICATION.DUPLICATE,
      message: 'This contact was already processed in a previous batch.',
      resolution: 'No action needed unless a deliberate re-run is intended.'
    },
    E005_EXISTING_CONTACT: {
      category: CLASSIFICATION.DUPLICATE,
      message: 'A matching Salesforce Contact already exists.',
      resolution: 'Handle through the existing-contact workflow rather than new outreach.'
    },
    E006_MULTIPLE_SALESFORCE_MATCHES: {
      category: CLASSIFICATION.REVIEW_REQUIRED,
      message: 'More than one plausible Salesforce record matches this row.',
      resolution: 'A reviewer must select the correct Salesforce record.'
    },
    E007_OWNER_CONFLICT: {
      category: CLASSIFICATION.REVIEW_REQUIRED,
      message: 'The proposed coverage owner conflicts with the current Salesforce owner.',
      resolution: 'The relationship owner must confirm or reassign coverage.'
    },
    E008_SUPPRESSED: {
      category: CLASSIFICATION.BLOCKED,
      message: 'The contact has opted out or is on a suppression list.',
      resolution: 'Do not contact. Suppression cannot be overridden in this workflow.'
    },
    E009_BLOCKED_DOMAIN: {
      category: CLASSIFICATION.BLOCKED,
      message: 'The email domain is on the blocked-domain list.',
      resolution: 'Do not contact. An administrator manages the blocked-domain list.'
    },
    E010_REQUIRED_FIELD_MISSING: {
      category: CLASSIFICATION.INVALID,
      message: 'A mandatory field for this process is missing.',
      resolution: 'Complete the missing field, or reject the row.'
    },
    E011_EXISTING_LIVE_PROCESS: {
      category: CLASSIFICATION.REVIEW_REQUIRED,
      message: 'There is an existing live relationship or open process for this contact.',
      resolution: 'The relationship owner must decide whether outreach is appropriate.'
    },
    E012_FILE_ALREADY_PROCESSED: {
      category: CLASSIFICATION.BLOCKED,
      message: 'An identical file has already been processed.',
      resolution: 'Open the previous batch, or confirm a deliberate re-run as a new batch version.'
    },
    E013_SYSTEM_CONNECTION_FAILURE: {
      category: CLASSIFICATION.SYSTEM_ERROR,
      message: 'A required system connection failed while processing this row.',
      resolution: 'Retry the failed system step once the connection is restored.'
    },
    E014_GENERIC_EMAIL: {
      category: CLASSIFICATION.REVIEW_REQUIRED,
      message: 'The email address is a generic mailbox (e.g. info@, office@).',
      resolution: 'A reviewer must confirm the mailbox is an acceptable recipient.'
    },
    E015_PLACEHOLDER_DATA: {
      category: CLASSIFICATION.INVALID,
      message: 'The row appears to contain placeholder or test data.',
      resolution: 'Replace with real data, or reject the row.'
    },
    E016_OWNER_UNRESOLVED: {
      category: CLASSIFICATION.REVIEW_REQUIRED,
      message: 'No coverage owner could be determined for this row.',
      resolution: 'A reviewer must assign a coverage owner.'
    },
    E017_BLOCKED_ACCOUNT: {
      category: CLASSIFICATION.BLOCKED,
      message: 'The matched account is on the blocked-account list.',
      resolution: 'Do not contact. An administrator manages the blocked-account list.'
    },
    E018_HARD_BOUNCE: {
      category: CLASSIFICATION.BLOCKED,
      message: 'A previous email to this address hard-bounced.',
      resolution: 'Do not email this address. Obtain a corrected address.'
    },
    E019_ALREADY_EXECUTED: {
      category: CLASSIFICATION.REVIEW_REQUIRED,
      message: 'This exact action has already been executed for this row.',
      resolution: 'No repeat is permitted. Review the previous execution result.'
    }
  };

  function describeError(code) {
    var def = ERROR_CODES[code];
    return def ? { code: code, category: def.category, message: def.message, resolution: def.resolution }
               : { code: code, category: CLASSIFICATION.REVIEW_REQUIRED, message: 'Unrecognised exception code.', resolution: 'Route to review.' };
  }

  /* ────────────────────────────────────────────────────────────────────────
     3. Column detection and mapping
     ──────────────────────────────────────────────────────────────────────── */

  /* Canonical fields and their approved aliases. Administrators can extend
     these through Configuration; these are the shipped defaults. */
  var COLUMN_ALIASES = {
    firstName: ['first name', 'firstname', 'given name', 'forename', 'first'],
    lastName: ['last name', 'lastname', 'surname', 'family name', 'last'],
    fullName: ['name', 'full name', 'contact name', 'contact'],
    company: ['company', 'company name', 'firm', 'firm name', 'organisation',
              'organization', 'account', 'account name'],
    email: ['email', 'email address', 'e-mail', 'e-mail address',
            'business email', 'work email'],
    country: ['country', 'country/region', 'nation'],
    region: ['region', 'territory', 'coverage region'],
    title: ['title', 'job title', 'position', 'role'],
    phone: ['phone', 'phone number', 'telephone', 'mobile', 'mobile phone'],
    owner: ['owner', 'owner name', 'contact owner', 'account owner', 'coverage owner'],
    salesforceContactId: ['contact id', 'salesforce contact id', 'sfdc contact id'],
    salesforceAccountId: ['account id', 'salesforce account id', 'sfdc account id']
  };

  function normaliseHeader(h) {
    return String(h == null ? '' : h).trim().toLowerCase()
      .replace(/[_\-.]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /* Loose similarity used ONLY to *propose* a mapping for confirmation —
     never to map silently. */
  function headerSimilarity(header, alias) {
    if (header === alias) return 1;
    var h = header.replace(/\s/g, ''), a = alias.replace(/\s/g, '');
    if (h === a) return 0.95;
    if (h.indexOf(a) !== -1 || a.indexOf(h) !== -1) return 0.8;
    return 0;
  }

  /**
   * Map raw file headers onto canonical fields.
   * Rules (in order, per field):
   *   exact approved alias            → mapped automatically ('exact')
   *   one strong likely match         → proposed, requires confirmation ('proposed')
   *   multiple possible matches       → requires user selection ('ambiguous')
   *   no credible match               → unmapped (stop or manual mapping)
   * Never silently guesses between multiple plausible columns.
   */
  function mapColumns(headers, aliasOverrides) {
    var aliases = aliasOverrides || COLUMN_ALIASES;
    var norm = headers.map(function (h, i) { return { raw: h, norm: normaliseHeader(h), index: i }; });
    var result = { mapped: {}, proposed: {}, ambiguous: {}, unmapped: [] };
    var claimed = {};

    Object.keys(aliases).forEach(function (field) {
      var fieldAliases = aliases[field].map(normaliseHeader);
      var exact = [], loose = [];
      norm.forEach(function (col) {
        if (claimed[col.index]) return;
        if (fieldAliases.indexOf(col.norm) !== -1) { exact.push(col); return; }
        var best = 0;
        fieldAliases.forEach(function (a) { best = Math.max(best, headerSimilarity(col.norm, a)); });
        if (best >= 0.8) loose.push(col);
      });
      if (exact.length === 1) {
        result.mapped[field] = { column: exact[0].raw, index: exact[0].index, confidence: 'exact' };
        claimed[exact[0].index] = true;
      } else if (exact.length > 1) {
        result.ambiguous[field] = exact.map(function (c) { return { column: c.raw, index: c.index }; });
      } else if (loose.length === 1) {
        result.proposed[field] = { column: loose[0].raw, index: loose[0].index, confidence: 'proposed' };
      } else if (loose.length > 1) {
        result.ambiguous[field] = loose.map(function (c) { return { column: c.raw, index: c.index }; });
      } else {
        result.unmapped.push(field);
      }
    });
    return result;
  }

  /**
   * Decide whether mapping can proceed given the required fields for the
   * selected process. Returns { ok, requiresConfirmation, requiresSelection,
   * missing } — the UI must resolve confirmations/selections before running.
   */
  function assessMapping(mapping, requiredFields) {
    var required = requiredFields || ['email', 'company'];
    var missing = [], requiresSelection = [], requiresConfirmation = [];
    required.forEach(function (field) {
      if (mapping.mapped[field]) return;
      if (mapping.proposed[field]) { requiresConfirmation.push(field); return; }
      if (mapping.ambiguous[field]) { requiresSelection.push(field); return; }
      /* fullName can satisfy firstName/lastName requirements for splitting */
      if ((field === 'firstName' || field === 'lastName') &&
          (mapping.mapped.fullName || mapping.proposed.fullName)) return;
      missing.push(field);
    });
    return {
      ok: missing.length === 0 && requiresSelection.length === 0 && requiresConfirmation.length === 0,
      requiresConfirmation: requiresConfirmation,
      requiresSelection: requiresSelection,
      missing: missing
    };
  }

  /* ────────────────────────────────────────────────────────────────────────
     4. Header-row detection
     ──────────────────────────────────────────────────────────────────────── */

  function headerRowScore(cells) {
    if (!cells || !cells.length) return 0;
    var known = 0, nonEmpty = 0, allAliases = [];
    Object.keys(COLUMN_ALIASES).forEach(function (f) {
      COLUMN_ALIASES[f].forEach(function (a) { allAliases.push(normaliseHeader(a)); });
    });
    cells.forEach(function (c) {
      var n = normaliseHeader(c);
      if (!n) return;
      nonEmpty++;
      if (allAliases.indexOf(n) !== -1) known++;
    });
    if (!nonEmpty) return 0;
    /* Header rows contain mostly text labels, several of them recognisable. */
    return known * 2 + nonEmpty * 0.1;
  }

  /**
   * Detect the header row within the first rows of a sheet.
   * Returns { index, score, ambiguous, candidates }.
   * ambiguous=true when two rows score equally well — the file must stop.
   */
  function detectHeaderRow(rows, scanLimit) {
    var limit = Math.min(rows.length, scanLimit || 10);
    var candidates = [];
    for (var i = 0; i < limit; i++) {
      var score = headerRowScore(rows[i]);
      if (score >= 2) candidates.push({ index: i, score: score });
    }
    if (!candidates.length) return { index: -1, score: 0, ambiguous: false, candidates: [] };
    candidates.sort(function (a, b) { return b.score - a.score || a.index - b.index; });
    var ambiguous = candidates.length > 1 && candidates[0].score === candidates[1].score;
    return { index: candidates[0].index, score: candidates[0].score, ambiguous: ambiguous, candidates: candidates };
  }

  /* Salesforce report heuristic: exported reports carry characteristic
     columns and often a trailing footer line. */
  function looksLikeSalesforceExport(headers) {
    var norm = (headers || []).map(normaliseHeader);
    var markers = ['contact id', 'account id', 'opportunity id', 'contact owner',
                   'account owner', 'created date', 'last activity', 'lead source',
                   'salutation', 'mailing country', 'stage', 'close date'];
    var hits = norm.filter(function (h) { return markers.indexOf(h) !== -1; }).length;
    return hits >= 2;
  }

  /* ────────────────────────────────────────────────────────────────────────
     5. File-level validation
     ──────────────────────────────────────────────────────────────────────── */

  var SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

  /**
   * Validate a whole file before any row processing.
   * `file` — { name, size, type ('xlsx'|'xls'|'csv'|'unknown'), rowCount,
   *            encrypted, corrupted, uploading, locked, hash, hasMacros,
   *            hasExternalLinks }
   * `context` — { config: {maxFileBytes, maxRows}, processedHashes: [],
   *               headerDetection, mappingAssessment, processCompatible,
   *               configurationAvailable }
   * Returns array of { code, reason } — empty means the file may proceed.
   */
  function validateFile(file, context) {
    var problems = [];
    var cfg = (context && context.config) || {};
    var maxBytes = cfg.maxFileBytes || 25 * 1024 * 1024;
    var maxRows = cfg.maxRows || 50000;

    function reject(code, reason) { problems.push({ code: code, reason: reason }); }

    if (context && context.configurationAvailable === false) {
      reject('E013_SYSTEM_CONNECTION_FAILURE', 'Configuration data required for processing is unavailable. Processing is disabled until configuration can be read.');
      return problems; /* cannot validate further without configuration */
    }
    if (file.uploading) reject('FILE_UPLOADING', 'The file is still uploading. Wait for the upload to finish.');
    if (file.locked) reject('FILE_LOCKED', 'The file is locked by another application. Close it and upload again.');
    var ext = '.' + String(file.name || '').split('.').pop().toLowerCase();
    if (SUPPORTED_EXTENSIONS.indexOf(ext) === -1 || file.type === 'unknown') {
      reject('FILE_UNSUPPORTED_TYPE', 'Unsupported file type "' + ext + '". Accepted types: .xlsx, .xls, .csv.');
    }
    if (!file.size) reject('FILE_EMPTY', 'The file is empty (0 bytes).');
    else if (file.rowCount === 0) reject('FILE_EMPTY', 'The file contains no data rows.');
    if (file.corrupted) reject('FILE_CORRUPTED', 'The file appears to be corrupted and cannot be read.');
    if (file.encrypted) reject('FILE_PASSWORD_PROTECTED', 'The file is password protected. Remove the password and upload again.');
    if (file.size > maxBytes) reject('FILE_TOO_LARGE', 'The file exceeds the configured size limit of ' + Math.round(maxBytes / (1024 * 1024)) + ' MB.');
    if (file.rowCount > maxRows) reject('FILE_TOO_MANY_ROWS', 'The file exceeds the configured limit of ' + maxRows + ' rows.');
    if (file.hasMacros) reject('FILE_MACROS', 'The workbook contains macros, which are not permitted in this workflow.');
    if (file.hasExternalLinks) reject('FILE_EXTERNAL_LINKS', 'The workbook contains external connections, which are not permitted in this workflow.');

    if (context && context.headerDetection) {
      if (context.headerDetection.index === -1) {
        reject('FILE_NO_HEADER', 'No usable header row was detected.');
      } else if (context.headerDetection.ambiguous) {
        reject('FILE_AMBIGUOUS_HEADER', 'Multiple equally plausible header rows were detected. The correct header row must be confirmed manually.');
      }
    }
    if (context && context.mappingAssessment && context.mappingAssessment.missing && context.mappingAssessment.missing.length) {
      reject('FILE_REQUIRED_COLUMNS', 'Required columns could not be identified: ' + context.mappingAssessment.missing.join(', ') + '.');
    }
    if (context && context.processedHashes && file.hash && context.processedHashes.indexOf(file.hash) !== -1) {
      reject('E012_FILE_ALREADY_PROCESSED', 'This exact file has already been processed. Open the previous batch, or confirm a deliberate re-run.');
    }
    if (context && context.processCompatible === false) {
      reject('FILE_PROCESS_INCOMPATIBLE', 'The selected saved process is incompatible with the structure of this file.');
    }
    return problems;
  }

  /* ────────────────────────────────────────────────────────────────────────
     6. Normalisation helpers
     ──────────────────────────────────────────────────────────────────────── */

  var EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

  var GENERIC_MAILBOXES = ['info', 'admin', 'office', 'contact', 'hello', 'sales',
    'support', 'enquiries', 'inquiries', 'mail', 'team', 'hr', 'ir', 'pr',
    'noreply', 'no-reply', 'donotreply', 'reception', 'general'];

  var PLACEHOLDER_TOKENS = ['test', 'testing', 'asdf', 'qwerty', 'xxx', 'zzz',
    'dummy', 'sample', 'placeholder', 'n/a', 'na', 'tbd', 'tbc', 'unknown',
    'none', 'delete', 'x'];
  var PLACEHOLDER_DOMAINS = ['example.com', 'example.org', 'test.com', 'email.com',
    'domain.com', 'company.com', 'nowhere.com'];

  function normaliseEmail(email) {
    return String(email == null ? '' : email).trim().toLowerCase();
  }
  function emailDomain(email) {
    var e = normaliseEmail(email);
    var at = e.lastIndexOf('@');
    return at === -1 ? '' : e.slice(at + 1);
  }
  function isValidEmail(email) {
    var e = normaliseEmail(email);
    return !!e && e.length <= 254 && EMAIL_RE.test(e);
  }
  function isGenericEmail(email) {
    var e = normaliseEmail(email);
    var at = e.indexOf('@');
    if (at === -1) return false;
    return GENERIC_MAILBOXES.indexOf(e.slice(0, at)) !== -1;
  }
  function isPlaceholderValue(value) {
    var v = String(value == null ? '' : value).trim().toLowerCase();
    if (!v) return false;
    return PLACEHOLDER_TOKENS.indexOf(v) !== -1;
  }
  function isPlaceholderEmail(email) {
    var e = normaliseEmail(email);
    if (!e) return false;
    var dom = emailDomain(e);
    if (PLACEHOLDER_DOMAINS.indexOf(dom) !== -1) return true;
    var local = e.split('@')[0];
    return PLACEHOLDER_TOKENS.indexOf(local) !== -1;
  }
  function normaliseName(name) {
    var n = String(name == null ? '' : name).trim().replace(/\s+/g, ' ');
    if (!n) return '';
    if (n === n.toUpperCase() || n === n.toLowerCase()) {
      return n.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
    }
    return n;
  }
  function splitFullName(full) {
    var n = normaliseName(full);
    if (!n) return { firstName: '', lastName: '' };
    if (n.indexOf(',') !== -1) {
      var parts = n.split(',');
      return { firstName: parts.slice(1).join(',').trim(), lastName: parts[0].trim() };
    }
    var words = n.split(' ');
    if (words.length === 1) return { firstName: words[0], lastName: '' };
    return { firstName: words.slice(0, -1).join(' '), lastName: words[words.length - 1] };
  }

  /* ────────────────────────────────────────────────────────────────────────
     7. Row validation
     ──────────────────────────────────────────────────────────────────────── */

  /**
   * Validate a single normalised row.
   *
   * `row` — { originalRowNumber, firstName, lastName, company, email, country, region }
   * `context` —
   *   settings:            the confirmed run settings (see interpreter)
   *   requiredFields:      e.g. ['firstName','company','email']
   *   seenEmailsInFile:    Map/obj email → first original row number
   *   currentBatchEmails:  emails already accepted into this batch
   *   previousBatchEmails: emails processed in prior batches
   *   salesforce:          { contactsByEmail: {email: [contacts]},
   *                          blockedAccountIds: [], liveProcessEmails: [],
   *                          openOpportunityAccountIds: [] }
   *   previousOutreach:    [emails]
   *   suppressed:          [emails]
   *   blockedDomains:      [domains]
   *   hardBounces:         [emails]
   *   coverage:            { regionOwners: {regionLower: owner} }
   *   systemFailure:       truthy when a connector failed for this row
   *
   * Returns array of exception objects: { code, category, message, resolution }.
   */
  function validateRow(row, context) {
    var ctx = context || {};
    var settings = ctx.settings || {};
    var exceptions = [];
    function add(code, extra) {
      var e = describeError(code);
      if (extra) e.message = e.message + ' ' + extra;
      exceptions.push(e);
    }

    /* System failures are recorded but do not stop business validation of
       what can still be checked locally. */
    if (ctx.systemFailure) add('E013_SYSTEM_CONNECTION_FAILURE');

    var email = normaliseEmail(row.email);
    var domain = emailDomain(email);

    /* Mandatory information */
    if (!email) add('E001_MISSING_EMAIL');
    else if (!isValidEmail(email)) add('E002_INVALID_EMAIL');

    (ctx.requiredFields || []).forEach(function (f) {
      if (f === 'email') return; /* handled above */
      var v = row[f];
      if (v == null || String(v).trim() === '') {
        add('E010_REQUIRED_FIELD_MISSING', '(' + f + ')');
      }
    });

    /* Placeholder / test data */
    if (isPlaceholderEmail(email) ||
        isPlaceholderValue(row.firstName) || isPlaceholderValue(row.lastName) ||
        isPlaceholderValue(row.company)) {
      add('E015_PLACEHOLDER_DATA');
    }

    if (email && isValidEmail(email)) {
      /* Compliance and blocked-record checks */
      if (arr(ctx.suppressed).indexOf(email) !== -1) add('E008_SUPPRESSED');
      if (domain && arr(ctx.blockedDomains).indexOf(domain) !== -1) add('E009_BLOCKED_DOMAIN');
      if (arr(ctx.hardBounces).indexOf(email) !== -1) add('E018_HARD_BOUNCE');

      /* Generic mailbox */
      if (isGenericEmail(email)) add('E014_GENERIC_EMAIL');

      /* Duplicates */
      var seen = ctx.seenEmailsInFile || {};
      if (Object.prototype.hasOwnProperty.call(seen, email) &&
          seen[email] !== row.originalRowNumber) {
        add('E003_DUPLICATE_IN_FILE', '(first seen at row ' + seen[email] + ')');
      }
      if (arr(ctx.currentBatchEmails).indexOf(email) !== -1) {
        add('E003_DUPLICATE_IN_FILE', '(already accepted into this batch)');
      }
      if (arr(ctx.previousBatchEmails).indexOf(email) !== -1) add('E004_DUPLICATE_PREVIOUS_BATCH');

      /* Previous outreach */
      if (settings.excludePreviousOutreach !== false &&
          arr(ctx.previousOutreach).indexOf(email) !== -1) {
        add('E004_DUPLICATE_PREVIOUS_BATCH', '(previous outreach on record)');
      }

      /* Salesforce matching */
      var sf = ctx.salesforce || {};
      var matches = (sf.contactsByEmail && sf.contactsByEmail[email]) || [];
      if (matches.length > 1) {
        add('E006_MULTIPLE_SALESFORCE_MATCHES', '(' + matches.length + ' candidate records)');
      } else if (matches.length === 1) {
        var match = matches[0];
        if (match.accountId && arr(sf.blockedAccountIds).indexOf(match.accountId) !== -1) {
          add('E017_BLOCKED_ACCOUNT');
        }
        if (settings.treatExistingContacts === 'include') {
          /* Existing-contact reconnect processes deliberately keep matches. */
        } else {
          add('E005_EXISTING_CONTACT', match.name ? '(' + match.name + ')' : '');
        }
        if (match.owner && row.proposedOwner && match.owner !== row.proposedOwner) {
          add('E007_OWNER_CONFLICT', '(current owner: ' + match.owner + ')');
        }
      }
      if (arr(sf.liveProcessEmails).indexOf(email) !== -1) add('E011_EXISTING_LIVE_PROCESS');
    }

    /* Coverage ownership */
    if (!row.proposedOwner) {
      var owners = (ctx.coverage && ctx.coverage.regionOwners) || {};
      var regionKey = String(row.region || row.country || '').trim().toLowerCase();
      if (!regionKey || !owners[regionKey]) add('E016_OWNER_UNRESOLVED');
    }

    return exceptions;
  }

  function arr(v) { return Array.isArray(v) ? v : []; }

  /* ────────────────────────────────────────────────────────────────────────
     8. Classification
     Applied strictly in the mandated order. Every row ends in exactly one
     status; no row may remain unclassified.
     ──────────────────────────────────────────────────────────────────────── */

  function classifyRow(exceptions) {
    var categories = (exceptions || []).map(function (e) {
      return (ERROR_CODES[e.code] && ERROR_CODES[e.code].category) || e.category || CLASSIFICATION.REVIEW_REQUIRED;
    });
    for (var i = 0; i < CLASSIFICATION_ORDER.length; i++) {
      if (categories.indexOf(CLASSIFICATION_ORDER[i]) !== -1) return CLASSIFICATION_ORDER[i];
    }
    return CLASSIFICATION.READY;
  }

  function countByClassification(rows) {
    var counts = {};
    counts[CLASSIFICATION.READY] = 0;
    counts[CLASSIFICATION.REVIEW_REQUIRED] = 0;
    counts[CLASSIFICATION.DUPLICATE] = 0;
    counts[CLASSIFICATION.BLOCKED] = 0;
    counts[CLASSIFICATION.INVALID] = 0;
    counts[CLASSIFICATION.SYSTEM_ERROR] = 0;
    (rows || []).forEach(function (r) {
      var c = r.classification;
      if (Object.prototype.hasOwnProperty.call(counts, c)) counts[c]++;
      else counts[CLASSIFICATION.SYSTEM_ERROR]++; /* unclassified is a defect: surface it */
    });
    return counts;
  }

  /* ────────────────────────────────────────────────────────────────────────
     9. Reconciliation
     Input rows must equal the sum of all classifications, exactly.
     ──────────────────────────────────────────────────────────────────────── */

  function reconcile(totalRows, counts) {
    var sum = 0;
    Object.keys(CLASSIFICATION).forEach(function (k) {
      sum += counts[CLASSIFICATION[k]] || 0;
    });
    var balanced = sum === totalRows;
    return {
      balanced: balanced,
      totalRows: totalRows,
      classifiedRows: sum,
      difference: totalRows - sum,
      statement: totalRows + ' input rows = ' +
        (counts[CLASSIFICATION.READY] || 0) + ' Ready + ' +
        (counts[CLASSIFICATION.REVIEW_REQUIRED] || 0) + ' Review Required + ' +
        (counts[CLASSIFICATION.DUPLICATE] || 0) + ' Duplicate + ' +
        (counts[CLASSIFICATION.BLOCKED] || 0) + ' Blocked + ' +
        (counts[CLASSIFICATION.INVALID] || 0) + ' Invalid + ' +
        (counts[CLASSIFICATION.SYSTEM_ERROR] || 0) + ' System Error' +
        (balanced ? '' : ' — MISMATCH of ' + (totalRows - sum))
    };
  }

  /* ────────────────────────────────────────────────────────────────────────
     10. Execution keys and execution conditions
     ──────────────────────────────────────────────────────────────────────── */

  /** Unique, deterministic key for any external action. */
  function buildExecutionKey(batchId, rowId, actionType, recipientEmail, templateVersion) {
    return [batchId, rowId, actionType, normaliseEmail(recipientEmail), templateVersion || 'none']
      .map(function (p) { return String(p == null ? '' : p); })
      .join('::');
  }

  /**
   * Decide whether an external action may run. `executedKeys` is the
   * registry of keys that have ALREADY produced (or may have produced)
   * an external effect. Fail closed: an uncertain previous attempt counts
   * as executed.
   */
  function checkExecutionKey(key, executedKeys) {
    var registry = executedKeys || {};
    if (Object.prototype.hasOwnProperty.call(registry, key)) {
      return { allowed: false, status: 'Already Executed', previous: registry[key] };
    }
    return { allowed: true, status: 'Not Executed' };
  }

  /**
   * All conditions that must be true before a row-level external action
   * executes. Any false or missing condition blocks execution.
   * Returns { allowed, failures: [names] }.
   */
  function canExecuteRow(check) {
    var c = check || {};
    var conditions = {
      batchApprovedForExecution: c.batchApprovedForExecution === true,
      rowStatusReady: c.rowClassification === CLASSIFICATION.READY,
      reviewApproved: c.reviewStatus === 'Approved' || c.reviewStatus === 'Not Required',
      notDryRun: c.dryRun === false,
      executionNotStarted: c.executionStatus === 'Not Started',
      senderAuthorised: c.senderAuthorised === true,
      templateApproved: c.templateApproved === true,
      recipientValid: c.recipientValid === true,
      suppressionCheckPassed: c.suppressionCheckPassed === true,
      ownerCheckPassed: c.ownerCheckPassed === true,
      duplicateCheckPassed: c.duplicateCheckPassed === true,
      batchVersionMatches: c.batchVersion != null && c.batchVersion === c.approvedBatchVersion
    };
    var failures = Object.keys(conditions).filter(function (k) { return conditions[k] !== true; });
    return { allowed: failures.length === 0, failures: failures, conditions: conditions };
  }

  /* ────────────────────────────────────────────────────────────────────────
     11. Batch locking
     ──────────────────────────────────────────────────────────────────────── */

  function acquireLock(batch, lockRequest, nowIso) {
    if (batch.locked) {
      return { acquired: false, reason: 'Batch is locked by ' + batch.lockedBy + ' since ' + batch.lockedAt + '.' };
    }
    return {
      acquired: true,
      lock: {
        batchId: batch.batchId,
        flowRunId: lockRequest.flowRunId,
        lockedBy: lockRequest.lockedBy,
        lockedAt: nowIso,
        processingVersion: lockRequest.processingVersion
      }
    };
  }

  /* ────────────────────────────────────────────────────────────────────────
     12. Natural-language instruction interpreter
     Translates an employee instruction into PROPOSED structured settings
     only. It never executes anything, never enables an external action,
     and reports what it could not interpret instead of guessing.
     ──────────────────────────────────────────────────────────────────────── */

  var EXTERNAL_ACTION_KEYS = ['prepareDraftEmails', 'sendEmails', 'createSalesforceActions', 'updateSalesforce'];

  /**
   * `instruction` — free text from the instruction box.
   * `vocab` — controlled vocabularies from Configuration:
   *   { owners: [{name, regions:[...]}], regions: [], funds: [],
   *     campaigns: [], templates: [] }
   * Returns:
   *   { proposedSettings, ownerAssignments, externalActionRequests,
   *     explicitProhibitions, warnings, matchedPhrases }
   */
  function interpretInstruction(instruction, vocab) {
    var text = String(instruction == null ? '' : instruction).toLowerCase();
    var v = vocab || {};
    var proposed = {};
    var ownerAssignments = [];
    var externalActionRequests = [];
    var explicitProhibitions = [];
    var warnings = [];
    var matched = [];

    if (!text.trim()) {
      return { proposedSettings: proposed, ownerAssignments: ownerAssignments,
               externalActionRequests: externalActionRequests,
               explicitProhibitions: explicitProhibitions,
               warnings: warnings, matchedPhrases: matched };
    }

    function hit(phrase) { matched.push(phrase); }

    /* Cleaning / matching / exclusions */
    if (/clean/.test(text)) { proposed.processType = 'General List Cleaning'; hit('clean'); }
    if (/match(ing)?\s+(it\s+)?(against\s+)?salesforce|salesforce match/.test(text)) {
      proposed.matchAgainstSalesforce = true; hit('match against Salesforce');
    }
    if (/exclude[^.]*duplicates|remove[^.]*duplicates|de-?dupe/.test(text)) {
      proposed.excludeDuplicates = true; hit('exclude duplicates');
    }
    if (/exclude[^.]*previous outreach|exclude[^.]*prior outreach/.test(text)) {
      proposed.excludePreviousOutreach = true; hit('exclude previous outreach');
    }
    if (/exclude[^.]*blocked/.test(text)) { proposed.excludeBlockedRecords = true; hit('exclude blocked records'); }
    if (/review workbook|review file|generate[^.]*workbook/.test(text)) {
      proposed.generateReviewWorkbook = true; hit('generate review workbook');
    }

    /* Owner assignments: "assign Asia to Kelvin", "Asia to Kelvin",
       "ex-asia to john". Owners are validated against the controlled
       vocabulary; unknown names are routed to review, never invented. */
    var assignRe = /(?:assign\s+)?([a-z][a-z /-]{1,30}?)\s+to\s+([a-z][a-z .'-]{1,30}?)(?=[,.;]|\s+and\s+|$)/g;
    var m;
    while ((m = assignRe.exec(text)) !== null) {
      var regionRaw = m[1].trim(), ownerRaw = m[2].trim();
      /* strip a leading conjunction carried over from the previous clause
         (e.g. "…and ex-asia to john" → region "ex-asia") */
      regionRaw = regionRaw.replace(/^(?:and|or|then)\s+/, '').trim();
      /* skip grammatical false positives such as "it to" or "emails to" */
      if (!regionRaw || /^(it|them|this|that|list|emails?|file|records?|rows?)$/.test(regionRaw)) continue;
      var knownOwner = (v.owners || []).filter(function (o) {
        var name = (o.name || o).toLowerCase();
        return name === ownerRaw || name.split(' ')[0] === ownerRaw.split(' ')[0];
      })[0];
      var knownRegion = (v.regions || []).filter(function (r) {
        return String(r).toLowerCase() === regionRaw;
      })[0];
      if (knownOwner) {
        ownerAssignments.push({
          region: knownRegion || regionRaw,
          owner: knownOwner.name || knownOwner,
          regionRecognised: !!knownRegion,
          confirmed: false
        });
        hit('assign ' + regionRaw + ' to ' + ownerRaw);
      } else {
        var ownerDisplay = ownerRaw.replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
        warnings.push('Owner "' + ownerDisplay + '" is not in the approved coverage-owner list. This assignment requires review.');
      }
    }

    /* Explicit prohibitions take precedence and are recorded verbatim. */
    if (/do not send|don'?t send|no emails? (are|should be|to be)? ?sent|without sending/.test(text)) {
      explicitProhibitions.push('sendEmails'); hit('do not send emails');
    }
    if (/(do not|don'?t|no)\b[^.]*(update|change|modify)[^.]*salesforce|no salesforce (updates?|changes?)/.test(text)) {
      explicitProhibitions.push('updateSalesforce'); hit('do not update Salesforce');
    }

    /* External-action REQUESTS are surfaced for manual enablement only.
       They are never turned on automatically. */
    if (explicitProhibitions.indexOf('sendEmails') === -1 && /send[^.]*emails?/.test(text)) {
      externalActionRequests.push({ action: 'sendEmails',
        note: 'The instruction mentions sending emails. Sending is never enabled from text — it requires the controlled setting, approvals, and execution conditions.' });
    }
    if (/draft[^.]*emails?|prepare[^.]*emails?/.test(text)) {
      externalActionRequests.push({ action: 'prepareDraftEmails',
        note: 'The instruction mentions preparing draft emails. Enable "Prepare draft emails" manually if intended.' });
    }
    if (explicitProhibitions.indexOf('updateSalesforce') === -1 && /update[^.]*salesforce/.test(text)) {
      externalActionRequests.push({ action: 'updateSalesforce',
        note: 'The instruction mentions updating Salesforce. Enable "Update Salesforce" manually if intended; it also requires execution approval.' });
    }
    if (/create[^.]*salesforce|add[^.]*salesforce/.test(text)) {
      externalActionRequests.push({ action: 'createSalesforceActions',
        note: 'The instruction mentions creating Salesforce records. Enable "Create Salesforce actions" manually if intended; it also requires execution approval.' });
    }

    /* Vocabulary detection: funds, campaigns, regions, templates. */
    (v.funds || []).forEach(function (f) {
      if (text.indexOf(String(f).toLowerCase()) !== -1) { proposed.fund = f; hit(f); }
    });
    (v.campaigns || []).forEach(function (c) {
      if (text.indexOf(String(c).toLowerCase()) !== -1) { proposed.campaign = c; hit(c); }
    });

    /* Dry-run language */
    if (/dry.?run|test run|without (executing|running) anything/.test(text)) {
      proposed.dryRun = true; hit('dry run');
    }

    /* Guard: external actions can be REQUESTED or PROHIBITED, never proposed
       as enabled. This is enforced structurally here. */
    EXTERNAL_ACTION_KEYS.forEach(function (k) { delete proposed[k]; });

    return {
      proposedSettings: proposed,
      ownerAssignments: ownerAssignments,
      externalActionRequests: externalActionRequests,
      explicitProhibitions: explicitProhibitions,
      warnings: warnings,
      matchedPhrases: matched
    };
  }

  /* Default controlled settings for a new run. Fail-closed defaults:
     dry run on, every external action off. */
  function defaultSettings() {
    return {
      processType: '',
      coverageOwner: '',
      region: '',
      fund: '',
      campaign: '',
      sender: '',
      template: '',
      matchAgainstSalesforce: true,
      excludePreviousOutreach: true,
      excludeBlockedRecords: true,
      generateReviewWorkbook: true,
      prepareDraftEmails: false,
      createSalesforceActions: false,
      updateSalesforce: false,
      sendEmails: false,
      dryRun: true,
      notes: ''
    };
  }

  /* Workbook contract — fixed worksheet order for the generated output. */
  var WORKBOOK_SHEETS = ['README', 'BATCH SUMMARY', 'READY', 'REVIEW REQUIRED',
    'DUPLICATES', 'BLOCKED', 'INVALID', 'SOURCE DATA', 'AUDIT LOG', 'CONFIG SNAPSHOT'];

  return {
    CLASSIFICATION: CLASSIFICATION,
    CLASSIFICATION_ORDER: CLASSIFICATION_ORDER,
    BATCH_STATUS: BATCH_STATUS,
    PROCESSING_STAGES: PROCESSING_STAGES,
    REVIEW_DECISIONS: REVIEW_DECISIONS,
    ROLES: ROLES,
    PERMISSIONS: PERMISSIONS,
    ERROR_CODES: ERROR_CODES,
    COLUMN_ALIASES: COLUMN_ALIASES,
    SUPPORTED_EXTENSIONS: SUPPORTED_EXTENSIONS,
    WORKBOOK_SHEETS: WORKBOOK_SHEETS,
    EXTERNAL_ACTION_KEYS: EXTERNAL_ACTION_KEYS,
    can: can,
    describeError: describeError,
    normaliseHeader: normaliseHeader,
    mapColumns: mapColumns,
    assessMapping: assessMapping,
    detectHeaderRow: detectHeaderRow,
    looksLikeSalesforceExport: looksLikeSalesforceExport,
    validateFile: validateFile,
    normaliseEmail: normaliseEmail,
    emailDomain: emailDomain,
    isValidEmail: isValidEmail,
    isGenericEmail: isGenericEmail,
    isPlaceholderValue: isPlaceholderValue,
    isPlaceholderEmail: isPlaceholderEmail,
    normaliseName: normaliseName,
    splitFullName: splitFullName,
    validateRow: validateRow,
    classifyRow: classifyRow,
    countByClassification: countByClassification,
    reconcile: reconcile,
    buildExecutionKey: buildExecutionKey,
    checkExecutionKey: checkExecutionKey,
    canExecuteRow: canExecuteRow,
    acquireLock: acquireLock,
    interpretInstruction: interpretInstruction,
    defaultSettings: defaultSettings
  };
});
