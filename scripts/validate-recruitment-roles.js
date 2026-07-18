#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'assets/data/recruitment/roles.v1.json');
const schemaPath = path.join(root, 'assets/data/recruitment/roles.v1.schema.json');

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const SUPPORTED_SIGNATURES = new Set(['pdf', 'oleCompoundFile', 'zipDocx']);
const FILE_PURPOSES = new Set(['cv', 'cover_letter', 'supporting_document']);
const ROLE_STATUSES = new Set(['draft', 'active', 'closed', 'archived']);
const EMPLOYMENT_TYPES = new Set(['Full-time', 'Part-time', 'Internship', 'Contract']);
const QUESTION_TYPES = new Set(['short_text', 'long_text', 'single_select', 'multi_select', 'yes_no']);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${path.relative(root, file)} is not valid JSON: ${error.message}`);
  }
}

function fail(errors, message) {
  errors.push(message);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasDuplicate(values) {
  return new Set(values).size !== values.length;
}

// Candidate-facing manifest text is rendered through textContent only. Reject any
// value that carries HTML-tag or entity syntax so unsafe markup can never be authored.
function looksLikeHtml(value) {
  return typeof value === 'string' && /<[a-z!/]|&#?\w+;|<\s*script/i.test(value);
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function deadlineHasPassed(value, now) {
  if (!isValidIsoDate(value)) return false;
  // Date-only deadlines are treated as end-of-day UTC so an application remains open
  // for the whole stated closing day.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59Z` : value;
  return Date.parse(iso) < now.getTime();
}

function isPlainStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function formatAjvError(error) {
  const pathLabel = error.instancePath || '/';
  let detail = error.message || 'is invalid';
  if (error.keyword === 'additionalProperties' && error.params?.additionalProperty) {
    detail = `must not have additional property ${JSON.stringify(error.params.additionalProperty)}`;
  } else if (error.keyword === 'required' && error.params?.missingProperty) {
    detail = `must have required property ${JSON.stringify(error.params.missingProperty)}`;
  }
  return `${pathLabel} ${detail}`;
}

function validateJsonSchema(manifest, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv, { formats: ['date-time'] });
  const validate = ajv.compile(schema);
  return validate(manifest) ? [] : (validate.errors || []).map(formatAjvError);
}

function validateNoSecretsOrCandidatePii(manifest, errors) {
  // Structured ISO date fields (generatedAtUtc, applicationDeadline) are controlled machine
  // values, not candidate free text; strip them before the PII scan so date syntax is not
  // mistaken for a telephone number.
  const scanned = JSON.parse(JSON.stringify(manifest));
  delete scanned.generatedAtUtc;
  if (Array.isArray(scanned.roles)) {
    scanned.roles.forEach((role) => { if (role && typeof role === 'object') delete role.applicationDeadline; });
  }
  const text = JSON.stringify(scanned, null, 2);
  const forbidden = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/i, 'private key'],
    [/AccountKey\s*=|SharedAccessKey\s*=|DefaultEndpointsProtocol=/i, 'storage connection string'],
    [/client_secret|tenant_id|password|passwd|secret\s*[:=]|api[_-]?key/i, 'secret-like key'],
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, 'email address'],
    [/\b(?:\+?\d[\d .()\-]{7,}\d)\b/, 'telephone-like number'],
    [/\b(?:passport|national id|identity card|date of birth|dob|salary history)\b/i, 'prohibited candidate PII field']
  ];
  forbidden.forEach(([pattern, label]) => {
    if (pattern.test(text)) fail(errors, `Manifest must not contain ${label}.`);
  });
}

function validateSchemaFile(schema, errors) {
  if (!schema || schema.type !== 'object') fail(errors, 'roles.v1.schema.json must be an object schema.');
  if (schema?.properties?.schemaVersion?.const !== '1.0') fail(errors, 'Schema must require schemaVersion 1.0.');
  if (!schema?.properties?.roles) fail(errors, 'Schema must define roles.');
  if (!schema?.$defs?.role) fail(errors, 'Schema must define $defs.role.');
}

