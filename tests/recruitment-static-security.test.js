const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const rolePages = [
  'careers/distressed-debt-investment-manager.html',
  'careers/distressed-debt-investment-manager_cn.html',
  'careers/legal-assistant.html',
  'careers/legal-assistant_cn.html'
];
const disabledCleanRolePages = [
  'careers/distressed-debt-investment-manager/index.html',
  'cn/careers/distressed-debt-investment-manager/index.html',
  'careers/legal-assistant/index.html',
  'cn/careers/legal-assistant/index.html'
];
const publicFiles = [
  'careers.html',
  'careers_cn.html',
  'careers/index.html',
  'assets/js/recruitment-role-list.js',
  'assets/js/recruitment-role-detail.js',
  'assets/data/recruitment/roles.v1.json',
  ...rolePages,
  ...disabledCleanRolePages
];
function read(f){return fs.readFileSync(path.join(root,f),'utf8');}
const manifest = JSON.parse(read('assets/data/recruitment/roles.v1.json'));
assert.strictEqual(manifest.emailApplication.enabled, true, 'email application config is retained for future reactivation');
assert.strictEqual(manifest.emailApplication.address, 'hr@shorevest.com', 'email application address is centralized');
for (const role of manifest.roles) {
  assert.strictEqual(role.status, 'published', `${role.id} source content remains approved`);
  assert.strictEqual(role.contentReviewRequired, false, `${role.id} content review is cleared`);
  assert.strictEqual(role.contentReviewNote, '', `${role.id} note is cleared`);
  assert.strictEqual(role.application.enabled, false, `${role.id} secure application remains disabled`);
  assert.strictEqual(role.application.privacyNoticeVersion, null, `${role.id} has no unapproved privacy notice`);
}
for (const f of publicFiles) {
  const s = read(f);
  assert.doesNotMatch(s, /<form\b/i, `${f} must not contain an application form`);
  assert.doesNotMatch(s, /<input\b|<textarea\b/i, `${f} must not contain input controls`);
  assert.doesNotMatch(s, /type=["']file["']|drag-and-drop|dropzone/i, `${f} must not contain upload UI`);
  assert.doesNotMatch(s, /Submit application|申请该职位|apply\.html|apply_cn\.html/i, `${f} must not contain online submission actions`);
  assert.doesNotMatch(s, /fetch\([^)]*recruitment|XMLHttpRequest|AzureWebJobs|cosmos|blob\.core\.windows\.net/i, `${f} must not call an Azure recruitment endpoint`);
}
for (const f of rolePages) {
  const s = read(f);
  assert.match(s, /noindex, nofollow, noarchive/, `${f} is excluded from search while roles are disabled`);
  assert.match(s, /<script[^>]+application\/ld\+json[^>]*>[\s\S]*JobPosting/i, `${f} preserves approved role source content for later reactivation`);
  assert.doesNotMatch(s, /baseSalary|salary|compensation|jobBenefits|validThrough|applicantLocationRequirements|TELECOMMUTE/i, `${f} does not invent salary, benefits, deadline, or remote work`);
  assert.doesNotMatch(s, /INTERNAL PREVIEW|内部预览|Draft preview|草稿预览/, `${f} no-JS fallback does not expose draft messaging`);
}
for (const f of disabledCleanRolePages) {
  const s = read(f);
  assert.match(s, /noindex, nofollow, noarchive/, `${f} disabled route is excluded from search`);
  assert.match(s, /window\.location\.replace\("\/(?:cn\/)?careers\/#open-roles"\)/, `${f} redirects to the Careers no-vacancies state`);
  assert.doesNotMatch(s, /JobPosting|Apply by email|通过邮件申请|hr@shorevest\.com/i, `${f} does not expose vacancy content`);
}
assert.match(read('assets/js/site-config.js'), /careersOpenRolesEnabled: false/, 'careers feature flag is disabled');
for (const slug of ['distressed-debt-investment-manager','legal-assistant']) {
  assert.doesNotMatch(read('sitemap.xml'), new RegExp(`https://shorevest\\.com/(?:cn/)?careers/${slug}/`), `${slug} clean routes are absent from sitemap`);
  assert.doesNotMatch(read('sitemap.xml'), new RegExp(`${slug}(?:_cn)?\\.html`), `${slug} legacy routes are absent from sitemap`);
}
for (const f of ['api/recruitment/applicationValidation.js','api/recruitment/fileSignatures.js','api/recruitment/handler.js','api/recruitment/core/flows.js']) {
  assert.doesNotMatch(read(f), /applicationStatement|status: active|applicationEnabled|role\.files/, `${f} does not preserve the obsolete upload-through-API contract`);
}
console.log('recruitment static security checks passed');
