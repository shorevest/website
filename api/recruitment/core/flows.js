'use strict';

const crypto = require('crypto');
const {
  APPLICATION_STATES: A,
  FILE_STATES: F,
  HIRING_STAGES: H,
  NOTIFICATION_EVENTS: N,
  SCAN_RESULTS: S,
  CONTAINERS,
  ERROR_CODES
} = require('./constants');
const { transition } = require('./stateMachines');
const { role: validateRole, candidate: validateCandidate, request: validateRequest, fileMeta } = require('./validation');
const { detect } = require('./fileTypes');

const TOKEN_VERSION = 1;
const TOKEN_ISSUER = 'shorevest.recruitment.phase2a';
const TOKEN_AUDIENCE = 'shorevest.recruitment.upload-completion';
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function fail(errorCode) {
  return { success: false, errorCode };
}

function cleanPath(year, roleId, applicationReference, fileReference, extension) {
  return `recruitment/${year}/${roleId}/${applicationReference}/${fileReference}.${extension}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function log(deps, event, fields) {
  if (deps.logger?.log) await deps.logger.log(event, fields);
}

function completionTokenPayload({ now, applicationReference, fileReference, blobPath, sizeBytes, contentType, tokenId }) {
  return {
    version: TOKEN_VERSION,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    issuedAtUtc: now.toISOString(),
    expiresAtUtc: addMinutes(now, 10),
    tokenId,
    applicationReference,
    fileReference,
    quarantineBlobPath: blobPath,
    expectedSizeBytes: sizeBytes,
    expectedDeclaredMimeType: contentType
  };
}

function validateTokenPayload(payload, request, file, now) {
  if (payload.version !== TOKEN_VERSION) return false;
  if (payload.issuer !== TOKEN_ISSUER || payload.audience !== TOKEN_AUDIENCE) return false;
  if (Date.parse(payload.expiresAtUtc) < now.getTime()) return false;
  if (Date.parse(payload.issuedAtUtc) > now.getTime() + CLOCK_SKEW_MS) return false;
  if (payload.applicationReference !== request.applicationReference) return false;
  if (payload.fileReference !== request.fileReference) return false;
  if (payload.quarantineBlobPath !== file.quarantineBlobPath) return false;
  if (payload.expectedSizeBytes !== file.sizeBytes) return false;
  if (payload.expectedDeclaredMimeType !== file.declaredMimeType) return false;
  return true;
}

async function initiateApplication(request, deps) {
  const now = await deps.now();
  const requestValidation = validateRequest(request, now);
  if (!requestValidation.ok) return requestValidation;

  const rateLimit = deps.rateLimiter ? await deps.rateLimiter.check(request.clientSubmissionId) : { allowed: true };
  if (rateLimit.allowed !== true) return fail(ERROR_CODES.RATE_LIMITED);

  const botVerification = deps.botVerifier ? await deps.botVerifier.verify(request) : { ok: true };
  if (botVerification.ok !== true) return fail(ERROR_CODES.BOT_VERIFICATION_FAILED);

  const manifest = await deps.loadManifest();
  const roleResult = validateRole(manifest, request.roleId, request.locale, request.privacyNoticeVersion, now);
  if (!roleResult.ok) return fail(roleResult.errorCode);
  if (!roleResult.role.application.allowedSources.includes(request.source)) return fail(ERROR_CODES.VALIDATION_FAILED);

  const candidateResult = validateCandidate(request.candidate, request.privacyAccepted);
  if (!candidateResult.ok) return candidateResult;

  const fileResult = fileMeta(request.file, roleResult.role.application.cv);
  if (!fileResult.ok) return fileResult;

  const idempotencyKey = `init:${request.roleId}:${request.clientSubmissionId}`;
  const claim = await deps.idempotency.begin(idempotencyKey, 10 * 60 * 1000);
  if (claim.status === 'completed') return claim.result;
  if (claim.status === 'in_progress') return claim.promise;

  try {
    const applicationReference = await deps.references.application();
    const fileReference = await deps.references.file();
    const blobPath = cleanPath(now.getUTCFullYear(), roleResult.role.id, applicationReference, fileReference, fileResult.extension);
    const uploadExpiresAtUtc = addMinutes(now, 10);
    const tokenId = deps.references.tokenId ? await deps.references.tokenId() : `${applicationReference}:${fileReference}`;

    const upload = await deps.sas.issue({
      container: CONTAINERS.quarantine,
      blobPath,
      permissions: ['create', 'write'],
      httpsOnly: true,
      userDelegation: true,
      expiresAtUtc: uploadExpiresAtUtc,
      startsAtUtc: addMinutes(now, -5),
      contentType: request.file.declaredMimeType
    });

    const tokenPayload = completionTokenPayload({
      now,
      applicationReference,
      fileReference,
      blobPath,
      sizeBytes: request.file.sizeBytes,
      contentType: request.file.declaredMimeType,
      tokenId
    });
    const completionToken = await deps.tokens.sign(tokenPayload);
    const timestamp = now.toISOString();

    const application = {
      applicationReference,
      roleId: roleResult.role.id,
      roleTitle: roleResult.role.title[request.locale],
      roleDepartment: roleResult.role.department[request.locale],
      roleLocation: roleResult.role.location[request.locale],
      locale: request.locale,
      source: request.source,
      candidateName: candidateResult.candidate.fullName,
      candidateEmail: candidateResult.candidate.email,
      candidateTelephone: candidateResult.candidate.telephone,
      candidateLocation: candidateResult.candidate.currentLocation,
      linkedInUrl: candidateResult.candidate.linkedinUrl,
      coverNote: candidateResult.candidate.coverNote,
      privacyNoticeVersion: request.privacyNoticeVersion,
      privacyAcceptedAtUtc: timestamp,
      submittedAtClientUtc: request.submittedAtClientUtc || null,
      submittedAtServerUtc: timestamp,
      technicalStatus: A.UploadPending,
      hiringStage: H.New,
      fileCount: 1,
      readyFileCount: 0,
      requiresManualReview: false,
      retentionReviewDate: addMinutes(now, 60 * 24 * 365),
      lastUpdatedAtUtc: timestamp
    };

    const file = {
      fileReference,
      applicationReference,
      filePurpose: 'CV',
      originalFileName: request.file.originalName,
      declaredMimeType: request.file.declaredMimeType,
      detectedFileType: null,
      sizeBytes: request.file.sizeBytes,
      expectedHash: null,
      quarantineBlobPath: blobPath,
      cleanBlobPath: null,
      quarantineRemovalPending: false,
      technicalStatus: F.SASIssued,
      scanResult: null,
      lastUpdatedAtUtc: timestamp
    };

    await deps.applicationStore.reserveSubmission({ application, file, idempotencyKey });
    const result = { success: true, applicationReference, fileReference, upload, completionToken };
    await deps.idempotency.complete(idempotencyKey, result);
    await log(deps, 'initiate_application', { applicationReference, roleId: roleResult.role.id });
    return result;
  } catch (error) {
    await deps.idempotency.fail(idempotencyKey, ERROR_CODES.SUBMISSION_FAILED);
    await log(deps, 'initiate_application_failed', { roleId: request.roleId, errorCode: ERROR_CODES.SUBMISSION_FAILED });
    return fail(ERROR_CODES.SUBMISSION_FAILED);
  }
}

async function completeUpload(request, deps) {
  const now = await deps.now();
  let tokenPayload;
  try {
    tokenPayload = await deps.tokens.verify(request.completionToken);
  } catch (_) {
    return fail(ERROR_CODES.TOKEN_INVALID);
  }

  if (tokenPayload.applicationReference !== request.applicationReference || tokenPayload.fileReference !== request.fileReference) return fail(ERROR_CODES.TOKEN_INVALID);

  const application = await deps.applicationStore.getApplication(request.applicationReference);
  const file = await deps.applicationStore.getFile(request.fileReference);
  if (!application || !file || file.applicationReference !== application.applicationReference) return fail(ERROR_CODES.VALIDATION_FAILED);
  if (!validateTokenPayload(tokenPayload, request, file, now)) return fail(ERROR_CODES.TOKEN_INVALID);

  if (file.technicalStatus === F.ScanPending && application.technicalStatus === A.Scanning) {
    return { success: true, applicationReference: application.applicationReference, fileReference: file.fileReference, status: application.technicalStatus };
  }

  const properties = await deps.storage.properties(CONTAINERS.quarantine, file.quarantineBlobPath);
  if (!properties) return fail(ERROR_CODES.BLOB_NOT_FOUND);
  if (properties.sizeBytes !== file.sizeBytes || properties.contentType !== file.declaredMimeType) return fail(ERROR_CODES.BLOB_MISMATCH);

  const bytes = await deps.storage.read(CONTAINERS.quarantine, file.quarantineBlobPath, { maxBytes: file.sizeBytes });
  const detectedType = detect(bytes);
  const expectedDocx = file.declaredMimeType.includes('wordprocessingml');
  if ((file.declaredMimeType === 'application/pdf' && detectedType !== 'pdf') || (expectedDocx && detectedType !== 'docx')) {
    file.technicalStatus = transition('file', file.technicalStatus, F.ValidationFailed);
    file.lastUpdatedAtUtc = now.toISOString();
    await deps.applicationStore.updateApplicationAndFile({ application, file });
    return fail(ERROR_CODES.FILE_SIGNATURE_REJECTED);
  }

  file.detectedFileType = detectedType;
  file.expectedHash = hashBuffer(bytes);
  file.technicalStatus = transition('file', transition('file', file.technicalStatus, F.Uploaded), F.ScanPending);
  file.uploadVerifiedAtUtc = now.toISOString();
  file.scanStartedAtUtc = now.toISOString();
  file.lastUpdatedAtUtc = now.toISOString();
  application.technicalStatus = transition('application', transition('application', application.technicalStatus, A.Received), A.Scanning);
  application.lastUpdatedAtUtc = now.toISOString();

  await deps.applicationStore.updateApplicationAndFile({
    application,
    file,
    outboxEvent: { type: N.ApplicationReceived, idempotencyKey: `outbox:${application.applicationReference}:received`, applicationReference: application.applicationReference }
  });

  return { success: true, applicationReference: application.applicationReference, fileReference: file.fileReference, status: application.technicalStatus };
}

function validateScanEvent(event) {
  if (!event || typeof event !== 'object') return false;
  if (typeof event.eventId !== 'string' || !event.eventId) return false;
  if (typeof event.fileReference !== 'string' || !event.fileReference) return false;
  if (typeof event.blobPath !== 'string' || !event.blobPath) return false;
  if (!Object.values(S).includes(event.result)) return false;
  if (typeof event.scannedAtUtc !== 'string' || Number.isNaN(Date.parse(event.scannedAtUtc))) return false;
  return true;
}

async function processScanResult(event, deps, policy = { deleteMaliciousQuarantine: false }) {
  if (!validateScanEvent(event)) return fail(ERROR_CODES.VALIDATION_FAILED);
  const eventKey = `${event.eventId}:${event.fileReference}`;
  const claim = await deps.scanEvents.claim(eventKey);
  if (claim.status === 'completed') return { success: true, deduplicated: true };
  if (claim.status === 'in_progress') return fail(ERROR_CODES.EVENT_IN_PROGRESS);

  try {
    const file = await deps.applicationStore.getFile(event.fileReference);
    if (!file || file.quarantineBlobPath !== event.blobPath) {
      await deps.scanEvents.permanentFailure(eventKey, ERROR_CODES.BLOB_MISMATCH);
      return fail(ERROR_CODES.BLOB_MISMATCH);
    }

    const application = await deps.applicationStore.getApplication(file.applicationReference);
    if (!application || application.applicationReference !== file.applicationReference || file.technicalStatus !== F.ScanPending) {
      await deps.scanEvents.permanentFailure(eventKey, ERROR_CODES.STATE_TRANSITION_INVALID);
      return fail(ERROR_CODES.STATE_TRANSITION_INVALID);
    }

    file.scanEventId = event.eventId;
    file.scanResult = event.result;
    file.scanCompletedAtUtc = event.scannedAtUtc;
    file.lastUpdatedAtUtc = event.scannedAtUtc;
    application.lastUpdatedAtUtc = event.scannedAtUtc;

    let outboxEvent;
    if (event.result === S.Clean) {
      const cleanBlobPath = file.quarantineBlobPath;
      const promoted = await deps.storage.promoteClean({
        sourceContainer: CONTAINERS.quarantine,
        sourcePath: file.quarantineBlobPath,
        destinationContainer: CONTAINERS.clean,
        destinationPath: cleanBlobPath,
        expectedSizeBytes: file.sizeBytes,
        expectedContentType: file.declaredMimeType,
        expectedHash: file.expectedHash
      });
      if (promoted.status !== 'Succeeded') throw new Error('clean promotion incomplete');

      file.technicalStatus = transition('file', transition('file', file.technicalStatus, F.Clean), F.Ready);
      file.cleanBlobPath = cleanBlobPath;
      file.readyAtUtc = event.scannedAtUtc;
      application.technicalStatus = transition('application', application.technicalStatus, A.Ready);
      application.readyFileCount = 1;
      application.readyAtUtc = event.scannedAtUtc;
      outboxEvent = { type: N.DocumentsReady, idempotencyKey: `outbox:${application.applicationReference}:documents-ready`, applicationReference: application.applicationReference };

      try {
        await deps.storage.delete(CONTAINERS.quarantine, file.quarantineBlobPath);
        file.quarantineRemovedAtUtc = event.scannedAtUtc;
        file.quarantineRemovalPending = false;
      } catch (_) {
        file.quarantineRemovalPending = true;
        outboxEvent.cleanupRequired = true;
      }
    } else if (event.result === S.Malicious) {
      file.technicalStatus = transition('file', file.technicalStatus, F.Malicious);
      application.technicalStatus = transition('application', application.technicalStatus, A.Blocked);
      application.blockedAtUtc = event.scannedAtUtc;
      outboxEvent = { type: N.MaliciousFileDetected, idempotencyKey: `outbox:${application.applicationReference}:${file.fileReference}:malicious`, applicationReference: application.applicationReference, fileReference: file.fileReference };
      if (policy.deleteMaliciousQuarantine) await deps.storage.delete(CONTAINERS.quarantine, file.quarantineBlobPath);
    } else {
      file.technicalStatus = transition('file', transition('file', file.technicalStatus, F.ScanFailed), F.ManualReview);
      application.technicalStatus = transition('application', application.technicalStatus, A.ManualReview);
      application.requiresManualReview = true;
      application.manualReviewAtUtc = event.scannedAtUtc;
      outboxEvent = { type: N.ManualReviewRequired, idempotencyKey: `outbox:${application.applicationReference}:${file.fileReference}:manual-review`, applicationReference: application.applicationReference, fileReference: file.fileReference };
    }

    await deps.applicationStore.updateApplicationAndFile({ application, file, outboxEvent });
    const result = { success: true };
    await deps.scanEvents.complete(eventKey, result);
    return result;
  } catch (error) {
    await deps.scanEvents.retryableFailure(eventKey, ERROR_CODES.INFRASTRUCTURE_RETRYABLE);
    await log(deps, 'process_scan_result_failed', { eventId: event.eventId, fileReference: event.fileReference, errorCode: ERROR_CODES.INFRASTRUCTURE_RETRYABLE });
    return fail(ERROR_CODES.INFRASTRUCTURE_RETRYABLE);
  }
}

async function retryQuarantineCleanup({ fileReference }, deps) {
  const file = await deps.applicationStore.getFile(fileReference);
  if (!file || !file.quarantineRemovalPending) return fail(ERROR_CODES.VALIDATION_FAILED);
  await deps.storage.delete(CONTAINERS.quarantine, file.quarantineBlobPath);
  file.quarantineRemovalPending = false;
  file.quarantineRemovedAtUtc = (await deps.now()).toISOString();
  file.lastUpdatedAtUtc = file.quarantineRemovedAtUtc;
  const application = await deps.applicationStore.getApplication(file.applicationReference);
  await deps.applicationStore.updateApplicationAndFile({ application, file });
  return { success: true };
}

module.exports = { initiateApplication, completeUpload, processScanResult, retryQuarantineCleanup, cleanPath };