function validateLocalizedRole(role, locale, rolePath, errors) {
  if (!role) return;
  ['title', 'location', 'team', 'detailPath'].forEach((field) => {
    if (!isNonEmptyString(role[field])) fail(errors, `${rolePath}.locales.${locale}.${field} is required.`);
  });
  if (isNonEmptyString(role.detailPath)) {
    const expectedCn = locale === 'zh-CN';
    // detailPath must be an internal relative careers/*.html path: reject external URLs,
    // javascript:, protocol-relative //, path traversal, and absolute filesystem paths.
    const path = role.detailPath;
    if (path.indexOf('://') !== -1 || path.indexOf('//') === 0) fail(errors, `${rolePath}.locales.${locale}.detailPath must not be an external or protocol-relative URL.`);
    if (/^(?:javascript|data|mailto|file):/i.test(path)) fail(errors, `${rolePath}.locales.${locale}.detailPath must not use a non-http scheme.`);
    if (path.indexOf('..') !== -1) fail(errors, `${rolePath}.locales.${locale}.detailPath must not contain path traversal.`);
    if (path.startsWith('/') || /^[a-zA-Z]:\\/.test(path)) fail(errors, `${rolePath}.locales.${locale}.detailPath must be a relative path.`);
    if (!/^careers\/[a-z0-9][a-z0-9-]*(_cn)?\.html$/.test(path)) fail(errors, `${rolePath}.locales.${locale}.detailPath must be a careers/*.html path.`);
    if (expectedCn && !path.endsWith('_cn.html')) fail(errors, `${rolePath}.locales.${locale}.detailPath must use _cn.html.`);
    if (!expectedCn && path.endsWith('_cn.html')) fail(errors, `${rolePath}.locales.${locale}.detailPath must be the English path.`);
  }

  // Candidate-facing text (fixed fields, optional prose, and array items) must be plain
  // text with no HTML syntax, since the renderer inserts it through textContent only.
  const textFields = ['title', 'location', 'team', 'summary', 'applicationStatementPrompt'];
  textFields.forEach((field) => {
    if (typeof role[field] === 'string' && looksLikeHtml(role[field])) fail(errors, `${rolePath}.locales.${locale}.${field} must not contain HTML.`);
  });
  ['responsibilities', 'requirements', 'preferredQualifications'].forEach((field) => {
    if (role[field] === undefined) return;
    if (!isPlainStringArray(role[field])) {
      fail(errors, `${rolePath}.locales.${locale}.${field} must be an array of plain strings.`);
      return;
    }
    role[field].forEach((item, index) => {
      if (!isNonEmptyString(item)) fail(errors, `${rolePath}.locales.${locale}.${field}[${index}] must be a non-empty string.`);
      if (looksLikeHtml(item)) fail(errors, `${rolePath}.locales.${locale}.${field}[${index}] must not contain HTML.`);
    });
  });
}

// Minimum content a role must carry before applications may be enabled. This prevents an
// unreviewed placeholder role (empty responsibilities/requirements) from ever being turned on.
function localeHasMinimumContent(localized) {
  return Boolean(
    localized &&
    isNonEmptyString(localized.summary) &&
    Array.isArray(localized.responsibilities) && localized.responsibilities.some(isNonEmptyString) &&
    Array.isArray(localized.requirements) && localized.requirements.some(isNonEmptyString) &&
    isNonEmptyString(localized.applicationStatementPrompt)
  );
}

function validateApplicationReadiness(role, rolePath, errors, now) {
  if (typeof role.applicationEnabled !== 'boolean') fail(errors, `${rolePath}.applicationEnabled must be a boolean.`);
  if (role.applicationEnabled !== true) return;

  // An inactive/closed/draft/archived role can never accept applications.
  if (role.status !== 'active') fail(errors, `${rolePath} cannot set applicationEnabled true unless status is active.`);

  // Applications require a valid required CV-upload definition.
  const cv = Array.isArray(role.files) ? role.files.find((file) => file && file.filePurpose === 'cv') : null;
  if (!cv || cv.required !== true || !Array.isArray(cv.allowedExtensions) || cv.allowedExtensions.length === 0) {
    fail(errors, `${rolePath} cannot set applicationEnabled true without a valid required CV upload definition.`);
  }

  // Both locales must carry the minimum reviewed content.
  if (!localeHasMinimumContent(role.locales?.en) || !localeHasMinimumContent(role.locales?.['zh-CN'])) {
    fail(errors, `${rolePath} cannot set applicationEnabled true without approved summary, responsibilities, requirements, and application prompt in both locales.`);
  }

  // A passed deadline blocks enablement unless an explicit administrative override is recorded.
  if (deadlineHasPassed(role.applicationDeadline, now) && role.deadlineAdminOverride !== true) {
    fail(errors, `${rolePath} cannot set applicationEnabled true after applicationDeadline has passed without deadlineAdminOverride.`);
  }
}

function validateFiles(files, rolePath, errors) {
  if (!Array.isArray(files)) return;
  const purposes = [];
  files.forEach((file, index) => {
    const filePath = `${rolePath}.files[${index}]`;
    if (!FILE_PURPOSES.has(file.filePurpose)) fail(errors, `${filePath}.filePurpose is unsupported.`);
    purposes.push(file.filePurpose);
    (file.allowedExtensions || []).forEach((extension) => { if (!SUPPORTED_EXTENSIONS.has(extension)) fail(errors, `${filePath} uses unsupported extension ${extension}.`); });
    (file.allowedMimeTypes || []).forEach((mimeType) => { if (!SUPPORTED_MIME_TYPES.has(mimeType)) fail(errors, `${filePath} uses unsupported MIME type ${mimeType}.`); });
    (file.signatureValidation?.acceptedSignatures || []).forEach((signature) => { if (!SUPPORTED_SIGNATURES.has(signature)) fail(errors, `${filePath} uses unsupported signature ${signature}.`); });
  });
  if (hasDuplicate(purposes)) fail(errors, `${rolePath}.files must not duplicate filePurpose values.`);
  if (!purposes.includes('cv')) fail(errors, `${rolePath}.files must include a cv definition.`);
}

