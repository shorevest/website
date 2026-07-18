const assert = require('assert');
const app = require('../assets/js/recruitment-application');

// ---------------------------------------------------------------------------------------
// Minimal DOM shim with a query registry keyed by the data-* selectors the renderer uses.
// ---------------------------------------------------------------------------------------
let innerHtmlWrites = 0;

class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.attributes = {};
    this.className = '';
    this.value = '';
    this.checked = false;
    this.files = [];
    this._text = '';
    this.listeners = {};
    this.focused = false;
  }
  appendChild(c) { this.children.push(c); return c; }
  set innerHTML(v) { innerHtmlWrites += 1; this._text = String(v); }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  setAttribute(n, v) { this.attributes[n] = String(v); if (n === 'value') this.value = String(v); }
  getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attributes, n) ? this.attributes[n] : null; }
  removeAttribute(n) { delete this.attributes[n]; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  dispatch(type, event) { (this.listeners[type] || []).forEach((fn) => fn(event)); }
  focus() { this.focused = true; }
}

class Doc {
  constructor(lang) {
    this.documentElement = { lang };
    this.body = new El('body');
    this.registry = {};
    this.all = {};
  }
  register(selector, el) { this.registry[selector] = el; return el; }
  registerAll(selector, els) { this.all[selector] = els; }
  createElement(t) { return new El(t); }
  createTextNode(t) { const n = new El('#text'); n.textContent = t; return n; }
  querySelector(sel) { return this.registry[sel] || null; }
  querySelectorAll(sel) { return this.all[sel] || []; }
}

function manifest(roles) { return { schemaVersion: '1.0', generatedAtUtc: '2026-07-17T00:00:00Z', roles }; }

function role(overrides = {}) {
  return Object.assign({
    roleId: 'investment-analyst',
    status: 'active',
    employmentType: 'Full-time',
    applicationEnabled: true,
    applicationDeadline: null,
    reportingLine: null,
    locales: {
      en: { title: 'Investment Analyst', team: 'Investment', location: 'Guangzhou', detailPath: 'careers/investment-analyst.html', applicationStatementPrompt: 'Tell us why.' },
      'zh-CN': { title: '投资分析师', team: '投资', location: '广州', detailPath: 'careers/investment-analyst_cn.html', applicationStatementPrompt: '请说明原因。' }
    },
    files: [{ filePurpose: 'cv', required: true, maxSizeBytes: 10485760, allowedExtensions: ['.pdf', '.doc', '.docx'], allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], signatureValidation: { required: true, acceptedSignatures: ['pdf', 'oleCompoundFile', 'zipDocx'] } }],
    screening: { workAuthorization: { enabled: false, required: false, jurisdictions: [] }, roleSpecificQuestions: [] }
  }, overrides);
}

// Build a document wired with the gating/role targets used by renderApplication.
function renderDoc(lang) {
  const d = new Doc(lang);
  d.register('[data-application-form]', new El('form'));
  d.register('[data-application-state]', new El('p'));
  d.register('[data-application-role-title]', new El('p'));
  d.register('[data-application-role-meta]', new El('p'));
  d.register('[data-application-statement-prompt]', new El('p'));
  ['roleId', 'roleTitle', 'roleTeam', 'roleLocation', 'locale', 'source', 'privacyNoticeVersion', 'applicationPageVersion'].forEach((n) => {
    d.register('[data-hidden-field="' + n + '"]', new El('input'));
  });
  return d;
}

// ---- normalizeSource -------------------------------------------------------------------
assert.strictEqual(app.normalizeSource('website'), 'website');
assert.strictEqual(app.normalizeSource('linkedin'), 'linkedin');
assert.strictEqual(app.normalizeSource('direct'), 'direct');
assert.strictEqual(app.normalizeSource('other'), 'other');
assert.strictEqual(app.normalizeSource('evil<script>'), 'direct', 'unknown source becomes direct');
assert.strictEqual(app.normalizeSource(''), 'direct', 'empty source becomes direct');
assert.strictEqual(app.normalizeSource(undefined), 'direct', 'missing source becomes direct');

