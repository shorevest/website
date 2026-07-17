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
  const text = JSON.stringify(manifest, null, 2);
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
    if (!/^careers\/[a-z0-9][a-z0-9-]*(_cn)?\.html$/.test(role.detailPath)) fail(errors, `${rolePath}.locales.${locale}.detailPath must be a careers/*.html path.`);
    if (expectedCn && !role.detailPath.endsWith('_cn.html')) fail(errors, `${rolePath}.locales.${locale}.detailPath must use _cn.html.`);
    if (!expectedCn && role.detailPath.endsWith('_cn.html')) fail(errors, `${rolePath}.locales.${locale}.detailPath must be the English path.`);
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

function validateSemantics(manifest, schema) {
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

module.exports = { validateManifest, validateJsonSchema, validateSemantics };