function validateScreening(screening, rolePath, errors) {
  if (!screening) return;
  const workAuth = screening.workAuthorization;
  if (workAuth?.required && !workAuth.enabled) fail(errors, `${rolePath}.screening.workAuthorization cannot be required when disabled.`);
  if (workAuth?.required && workAuth.jurisdictions?.length === 0) fail(errors, `${rolePath}.screening.workAuthorization required questions need jurisdictions.`);
  if (!Array.isArray(screening.roleSpecificQuestions)) return;
  const questionIds = [];
  screening.roleSpecificQuestions.forEach((question, index) => {
    const qPath = `${rolePath}.screening.roleSpecificQuestions[${index}]`;
    questionIds.push(question.questionId);
    if (!QUESTION_TYPES.has(question.type)) fail(errors, `${qPath}.type is unsupported.`);
  });
  if (hasDuplicate(questionIds)) fail(errors, `${rolePath}.screening.roleSpecificQuestions must not duplicate questionId values.`);
}

function validateDeadlineAndReporting(role, rolePath, errors) {
  if (role.applicationDeadline !== undefined && role.applicationDeadline !== null && !isValidIsoDate(role.applicationDeadline)) {
    fail(errors, `${rolePath}.applicationDeadline must be null or a valid ISO date.`);
  }
  if (role.reportingLine !== undefined && role.reportingLine !== null) {
    const line = role.reportingLine;
    if (typeof line !== 'object' || typeof line.approved !== 'boolean' || !line.locales) {
      fail(errors, `${rolePath}.reportingLine must be null or an object with approved and locales.`);
    } else {
      ['en', 'zh-CN'].forEach((locale) => {
        if (!isNonEmptyString(line.locales[locale])) fail(errors, `${rolePath}.reportingLine.locales.${locale} must be a non-empty string.`);
        if (looksLikeHtml(line.locales[locale])) fail(errors, `${rolePath}.reportingLine.locales.${locale} must not contain HTML.`);
      });
    }
  }
}

function validateSemantics(manifest, schema, now = new Date()) {
  const errors = [];
  validateSchemaFile(schema, errors);
  validateNoSecretsOrCandidatePii(manifest, errors);
  const roleIds = [];
  (manifest.roles || []).forEach((role, index) => {
    const rolePath = `roles[${index}]`;
    roleIds.push(role.roleId);
    if (!ROLE_STATUSES.has(role.status)) fail(errors, `${rolePath}.status is unsupported.`);
    if (!role.locales || !role.locales.en || !role.locales['zh-CN']) fail(errors, `${rolePath} must include both en and zh-CN locale records.`);
    validateLocalizedRole(role.locales?.en, 'en', rolePath, errors);
    validateLocalizedRole(role.locales?.['zh-CN'], 'zh-CN', rolePath, errors);
    if (!EMPLOYMENT_TYPES.has(role.employmentType)) fail(errors, `${rolePath}.employmentType is unsupported.`);
    if ((role.status === 'active' || role.applicationEnabled) && (!role.locales?.en?.detailPath || !role.locales?.['zh-CN']?.detailPath)) fail(errors, `${rolePath} public role requires English and Chinese detail-page paths.`);
    validateFiles(role.files, rolePath, errors);
    validateScreening(role.screening, rolePath, errors);
    validateDeadlineAndReporting(role, rolePath, errors);
    validateApplicationReadiness(role, rolePath, errors, now);
  });
  if (hasDuplicate(roleIds)) fail(errors, 'roleId values must be unique.');
  return errors;
}

function validateManifest(manifest, schema) {
  const schemaErrors = validateJsonSchema(manifest, schema);
  if (schemaErrors.length) return schemaErrors.map((error) => `Schema ${error}`);
  return validateSemantics(manifest, schema);
}

function main() {
  const manifest = readJson(manifestPath);
  const schema = readJson(schemaPath);
  const errors = validateManifest(manifest, schema);
  if (errors.length) {
    console.error('Recruitment role manifest validation failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log(`Recruitment role manifest validation passed (${manifest.roles.length} roles).`);
}

if (require.main === module) main();

module.exports = { validateManifest, validateJsonSchema, validateSemantics, looksLikeHtml, isValidIsoDate, deadlineHasPassed };
