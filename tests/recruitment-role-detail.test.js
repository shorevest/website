const assert = require('assert');
const renderer = require('../assets/js/recruitment-role-detail');

// Minimal DOM shim mirroring tests/recruitment-role-list.test.js. It records whether any
// value was ever assigned through innerHTML so we can prove the renderer never uses it.
let innerHtmlWrites = 0;

class Element {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.className = '';
    this._textContent = '';
  }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  set href(value) { this.attributes.href = value; }
  get href() { return this.attributes.href; }
  set innerHTML(value) { innerHtmlWrites += 1; this._textContent = String(value); }
  set textContent(value) { this._textContent = String(value); this.children = []; }
  get textContent() { return this._textContent + this.children.map((c) => c.textContent).join(''); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  findByTag(tagName, found = []) {
    if (this.tagName === tagName.toUpperCase()) found.push(this);
    this.children.forEach((c) => c.findByTag(tagName, found));
    return found;
  }
}

class Document {
  constructor(lang, roleId) {
    this.documentElement = { lang };
    this.hero = new Element('div');
    this.hero.attributes['data-role-detail'] = 'hero';
    this.body_ = new Element('body');
    if (roleId !== undefined) this.body_.attributes['data-recruitment-role-id'] = roleId;
    this.bodyEl = new Element('section');
    this.bodyEl.attributes['data-role-detail'] = 'body';
  }
  get body() { return this.body_; }
  createElement(tag) { return new Element(tag); }
  querySelector(sel) {
    if (sel === '[data-role-detail="hero"]') return this.hero;
    if (sel === '[data-role-detail="body"]') return this.bodyEl;
    return null;
  }
}

function baseRole(overrides = {}) {
  return Object.assign({
    roleId: 'investment-analyst',
    status: 'active',
    employmentType: 'Full-time',
    applicationEnabled: false,
    applicationDeadline: null,
    reportingLine: null,
    locales: {
      en: { title: 'Investment Analyst', team: 'Investment', location: 'Guangzhou', detailPath: 'careers/investment-analyst.html' },
      'zh-CN': { title: '投资分析师', team: '投资', location: '广州', detailPath: 'careers/investment-analyst_cn.html' }
    },
    files: [{ filePurpose: 'cv', required: true, maxSizeBytes: 10485760, allowedExtensions: ['.pdf'], allowedMimeTypes: ['application/pdf'], signatureValidation: { required: true, acceptedSignatures: ['pdf'] } }],
    screening: { workAuthorization: { enabled: false, required: false, jurisdictions: [] }, roleSpecificQuestions: [] }
  }, overrides);
}

function manifest(roles) { return { schemaVersion: '1.0', generatedAtUtc: '2026-07-17T00:00:00Z', roles }; }

function render(lang, roleId, roles, opts) {
  const d = new Document(lang, roleId);
  const status = renderer.renderRoleDetail(d, roles === undefined ? undefined : manifest(roles), Object.assign({ roleId }, opts));
  return { d, status, hero: () => d.hero.textContent, body: () => d.bodyEl.textContent };
}

// --- English active, disabled applications --------------------------------------------
let r = render('en', 'investment-analyst', [baseRole()]);
assert.strictEqual(r.status, 'disabled', 'active disabled-applications role reports disabled');
assert.match(r.hero(), /Investment Analyst/, 'English title renders');
assert.match(r.hero(), /Investment · Guangzhou · Full-time/, 'meta renders team/location/employment');
assert.match(r.body(), /Applications are not currently being accepted for this position\./, 'English disabled wording');
assert.strictEqual(r.d.bodyEl.findByTag('a').filter((a) => /apply\.html/.test(a.href)).length, 0, 'no apply button when disabled');

// --- Chinese active, disabled ---------------------------------------------------------
r = render('zh-CN', 'investment-analyst', [baseRole()]);
assert.strictEqual(r.status, 'disabled');
assert.match(r.hero(), /投资分析师/, 'Chinese title renders');
assert.match(r.body(), /该职位目前暂不接受申请。/, 'Chinese disabled wording');

// --- Enabled application renders correct Apply URL (EN + source=website) ---------------
const enabledEn = baseRole({
  applicationEnabled: true,
  locales: {
    en: { title: 'Investment Analyst', team: 'Investment', location: 'Guangzhou', detailPath: 'careers/investment-analyst.html', summary: 'S', responsibilities: ['R'], requirements: ['Q'], applicationStatementPrompt: 'P' },
    'zh-CN': { title: '投资分析师', team: '投资', location: '广州', detailPath: 'careers/investment-analyst_cn.html', summary: 'S', responsibilities: ['R'], requirements: ['Q'], applicationStatementPrompt: 'P' }
  }
});
r = render('en', 'investment-analyst', [enabledEn]);
assert.strictEqual(r.status, 'apply-open', 'enabled active role reports apply-open');
let applyLinks = r.d.bodyEl.findByTag('a').map((a) => a.href);
assert.ok(applyLinks.includes('apply.html?role=investment-analyst&source=website'), `English apply URL is correct; got ${applyLinks.join(',')}`);

// --- Enabled Chinese Apply URL --------------------------------------------------------
r = render('zh-CN', 'investment-analyst', [enabledEn]);
applyLinks = r.d.bodyEl.findByTag('a').map((a) => a.href);
assert.ok(applyLinks.includes('apply_cn.html?role=investment-analyst&source=website'), `Chinese apply URL is correct; got ${applyLinks.join(',')}`);