// ---- parseParams -----------------------------------------------------------------------
assert.deepStrictEqual(app.parseParams('?role=investment-analyst&source=linkedin'), { role: 'investment-analyst', source: 'linkedin' });
assert.deepStrictEqual(app.parseParams('?role=investment-analyst'), { role: 'investment-analyst', source: 'direct' }, 'missing source defaults to direct');
assert.deepStrictEqual(app.parseParams('?source=bogus'), { role: null, source: 'direct' }, 'bogus source defaults to direct');
assert.deepStrictEqual(app.parseParams(''), { role: null, source: 'direct' });

// ---- resolveRole gating ----------------------------------------------------------------
assert.strictEqual(app.resolveRole(manifest([role()]), 'investment-analyst', 'en').ok, true, 'valid enabled role resolves');
assert.strictEqual(app.resolveRole(manifest([role()]), 'nope-role', 'en').reason, 'notFound', 'unknown role');
assert.strictEqual(app.resolveRole(manifest([role()]), 'Bad Id', 'en').reason, 'notFound', 'malformed role id');
assert.strictEqual(app.resolveRole(manifest([role()]), '', 'en').reason, 'notFound', 'missing role id');
assert.strictEqual(app.resolveRole(manifest([role({ status: 'draft' })]), 'investment-analyst', 'en').reason, 'notFound', 'inactive/draft role');
assert.strictEqual(app.resolveRole(manifest([role({ status: 'closed' })]), 'investment-analyst', 'en').reason, 'closed', 'closed role');
assert.strictEqual(app.resolveRole(manifest([role({ status: 'archived' })]), 'investment-analyst', 'en').reason, 'closed', 'archived role');
assert.strictEqual(app.resolveRole(manifest([role({ applicationEnabled: false })]), 'investment-analyst', 'en').reason, 'disabled', 'disabled application');
assert.strictEqual(app.resolveRole(manifest([role({ applicationDeadline: '2000-01-01' })]), 'investment-analyst', 'en').reason, 'disabled', 'passed deadline');
const missingLocaleRole = role();
delete missingLocaleRole.locales['zh-CN'];
assert.strictEqual(app.resolveRole(manifest([missingLocaleRole]), 'investment-analyst', 'zh-CN').reason, 'notFound', 'missing locale');
const badFileRole = role();
badFileRole.files = [{ filePurpose: 'cover_letter', required: false, maxSizeBytes: 1, allowedExtensions: [], allowedMimeTypes: [], signatureValidation: { required: true, acceptedSignatures: ['pdf'] } }];
assert.strictEqual(app.resolveRole(manifest([badFileRole]), 'investment-analyst', 'en').reason, 'disabled', 'malformed file config');
assert.strictEqual(app.resolveRole(null, 'investment-analyst', 'en').reason, 'unavailable', 'no manifest is unavailable');

// ---- renderApplication: gating hides the form, open shows it ---------------------------
let d = renderDoc('en');
let status = app.renderApplication(d, manifest([role({ applicationEnabled: false })]), { roleId: 'investment-analyst', source: 'website', locale: 'en' });
assert.strictEqual(status, 'disabled');
assert.strictEqual(d.querySelector('[data-application-form]').getAttribute('hidden'), 'hidden', 'form hidden when disabled');
assert.match(d.querySelector('[data-application-state]').textContent, /Applications are not currently being accepted/);

