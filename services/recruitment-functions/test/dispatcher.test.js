'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  NOTIFICATION_EVENTS: EVENTS
} = require('../../../api/recruitment/core/constants');
const {
  applicationFields,
  fileFields,
  acknowledgementMessage,
  createOutboxDispatcher
} = require('../src/outbox/dispatcher');

function application(patch = {}) {
  return {
    applicationReference: 'SV-APP-2026-ABC123',
    roleId: 'legal-assistant',
    roleTitle: 'Legal Assistant',
    roleDepartment: 'Legal Department',
    roleLocation: 'Guangzhou, China',
    locale: 'en',
    source: 'website',
    candidateName: 'Candidate Name',
    candidateEmail: 'candidate@example.com',
    candidateTelephone: '+1 212 555 0100',
    candidateLocation: 'New York, US',
    linkedInUrl: 'https://www.linkedin.com/in/example',
    coverNote: 'Short note',
    privacyNoticeVersion: 'approved-v1',
    privacyAcceptedAtUtc: '2026-07-22T00:00:00.000Z',
    initiatedAtUtc: '2026-07-22T00:00:00.000Z',
    submittedAtClientUtc: '2026-07-22T00:00:00.000Z',
    submittedAtServerUtc: '2026-07-22T00:01:00.000Z',
    finalizedAtUtc: '2026-07-22T00:01:00.000Z',
    accuracyConfirmedAtUtc: '2026-07-22T00:01:00.000Z',
    candidateSubmissionStatus: 'Submitted',
    technicalStatus: 'Scanning',
    hiringStage: 'New',
    fileCount: 1,
    readyFileCount: 0,
    requiresManualReview: false,
    retentionReviewDate: '2027-07-22T00:00:00.000Z',
    lastUpdatedAtUtc: '2026-07-22T00:01:00.000Z',
    ...patch
  };
}

function file(patch = {}) {
  return {
    fileReference: 'SV-FILE-ABC12345',
    applicationReference: 'SV-APP-2026-ABC123',
    filePurpose: 'CV',
    originalFileName: 'candidate-cv.pdf',
    declaredMimeType: 'application/pdf',
    detectedFileType: 'pdf',
    sizeBytes: 1024,
    expectedHash: 'a'.repeat(64),
    quarantineBlobPath: 'recruitment/2026/legal-assistant/SV-APP-2026-ABC123/SV-FILE-ABC12345.pdf',
    cleanBlobPath: null,
    quarantineRemovalPending: false,
    technicalStatus: 'ScanPending',
    scanResult: null,
    scanEventId: null,
    uploadVerifiedAtUtc: '2026-07-22T00:01:00.000Z',
    scanStartedAtUtc: '2026-07-22T00:01:00.000Z',
    scanCompletedAtUtc: null,
    readyAtUtc: null,
    quarantineRemovedAtUtc: null,
    retentionReviewDate: '2027-07-22T00:00:00.000Z',
    lastUpdatedAtUtc: '2026-07-22T00:01:00.000Z',
    ...patch
  };
}

function config() {
  return {
    sharePoint: {
      siteId: 'site-id',
      applicationsListId: 'applications-list',
      filesListId: 'files-list'
    },
    candidateAcknowledgement: {
      enabled: true,
      templateApproved: true,
      mailbox: 'hr@shorevest.com',
      privacyNoticeUrl: 'https://shorevest.com/privacy-policy/'
    }
  };
}

test('application projection marks only approved HR notifications pending', () => {
  const received = applicationFields(application(), {
    type: EVENTS.ApplicationReceived,
    idempotencyKey: 'outbox:application:received'
  });
  assert.equal(received.NotificationState, 'Pending');
  assert.equal(received.NotificationEventKey, 'outbox:application:received');

  const malicious = applicationFields(application({ technicalStatus: 'Blocked' }), {
    type: EVENTS.MaliciousFileDetected,
    idempotencyKey: 'outbox:file:malicious'
  });
  assert.equal(malicious.NotificationState, undefined);
});

test('file projection contains metadata but no document bytes or public URL', () => {
  const fields = fileFields(file());
  assert.equal(fields.FileReference, 'SV-FILE-ABC12345');
  assert.equal(fields.OriginalFileName, 'candidate-cv.pdf');
  assert.equal(fields.bytes, undefined);
  assert.equal(fields.PublicUrl, undefined);
  assert.equal(fields.SasUrl, undefined);
});

