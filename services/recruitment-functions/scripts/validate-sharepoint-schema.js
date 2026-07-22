'use strict';

const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, '../../../infra/recruitment/sharepoint-lists.v1.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

function fail(message) {
  throw new Error(`Recruitment SharePoint schema invalid: ${message}`);
}

function unique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length) fail(`${label} contains duplicates: ${[...new Set(duplicates)].join(', ')}`);
}

if (schema.schemaVersion !== '1.0') fail('schemaVersion must be 1.0');
if (schema.documentStorage !== 'azure-blob-only') fail('documentStorage must remain azure-blob-only');
if (schema.runtimePermission !== 'Lists.SelectedOperations.Selected') {
  fail('runtimePermission must use selected list operations');
}
if (!Array.isArray(schema.lists) || schema.lists.length !== 2) fail('exactly two lists are required');

const names = schema.lists.map((list) => list.name);
unique(names, 'list names');
if (!names.includes('RecruitmentApplications') || !names.includes('RecruitmentFiles')) {
  fail('required lists are RecruitmentApplications and RecruitmentFiles');
}

const requiredColumns = {
  RecruitmentApplications: [
    'Title',
    'ApplicationReference',
    'RoleId',
    'RoleTitle',
    'CandidateName',
    'CandidateEmail',
    'PrivacyNoticeVersion',
    'PrivacyAcceptedAtUtc',
    'SubmittedAtServerUtc',
    'FinalizedAtUtc',
    'AccuracyConfirmedAtUtc',
    'CandidateSubmissionStatus',
    'TechnicalStatus',
    'HiringStage',
    'NotificationState',
    'NotificationEventKey',
    'NotificationAttemptCount',
    'RetentionDeleteAfterUtc',
    'LegalHold',
    'LastUpdatedAtUtc'
  ],
  RecruitmentFiles: [
    'Title',
    'FileReference',
    'ApplicationReference',
    'FilePurpose',
    'OriginalFileName',
    'DeclaredMimeType',
    'SizeBytes',
    'QuarantineBlobPath',
    'TechnicalStatus',
    'RetentionDeleteAfterUtc',
    'LegalHold',
    'LastUpdatedAtUtc'
  ]
};

for (const list of schema.lists) {
  if (list.template !== 'genericList') fail(`${list.name} must be a generic list, not a document library`);
  if (!Array.isArray(list.columns) || !list.columns.length) fail(`${list.name} has no columns`);
  if (!Array.isArray(list.indexedFields)) fail(`${list.name} indexedFields must be an array`);
  if (list.indexedFields.length > 20) fail(`${list.name} exceeds the SharePoint index limit`);

  const columnNames = list.columns.map((column) => column.name);
  unique(columnNames, `${list.name} columns`);
  unique(list.indexedFields, `${list.name} indexedFields`);

  for (const required of requiredColumns[list.name]) {
    if (!columnNames.includes(required)) fail(`${list.name} is missing ${required}`);
  }
  if (!columnNames.includes(list.keyField)) fail(`${list.name} keyField does not exist`);
  const key = list.columns.find((column) => column.name === list.keyField);
  if (key.enforceUniqueValues !== true) fail(`${list.name} keyField must enforce unique values`);
  if (!list.indexedFields.includes(list.keyField)) fail(`${list.name} keyField must be indexed`);

  for (const indexed of list.indexedFields) {
    if (!columnNames.includes(indexed)) fail(`${list.name} indexes missing column ${indexed}`);
  }

  for (const column of list.columns) {
    if (!column.name || !column.type) fail(`${list.name} contains a column without name/type`);
    if (/attachment|documentcontent|filebytes|sasurl|publicurl/i.test(column.name)) {
      fail(`${list.name}.${column.name} would violate metadata-only storage`);
    }
    if (column.type === 'choice' && (!Array.isArray(column.choices) || column.choices.length === 0)) {
      fail(`${list.name}.${column.name} choice column has no choices`);
    }
  }
}

const applicationList = schema.lists.find((list) => list.name === 'RecruitmentApplications');
const fileList = schema.lists.find((list) => list.name === 'RecruitmentFiles');
if (!applicationList.indexedFields.includes('CandidateEmail')) fail('CandidateEmail must be indexed');
if (!fileList.indexedFields.includes('ApplicationReference')) fail('file ApplicationReference must be indexed');

console.log('Recruitment SharePoint schema validation passed.');
