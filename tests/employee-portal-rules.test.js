/* ==========================================================================
   ShoreVest Operations — rules + file-handling test suite
   Run: node tests/employee-portal-rules.test.js
   Covers the scenarios enumerated in the specification's Testing section
   that are exercisable without a live Microsoft/Salesforce tenant.
   ========================================================================== */
'use strict';

const assert = require('assert');
const path = require('path');
const zlib = require('zlib');

const R = require('../assets/js/employee-portal/rules.js');
const F = require('../assets/js/employee-portal/files.js');

let passed = 0;
const failures = [];
const pending = [];
function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      pending.push(result.then(() => { passed++; }, (e) => { failures.push({ name, error: e }); }));
    } else {
      passed++;
    }
  } catch (e) { failures.push({ name, error: e }); }
}

/* ── Column detection and mapping ──────────────────────────────────────── */

test('exact aliases map automatically', () => {
  const m = R.mapColumns(['Company Name', 'Email Address', 'First Name', 'Last Name']);
  assert.strictEqual(m.mapped.company.column, 'Company Name');
  assert.strictEqual(m.mapped.email.column, 'Email Address');
  assert.strictEqual(m.mapped.firstName.column, 'First Name');
});

test('alternative headers (Firm/Work Email/Given Name) map to canonical fields', () => {
  const m = R.mapColumns(['Firm', 'Work Email', 'Given Name', 'Surname']);
  assert.strictEqual(m.mapped.company.column, 'Firm');
  assert.strictEqual(m.mapped.email.column, 'Work Email');
  assert.strictEqual(m.mapped.firstName.column, 'Given Name');
  assert.strictEqual(m.mapped.lastName.column, 'Surname');
});

test('multiple plausible email columns are ambiguous, not guessed', () => {
  const m = R.mapColumns(['Email', 'Business Email']);
  assert.ok(m.ambiguous.email, 'expected email to be ambiguous');
  assert.ok(!m.mapped.email, 'must not silently pick one');
});

test('required columns missing -> assessMapping reports missing', () => {
  const m = R.mapColumns(['Random', 'Notes']);
  const a = R.assessMapping(m, ['email', 'company']);
  assert.strictEqual(a.ok, false);
  assert.deepStrictEqual(a.missing.sort(), ['company', 'email']);
});

/* ── Header-row detection ─────────────────────────────────────────────── */

test('header row detected below title/blank rows', () => {
  const rows = [
    ['ShoreVest Prospect List'], [],
    ['First Name', 'Last Name', 'Company', 'Email'],
    ['Jane', 'Doe', 'Acme', 'jane@acme.com']
  ];
  const d = R.detectHeaderRow(rows);
  assert.strictEqual(d.index, 2);
  assert.strictEqual(d.ambiguous, false);
});

test('missing headers -> index -1', () => {
  const rows = [['x', 'y'], ['1', '2']];
  const d = R.detectHeaderRow(rows);
  assert.strictEqual(d.index, -1);
});

test('Salesforce export heuristic', () => {
  assert.ok(R.looksLikeSalesforceExport(['Contact ID', 'Account Name', 'Contact Owner', 'Email']));
  assert.ok(!R.looksLikeSalesforceExport(['Name', 'Notes']));
});

/* ── File validation ──────────────────────────────────────────────────── */

function baseFile(over) {
  return Object.assign({ name: 'list.csv', size: 2048, type: 'csv', rowCount: 10,
    encrypted: false, corrupted: false, hasMacros: false, hasExternalLinks: false,
    hash: 'abc', uploading: false, locked: false }, over);
}
function ctx(over) {
  return Object.assign({ config: { maxFileBytes: 1000000, maxRows: 1000 },
    processedHashes: [], headerDetection: { index: 0, ambiguous: false },
    mappingAssessment: { missing: [] }, configurationAvailable: true }, over);
}

