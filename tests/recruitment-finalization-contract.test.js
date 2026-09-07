'use strict';

const assert = require('assert');
const baseManifest = require('../assets/data/recruitment/roles.v1.json');
const { createMemoryAdapters } = require('../api/recruitment/core/inMemoryAdapters');
const {
  initiateApplication,
  completeUpload,
  finalizeApplication
} = require('../api/recruitment/core/flows');
const { ERROR_CODES, NOTIFICATION_EVENTS } = require('../api/recruitment/core/constants');

function manifest() {
  const copy = JSON.parse(JSON.stringify(baseManifest));
  copy.roles = [copy.roles.find((role) => role.id === 'legal-assistant')];
  copy.roles[0].status = 'published';
  copy.roles[0].contentReviewRequired = false;
  copy.roles[0].application = {
    enabled: true,
    deadlineUtc: null,
    privacyNoticeVersion: '2026-08-08-v1',
    allowedSources: ['website'],
    cv: {
      required: true,
      maxSizeBytes: 10 * 1024 * 1024,
      allowedExtensions: ['.pdf'],
      allowedMimeTypes: ['application/pdf']
    }
  };
  return copy;
}

function request(clientSubmissionId) {
  return {
    roleId: 'legal-assistant',
    locale: 'en',
    source: 'website',
    clientSubmissionId,
    candidate: {
      fullName: 'Synthetic Recruitment Test',
      email: 'recruitment-test@shorevest.com',
      telephone: '+447700900000',
      currentLocation: 'Test only',
      linkedinUrl: '',
      coverNote: 'Synthetic contract test; no real candidate data.'
    },
    privacyAccepted: true,
    privacyNoticeVersion: '2026-08-08-v1',
    submittedAtClientUtc: '2026-07-20T00:00:00Z',
    file: {
      originalName: 'synthetic-test-cv.pdf',
      declaredMimeType: 'application/pdf',
      sizeBytes: 9
    }
  };
}

async function uploadedApplication(deps, clientSubmissionId) {
  const initiated = await initiateApplication(request(clientSubmissionId), deps);
  assert.equal(initiated.success, true);
  const file = deps.files.get(initiated.fileReference);
  deps.storage.put(
    'recruitment-quarantine',
    file.quarantineBlobPath,
    Buffer.from('%PDF-test'),
    'application/pdf'
  );
  const completed = await completeUpload({
    applicationReference: initiated.applicationReference,
    fileReference: initiated.fileReference,
    completionToken: initiated.completionToken
  }, deps);
  return { initiated, completed };
}

(async () => {
  const deps = createMemoryAdapters({ manifest: manifest() });
  const first = await uploadedApplication(deps, '550e8400-e29b-41d4-a716-446655449001');

  assert.equal(first.completed.success, true);
  assert.equal(typeof first.completed.finalizationToken, 'string');
  assert.ok(first.completed.finalizationToken.length > 40);
  assert.equal(
    deps.outbox.events.some((event) => event.type === NOTIFICATION_EVENTS.ApplicationReceived),
    false,
    'upload completion must not submit or notify before explicit finalization'
  );

  const finalized = await finalizeApplication({
    applicationReference: first.initiated.applicationReference,
    fileReference: first.initiated.fileReference,
    finalizationToken: first.completed.finalizationToken,
    privacyAccepted: true,
    accuracyConfirmed: true
  }, deps);
  assert.equal(finalized.success, true);
  assert.equal(deps.applications.get(first.initiated.applicationReference).candidateSubmissionStatus, 'Submitted');
  assert.equal(
    deps.outbox.events.filter((event) => event.type === NOTIFICATION_EVENTS.ApplicationReceived).length,
    1
  );
  assert.equal(
    deps.outbox.events.filter((event) => event.type === NOTIFICATION_EVENTS.CandidateAcknowledgementRequested).length,
    1
  );

  const retry = await finalizeApplication({
    applicationReference: first.initiated.applicationReference,
    fileReference: first.initiated.fileReference,
    finalizationToken: first.completed.finalizationToken,
    privacyAccepted: true,
    accuracyConfirmed: true
  }, deps);
  assert.equal(retry.success, true);
  assert.equal(retry.alreadyFinalized, true);
  assert.equal(
    deps.outbox.events.filter((event) => event.type === NOTIFICATION_EVENTS.ApplicationReceived).length,
    1,
    'idempotent finalization must not duplicate notifications'
  );

  const second = await uploadedApplication(deps, '550e8400-e29b-41d4-a716-446655449002');
  const crossApplication = await finalizeApplication({
    applicationReference: second.initiated.applicationReference,
    fileReference: second.initiated.fileReference,
    finalizationToken: first.completed.finalizationToken,
    privacyAccepted: true,
    accuracyConfirmed: true
  }, deps);
  assert.equal(crossApplication.errorCode, ERROR_CODES.TOKEN_INVALID);

  const tampered = `${second.completed.finalizationToken.slice(0, -1)}x`;
  const tamperedResult = await finalizeApplication({
    applicationReference: second.initiated.applicationReference,
    fileReference: second.initiated.fileReference,
    finalizationToken: tampered,
    privacyAccepted: true,
    accuracyConfirmed: true
  }, deps);
  assert.equal(tamperedResult.errorCode, ERROR_CODES.TOKEN_INVALID);

  console.log('recruitment finalization contract tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