test('projection upserts the application and every file in the application partition', async () => {
  const upserts = [];
  const graph = {
    async upsertListItem(input) {
      upserts.push(input);
      return { itemId: String(upserts.length), created: true };
    },
    async sendMail() {
      throw new Error('mail not expected');
    }
  };
  const dispatcher = createOutboxDispatcher({ graph, config: config() });
  const dependencies = {
    applicationStore: {
      async getApplication() {
        return application();
      },
      async getFile() {
        return file();
      }
    },
    projectionReader: {
      async getFilesForApplication() {
        return [file(), file({ fileReference: 'SV-FILE-SECOND', filePurpose: 'SupportingDocument' })];
      }
    }
  };

  const result = await dispatcher.deliver({
    type: EVENTS.ApplicationReceived,
    applicationReference: 'SV-APP-2026-ABC123',
    idempotencyKey: 'outbox:application:received'
  }, dependencies);

  assert.equal(upserts.length, 3);
  assert.equal(upserts[0].keyField, 'ApplicationReference');
  assert.equal(upserts[1].keyField, 'FileReference');
  assert.equal(upserts[2].keyValue, 'SV-FILE-SECOND');
  assert.equal(result.deliveryReference, 'application:1|file:2|file:3');
});

test('file-specific events do not query unrelated application files', async () => {
  let projectionReads = 0;
  let upserts = 0;
  const dispatcher = createOutboxDispatcher({
    graph: {
      async upsertListItem() {
        upserts += 1;
        return { itemId: String(upserts), created: false };
      },
      async sendMail() {}
    },
    config: config()
  });

  await dispatcher.deliver({
    type: EVENTS.MaliciousFileDetected,
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345',
    idempotencyKey: 'outbox:file:malicious'
  }, {
    applicationStore: {
      async getApplication() {
        return application({ technicalStatus: 'Blocked' });
      },
      async getFile() {
        return file({ technicalStatus: 'Malicious', scanResult: 'Malicious' });
      }
    },
    projectionReader: {
      async getFilesForApplication() {
        projectionReads += 1;
        return [];
      }
    }
  });

  assert.equal(upserts, 2);
  assert.equal(projectionReads, 0);
});

test('acknowledgement message is bilingual, contains fraud wording and no attachments', () => {
  const english = acknowledgementMessage(application(), config().candidateAcknowledgement);
  assert.ok(english.subject.includes('Application received'));
  assert.ok(english.body.content.includes('never ask a candidate to make a payment'));
  assert.equal(english.attachments, undefined);

  const chinese = acknowledgementMessage(
    application({ locale: 'zh-CN', roleTitle: '法务专员', candidateName: '候选人' }),
    config().candidateAcknowledgement
  );
  assert.ok(chinese.body.content.includes('不会在招聘过程中要求候选人付款'));
});

test('candidate acknowledgement remains blocked without explicit template approval', async () => {
  const dispatcher = createOutboxDispatcher({
    graph: {
      async upsertListItem() {
        return { itemId: '1' };
      },
      async sendMail() {
        throw new Error('should not send');
      }
    },
    config: {
      ...config(),
      candidateAcknowledgement: {
        ...config().candidateAcknowledgement,
        templateApproved: false
      }
    }
  });

  await assert.rejects(
    () => dispatcher.deliver({
      type: EVENTS.CandidateAcknowledgementRequested,
      applicationReference: 'SV-APP-2026-ABC123'
    }, {
      applicationStore: {
        async getApplication() {
          return application();
        }
      }
    }),
    (error) => error.code === 'CANDIDATE_ACKNOWLEDGEMENT_DISABLED' && error.permanent === true
  );
});

test('approved candidate acknowledgement sends through the configured recruitment mailbox', async () => {
  const sent = [];
  const dispatcher = createOutboxDispatcher({
    graph: {
      async upsertListItem() {
        return { itemId: '1' };
      },
      async sendMail(mailbox, message) {
        sent.push({ mailbox, message });
      }
    },
    config: config()
  });

  const result = await dispatcher.deliver({
    type: EVENTS.CandidateAcknowledgementRequested,
    applicationReference: 'SV-APP-2026-ABC123'
  }, {
    applicationStore: {
      async getApplication() {
        return application();
      }
    }
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].mailbox, 'hr@shorevest.com');
  assert.equal(sent[0].message.toRecipients[0].emailAddress.address, 'candidate@example.com');
  assert.equal(sent[0].message.attachments, undefined);
  assert.equal(result.deliveryReference, 'mail:SV-APP-2026-ABC123');
});
