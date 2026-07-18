const assert = require('assert');
const validation = require('../api/recruitment/applicationValidation');
const { detectSignature, matchesAccepted } = require('../api/recruitment/fileSignatures');
const { handleApplication } = require('../api/recruitment/handler');

// ---- File signatures -------------------------------------------------------------------
assert.strictEqual(detectSignature(Buffer.from('%PDF-1.7\n')), 'pdf');
assert.strictEqual(detectSignature(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), 'oleCompoundFile');
assert.strictEqual(detectSignature(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])), 'zipDocx');
assert.strictEqual(detectSignature(Buffer.from('MZ hello')), null, 'executable header is not accepted');
assert.strictEqual(matchesAccepted(Buffer.from('%PDF-'), ['pdf']), true);
assert.strictEqual(matchesAccepted(Buffer.from('%PDF-'), ['zipDocx']), false, 'signature not in accepted list is rejected');

// ---- Role resolution -------------------------------------------------------------------
function role(over) {
  return Object.assign({
    roleId: 'investment-analyst', status: 'active', applicationEnabled: true, applicationDeadline: null,
    employmentType: 'Full-time',
    locales: { en: { title: 'Investment Analyst', team: 'Investment', location: 'Guangzhou', detailPath: 'careers/investment-analyst.html' }, 'zh-CN': { title: '投资分析师', team: '投资', location: '广州', detailPath: 'careers/investment-analyst_cn.html' } },
    files: [{ filePurpose: 'cv', required: true, maxSizeBytes: 10485760, allowedExtensions: ['.pdf', '.doc', '.docx'], allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], signatureValidation: { required: true, acceptedSignatures: ['pdf', 'oleCompoundFile', 'zipDocx'] } }],
    screening: { workAuthorization: { enabled: false, required: false, jurisdictions: [] }, roleSpecificQuestions: [] }
  }, over);
}
function manifest(roles) { return { schemaVersion: '1.0', generatedAtUtc: '2026-07-17T00:00:00Z', roles }; }
const E = validation.ERROR_CODES;

assert.strictEqual(validation.resolveServerRole(manifest([role()]), 'investment-analyst', 'en').ok, true);
assert.strictEqual(validation.resolveServerRole(manifest([role()]), 'no-role', 'en').errorCode, E.ROLE_NOT_FOUND);
assert.strictEqual(validation.resolveServerRole(manifest([role({ status: 'closed' })]), 'investment-analyst', 'en').errorCode, E.ROLE_CLOSED);
assert.strictEqual(validation.resolveServerRole(manifest([role({ status: 'draft' })]), 'investment-analyst', 'en').errorCode, E.ROLE_NOT_OPEN);
assert.strictEqual(validation.resolveServerRole(manifest([role({ applicationEnabled: false })]), 'investment-analyst', 'en').errorCode, E.ROLE_NOT_OPEN);
assert.strictEqual(validation.resolveServerRole(manifest([role({ applicationDeadline: '2000-01-01' })]), 'investment-analyst', 'en').errorCode, E.APPLICATION_DEADLINE_PASSED);

// ---- Field + file validation -----------------------------------------------------------
const goodFields = { fullName: 'Jane', email: 'Jane@Example.COM', location: 'Guangzhou', applicationStatement: 'Interested', linkedinUrl: '', privacyAccepted: true };
assert.strictEqual(validation.validateFields(goodFields).ok, true);
assert.deepStrictEqual(validation.validateFields(Object.assign({}, goodFields, { email: 'bad' })).fields, ['email']);
assert.ok(validation.validateFields(Object.assign({}, goodFields, { privacyAccepted: false })).fields.includes('privacyAccepted'));
assert.strictEqual(validation.normalizeEmail('Jane@Example.COM'), 'Jane@example.com', 'domain lowercased, local part preserved');

const cvRules = role().files[0];
assert.strictEqual(validation.validateFile({ name: 'cv.pdf', type: 'application/pdf', size: 100, bytes: Buffer.from('%PDF-1.4') }, cvRules).ok, true);
assert.strictEqual(validation.validateFile(null, cvRules).errorCode, E.FILE_MISSING);
assert.strictEqual(validation.validateFile({ name: 'cv.exe', type: 'x', size: 1, bytes: Buffer.from('MZ') }, cvRules).errorCode, E.FILE_TYPE_REJECTED);
assert.strictEqual(validation.validateFile({ name: 'cv.pdf', type: 'application/pdf', size: 99999999, bytes: Buffer.from('%PDF-') }, cvRules).errorCode, E.FILE_TOO_LARGE);
assert.strictEqual(validation.validateFile({ name: 'cv.pdf', type: 'application/pdf', size: 100, bytes: Buffer.from('MZ not a pdf') }, cvRules).errorCode, E.FILE_SIGNATURE_REJECTED, 'extension spoofing caught by signature check');