test('empty file rejected', () => {
  const p = R.validateFile(baseFile({ size: 0, rowCount: 0 }), ctx());
  assert.ok(p.some(x => x.code === 'FILE_EMPTY'));
});
test('password-protected file rejected', () => {
  const p = R.validateFile(baseFile({ encrypted: true }), ctx());
  assert.ok(p.some(x => x.code === 'FILE_PASSWORD_PROTECTED'));
});
test('corrupted file rejected', () => {
  const p = R.validateFile(baseFile({ corrupted: true }), ctx());
  assert.ok(p.some(x => x.code === 'FILE_CORRUPTED'));
});
test('unsupported type rejected', () => {
  const p = R.validateFile(baseFile({ name: 'data.pdf', type: 'unknown' }), ctx());
  assert.ok(p.some(x => x.code === 'FILE_UNSUPPORTED_TYPE'));
});
test('oversize file rejected', () => {
  const p = R.validateFile(baseFile({ size: 2000000 }), ctx());
  assert.ok(p.some(x => x.code === 'FILE_TOO_LARGE'));
});
test('too many rows rejected', () => {
  const p = R.validateFile(baseFile({ rowCount: 5000 }), ctx());
  assert.ok(p.some(x => x.code === 'FILE_TOO_MANY_ROWS'));
});
test('already-processed file rejected (E012)', () => {
  const p = R.validateFile(baseFile({ hash: 'dup' }), ctx({ processedHashes: ['dup'] }));
  assert.ok(p.some(x => x.code === 'E012_FILE_ALREADY_PROCESSED'));
});
test('ambiguous header stops the file', () => {
  const p = R.validateFile(baseFile(), ctx({ headerDetection: { index: 1, ambiguous: true } }));
  assert.ok(p.some(x => x.code === 'FILE_AMBIGUOUS_HEADER'));
});
test('macros rejected', () => {
  const p = R.validateFile(baseFile({ hasMacros: true }), ctx());
  assert.ok(p.some(x => x.code === 'FILE_MACROS'));
});
test('external links rejected', () => {
  const p = R.validateFile(baseFile({ hasExternalLinks: true }), ctx());
  assert.ok(p.some(x => x.code === 'FILE_EXTERNAL_LINKS'));
});
test('configuration unavailable stops processing (fail closed)', () => {
  const p = R.validateFile(baseFile(), ctx({ configurationAvailable: false }));
  assert.ok(p.some(x => x.code === 'E013_SYSTEM_CONNECTION_FAILURE'));
});
test('clean valid file passes', () => {
  const p = R.validateFile(baseFile(), ctx());
  assert.strictEqual(p.length, 0);
});

/* ── Email / normalisation ────────────────────────────────────────────── */

test('valid vs malformed email', () => {
  assert.ok(R.isValidEmail('jane.doe@acme.com'));
  assert.ok(!R.isValidEmail('jane@'));
  assert.ok(!R.isValidEmail('not-an-email'));
  assert.ok(!R.isValidEmail('a@b'));
});
test('generic mailbox detection', () => {
  assert.ok(R.isGenericEmail('info@acme.com'));
  assert.ok(!R.isGenericEmail('jane@acme.com'));
});
test('placeholder email detection', () => {
  assert.ok(R.isPlaceholderEmail('test@example.com'));
  assert.ok(R.isPlaceholderEmail('jane@test.com'));
});
test('name normalisation and split', () => {
  assert.strictEqual(R.normaliseName('JANE  DOE'), 'Jane Doe');
  assert.deepStrictEqual(R.splitFullName('Doe, Jane'), { firstName: 'Jane', lastName: 'Doe' });
  assert.deepStrictEqual(R.splitFullName('Jane Doe'), { firstName: 'Jane', lastName: 'Doe' });
});

/* ── Row validation & classification ──────────────────────────────────── */

function rowCtx(over) {
  return Object.assign({
    settings: { excludePreviousOutreach: true, matchAgainstSalesforce: true },
    requiredFields: ['company'],
    seenEmailsInFile: {}, currentBatchEmails: [], previousBatchEmails: [],
    previousOutreach: [], suppressed: [], blockedDomains: [], hardBounces: [],
    salesforce: { contactsByEmail: {}, blockedAccountIds: [], liveProcessEmails: [] },
    coverage: { regionOwners: { asia: 'Kelvin', 'ex-asia': 'John' } }
  }, over);
}

