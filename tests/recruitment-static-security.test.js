const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
// Containment state: public listings and candidate capture stay closed until the
// committed/deployed backend and malware-scanning path pass controlled end-to-end verification.
function read(f){return fs.readFileSync(path.join(root,f),'utf8');}

const rolePages = [
  'careers/distressed-debt-investment-manager.html',
  'careers/distressed-debt-investment-manager_cn.html',
  'careers/legal-assistant.html',
  'careers/legal-assistant_cn.html'
];
const applicationPages = ['careers/apply.html','careers/apply_cn.html'];
const manifest = JSON.parse(read('assets/data/recruitment/roles.v1.json'));
const publicConfig = JSON.parse(read('assets/data/recruitment/public-config.json'));

assert.strictEqual(publicConfig.openRolesEnabled, false, 'Open Roles stay hidden until go-live is verified');
assert.strictEqual(publicConfig.applicationsEnabled, false, 'candidate capture stays closed until go-live is verified');
assert.strictEqual(publicConfig.turnstileSiteKey, '0x4AAAAAAEJh3KNuIlG3ZdgM', 'only the public Turnstile site key is published');
assert.strictEqual(publicConfig.apiBase, 'https://svrc26hk-recruit-fn-test.azurewebsites.net/api/recruitment');
assert.strictEqual(publicConfig.turnstileAction, 'recruitment-application');
assert.ok(!Object.keys(publicConfig).some(k => /secret/i.test(k)), 'public config contains no secret field');

for (const role of manifest.roles) {
  assert.strictEqual(role.status, 'published', `${role.id} source content remains approved`);
  assert.strictEqual(role.contentReviewRequired, false, `${role.id} content review is cleared`);
  assert.strictEqual(role.contentReviewNote, '', `${role.id} note is cleared`);
  assert.strictEqual(role.application.enabled, true, `${role.id} accepts online applications`);
  assert.strictEqual(role.application.privacyNoticeVersion, '2026-08-08-v1', `${role.id} uses the approved privacy version`);
}
assert.strictEqual(manifest.roles.filter(role => role.application.enabled === true).length, 2, 'both approved roles accept online applications');

