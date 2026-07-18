const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateManifest } = require('../scripts/validate-recruitment-roles');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'assets/data/recruitment/roles.v1.json');
const schemaPath = path.join(root, 'assets/data/recruitment/roles.v1.schema.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertInvalid(name, mutatedManifest, expectedMessage) {
  const errors = validateManifest(mutatedManifest, schema);
  assert.ok(errors.some((error) => error.includes(expectedMessage)), `${name} should fail with ${expectedMessage}; got ${errors.join(' | ')}`);
}

function runValidatorAgainst(mutatedManifest) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shorevest-recruitment-roles-'));
  const manifestOut = path.join(tmpDir, 'roles.v1.json');
  fs.writeFileSync(manifestOut, JSON.stringify(mutatedManifest, null, 2));
  const script = `
    const validator = require(${JSON.stringify(path.join(root, 'scripts/validate-recruitment-roles.js'))});
    const schema = require(${JSON.stringify(schemaPath)});
    const manifest = require(${JSON.stringify(manifestOut)});
    const errors = validator.validateManifest(manifest, schema);
    if (errors.length) {
      console.error(errors.join('\\n'));
      process.exit(1);
    }
  `;
  return spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
}

assert.deepStrictEqual(validateManifest(manifest, schema), [], 'checked-in recruitment manifest should validate');
assert.strictEqual(manifest.schemaVersion, '1.0', 'manifest schemaVersion should be 1.0');
assert.ok(!Number.isNaN(Date.parse(manifest.generatedAtUtc)), 'manifest generatedAtUtc should be parseable');
assert.ok(Array.isArray(manifest.roles), 'manifest roles should be an array');
assert.strictEqual(manifest.roles.length, 2, 'temporary preview manifest should include two sample roles');
assert.ok(manifest.roles.every((role) => role.status === 'active'), 'temporary preview roles should be active for role-list review');
assert.ok(manifest.roles.every((role) => role.applicationEnabled === false), 'application submission remains disabled for every role');
assert.ok(manifest.roles.every((role) => role.screening.workAuthorization.enabled === false), 'work authorization screening remains disabled');
assert.ok(manifest.roles.every((role) => role.screening.roleSpecificQuestions.length === 0), 'no role-specific screening questions are present');