d = renderDoc('en');
status = app.renderApplication(d, manifest([role()]), { roleId: 'investment-analyst', source: 'linkedin', locale: 'en' });
assert.strictEqual(status, 'open', 'enabled role opens the form');
assert.strictEqual(d.querySelector('[data-application-form]').getAttribute('hidden'), null, 'form shown when open');
assert.strictEqual(d.querySelector('[data-application-role-title]').textContent, 'Investment Analyst', 'role title from manifest');
assert.strictEqual(d.querySelector('[data-hidden-field="roleTitle"]').getAttribute('value'), 'Investment Analyst', 'hidden roleTitle from manifest, not URL');
assert.strictEqual(d.querySelector('[data-hidden-field="source"]').getAttribute('value'), 'linkedin', 'normalized source recorded');
assert.strictEqual(d.querySelector('[data-hidden-field="locale"]').getAttribute('value'), 'en', 'locale recorded');
assert.strictEqual(d.querySelector('[data-hidden-field="privacyNoticeVersion"]').getAttribute('value'), 'recruitment-privacy-draft-2026-07', 'privacy version recorded');

// Query-string title spoofing is ignored: renderApplication takes title from the manifest.
d = renderDoc('en');
app.renderApplication(d, manifest([role()]), { roleId: 'investment-analyst', roleTitle: 'FAKE TITLE', source: 'website', locale: 'en' });
assert.strictEqual(d.querySelector('[data-application-role-title]').textContent, 'Investment Analyst', 'URL-supplied title is ignored');

// Chinese role title.
d = renderDoc('zh-CN');
app.renderApplication(d, manifest([role()]), { roleId: 'investment-analyst', source: 'website', locale: 'zh-CN' });
assert.strictEqual(d.querySelector('[data-application-role-title]').textContent, '投资分析师', 'Chinese role title from manifest');

// Unknown source in renderApplication normalizes to direct in the hidden field.
d = renderDoc('en');
app.renderApplication(d, manifest([role()]), { roleId: 'investment-analyst', source: 'promo123', locale: 'en' });
assert.strictEqual(d.querySelector('[data-hidden-field="source"]').getAttribute('value'), 'direct', 'unknown source stored as direct');

// The raw source value is never written into any attribute or text.
d = renderDoc('en');
app.renderApplication(d, manifest([role()]), { roleId: 'investment-analyst', source: '"><img src=x>', locale: 'en' });
const dump = JSON.stringify(d.registry, function (k, v) { return v instanceof El ? { a: v.attributes, t: v.textContent } : v; });
assert.doesNotMatch(dump, /img src=x/, 'raw source value never rendered');

// ---- Field validation ------------------------------------------------------------------
const cvRules = role().files[0];
function goodValues(over) {
  return Object.assign({ fullName: 'Jane Doe', email: 'jane@example.com', location: 'Guangzhou', telephone: '', linkedinUrl: '', applicationStatement: 'I am interested.', privacyAccepted: true }, over);
}
const goodFile = [{ name: 'cv.pdf', type: 'application/pdf', size: 1000 }];

