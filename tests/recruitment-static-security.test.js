const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

// Files that make up the recruitment interface and backend scaffold. The static security
// checks below apply to these candidate-facing pages and code files (not to the options/
// decision memos, which legitimately discuss intake channels).
const CODE_FILES = [
  'assets/js/recruitment-role-list.js',
  'assets/js/recruitment-role-detail.js',
  'assets/js/recruitment-application.js',
  'api/recruitment/applicationValidation.js',
  'api/recruitment/fileSignatures.js',
  'api/recruitment/handler.js'
];
const PAGE_FILES = [
  'careers/apply.html',
  'careers/apply_cn.html',
  'careers/investment-analyst.html',
  'careers/investment-analyst_cn.html',
  'careers/finance-fund-operations-associate.html',
  'careers/finance-fund-operations-associate_cn.html'
];
const ALL_FILES = CODE_FILES.concat(PAGE_FILES);

// 1. No mailto: application mechanism anywhere in the recruitment interface.
ALL_FILES.forEach((f) => {
  assert.doesNotMatch(read(f), /mailto:/i, `${f} must not use a mailto: flow`);
});

// 2. No innerHTML use in the recruitment renderers (manifest content must go through
//    textContent / DOM nodes only).
CODE_FILES.filter((f) => f.startsWith('assets/js/')).forEach((f) => {
  assert.doesNotMatch(read(f), /\.innerHTML/, `${f} must not use innerHTML`);
  assert.doesNotMatch(read(f), /insertAdjacentHTML|outerHTML|document\.write/, `${f} must not inject raw HTML`);
});

// 3. No exposed credentials / secrets / connection strings / tokens.
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/AccountKey\s*=|SharedAccessKey\s*=|DefaultEndpointsProtocol\s*=/, 'storage connection string'],
  [/client_secret\s*[:=]/i, 'client secret'],
  [/\bapi[_-]?key\s*[:=]\s*["'`][^"'`]+/i, 'api key literal'],
  [/\bpassword\s*[:=]\s*["'`][^"'`]+/i, 'password literal'],
  [/xoxb-[A-Za-z0-9-]+/, 'slack token'],
  [/\bsmtp\b.*(password|secret)/i, 'smtp secret'],
  [/AKIA[0-9A-Z]{16}/, 'aws key'],
  [/\bBearer\s+[A-Za-z0-9._-]{20,}/, 'hard-coded bearer token']
];
ALL_FILES.forEach((f) => {
  const text = read(f);
  SECRET_PATTERNS.forEach(([pattern, label]) => {
    assert.doesNotMatch(text, pattern, `${f} must not contain a ${label}`);
  });
});

// 4. No hard-coded employee personal email address in the recruitment interface.
ALL_FILES.forEach((f) => {
  assert.doesNotMatch(read(f), /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, `${f} must not embed an email address`);
});

// 5. No applicant data routed to analytics / trackers, and no browser storage of applicant data.
const TRACKING_PATTERNS = [/gtag\(/, /dataLayer/, /\bga\(/, /mixpanel/i, /segment\.io/i, /fbq\(/, /hj\(/];
const STORAGE_PATTERNS = [/localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /caches\./];
CODE_FILES.filter((f) => f.startsWith('assets/js/')).forEach((f) => {
  const text = read(f);
  TRACKING_PATTERNS.forEach((p) => assert.doesNotMatch(text, p, `${f} must not send data to ${p}`));
  STORAGE_PATTERNS.forEach((p) => assert.doesNotMatch(text, p, `${f} must not use browser storage ${p}`));
});

// 6. No CV bytes logged; no console logging of applicant data in the frontend renderer.
assert.doesNotMatch(read('assets/js/recruitment-application.js'), /console\.(log|info|debug|error|warn)/, 'application renderer must not log to the console');

// 7. No public CV-storage links or SharePoint/blob URLs in candidate-facing pages/code.
ALL_FILES.forEach((f) => {
  const text = read(f);
  assert.doesNotMatch(text, /https?:\/\/[a-z0-9.-]*\.sharepoint\.com/i, `${f} must not contain a SharePoint URL`);
  assert.doesNotMatch(text, /https?:\/\/[a-z0-9.-]*\.blob\.core\.windows\.net/i, `${f} must not contain a public blob URL`);
});

// 8. No external application platform / third-party form embed added to the flow.
const EXTERNAL_FORM_PATTERNS = [/hbspt\.forms/i, /formspree/i, /typeform/i, /wufoo/i, /jotform/i, /google\.com\/forms/i, /surveymonkey/i, /greenhouse\.io/i, /lever\.co/i, /workday/i];
ALL_FILES.forEach((f) => {
  const text = read(f);
  EXTERNAL_FORM_PATTERNS.forEach((p) => assert.doesNotMatch(text, p, `${f} must not add an external application platform (${p})`));
});

// 9. No unsafe arbitrary redirect driven by a URL parameter.
CODE_FILES.filter((f) => f.startsWith('assets/js/')).forEach((f) => {
  const text = read(f);
  assert.doesNotMatch(text, /location\.href\s*=\s*[^;]*(param|search|source|query)/i, `${f} must not redirect from a URL parameter`);
  assert.doesNotMatch(text, /location\.replace\s*\(/, `${f} must not perform an arbitrary redirect`);
});

// 10. No production mock-success mode: the checked-in application pages must not opt into the
//     development mock, and the guard requires a non-production host anyway.
['careers/apply.html', 'careers/apply_cn.html'].forEach((f) => {
  assert.doesNotMatch(read(f), /data-recruitment-mock\s*=\s*["']true["']/, `${f} must not enable the mock success mode`);
  // The endpoint attribute is present and empty (no backend, honest failure).
  assert.match(read(f), /data-recruitment-endpoint=""/, `${f} must ship with an empty endpoint`);
  assert.match(read(f), /noindex, nofollow, noarchive/, `${f} must be noindex`);
});

// 11. No sample role is accidentally activated: every manifest role remains disabled.
const manifest = JSON.parse(read('assets/data/recruitment/roles.v1.json'));
assert.ok(Array.isArray(manifest.roles) && manifest.roles.length >= 1, 'manifest has roles');
manifest.roles.forEach((role) => {
  assert.strictEqual(role.applicationEnabled, false, `role ${role.roleId} must keep applications disabled`);
});

// 12. Role-detail pages stay noindexed while unapproved.
['careers/investment-analyst.html', 'careers/investment-analyst_cn.html', 'careers/finance-fund-operations-associate.html', 'careers/finance-fund-operations-associate_cn.html'].forEach((f) => {
  assert.match(read(f), /noindex, nofollow, noarchive/, `${f} must be noindex`);
});

// 13. No CV or applicant field is placed into a query string by the renderer.
assert.doesNotMatch(read('assets/js/recruitment-application.js'), /[?&](fullName|email|cv|applicationStatement|telephone)=/, 'applicant fields must never be put in a query string');

console.log('recruitment static security checks passed');
