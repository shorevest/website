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
assert.strictEqual(manifest.roles.length, 0, 'PR 1 must not publish an unapproved role');

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

console.log('recruitment role manifest contract tests passed');
