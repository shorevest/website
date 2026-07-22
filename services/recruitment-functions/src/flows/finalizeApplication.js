'use strict';

const {
  FILE_STATES: FILE,
  NOTIFICATION_EVENTS: EVENTS,
  ERROR_CODES
} = require('../../../../api/recruitment/core/constants');

function outcomeEvent(application, file) {
  const suffix = 'after-finalization';
  if (file.technicalStatus === FILE.Ready) {
    return {
      type: EVENTS.DocumentsReady,
      idempotencyKey: `outbox:${application.applicationReference}:documents-ready:${suffix}`,
      applicationReference: application.applicationReference,
      fileReference: file.fileReference
    };
  }
  if (file.technicalStatus === FILE.Malicious) {
    return {
      type: EVENTS.MaliciousFileDetected,
      idempotencyKey: `outbox:${application.applicationReference}:${file.fileReference}:malicious:${suffix}`,
      applicationReference: application.applicationReference,
      fileReference: file.fileReference
    };
  }
  if (file.technicalStatus === FILE.ManualReview) {
    return {
      type: EVENTS.ManualReviewRequired,
      idempotencyKey: `outbox:${application.applicationReference}:${file.fileReference}:manual-review:${suffix}`,
      applicationReference: application.applicationReference,
      fileReference: file.fileReference
    };
  }
  return null;
}

async function hasEvent(dependencies, event) {
  return dependencies.applicationStore.hasOutboxEvent({
    applicationReference: event.applicationReference,
    idempotencyKey: event.idempotencyKey,
    type: event.type
  });
}

async function ensureOutcomeProjection(request, dependencies) {
  const application = await dependencies.applicationStore.getApplication(request.applicationReference);
  const file = await dependencies.applicationStore.getFile(request.fileReference);
  if (!application?.finalizedAtUtc || !file || file.applicationReference !== application.applicationReference) {
    return { status: 'not-applicable' };
  }

  const event = outcomeEvent(application, file);
  if (!event) return { status: 'not-applicable' };
  if (await hasEvent(dependencies, event)) return { status: 'current', event };

  try {
    await dependencies.applicationStore.commitAggregate({
      expectedVersion: application.aggregateVersion || 0,
      application,
      files: [file],
      outboxEvents: [event]
    });
    return { status: 'created', event };
  } catch (error) {
    if (await hasEvent(dependencies, event)) return { status: 'current', event };
    throw error;
  }
}

function createFinalizeApplication(coreFinalizeApplication) {
  if (typeof coreFinalizeApplication !== 'function') {
    throw new TypeError('core finalize application flow is required');
  }

  return async function finalizeApplication(request, dependencies) {
    const result = await coreFinalizeApplication(request, dependencies);
    if (result?.success !== true) return result;

    try {
      await ensureOutcomeProjection(request, dependencies);
      return result;
    } catch (error) {
      if (dependencies.logger?.log) {
        try {
          await dependencies.logger.log('finalization_outcome_reconciliation_failed', {
            applicationReference: request?.applicationReference,
            fileReference: request?.fileReference,
            errorCode: error.code || ERROR_CODES.INFRASTRUCTURE_RETRYABLE
          });
        } catch (_) {}
      }
      return {
        success: false,
        errorCode: ERROR_CODES.INFRASTRUCTURE_RETRYABLE
      };
    }
  };
}

module.exports = {
  outcomeEvent,
  ensureOutcomeProjection,
  createFinalizeApplication
};
