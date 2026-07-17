const assert = require('assert');
const fs = require('fs');
const path = require('path');
const renderer = require('../assets/js/recruitment-role-list');

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
  set textContent(value) { this._textContent = String(value); this.children = []; }
  get textContent() { return this._textContent + this.children.map((child) => child.textContent).join(''); }
  querySelectorAllByClass(className, found = []) {
    if (this.className === className) found.push(this);
    this.children.forEach((child) => child.querySelectorAllByClass(className, found));
    return found;
  }
  findByTag(tagName, found = []) {
    if (this.tagName === tagName.toUpperCase()) found.push(this);
    this.children.forEach((child) => child.findByTag(tagName, found));
    return found;
  }
}

class Document {
  constructor(lang, emptyText) {
    this.documentElement = { lang };
    this.container = new Element('div');
    this.container.attributes['data-role-list'] = 'open-roles';
    const empty = new Element('p');
    empty.className = 'careers-role-empty';
    empty.textContent = emptyText;
    this.container.appendChild(empty);
  }
  createElement(tagName) { return new Element(tagName); }
  querySelector(selector) { return selector === '[data-role-list="open-roles"]' ? this.container : null; }
}

const root = path.resolve(__dirname, '..');
const checkedInManifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/recruitment/roles.v1.json'), 'utf8'));
const EN_EMPTY = 'We do not currently have any open positions. Future opportunities will be posted on this page.';
const ZH_EMPTY = '目前暂无公开招聘职位。未来机会将在本页面发布。';

function doc(lang, empty = EN_EMPTY) { return new Document(lang, empty); }
function rows(document) { return document.container.querySelectorAllByClass('careers-role-row'); }
function links(document) { return document.container.findByTag('a'); }
function role(id, status = 'active', overrides = {}) {
  return {
    roleId: id,
    status,
    locales: {
      en: { title: `Title ${id}`, team: `Team ${id}`, location: `Location ${id}`, detailPath: `careers/${id}.html` },
      'zh-CN': { title: `职位 ${id}`, team: `团队 ${id}`, location: `地点 ${id}`, detailPath: `careers/${id}_cn.html` }
    },
    employmentType: 'Full-time',
    applicationEnabled: false,
    ...overrides
  };
}

function manifest(roles) { return { schemaVersion: '1.0', generatedAtUtc: '2026-07-17T00:00:00Z', roles }; }

let d = doc('en');
assert.strictEqual(renderer.renderRolesFromManifest(d, checkedInManifest), 0, 'empty checked-in manifest renders no English roles');
assert.strictEqual(d.container.textContent, EN_EMPTY, 'English empty state is preserved');

d = doc('zh-CN', ZH_EMPTY);
assert.strictEqual(renderer.renderRolesFromManifest(d, checkedInManifest), 0, 'empty checked-in manifest renders no Chinese roles');
assert.strictEqual(d.container.textContent, ZH_EMPTY, 'Chinese empty state is preserved');

d = doc('en');
assert.strictEqual(renderer.renderRolesFromManifest(d, manifest([role('investment-analyst')])), 1, 'valid English role renders');
assert.match(d.container.textContent, /Title investment-analyst/);
assert.match(d.container.textContent, /Team investment-analyst/);
assert.match(d.container.textContent, /Location investment-analyst/);
assert.match(d.container.textContent, /Full-time/);
assert.doesNotMatch(d.container.textContent, /全职/);
assert.strictEqual(links(d)[0].href, 'careers/investment-analyst.html');
assert.strictEqual(links(d)[0].textContent, 'View role');

d = doc('zh-CN', ZH_EMPTY);
assert.strictEqual(renderer.renderRolesFromManifest(d, manifest([role('investment-analyst')])), 1, 'valid Chinese role renders');
assert.match(d.container.textContent, /职位 investment-analyst/);
assert.match(d.container.textContent, /团队 investment-analyst/);
assert.match(d.container.textContent, /地点 investment-analyst/);
assert.match(d.container.textContent, /全职/);
assert.doesNotMatch(d.container.textContent, /Full-time/);
assert.strictEqual(links(d)[0].href, 'careers/investment-analyst_cn.html');
assert.strictEqual(links(d)[0].textContent, '查看职位');


for (const [employmentType, expectedLabel] of [['Part-time', '兼职'], ['Internship', '实习'], ['Contract', '合同制']]) {
  d = doc('zh-CN', ZH_EMPTY);
  assert.strictEqual(renderer.renderRolesFromManifest(d, manifest([role(`localized-${employmentType.toLowerCase()}`, 'active', { employmentType })])), 1, `${employmentType} renders in Chinese`);
  assert.match(d.container.textContent, new RegExp(expectedLabel));
  assert.doesNotMatch(d.container.textContent, new RegExp(employmentType), `${employmentType} raw English label is not rendered on Chinese page`);
}

