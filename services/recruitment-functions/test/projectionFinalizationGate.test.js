'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { NOTIFICATION_EVENTS: EVENTS } = require('../../../api/recruitment/core/constants');
const { createOutboxDispatcher } = require('../src/outbox/dispatcher');

function graphStub(counter) {
  return {
    async upsertListItem() {
      counter.upserts += 1;
      return { itemId: '1' };
    },
    async findMessagesByExtendedProperty() { return []; },
    async getMessage() { return null; },
    async createDraftMessage() { return { id: 'unused', isDraft: true }; },
    async sendDraftMessage() { return { accepted: true }; }
  };
}

test('scan outcomes are not projected to SharePoint before candidate finalization', async () => {
  const counter = { upserts: 0, fileReads: 0 };
  const dispatcher = createOutboxDispatcher({
    graph: graphStub(counter),
    config: {
      sharePoint: {
        siteId: 'site-id',
        applicationsListId: 'applications-list',
        filesListId: 'files-list'
      },
      candidateAcknowledgement: { enabled: false, templateApproved: false }
    }
  });

  const result = await dispatcher.deliver({
    type: EVENTS.DocumentsReady,
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345',
    idempotencyKey: 'outbox:file:documents-ready'
  }, {
    applicationStore: {
      async getApplication() {
        return {
          applicationReference: 'SV-APP-2026-ABC123',
          candidateSubmissionStatus: 'Draft',
          finalizedAtUtc: null,
          technicalStatus: 'Ready'
        };
      },
      async getFile() {
        counter.fileReads += 1;
        return { fileReference: 'SV-FILE-ABC12345' };
      }
    }
  });

  assert.deepEqual(result, {
    deliveryReference: 'deferred:DocumentsReady:SV-APP-2026-ABC123',
    skipped: true,
    reason: 'APPLICATION_NOT_FINALIZED'
  });
  assert.equal(counter.upserts, 0);
  assert.equal(counter.fileReads, 0);
});