assert.strictEqual(app.validateForm(goodValues(), goodFile, cvRules).valid, true, 'complete valid form passes');
assert.strictEqual(app.validateForm(goodValues({ fullName: '  ' }), goodFile, cvRules).errors.fullName, 'required', 'full name required');
assert.strictEqual(app.validateForm(goodValues({ email: 'not-an-email' }), goodFile, cvRules).errors.email, 'invalidEmail', 'email validated');
assert.strictEqual(app.validateForm(goodValues({ location: '' }), goodFile, cvRules).errors.location, 'required', 'location required');
assert.strictEqual(app.validateForm(goodValues({ applicationStatement: '' }), goodFile, cvRules).errors.applicationStatement, 'required', 'statement required');
assert.strictEqual(app.validateForm(goodValues({ privacyAccepted: false }), goodFile, cvRules).errors.privacyAccepted, 'privacyRequired', 'privacy acknowledgement required');
assert.strictEqual(app.validateForm(goodValues({ telephone: '+86 20 1234 5678' }), goodFile, cvRules).valid, true, 'valid telephone accepted');
assert.strictEqual(app.validateForm(goodValues({ telephone: 'call-me' }), goodFile, cvRules).errors.telephone, 'invalidPhone', 'bad telephone rejected');
assert.strictEqual(app.validateForm(goodValues({ linkedinUrl: 'https://www.linkedin.com/in/jane' }), goodFile, cvRules).valid, true, 'valid LinkedIn accepted');
assert.strictEqual(app.validateForm(goodValues({ linkedinUrl: 'http://evil.example' }), goodFile, cvRules).errors.linkedinUrl, 'invalidLinkedin', 'bad LinkedIn rejected');
assert.strictEqual(app.validateForm(goodValues(), [], cvRules).errors.cv, 'fileMissing', 'missing CV rejected');
assert.strictEqual(app.validateForm(goodValues(), [{ name: 'cv.exe', type: 'application/octet-stream', size: 10 }], cvRules).errors.cv, 'fileType', 'bad extension rejected');
assert.strictEqual(app.validateForm(goodValues(), [{ name: 'cv.pdf', type: 'application/x-msdownload', size: 10 }], cvRules).errors.cv, 'fileType', 'bad MIME rejected');
assert.strictEqual(app.validateForm(goodValues(), [{ name: 'cv.pdf', type: 'application/pdf', size: 20000000 }], cvRules).errors.cv, 'fileSize', 'oversized file rejected');
assert.strictEqual(app.validateForm(goodValues(), [{ name: 'a.pdf', type: 'application/pdf', size: 10 }, { name: 'b.pdf', type: 'application/pdf', size: 10 }], cvRules).errors.cv, 'fileMultiple', 'multiple files rejected');

// ---- buildSubmissionFields: exact multipart keys, manifest-derived role fields ---------
const fields = app.buildSubmissionFields(
  { roleId: 'investment-analyst', roleTitle: 'Investment Analyst', roleTeam: 'Investment', roleLocation: 'Guangzhou', locale: 'en', source: 'linkedin', submittedAtClientUtc: '2026-07-18T00:00:00.000Z' },
  goodValues({ telephone: '123456', linkedinUrl: 'https://www.linkedin.com/in/jane' })
);
assert.deepStrictEqual(Object.keys(fields).sort(), [
  'applicationStatement', 'email', 'fullName', 'linkedinUrl', 'locale', 'location',
  'privacyAccepted', 'privacyNoticeVersion', 'roleId', 'roleLocation', 'roleTeam', 'roleTitle', 'source', 'submittedAtClientUtc', 'telephone'
].sort(), 'submission carries exactly the contract keys (cv appended separately)');
assert.strictEqual(fields.source, 'linkedin');
assert.strictEqual(fields.locale, 'en');
assert.strictEqual(fields.privacyNoticeVersion, 'recruitment-privacy-draft-2026-07');
assert.strictEqual(fields.privacyAccepted, 'true');

// ---- Error-code mapping is neutral -----------------------------------------------------
const en = { notFound: 'nf', disabled: 'dis', closed: 'cl', genericFailure: 'gen', fileMissing: 'fm', fileType: 'ft', fileSize: 'fs', rateLimited: 'rl' };
assert.strictEqual(app.messageForErrorCode('RATE_LIMITED', en), 'rl');
assert.strictEqual(app.messageForErrorCode('STORAGE_FAILED', en), 'gen', 'storage failure maps to a generic message, no infra detail');
assert.strictEqual(app.messageForErrorCode('MALWARE_SCAN_FAILED', en), 'gen');
assert.strictEqual(app.messageForErrorCode('TOTALLY_UNKNOWN', en), 'gen', 'unknown codes map to generic');

// ---- Mock mode can never be enabled in production --------------------------------------
function fakeWin(host) { return { location: { hostname: host } }; }
const prodDoc = new Doc('en'); prodDoc.body.setAttribute('data-recruitment-mock', 'true');
assert.strictEqual(app.mockEnabled(prodDoc, fakeWin('shorevest.com')), false, 'mock cannot enable on production host');
assert.strictEqual(app.mockEnabled(prodDoc, fakeWin('localhost')), true, 'mock enables on localhost only with opt-in');
const noOptDoc = new Doc('en');
assert.strictEqual(app.mockEnabled(noOptDoc, fakeWin('localhost')), false, 'mock stays off without opt-in');
assert.strictEqual(app.isProductionHost(fakeWin('shorevest.com')), true);
assert.strictEqual(app.isProductionHost(fakeWin('localhost')), false);