d = doc('en');
assert.strictEqual(renderer.renderRolesFromManifest(d, manifest([role('unsupported-employment', 'active', { employmentType: 'Temporary' })])), 0, 'unsupported employment type is skipped');
assert.strictEqual(d.container.textContent, EN_EMPTY);

d = doc('en');
const englishWithChinesePath = role('english-with-chinese-path');
englishWithChinesePath.locales.en.detailPath = 'careers/english-with-chinese-path_cn.html';
assert.strictEqual(renderer.renderRolesFromManifest(d, manifest([englishWithChinesePath])), 0, 'English page rejects Chinese detail path suffix');
assert.strictEqual(d.container.textContent, EN_EMPTY);

d = doc('zh-CN', ZH_EMPTY);
const chineseWithEnglishPath = role('chinese-with-english-path');
chineseWithEnglishPath.locales['zh-CN'].detailPath = 'careers/chinese-with-english-path.html';
assert.strictEqual(renderer.renderRolesFromManifest(d, manifest([chineseWithEnglishPath])), 0, 'Chinese page rejects English detail path without suffix');
assert.strictEqual(d.container.textContent, ZH_EMPTY);

d = doc('en');
assert.strictEqual(renderer.renderRolesFromManifest(d, manifest([role('draft-role', 'draft'), role('closed-role', 'closed'), role('archived-role', 'archived')])), 0, 'inactive roles are skipped');
assert.strictEqual(d.container.textContent, EN_EMPTY);

d = doc('en');
renderer.renderRolesFromManifest(d, manifest([role('first'), role('second')]));
assert.deepStrictEqual(rows(d).map((row) => row.findByTag('h3')[0].textContent), ['Title first', 'Title second'], 'manifest order is preserved');

d = doc('zh-CN', ZH_EMPTY);
const missingLocale = role('missing-locale');
delete missingLocale.locales['zh-CN'];
assert.strictEqual(renderer.renderRolesFromManifest(d, manifest([missingLocale])), 0, 'missing page locale is skipped');
assert.strictEqual(d.container.textContent, ZH_EMPTY);

async function runAsyncTests() {
  d = doc('en');
  const malformedWarnings = [];
  await renderer.initRoleList({ document: d, console: { warn: (message) => malformedWarnings.push(message) }, fetch: () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) }) });
  assert.strictEqual(d.container.textContent, EN_EMPTY, 'malformed JSON preserves empty state');
  assert.deepStrictEqual(malformedWarnings, ['Recruitment role list unavailable.']);

  d = doc('en');
  await renderer.initRoleList({ document: d, console: { warn: () => {} }, fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }) });
  assert.strictEqual(d.container.textContent, EN_EMPTY, 'failed fetch preserves empty state');

  for (const unsafe of ['https://example.com/role', '//example.com/role', 'javascript:alert(1)', 'data:text/html,hi', 'mailto:jobs@example.com', 'application-form.html', 'careers/../x.html']) {
    d = doc('en');
    const unsafeRole = role('unsafe');
    unsafeRole.locales.en.detailPath = unsafe;
    assert.strictEqual(renderer.renderRolesFromManifest(d, manifest([unsafeRole])), 0, `${unsafe} is rejected`);
    assert.strictEqual(links(d).length, 0, 'no empty or unsafe link is rendered');
  }

  d = doc('en');
  const htmlRole = role('html-role');
  htmlRole.locales.en.title = '<img src=x onerror=alert(1)>Analyst';
  renderer.renderRolesFromManifest(d, manifest([htmlRole]));
  assert.strictEqual(rows(d)[0].findByTag('h3')[0].textContent, '<img src=x onerror=alert(1)>Analyst', 'manifest text is inserted as text');
  assert.strictEqual(rows(d)[0].findByTag('img').length, 0, 'manifest text is not parsed as HTML');

  d = doc('en');
  const enabledRole = role('applications-off-contract', 'active', { applicationEnabled: true });
  renderer.renderRolesFromManifest(d, manifest([enabledRole]));
  assert.strictEqual(rows(d).length, 1, 'applicationEnabled is not used as a launch switch');
  assert.strictEqual(rows(d)[0].findByTag('form').length, 0, 'no application form is rendered');
  assert.strictEqual(rows(d)[0].findByTag('button').length, 0, 'no application submission control is rendered');
  assert.strictEqual(links(d).length, 1, 'only the role-detail link is rendered');

  console.log('recruitment role-list renderer tests passed');
}

runAsyncTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