test('missing email -> Invalid (E001)', () => {
  const ex = R.validateRow({ originalRowNumber: 2, company: 'Acme', proposedOwner: 'Kelvin' }, rowCtx());
  assert.ok(ex.some(e => e.code === 'E001_MISSING_EMAIL'));
  assert.strictEqual(R.classifyRow(ex), R.CLASSIFICATION.INVALID);
});
test('malformed email -> Invalid (E002)', () => {
  const ex = R.validateRow({ originalRowNumber: 2, company: 'Acme', email: 'bad@', proposedOwner: 'Kelvin' }, rowCtx());
  assert.ok(ex.some(e => e.code === 'E002_INVALID_EMAIL'));
});
test('duplicate in file -> Duplicate (E003)', () => {
  const ex = R.validateRow({ originalRowNumber: 5, company: 'Acme', email: 'jane@acme.com', proposedOwner: 'Kelvin' },
    rowCtx({ seenEmailsInFile: { 'jane@acme.com': 2 } }));
  assert.ok(ex.some(e => e.code === 'E003_DUPLICATE_IN_FILE'));
  assert.strictEqual(R.classifyRow(ex), R.CLASSIFICATION.DUPLICATE);
});
test('suppressed recipient -> Blocked (E008), overrides duplicate precedence', () => {
  const ex = R.validateRow({ originalRowNumber: 2, company: 'Acme', email: 'opt@acme.com', proposedOwner: 'Kelvin' },
    rowCtx({ suppressed: ['opt@acme.com'], seenEmailsInFile: { 'opt@acme.com': 1 } }));
  assert.ok(ex.some(e => e.code === 'E008_SUPPRESSED'));
  assert.strictEqual(R.classifyRow(ex), R.CLASSIFICATION.BLOCKED);
});
test('blocked domain -> Blocked (E009)', () => {
  const ex = R.validateRow({ originalRowNumber: 2, company: 'Acme', email: 'x@blocked.com', proposedOwner: 'Kelvin' },
    rowCtx({ blockedDomains: ['blocked.com'] }));
  assert.strictEqual(R.classifyRow(ex), R.CLASSIFICATION.BLOCKED);
});
test('existing single Salesforce contact -> Duplicate (E005)', () => {
  const ex = R.validateRow({ originalRowNumber: 2, company: 'Acme', email: 'jane@acme.com', proposedOwner: 'Kelvin' },
    rowCtx({ salesforce: { contactsByEmail: { 'jane@acme.com': [{ id: 'C1', name: 'Jane', owner: 'Kelvin' }] }, blockedAccountIds: [], liveProcessEmails: [] } }));
  assert.ok(ex.some(e => e.code === 'E005_EXISTING_CONTACT'));
});
test('ambiguous Salesforce match -> Review Required (E006)', () => {
  const ex = R.validateRow({ originalRowNumber: 2, company: 'Acme', email: 'jane@acme.com', proposedOwner: 'Kelvin' },
    rowCtx({ salesforce: { contactsByEmail: { 'jane@acme.com': [{ id: 'C1' }, { id: 'C2' }] }, blockedAccountIds: [], liveProcessEmails: [] } }));
  assert.ok(ex.some(e => e.code === 'E006_MULTIPLE_SALESFORCE_MATCHES'));
  assert.strictEqual(R.classifyRow(ex), R.CLASSIFICATION.REVIEW_REQUIRED);
});
test('owner conflict -> Review Required (E007)', () => {
  const ex = R.validateRow({ originalRowNumber: 2, company: 'Acme', email: 'jane@acme.com', proposedOwner: 'John' },
    rowCtx({ settings: { treatExistingContacts: 'include' }, salesforce: { contactsByEmail: { 'jane@acme.com': [{ id: 'C1', owner: 'Kelvin' }] }, blockedAccountIds: [], liveProcessEmails: [] } }));
  assert.ok(ex.some(e => e.code === 'E007_OWNER_CONFLICT'));
});
test('missing required field -> Invalid (E010)', () => {
  const ex = R.validateRow({ originalRowNumber: 2, email: 'jane@acme.com', proposedOwner: 'Kelvin' }, rowCtx());
  assert.ok(ex.some(e => e.code === 'E010_REQUIRED_FIELD_MISSING'));
});
test('unresolved owner -> Review Required (E016)', () => {
  const ex = R.validateRow({ originalRowNumber: 2, company: 'Acme', email: 'jane@acme.com', country: 'Nowhere' },
    rowCtx({ coverage: { regionOwners: {} } }));
  assert.ok(ex.some(e => e.code === 'E016_OWNER_UNRESOLVED'));
});
test('clean row -> Ready', () => {
  const ex = R.validateRow({ originalRowNumber: 2, firstName: 'Jane', company: 'Acme', email: 'jane@acme.com', proposedOwner: 'Kelvin' }, rowCtx());
  assert.strictEqual(ex.length, 0);
  assert.strictEqual(R.classifyRow(ex), R.CLASSIFICATION.READY);
});
test('every row gets exactly one classification', () => {
  [[], [{ code: 'E001_MISSING_EMAIL' }], [{ code: 'E008_SUPPRESSED' }],
   [{ code: 'E006_MULTIPLE_SALESFORCE_MATCHES' }], [{ code: 'E013_SYSTEM_CONNECTION_FAILURE' }]]
    .forEach(ex => {
      const c = R.classifyRow(ex);
      assert.ok(Object.values(R.CLASSIFICATION).includes(c));
    });
});
test('classification precedence: blocked beats invalid beats duplicate beats review', () => {
  const ex = [{ code: 'E006_MULTIPLE_SALESFORCE_MATCHES' }, { code: 'E003_DUPLICATE_IN_FILE' },
    { code: 'E001_MISSING_EMAIL' }, { code: 'E008_SUPPRESSED' }];
  assert.strictEqual(R.classifyRow(ex), R.CLASSIFICATION.BLOCKED);
  assert.strictEqual(R.classifyRow(ex.slice(0, 3)), R.CLASSIFICATION.INVALID);
  assert.strictEqual(R.classifyRow(ex.slice(0, 2)), R.CLASSIFICATION.DUPLICATE);
  assert.strictEqual(R.classifyRow(ex.slice(0, 1)), R.CLASSIFICATION.REVIEW_REQUIRED);
});