// ---------------------------------------------------------------------------------------
// Submission flow tests, including "no fake success" and browser-storage abstinence.
// ---------------------------------------------------------------------------------------

// Build a document with an interactive form and all submission targets.
function submitDoc(lang, values, file) {
  const d = new Doc(lang);
  const form = new El('form');
  d.register('[data-application-form]', form);
  const errors = new El('div'); errors.setAttribute('hidden', 'hidden');
  d.register('[data-application-errors]', errors);
  const success = new El('div'); success.setAttribute('hidden', 'hidden');
  d.register('[data-application-success]', success);
  d.register('[data-application-submit]', new El('button'));
  const submitError = new El('p'); submitError.setAttribute('hidden', 'hidden');
  d.register('[data-application-submit-error]', submitError);
  d.registerAll('[data-field-error]', []);
  d.registerAll('[data-field]', []);
  const fieldEls = {};
  ['fullName', 'email', 'location', 'telephone', 'linkedinUrl', 'applicationStatement'].forEach((n) => {
    const el = new El('input'); el.value = values[n] || '';
    fieldEls[n] = el; d.register('[data-field="' + n + '"]', el);
  });
  const privacy = new El('input'); privacy.checked = Boolean(values.privacyAccepted);
  d.register('[data-field="privacyAccepted"]', privacy);
  const cv = new El('input'); cv.files = file || [];
  d.register('[data-field="cv"]', cv);
  return { d, form };
}

const context = { roleId: 'investment-analyst', roleTitle: 'Investment Analyst', roleTeam: 'Investment', roleLocation: 'Guangzhou', locale: 'en', source: 'website', cvRules: cvRules };
const strings = {
  submitting: '…', submit: 'Submit application', backendUnavailable: 'unavailable-msg', genericFailure: 'generic', rateLimited: 'rate', networkFailure: 'network',
  successTitle: 'Application received', successBody: 'ok', successReference: 'Application reference:', successFollowup: 'follow', errorSummaryTitle: 'errs', required: 'req'
};

class FormDataStub { constructor() { this.entries = []; } append(k, v) { this.entries.push([k, v]); } }

