'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  validLinkedInUrl,
  validOriginalFileName,
  candidate,
  fileMeta
} = require('../../../api/recruitment/core/validation');
const { ERROR_CODES } = require('../../../api/recruitment/core/constants');

const cv = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedExtensions: ['.pdf', '.docx'],
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
};

function candidateInput(linkedinUrl) {
  return {
    fullName: 'Candidate Name',
    email: 'candidate@example.com',
    telephone: '',
    currentLocation: '',
    linkedinUrl,
    coverNote: ''
  };
}

test('LinkedIn validation requires an HTTPS LinkedIn hostname', () => {
  assert.equal(validLinkedInUrl(''), true);
  assert.equal(validLinkedInUrl('https://linkedin.com/in/example'), true);
  assert.equal(validLinkedInUrl('https://www.linkedin.com/in/example'), true);
  assert.equal(validLinkedInUrl('https://hk.linkedin.com/in/example'), true);
  assert.equal(validLinkedInUrl('http://www.linkedin.com/in/example'), false);
  assert.equal(validLinkedInUrl('https://evil.example/?linkedin.com'), false);
  assert.equal(validLinkedInUrl('https://linkedin.com.evil.example/in/example'), false);
  assert.equal(validLinkedInUrl('https://user:password@linkedin.com/in/example'), false);
  assert.equal(validLinkedInUrl('not-a-url'), false);
});

test('candidate validation rejects lookalike LinkedIn links', () => {
  const result = candidate(
    candidateInput('https://evil.example/?next=linkedin.com'),
    true
  );
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, ERROR_CODES.VALIDATION_FAILED);
  assert.deepEqual(result.fields, ['linkedinUrl']);
});

test('original filename validation rejects paths, controls and bidi overrides', () => {
  assert.equal(validOriginalFileName('candidate-cv.pdf'), true);
  assert.equal(validOriginalFileName('../candidate-cv.pdf'), false);
  assert.equal(validOriginalFileName('folder/candidate-cv.pdf'), false);
  assert.equal(validOriginalFileName('candidate\u0000-cv.pdf'), false);
  assert.equal(validOriginalFileName('candidate\n-cv.pdf'), false);
  assert.equal(validOriginalFileName('candidate\u202e-fdp.exe'), false);
});

test('file metadata rejects unsafe original filenames before extension handling', () => {
  for (const originalName of [
    'candidate\u0000-cv.pdf',
    'candidate\n-cv.pdf',
    'candidate\u202e-fdp.exe'
  ]) {
    const result = fileMeta({
      originalName,
      declaredMimeType: 'application/pdf',
      sizeBytes: 1024
    }, cv);
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, ERROR_CODES.VALIDATION_FAILED);
  }
});