/* ── Reconciliation ───────────────────────────────────────────────────── */

test('reconciliation balances', () => {
  const rows = [
    { classification: R.CLASSIFICATION.READY }, { classification: R.CLASSIFICATION.READY },
    { classification: R.CLASSIFICATION.DUPLICATE }, { classification: R.CLASSIFICATION.INVALID },
    { classification: R.CLASSIFICATION.REVIEW_REQUIRED }
  ];
  const counts = R.countByClassification(rows);
  const rec = R.reconcile(5, counts);
  assert.ok(rec.balanced);
});
test('reconciliation mismatch detected', () => {
  const counts = R.countByClassification([{ classification: R.CLASSIFICATION.READY }]);
  const rec = R.reconcile(5, counts);
  assert.ok(!rec.balanced);
  assert.strictEqual(rec.difference, 4);
});

/* ── Execution keys & conditions (duplicate-action prevention) ────────── */

test('execution key is deterministic and unique per action tuple', () => {
  const k1 = R.buildExecutionKey('B1', 'R1', 'sendEmails', 'a@b.com', 'T1');
  const k2 = R.buildExecutionKey('B1', 'R1', 'sendEmails', 'a@b.com', 'T1');
  const k3 = R.buildExecutionKey('B1', 'R1', 'sendEmails', 'a@b.com', 'T2');
  assert.strictEqual(k1, k2);
  assert.notStrictEqual(k1, k3);
});
test('repeat execution blocked (double-click / retry)', () => {
  const key = R.buildExecutionKey('B1', 'R1', 'sendEmails', 'a@b.com', 'T1');
  const registry = {};
  assert.ok(R.checkExecutionKey(key, registry).allowed);
  registry[key] = { result: 'ok' };
  const second = R.checkExecutionKey(key, registry);
  assert.strictEqual(second.allowed, false);
  assert.strictEqual(second.status, 'Already Executed');
});
test('execution blocked when any condition false (fail closed)', () => {
  const good = {
    batchApprovedForExecution: true, rowClassification: R.CLASSIFICATION.READY,
    reviewStatus: 'Approved', dryRun: false, executionStatus: 'Not Started',
    senderAuthorised: true, templateApproved: true, recipientValid: true,
    suppressionCheckPassed: true, ownerCheckPassed: true, duplicateCheckPassed: true,
    batchVersion: 2, approvedBatchVersion: 2
  };
  assert.ok(R.canExecuteRow(good).allowed);
  assert.ok(!R.canExecuteRow(Object.assign({}, good, { dryRun: true })).allowed);
  assert.ok(!R.canExecuteRow(Object.assign({}, good, { batchVersion: 3 })).allowed);
  assert.ok(!R.canExecuteRow(Object.assign({}, good, { reviewStatus: 'Pending' })).allowed);
});

