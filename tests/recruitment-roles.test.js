const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateManifest } = require('../scripts/validate-recruitment-roles');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/recruitment/roles.v1.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/recruitment/roles.v1.schema.json'), 'utf8'));

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
      }
    ]
  }
};

const validManifest = { ...manifest, roles: [validRole] };
assert.deepStrictEqual(validateManifest(validManifest, schema), [], 'representative role should validate');

const duplicateManifest = { ...manifest, roles: [validRole, { ...validRole }] };
assert.ok(validateManifest(duplicateManifest, schema).some((error) => error.includes('roleId values must be unique')), 'duplicate role IDs should fail');

const missingChinese = { ...manifest, roles: [{ ...validRole, locales: { en: validRole.locales.en } }] };
assert.ok(validateManifest(missingChinese, schema).some((error) => error.includes('both en and zh-CN')), 'missing Chinese locale should fail');

const badExtension = {
  ...manifest,
  roles: [{
    ...validRole,
    files: [{ ...validRole.files[0], allowedExtensions: ['.pdf', '.exe'] }]
  }]
};
assert.ok(validateManifest(badExtension, schema).some((error) => error.includes('unsupported extension .exe')), 'unsupported extensions should fail');

const badMime = {
  ...manifest,
  roles: [{
    ...validRole,
    files: [{ ...validRole.files[0], allowedMimeTypes: ['application/pdf', 'application/x-msdownload'] }]
  }]
};
assert.ok(validateManifest(badMime, schema).some((error) => error.includes('unsupported MIME type application/x-msdownload')), 'unsupported MIME types should fail');

const withSecret = { ...manifest, roles: [], client_secret: 'not-allowed' };
assert.ok(validateManifest(withSecret, schema).some((error) => error.includes('secret-like key')), 'secret-like fields should fail');

console.log('recruitment role manifest contract tests passed');
