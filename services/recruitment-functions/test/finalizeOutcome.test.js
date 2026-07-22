'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  NOTIFICATION_EVENTS: EVENTS,
  ERROR_CODES
} = require('../../../api/recruitment/core/constants');
const {
  outcomeEvent,
  ensureOutcomeProjection,
  createFinalizeApplication
} = require('../src/flows/finalizeApplication');

function application(patch = {}) {
  return {
    applicationReference: 'SV-APP-2026-ABC123',
    aggregateVersion: 4,
    finalizedAtUtc: '2026-07-22T00:05:00.000Z',
    candidateSubmissionStatus: 'Submitted',
    ...patch
  };
}

function file(patch = {}) {
  return {
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345',
    technicalStatus: 'Ready',
    ...patch
  };
}

function dependencies({ app = application(), currentFile = file(), hasEvent = false, commitError = null } = {}) {
  const committed = [];
  return {
    committed,
    applicationStore: {
      async getApplication() { return app; },
      async getFile() { return currentFile; },
      async hasOutboxEvent() { return hasEvent || committed.length > 0; },
      async commitAggregate(input) {
        if (commitError) throw commitError;
        committed.push(input);
        return input;
      }
    },
    logger: { async log() {} }
  };
}

test('outcome event maps finalized scan states to fresh event keys', () => {
  assert.equal(outcomeEvent(application(), file()).type, EVENTS.DocumentsReady);
  assert.ok(outcomeEvent(application(), file()).idempotencyKey.endsWith('after-finalization'));
  assert.equal(outcomeEvent(application(), file({ technicalStatus: 'Malicious' })).type, EVENTS.MaliciousFileDetected);
  assert.equal(outcomeEvent(application(), file({ technicalStatus: 'ManualReview' })).type, EVENTS.ManualReviewRequired);
  assert.equal(outcomeEvent(application(), file({ technicalStatus: 'ScanPending' })), null);
});

test('finalized ready application creates one post-finalization outcome event', async () => {
  const deps = dependencies();
  const result = await ensureOutcomeProjection({
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345'
  }, deps);

  assert.equal(result.status, 'created');
  assert.equal(deps.committed.length, 1);
  assert.equal(deps.committed[0].outboxEvents[0].type, EVENTS.DocumentsReady);
  assert.equal(deps.committed[0].expectedVersion, 4);
});

test('existing outcome event is not created twice', async () => {
  const deps = dependencies({ hasEvent: true });
  const result = await ensureOutcomeProjection({
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345'
  }, deps);
  assert.equal(result.status, 'current');
  assert.equal(deps.committed.length, 0);
});

test('scan-pending finalization does not create an outcome event', async () => {
  const deps = dependencies({ currentFile: file({ technicalStatus: 'ScanPending' }) });
  assert.deepEqual(await ensureOutcomeProjection({
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345'
  }, deps), { status: 'not-applicable' });
  assert.equal(deps.committed.length, 0);
});

test('wrapper returns retryable when finalization committed but outcome reconciliation failed', async () => {
  const core = async () => ({
    success: true,
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345'
  });
  const wrapped = createFinalizeApplication(core);
  const deps = dependencies({
    commitError: Object.assign(new Error('Cosmos unavailable'), { code: 503 })
  });
  deps.applicationStore.hasOutboxEvent = async () => false;

  assert.deepEqual(await wrapped({
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345'
  }, deps), {
    success: false,
    errorCode: ERROR_CODES.INFRASTRUCTURE_RETRYABLE
  });
});

test('wrapper preserves successful core result after reconciliation', async () => {
  const coreResult = {
    success: true,
    alreadyFinalized: true,
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345',
    status: 'Ready'
  };
  const wrapped = createFinalizeApplication(async () => coreResult);
  const deps = dependencies();
  assert.deepEqual(await wrapped({
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345'
  }, deps), coreResult);
  assert.equal(deps.committed.length, 1);
});