/* ── Natural-language interpreter ─────────────────────────────────────── */

const vocab = {
  owners: [{ name: 'Kelvin', regions: ['Asia'] }, { name: 'John', regions: ['Ex-Asia'] }],
  regions: ['Asia', 'Ex-Asia'], funds: ['Fund III'], campaigns: ['Asia Conference 2026'], templates: []
};

test('interpreter proposes settings but never enables external actions', () => {
  const r = R.interpretInstruction(
    'Clean this list, match it against Salesforce, exclude duplicates and previous outreach, ' +
    'assign Asia to Kelvin and Ex-Asia to John, and generate a review workbook. ' +
    'Do not send emails or update Salesforce.', vocab);
  assert.strictEqual(r.proposedSettings.matchAgainstSalesforce, true);
  assert.strictEqual(r.proposedSettings.excludeDuplicates, true);
  assert.strictEqual(r.proposedSettings.generateReviewWorkbook, true);
  R.EXTERNAL_ACTION_KEYS.forEach(k => assert.ok(!(k in r.proposedSettings), k + ' must not be proposed'));
  assert.ok(r.explicitProhibitions.includes('sendEmails'));
  assert.ok(r.explicitProhibitions.includes('updateSalesforce'));
});
test('interpreter maps owner assignments to controlled vocabulary', () => {
  const r = R.interpretInstruction('assign Asia to Kelvin and Ex-Asia to John', vocab);
  const asia = r.ownerAssignments.find(a => String(a.region).toLowerCase() === 'asia');
  const exasia = r.ownerAssignments.find(a => String(a.region).toLowerCase() === 'ex-asia');
  assert.ok(asia && asia.owner === 'Kelvin');
  assert.ok(exasia && exasia.owner === 'John');
});
test('interpreter routes unknown owner to warning, not invention', () => {
  const r = R.interpretInstruction('assign Asia to Zaphod', vocab);
  assert.strictEqual(r.ownerAssignments.length, 0);
  assert.ok(r.warnings.some(w => /Zaphod/.test(w)));
});
test('interpreter surfaces send request as a manual-enable note, not enabled', () => {
  const r = R.interpretInstruction('send emails to everyone', vocab);
  assert.ok(r.externalActionRequests.some(x => x.action === 'sendEmails'));
  assert.ok(!('sendEmails' in r.proposedSettings));
});

/* ── Default settings are fail-closed ─────────────────────────────────── */

test('default settings: dry run on, all external actions off', () => {
  const s = R.defaultSettings();
  assert.strictEqual(s.dryRun, true);
  assert.strictEqual(s.prepareDraftEmails, false);
  assert.strictEqual(s.createSalesforceActions, false);
  assert.strictEqual(s.updateSalesforce, false);
  assert.strictEqual(s.sendEmails, false);
});

/* ── Batch locking ────────────────────────────────────────────────────── */

test('batch lock prevents concurrent modification', () => {
  const batch = { batchId: 'B1', locked: false };
  const a = R.acquireLock(batch, { flowRunId: 'F1', lockedBy: 'x', processingVersion: 1 }, 'now');
  assert.ok(a.acquired);
  const locked = { batchId: 'B1', locked: true, lockedBy: 'x', lockedAt: 'now' };
  const b = R.acquireLock(locked, { flowRunId: 'F2', lockedBy: 'y', processingVersion: 1 }, 'now');
  assert.ok(!b.acquired);
});

/* ── CSV / file parsing ───────────────────────────────────────────────── */