for (const f of rolePages) {
  const s = read(f);
  assert.match(s, /<script[^>]+application\/ld\+json[^>]*>[\s\S]*JobPosting/i, `${f} preserves approved JobPosting source content`);
  assert.doesNotMatch(s, /<form\b|type=["']file["']/i, `${f} does not embed the application form`);
  assert.doesNotMatch(s, /baseSalary|salary|compensation|jobBenefits|validThrough|applicantLocationRequirements|TELECOMMUTE/i, `${f} does not invent employment terms`);
}

for (const f of applicationPages) {
  const s = read(f);
  assert.match(s, /noindex, nofollow, noarchive/, `${f} remains excluded from search indexing`);
  assert.match(s, /data-application-form/, `${f} contains the application form`);
  assert.match(s, /type="file"/, `${f} contains one CV file input`);
  assert.match(s, /data-turnstile/, `${f} contains the Turnstile mount`);
  assert.match(s, /challenges\.cloudflare\.com\/turnstile/, `${f} loads Turnstile from the approved origin`);
  assert.doesNotMatch(s, /mailto:|hr@shorevest\.com/i, `${f} does not send applications by email`);
  assert.doesNotMatch(s, /data-recruitment-mock|fake success|localStorage|sessionStorage|indexedDB/i, `${f} does not contain a production mock or browser persistence`);
}

assert.strictEqual(fs.existsSync(path.join(root, 'careers/application-test-20260808.html')), false, 'temporary application test page is removed');
assert.strictEqual(fs.existsSync(path.join(root, 'assets/js/recruitment-test-diagnostic.js')), false, 'temporary recruitment diagnostic client is removed');

const appClient = read('assets/js/recruitment-application.js');
for (const route of ['/applications/initiate','/applications/complete','/applications/finalize']) {
  assert.ok(appClient.includes(route), `application client uses ${route}`);
}
assert.match(appClient, /started\.upload\.url/, 'browser uploads only to the short-lived SAS URL returned by Azure');
assert.match(appClient, /botToken/, 'Turnstile token is sent to the backend');
assert.match(appClient, /clientSubmissionId/, 'client submission idempotency key is generated');
assert.doesNotMatch(appClient, /localStorage|sessionStorage|indexedDB|document\.cookie|console\.(?:log|info|debug)/, 'application client does not persist or log applicant data');
assert.doesNotMatch(appClient, /AccountKey=|SharedAccessSignature=|clientSecret|BEGIN PRIVATE KEY|recruitment-turnstile-secret/, 'application client contains no backend secret material');

const coreFlows = require('../api/recruitment/core/flows');
assert.strictEqual(typeof coreFlows.finalizeApplication, 'function', 'committed core exports the frontend finalize flow');
const appFactory = read('services/recruitment-functions/src/appFactory.js');
assert.match(appFactory, /flows:\s*\{[\s\S]*?finalizeApplication[,\s]/, 'Function composition exports the finalize flow');
const functionIndex = read('services/recruitment-functions/src/functions/index.js');
assert.match(functionIndex, /route:\s*['"]recruitment\/applications\/finalize['"]/, 'Functions host registers the finalize route');
const publicResponse = require('../services/recruitment-functions/src/lib/http').candidate({
  success: true,
  finalizationToken: 'contract-test-token',
  alreadyFinalized: true
});
assert.strictEqual(publicResponse.finalizationToken, 'contract-test-token', 'complete response does not strip the finalization token');
assert.strictEqual(publicResponse.alreadyFinalized, true, 'idempotent finalize state survives response filtering');

const roleDetail = read('assets/js/recruitment-role-detail.js');
assert.match(roleDetail, /applicationsEnabled===true/, 'role detail requires the public application switch');
assert.match(roleDetail, /role\.application\.enabled===true/, 'role detail also requires the role-level switch');
assert.doesNotMatch(roleDetail, /mailto:/, 'role details no longer route applications through email');

const headers = read('_headers');
assert.match(headers, /https:\/\/svrc26hk-recruit-fn-test\.azurewebsites\.net/, 'CSP permits only the configured recruitment Function host');
assert.match(headers, /https:\/\/svrc26hkcvtest\.blob\.core\.windows\.net/, 'CSP permits only the configured CV storage host');
assert.match(headers, /https:\/\/challenges\.cloudflare\.com/, 'CSP permits Turnstile');
assert.doesNotMatch(headers, /https:\/\/\*\.azurewebsites\.net|https:\/\/\*\.blob\.core\.windows\.net/, 'CSP does not use broad Azure wildcards');

assert.match(read('assets/js/site-config.js'), /careersOpenRolesEnabled: true/, 'legacy public Careers route flag is aligned with the launch state');
for (const f of ['api/recruitment/applicationValidation.js','api/recruitment/fileSignatures.js','api/recruitment/handler.js','api/recruitment/core/flows.js']) {
  assert.doesNotMatch(read(f), /applicationStatement|status: active|applicationEnabled|role\.files/, `${f} does not preserve the obsolete upload-through-API contract`);
}

const defenderTemplate = read('infra/recruitment/defender-scanning.bicep');
assert.match(defenderTemplate, /param enablePaidScanning bool = false/, 'paid scanning requires an explicit opt-in');
assert.match(defenderTemplate, /param capGBPerMonth int = 1/, 'test scanner has a small explicit volume cap');
assert.match(defenderTemplate, /scope: cvStorage/, 'Defender is scoped to the existing CV account');
assert.match(defenderTemplate, /overrideSubscriptionLevelSettings: true/, 'account-level configuration overrides inherited settings');
assert.match(defenderTemplate, /excludeBlobsWithPrefix: \['\$\{cleanContainerName\}\/'\]/, 'promoted clean files are excluded from rescanning');
assert.match(defenderTemplate, /dependsOn: \[delivery\]/, 'the scan-result consumer is configured before scanning is enabled');
assert.doesNotMatch(defenderTemplate, /resource\s+\w+\s+'Microsoft\.Security\/pricings/, 'no subscription-wide paid plan is enabled');
console.log('recruitment static security checks passed');