async function run() {
  // 1. No endpoint + no mock → neutral failure, never success.
  let s = submitDoc('en', goodValues(), goodFile);
  let r = await app.submitApplication({ doc: s.d, win: { FormData: FormDataStub }, strings: strings, context: context, endpoint: null, mock: false });
  assert.strictEqual(r, 'no-backend', 'no backend does not fake success');
  assert.strictEqual(s.d.querySelector('[data-application-submit-error]').textContent, 'unavailable-msg');
  assert.strictEqual(s.d.querySelector('[data-application-success]').getAttribute('hidden'), 'hidden', 'success region stays hidden without a backend');

  // 2. Invalid form → error summary, no network call.
  s = submitDoc('en', goodValues({ email: 'bad' }), goodFile);
  let fetched = false;
  r = await app.submitApplication({ doc: s.d, win: { FormData: FormDataStub, fetch: () => { fetched = true; return Promise.resolve({}); } }, strings: strings, context: context, endpoint: '/api/recruitment/applications', mock: false });
  assert.strictEqual(r, 'invalid', 'invalid form short-circuits');
  assert.strictEqual(fetched, false, 'no network call for invalid form');

  // 3. Backend success → success reference rendered, form hidden.
  s = submitDoc('en', goodValues(), goodFile);
  const okFetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, applicationReference: 'SV-2026-000042' }) });
  r = await app.submitApplication({ doc: s.d, win: { FormData: FormDataStub, fetch: okFetch }, strings: strings, context: context, endpoint: '/api/recruitment/applications', mock: false });
  assert.strictEqual(r, 'success');
  assert.match(s.d.querySelector('[data-application-success]').textContent, /SV-2026-000042/, 'application reference rendered');
  assert.strictEqual(s.d.querySelector('[data-application-form]').getAttribute('hidden'), 'hidden', 'form hidden after success');
  assert.strictEqual(s.d.querySelector('[data-application-submit]').getAttribute('disabled'), null, 'submit restored (not left disabled) after completion');

  // 4. Controlled server error code → neutral message, no success.
  s = submitDoc('en', goodValues(), goodFile);
  const errFetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({ success: false, errorCode: 'RATE_LIMITED' }) });
  r = await app.submitApplication({ doc: s.d, win: { FormData: FormDataStub, fetch: errFetch }, strings: strings, context: context, endpoint: '/api/x', mock: false });
  assert.strictEqual(r, 'error:RATE_LIMITED');
  assert.strictEqual(s.d.querySelector('[data-application-submit-error]').textContent, 'rate');
  assert.strictEqual(s.d.querySelector('[data-application-success]').getAttribute('hidden'), 'hidden');

  // 5. Network failure → neutral network message, form NOT reset, no success.
  s = submitDoc('en', goodValues(), goodFile);
  const netFail = () => Promise.reject(new Error('network down'));
  r = await app.submitApplication({ doc: s.d, win: { FormData: FormDataStub, fetch: netFail }, strings: strings, context: context, endpoint: '/api/x', mock: false });
  assert.strictEqual(r, 'network-error');
  assert.strictEqual(s.d.querySelector('[data-application-submit-error]').textContent, 'network');
  assert.strictEqual(s.d.querySelector('[data-field="fullName"]').value, 'Jane Doe', 'entered data preserved after network failure');
  assert.strictEqual(s.d.querySelector('[data-application-submit]').getAttribute('disabled'), null, 'submit restored after network failure');

  // 6. Success body missing reference is NOT treated as success.
  s = submitDoc('en', goodValues(), goodFile);
  const okNoRef = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
  r = await app.submitApplication({ doc: s.d, win: { FormData: FormDataStub, fetch: okNoRef }, strings: strings, context: context, endpoint: '/api/x', mock: false });
  assert.notStrictEqual(r, 'success', 'success without a reference is not a success');

  // 7. Correct multipart keys are appended, cv appended separately.
  s = submitDoc('en', goodValues(), goodFile);
  let capturedBody = null;
  const captureFetch = (url, opts) => { capturedBody = opts.body; return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, applicationReference: 'SV-1' }) }); };
  await app.submitApplication({ doc: s.d, win: { FormData: FormDataStub, fetch: captureFetch }, strings: strings, context: context, endpoint: '/api/x', mock: false });
  const keys = capturedBody.entries.map((e) => e[0]);
  assert.ok(keys.includes('roleId') && keys.includes('cv') && keys.includes('source') && keys.includes('privacyNoticeVersion') && keys.includes('submittedAtClientUtc'), 'multipart contains contract keys incl cv');
  const cvEntry = capturedBody.entries.find((e) => e[0] === 'cv');
  assert.strictEqual(cvEntry[1].name, 'cv.pdf', 'cv file appended');

  console.log('recruitment application renderer tests passed');
}

run().then(() => {
  // Global guarantees: the module source references no browser-storage or analytics APIs.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets/js/recruitment-application.js'), 'utf8');
  for (const banned of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'caches.', 'gtag(', 'dataLayer', 'analytics', 'console.log', 'console.error', '.innerHTML']) {
    assert.strictEqual(src.includes(banned), false, `application module must not reference ${banned}`);
  }
  assert.strictEqual(innerHtmlWrites, 0, 'no innerHTML writes occurred during rendering');
}).catch((err) => { console.error(err); process.exit(1); });