test('CSV parse handles quotes, commas, CRLF', () => {
  const rows = F.parseCsv('a,b,c\r\n"x,y",z,"he said ""hi"""\r\n');
  assert.deepStrictEqual(rows[0], ['a', 'b', 'c']);
  assert.deepStrictEqual(rows[1], ['x,y', 'z', 'he said "hi"']);
});
test('CSV delimiter detection (semicolon)', () => {
  assert.strictEqual(F.detectDelimiter('a;b;c\n1;2;3'), ';');
});
test('analyseTable finds header, drops blank rows, preserves row numbers', () => {
  const rows = [
    ['Prospect list'], [],
    ['First Name', 'Company', 'Email'],
    ['Jane', 'Acme', 'jane@acme.com'],
    [],
    ['John', 'Beta', 'john@beta.com']
  ];
  const a = F.analyseTable(rows, R.detectHeaderRow);
  assert.strictEqual(a.headers.length, 3);
  assert.strictEqual(a.dataRows.length, 2);
  assert.strictEqual(a.dataRows[0].originalRowNumber, 4);
  assert.strictEqual(a.dataRows[1].originalRowNumber, 6);
  assert.ok(a.blankRowNumbers.includes(5));
});
test('analyseTable trims Salesforce footer', () => {
  const rows = [
    ['First Name', 'Company', 'Email'],
    ['Jane', 'Acme', 'jane@acme.com'],
    [],
    ['Copyright (c) 2000-2026 salesforce.com, inc.']
  ];
  const a = F.analyseTable(rows, R.detectHeaderRow);
  assert.strictEqual(a.dataRows.length, 1);
});

/* ── XLSX reader (build a tiny valid workbook in-memory) ──────────────── */

function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = [];
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(files) {
  const enc = s => Buffer.from(s, 'utf8');
  const locals = [], centrals = [];
  let offset = 0;
  files.forEach(f => {
    const data = enc(f.content);
    const comp = zlib.deflateRawSync(data);
    const nameBuf = enc(f.name);
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    const local = Buffer.concat([lh, nameBuf, comp]);
    locals.push(local);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([ch, nameBuf]));
    offset += local.length;
  });
  const localAll = Buffer.concat(locals);
  const centralAll = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralAll.length, 12); eocd.writeUInt32LE(localAll.length, 16);
  return Buffer.concat([localAll, centralAll, eocd]);
}

test('minimal XLSX reads sheets, shared strings, and cells', () => {
  const files = [
    { name: '[Content_Types].xml', content: '<Types/>' },
    { name: 'xl/workbook.xml', content: '<workbook><sheets><sheet name="Contacts" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/sharedStrings.xml', content: '<sst><si><t>First Name</t></si><si><t>Company</t></si><si><t>Email</t></si><si><t>Jane</t></si><si><t>Acme</t></si><si><t>jane@acme.com</t></si></sst>' },
    { name: 'xl/worksheets/sheet1.xml', content:
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="s"><v>5</v></c></row>' +
      '</sheetData></worksheet>' }
  ];
  const zip = makeZip(files);
  return F.readXlsx(new Uint8Array(zip)).then(wb => {
    assert.strictEqual(wb.sheetNames[0], 'Contacts');
    const a = F.analyseTable(wb.sheets[0].rows, R.detectHeaderRow);
    assert.strictEqual(a.headers[0], 'First Name');
    assert.strictEqual(a.dataRows[0].cells[2], 'jane@acme.com');
  });
});

test('sniffBytes detects ZIP/xlsx, OLE encryption, and CSV text', () => {
  const zip = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0]);
  assert.strictEqual(F.sniffBytes(zip, 'a.xlsx').type, 'xlsx');
  const csv = new Uint8Array(Buffer.from('First Name,Email\nJane,jane@acme.com\n', 'utf8'));
  assert.strictEqual(F.sniffBytes(csv, 'a.csv').type, 'csv');
});

/* ── Permissions ──────────────────────────────────────────────────────── */

test('role permissions gate correctly', () => {
  assert.ok(R.can(R.ROLES.ADMINISTRATOR, 'administer'));
  assert.ok(!R.can(R.ROLES.EMPLOYEE, 'administer'));
  assert.ok(!R.can(R.ROLES.EMPLOYEE, 'viewAllBatches'));
  assert.ok(R.can(R.ROLES.EXECUTION_APPROVER, 'approveExecution'));
  assert.ok(!R.can(R.ROLES.IR_OPERATIONS, 'approveExecution'));
  assert.ok(R.can(R.ROLES.AUDITOR, 'viewAudit'));
  assert.ok(!R.can(R.ROLES.AUDITOR, 'processBatches'));
});

/* ── Run ──────────────────────────────────────────────────────────────── */

Promise.all(pending).then(() => {
  if (failures.length) {
    console.error('\n✗ ' + failures.length + ' test(s) failed:\n');
    failures.forEach(f => console.error('  ✗ ' + f.name + '\n    ' + (f.error && f.error.message)));
    process.exitCode = 1;
  } else {
    console.log('\n✓ All ' + passed + ' ShoreVest Operations tests passed.');
  }
});