const detailPages = [
  'careers/investment-analyst.html',
  'careers/investment-analyst_cn.html',
  'careers/finance-fund-operations-associate.html',
  'careers/finance-fund-operations-associate_cn.html'
];
detailPages.forEach((relativePath) => {
  const absolutePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} should exist`);
  const html = fs.readFileSync(absolutePath, 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/, `${relativePath} should be noindex`);
  assert.ok(html.includes('INTERNAL PREVIEW') || html.includes('内部预览'), `${relativePath} should contain the internal-preview notice`);
  assert.doesNotMatch(html, /<form\b/i, `${relativePath} must not contain a form`);
  assert.doesNotMatch(html, /<input\b[^>]*type=["']file["']/i, `${relativePath} must not contain file inputs`);
  // The shared header's mobile-menu toggle is the only permitted button.
  const htmlWithoutNavToggle = html.replace(/<button class="sv-burger"[^>]*><span><\/span><\/button>/g, '');
  assert.doesNotMatch(htmlWithoutNavToggle, /<button\b/i, `${relativePath} must not contain active submission buttons`);
});

const validRole = {
  roleId: 'investment-analyst-2026-gz',
  status: 'active',
  locales: {
    en: {
      title: 'Investment Analyst',
      location: 'Guangzhou',
      team: 'Investment',
      detailPath: 'careers/investment-analyst-2026-gz.html'
    },
    'zh-CN': {
      title: '投资分析师',
      location: '广州',
      team: '投资',
      detailPath: 'careers/investment-analyst-2026-gz_cn.html'
    }
  },
  employmentType: 'Full-time',
  applicationEnabled: false,
  files: [
    {
      filePurpose: 'cv',
      required: true,
      maxSizeBytes: 10485760,
      allowedExtensions: ['.pdf', '.doc', '.docx'],
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      signatureValidation: {
        required: true,
        acceptedSignatures: ['pdf', 'oleCompoundFile', 'zipDocx']
      }
    }
  ],
  screening: {
    workAuthorization: {
      enabled: false,
      required: false,
      jurisdictions: []
    },
    roleSpecificQuestions: [
      {
        questionId: 'investment-interest',
        type: 'long_text',
        required: false,
        locales: {
          en: 'Why are you interested in this role?',
          'zh-CN': '您为什么对该职位感兴趣？'
        }
      },
      {
        questionId: 'market-choice',
        type: 'single_select',
        required: false,
        locales: {
          en: 'Which market are you most interested in?',
          'zh-CN': '您最关注哪个市场？'
        },
        options: [
          { value: 'greater-bay-area', locales: { en: 'Greater Bay Area', 'zh-CN': '大湾区' } }
        ]
      }
    ]
  }
};

const validManifest = { ...manifest, roles: [validRole] };
assert.deepStrictEqual(validateManifest(validManifest, schema), [], 'representative role should validate');

const maxSizeTooLarge = clone(validManifest);
maxSizeTooLarge.roles[0].files[0].maxSizeBytes = 60000000;
assertInvalid('maxSizeBytes above schema maximum', maxSizeTooLarge, '/roles/0/files/0/maxSizeBytes must be <= 52428800');

const missingOptionLocale = clone(validManifest);
delete missingOptionLocale.roles[0].screening.roleSpecificQuestions[1].options[0].locales['zh-CN'];
assertInvalid('option missing required locale content', missingOptionLocale, '/roles/0/screening/roleSpecificQuestions/1/options/0/locales must have required property "zh-CN"');

const unexpectedRoleProperty = clone(validManifest);
unexpectedRoleProperty.roles[0].unexpected = true;
assertInvalid('unexpected role property', unexpectedRoleProperty, '/roles/0 must not have additional property "unexpected"');

const invalidGeneratedAtUtc = { ...manifest, generatedAtUtc: '2026-07-17 00:00:00', roles: [] };
assertInvalid('invalid generatedAtUtc', invalidGeneratedAtUtc, '/generatedAtUtc must match format "date-time"');

const invalidNestedFileDefinition = clone(validManifest);
invalidNestedFileDefinition.roles[0].files[0].signatureValidation.unexpected = 'nope';
assertInvalid('invalid nested file-definition property', invalidNestedFileDefinition, '/roles/0/files/0/signatureValidation must not have additional property "unexpected"');

const invalidNestedScreeningQuestion = clone(validManifest);
invalidNestedScreeningQuestion.roles[0].screening.roleSpecificQuestions[0].locales.extra = 'nope';
assertInvalid('invalid nested screening-question property', invalidNestedScreeningQuestion, '/roles/0/screening/roleSpecificQuestions/0/locales must not have additional property "extra"');

const duplicateRole = clone(validRole);
duplicateRole.locales.en.title = 'Investment Analyst Duplicate';
const duplicateManifest = { ...manifest, roles: [validRole, duplicateRole] };
assert.ok(validateManifest(duplicateManifest, schema).some((error) => error.includes('roleId values must be unique')), 'duplicate role IDs should fail');

const missingChinese = { ...manifest, roles: [{ ...validRole, locales: { en: validRole.locales.en } }] };
assert.ok(validateManifest(missingChinese, schema).some((error) => error.includes('must have required property "zh-CN"')), 'missing Chinese locale should fail');

const badExtension = clone(validManifest);
badExtension.roles[0].files[0].allowedExtensions = ['.pdf', '.exe'];
assert.ok(validateManifest(badExtension, schema).some((error) => error.includes('must be equal to one of the allowed values')), 'unsupported extensions should fail');

const badMime = clone(validManifest);
badMime.roles[0].files[0].allowedMimeTypes = ['application/pdf', 'application/x-msdownload'];
assert.ok(validateManifest(badMime, schema).some((error) => error.includes('must be equal to one of the allowed values')), 'unsupported MIME types should fail');

const withSecret = { ...manifest, roles: [], client_secret: 'not-allowed' };
assert.ok(validateManifest(withSecret, schema).some((error) => error.includes('must not have additional property "client_secret"')), 'unexpected secret-like fields should fail schema validation');

const invalidExit = runValidatorAgainst(maxSizeTooLarge);
assert.notStrictEqual(invalidExit.status, 0, 'validator should exit non-zero for invalid manifests');
assert.match(invalidExit.stderr, /maxSizeBytes/, 'validator should print invalid field details');

// --- Phase 1 hardening: extended manifest validation ---------------------------------

// A fully-populated, application-ready role used to exercise the enablement gates.
function readyRole(overrides = {}) {
  const base = clone(validRole);
  base.roleId = 'ready-role';
  base.locales.en.detailPath = 'careers/ready-role.html';
  base.locales['zh-CN'].detailPath = 'careers/ready-role_cn.html';
  base.locales.en.summary = 'A concise approved summary of the role.';
  base.locales.en.responsibilities = ['Lead reviews.'];
  base.locales.en.requirements = ['Relevant experience.'];
  base.locales.en.applicationStatementPrompt = 'Explain your interest.';
  base.locales['zh-CN'].summary = '经批准的职位简要说明。';
  base.locales['zh-CN'].responsibilities = ['负责审核。'];
  base.locales['zh-CN'].requirements = ['相关经验。'];
  base.locales['zh-CN'].applicationStatementPrompt = '请说明您的兴趣。';
  base.applicationEnabled = true;
  return Object.assign(base, overrides);
}

// A representative role carrying the new optional prose fields still validates.
const withContent = clone(validManifest);
withContent.roles[0].locales.en.summary = 'Approved summary.';
withContent.roles[0].locales.en.responsibilities = ['Do the work.'];
withContent.roles[0].locales.en.requirements = ['Have the skills.'];
withContent.roles[0].locales.en.preferredQualifications = ['A nice-to-have.'];
withContent.roles[0].locales.en.applicationStatementPrompt = 'Tell us why.';
withContent.roles[0].locales['zh-CN'].summary = '经批准的摘要。';
withContent.roles[0].locales['zh-CN'].responsibilities = ['完成工作。'];
withContent.roles[0].locales['zh-CN'].requirements = ['具备技能。'];
withContent.roles[0].applicationDeadline = null;
withContent.roles[0].reportingLine = null;
assert.deepStrictEqual(validateManifest(withContent, schema), [], 'role with optional prose fields validates');

// Raw HTML in candidate-facing text is rejected.
const htmlInTitle = clone(validManifest);
htmlInTitle.roles[0].locales.en.title = '<b>Analyst</b>';
assert.ok(validateManifest(htmlInTitle, schema).some((e) => e.includes('must not contain HTML')), 'HTML in title is rejected');

const htmlInResponsibility = clone(validManifest);
htmlInResponsibility.roles[0].locales.en.responsibilities = ['<img src=x onerror=alert(1)>'];
assert.ok(validateManifest(htmlInResponsibility, schema).some((e) => e.includes('must not contain HTML')), 'HTML in responsibilities is rejected');

// External / unsafe detail paths are rejected (schema pattern and/or semantic layer).
for (const [label, badPath] of [
  ['external URL', 'https://evil.example/role.html'],
  ['protocol-relative', '//evil.example/role.html'],
  ['javascript scheme', 'javascript:alert(1)'],
  ['path traversal', 'careers/../secret.html'],
  ['absolute path', '/etc/passwd']
]) {
  const bad = clone(validManifest);
  bad.roles[0].locales.en.detailPath = badPath;
  assert.ok(validateManifest(bad, schema).length > 0, `${label} detail path is rejected`);
}

// The semantic detail-path guards fire independently of the JSON-schema pattern, so unsafe
// paths are caught even if the pattern is ever loosened.
const { validateSemantics } = require('../scripts/validate-recruitment-roles');
for (const [badPath, expected] of [
  ['https://evil.example/role.html', 'external or protocol-relative'],
  ['//evil.example/role.html', 'external or protocol-relative'],
  ['javascript:alert(1)', 'non-http scheme'],
  ['careers/../secret.html', 'path traversal'],
  ['/etc/passwd', 'relative path']
]) {
  const bad = clone(validManifest);
  bad.roles[0].locales.en.detailPath = badPath;
  assert.ok(validateSemantics(bad, schema).some((e) => e.includes(expected)), `semantic layer rejects ${badPath}`);
}

// applicationEnabled on an inactive role is rejected.
const enabledInactive = { ...manifest, roles: [readyRole({ status: 'draft' })] };
assert.ok(validateManifest(enabledInactive, schema).some((e) => e.includes('unless status is active')), 'enabled application on inactive role is rejected');

const enabledClosed = { ...manifest, roles: [readyRole({ status: 'closed' })] };
assert.ok(validateManifest(enabledClosed, schema).some((e) => e.includes('unless status is active')), 'enabled application on closed role is rejected');

// A ready role with all content and active status validates when enabled.
assert.deepStrictEqual(validateManifest({ ...manifest, roles: [readyRole()] }, schema), [], 'fully-populated active enabled role validates');

// applicationEnabled without the minimum reviewed content is rejected.
const enabledNoContent = clone(validManifest);
enabledNoContent.roles[0].applicationEnabled = true;
assert.ok(validateManifest(enabledNoContent, schema).some((e) => e.includes('without approved summary')), 'enabled role without content is rejected');

// applicationEnabled without a valid required CV definition is rejected.
const enabledNoCv = readyRole();
enabledNoCv.files[0].required = false;
assert.ok(validateManifest({ ...manifest, roles: [enabledNoCv] }, schema).some((e) => e.includes('valid required CV upload')), 'enabled role without required CV is rejected');

// A passed deadline blocks enablement unless an administrative override is present.
const enabledPastDeadline = readyRole({ applicationDeadline: '2000-01-01' });
assert.ok(validateManifest({ ...manifest, roles: [enabledPastDeadline] }, schema).some((e) => e.includes('after applicationDeadline has passed')), 'enabled role with passed deadline is rejected');

const enabledPastDeadlineOverride = readyRole({ applicationDeadline: '2000-01-01', deadlineAdminOverride: true });
assert.deepStrictEqual(validateManifest({ ...manifest, roles: [enabledPastDeadlineOverride] }, schema), [], 'administrative override permits a passed-deadline enablement');

// Invalid deadline formats are rejected.
const badDeadline = clone(validManifest);
badDeadline.roles[0].applicationDeadline = '31-12-2026';
assert.ok(validateManifest(badDeadline, schema).length > 0, 'malformed applicationDeadline is rejected');

// A future, active-but-disabled role with a valid deadline validates.
const futureDeadline = clone(validManifest);
futureDeadline.roles[0].applicationDeadline = '2999-12-31';
assert.deepStrictEqual(validateManifest(futureDeadline, schema), [], 'future deadline on disabled role validates');

// reportingLine must be null or a well-formed approved/locales object.
const badReporting = clone(validManifest);
badReporting.roles[0].reportingLine = { approved: 'yes', locales: { en: 'Head of Investment', 'zh-CN': '投资主管' } };
assert.ok(validateManifest(badReporting, schema).length > 0, 'malformed reportingLine is rejected');

const goodReporting = clone(validManifest);
goodReporting.roles[0].reportingLine = { approved: true, locales: { en: 'Head of Investment', 'zh-CN': '投资主管' } };
assert.deepStrictEqual(validateManifest(goodReporting, schema), [], 'well-formed reportingLine validates');

console.log('recruitment role manifest contract tests passed');
