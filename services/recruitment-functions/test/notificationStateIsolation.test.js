'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { NOTIFICATION_EVENTS: EVENTS } = require('../../../api/recruitment/core/constants');
const { applicationFields } = require('../src/outbox/dispatcher');

const application = {
  applicationReference: 'SV-APP-2026-ABC123',
  candidateSubmissionStatus: 'Submitted',
  finalizedAtUtc: '2026-07-22T00:05:00.000Z'
};

test('application-received and documents-ready states use different columns', () => {
  const received = applicationFields(application, {
    type: EVENTS.ApplicationReceived,
    idempotencyKey: 'received-key'
  });
  const documents = applicationFields(application, {
    type: EVENTS.DocumentsReady,
    idempotencyKey: 'documents-key'
  });

  assert.equal(received.ApplicationReceivedNotificationState, 'Pending');
  assert.equal(received.ApplicationReceivedNotificationEventKey, 'received-key');
  assert.equal(received.DocumentsReadyNotificationState, undefined);

  assert.equal(documents.DocumentsReadyNotificationState, 'Pending');
  assert.equal(documents.DocumentsReadyNotificationEventKey, 'documents-key');
  assert.equal(documents.ApplicationReceivedNotificationState, undefined);
  assert.equal(documents.NotificationState, undefined);
});

test('purge clears both notification state machines', () => {
  const purged = applicationFields({
    ...application,
    retentionState: 'Purged',
    candidateSubmissionStatus: 'Deleted'
  }, {
    type: EVENTS.RetentionPurged,
    idempotencyKey: 'purged-key'
  });

  assert.equal(purged.NotificationState, null);
  assert.equal(purged.ApplicationReceivedNotificationState, null);
  assert.equal(purged.DocumentsReadyNotificationState, null);
  assert.equal(purged.ApplicationReceivedNotificationEventKey, null);
  assert.equal(purged.DocumentsReadyNotificationEventKey, null);
});