// --- Content rendering: responsibilities/requirements/preferred/reporting/deadline -----
const fullRole = baseRole({
  status: 'active',
  applicationEnabled: false,
  applicationDeadline: '2999-12-31',
  reportingLine: { approved: true, locales: { en: 'Head of Investment', 'zh-CN': '投资主管' } },
  locales: {
    en: { title: 'Investment Analyst', team: 'Investment', location: 'Guangzhou', detailPath: 'careers/investment-analyst.html', summary: 'Overview text.', responsibilities: ['Do reviews', 'Write memos'], requirements: ['Experience'], preferredQualifications: ['Mandarin'], applicationStatementPrompt: 'P' },
    'zh-CN': { title: '投资分析师', team: '投资', location: '广州', detailPath: 'careers/investment-analyst_cn.html', summary: '概述。', responsibilities: ['审查'], requirements: ['经验'], preferredQualifications: ['普通话'], applicationStatementPrompt: 'P' }
  }
});
r = render('en', 'investment-analyst', [fullRole]);
const body = r.body();
assert.match(body, /Overview text\./, 'summary renders');
assert.match(body, /Do reviews/, 'responsibilities render');
assert.match(body, /Write memos/, 'multiple responsibilities render');
assert.match(body, /Experience/, 'requirements render');
assert.match(body, /Mandarin/, 'preferred qualifications render when present');
assert.match(body, /Head of Investment/, 'approved reporting line renders');
assert.match(body, /Reporting Line/, 'reporting line heading renders');
assert.match(body, /2999-12-31/, 'deadline renders when present');

// Unapproved reporting line must NOT render.
const unapprovedReporting = baseRole({ reportingLine: { approved: false, locales: { en: 'Secret Manager', 'zh-CN': '机密' } } });
r = render('en', 'investment-analyst', [unapprovedReporting]);
assert.doesNotMatch(r.body(), /Secret Manager/, 'unapproved reporting line is hidden');

// Missing optional fields do not throw and produce no stray headings.
r = render('en', 'investment-analyst', [baseRole()]);
assert.doesNotMatch(r.body(), /Preferred Qualifications/, 'no preferred-qualifications heading when absent');
assert.doesNotMatch(r.body(), /Reporting Line/, 'no reporting-line heading when absent');

// --- Closed role ----------------------------------------------------------------------
r = render('en', 'investment-analyst', [baseRole({ status: 'closed' })]);
assert.strictEqual(r.status, 'closed', 'closed role reports closed');
assert.match(r.body(), /This position is no longer accepting applications\./, 'English closed wording');
r = render('zh-CN', 'investment-analyst', [baseRole({ status: 'closed' })]);
assert.match(r.body(), /该职位已停止接受申请。/, 'Chinese closed wording');

// Archived behaves like closed.
r = render('en', 'investment-analyst', [baseRole({ status: 'archived' })]);
assert.strictEqual(r.status, 'closed', 'archived role reports closed');

// Draft is treated as not-found (not publicly viewable).
r = render('en', 'investment-analyst', [baseRole({ status: 'draft' })]);
assert.strictEqual(r.status, 'draft');
assert.match(r.body(), /This position could not be found\./, 'draft shows not-found wording');

// --- Passed deadline on an enabled role does not open the Apply button -----------------
const pastDeadline = Object.assign({}, enabledEn, { applicationDeadline: '2000-01-01' });
r = render('en', 'investment-analyst', [pastDeadline]);
assert.strictEqual(r.status, 'disabled', 'enabled role with passed deadline does not open applications');
assert.strictEqual(r.d.bodyEl.findByTag('a').filter((a) => /apply\.html/.test(a.href)).length, 0, 'no apply button after deadline');

// --- Unknown role, missing locale, invalid role id, unavailable manifest --------------
r = render('en', 'nonexistent-role', [baseRole()]);
assert.strictEqual(r.status, 'not-found', 'unknown role id is not found');
assert.match(r.body(), /This position could not be found\./);

const missingLocale = baseRole();
delete missingLocale.locales['zh-CN'];
r = render('zh-CN', 'investment-analyst', [missingLocale]);
assert.strictEqual(r.status, 'missing-locale', 'missing locale reports missing-locale');
assert.match(r.body(), /未能找到该职位。/, 'missing locale shows Chinese not-found wording');

for (const bad of ['', 'Bad Role', 'a', '../etc', 'role/../x', 'javascript:alert(1)']) {
  r = render('en', bad, [baseRole()]);
  assert.strictEqual(r.status, 'invalid-role', `invalid role id "${bad}" rejected`);
}

// Missing/malformed manifest → safe unavailable state.
let d = new Document('en', 'investment-analyst');
assert.strictEqual(renderer.renderRoleDetail(d, null, { roleId: 'investment-analyst' }), 'unavailable', 'null manifest is unavailable');
assert.match(d.bodyEl.textContent, /could not be loaded/, 'unavailable wording shown');

// --- Safe DOM insertion: manifest HTML is text, never parsed ---------------------------
const htmlRole = baseRole();
htmlRole.locales.en.title = '<img src=x onerror=alert(1)>Analyst';
htmlRole.locales.en.summary = '<script>alert(1)</scr' + 'ipt>';
r = render('en', 'investment-analyst', [htmlRole]);
assert.strictEqual(r.d.hero.findByTag('img').length, 0, 'manifest title is not parsed into an <img>');
assert.strictEqual(r.d.bodyEl.findByTag('script').length, 0, 'manifest summary is not parsed into a <script>');
assert.match(r.hero(), /<img src=x onerror=alert\(1\)>Analyst/, 'title inserted verbatim as text');
assert.strictEqual(innerHtmlWrites, 0, 'renderer never assigns innerHTML for manifest content');

// deadlineHasPassed helper sanity.
assert.strictEqual(renderer.deadlineHasPassed('2000-01-01'), true);
assert.strictEqual(renderer.deadlineHasPassed('2999-12-31'), false);
assert.strictEqual(renderer.deadlineHasPassed(null), false);

console.log('recruitment role-detail renderer tests passed');