// ---- Safe filename + traversal ---------------------------------------------------------
assert.strictEqual(validation.safeStoredFilename('SV-2026-000001', 'Jane Résumé.pdf', 'ab12'), 'SV-2026-000001-ab12.pdf');
assert.strictEqual(validation.safeStoredFilename('SV-1', 'x.exe', 'r'), 'SV-1-r.bin', 'disallowed extension falls back to .bin');
assert.strictEqual(validation.hasPathTraversal('../../etc/passwd'), true);
assert.strictEqual(validation.hasPathTraversal('resume.pdf'), false);

// ---- Full handler pipeline with injected deps ------------------------------------------
function baseDeps(over) {
  const records = [];
  const stored = [];
  return Object.assign({
    _records: records, _stored: stored,
    loadManifest: () => manifest([role()]),
    now: () => new Date('2026-07-18T00:00:00Z'),
    rateLimiter: { check: () => ({ allowed: true }) },
    idempotency: (function () { const m = {}; return { get: (k) => m[k], put: (k, v) => { m[k] = v; } }; })(),
    generateReference: () => 'SV-2026-000001',
    generateRandomId: () => 'r4nd',
    storage: { store: (x) => { stored.push(x); return { ok: true }; } },
    register: { create: (r) => { records.push(r); return { ok: true }; } },
    log: () => {}
  }, over);
}

const goodRequest = {
  clientKey: 'ip-1',
  idempotencyKey: 'idem-1',
  fields: { roleId: 'investment-analyst', locale: 'en', source: 'linkedin', fullName: 'Jane', email: 'jane@example.com', location: 'Guangzhou', applicationStatement: 'Interested', telephone: '', linkedinUrl: '', privacyAccepted: 'true', privacyNoticeVersion: 'recruitment-privacy-draft-2026-07', submittedAtClientUtc: '2026-07-18T00:00:00Z' },
  file: { name: 'cv.pdf', type: 'application/pdf', size: 200, bytes: Buffer.from('%PDF-1.5 body') }
};

(async function run() {
  let deps = baseDeps();
  let res = await handleApplication(goodRequest, deps);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.applicationReference, 'SV-2026-000001');
  assert.strictEqual(deps._stored[0].storedName, 'SV-2026-000001-r4nd.pdf', 'stored file uses randomized name');
  assert.strictEqual(deps._stored[0].storedName.indexOf('Jane'), -1, 'candidate name not in stored filename');
  // roleTitle from browser is ignored; register uses manifest value.
  assert.strictEqual(deps._records[0].roleTitle, 'Investment Analyst');
  assert.strictEqual(deps._records[0].source, 'linkedin');
  assert.strictEqual(deps._records[0].candidateEmail, 'jane@example.com');
  assert.strictEqual(deps._records[0].submissionStatus, 'Received');

  // Idempotency: same key returns same reference, no duplicate record.
  res = await handleApplication(goodRequest, deps);
  assert.strictEqual(res.body.applicationReference, 'SV-2026-000001');
  assert.strictEqual(deps._records.length, 1, 'retry with same idempotency key does not duplicate the record');

  // roleTitle spoofing in the browser payload is overwritten server-side.
  deps = baseDeps();
  const spoofed = JSON.parse(JSON.stringify(goodRequest));
  spoofed.fields.roleTitle = 'CEO';
  spoofed.file = goodRequest.file;
  res = await handleApplication(spoofed, deps);
  assert.strictEqual(deps._records[0].roleTitle, 'Investment Analyst', 'browser roleTitle is not trusted');

  // Rate limited.
  deps = baseDeps({ rateLimiter: { check: () => ({ allowed: false }) } });
  res = await handleApplication(goodRequest, deps);
  assert.strictEqual(res.body.errorCode, E.RATE_LIMITED);

  // Signature-spoofed file rejected end to end.
  deps = baseDeps();
  const badFileReq = JSON.parse(JSON.stringify(goodRequest));
  badFileReq.file = { name: 'cv.pdf', type: 'application/pdf', size: 10, bytes: Buffer.from('MZ evil') };
  res = await handleApplication(badFileReq, deps);
  assert.strictEqual(res.body.errorCode, E.FILE_SIGNATURE_REJECTED);
  assert.strictEqual(deps._records.length, 0, 'no record created for a rejected file');

  // Storage failure surfaces STORAGE_FAILED, no register record.
  deps = baseDeps({ storage: { store: () => ({ ok: false }) } });
  res = await handleApplication(goodRequest, deps);
  assert.strictEqual(res.body.errorCode, E.STORAGE_FAILED);
  assert.strictEqual(deps._records.length, 0);

  console.log('recruitment backend scaffold tests passed');
})().catch((err) => { console.error(err); process.exit(1); });
