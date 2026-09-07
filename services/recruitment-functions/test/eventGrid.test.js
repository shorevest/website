'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizeEventGridEvent, normalizeStorageBlobCreatedEvent } = require('../src/lib/eventGrid');

const cfg = { uploadStorageAccountName: 'acct', quarantineContainer: 'recruitment-quarantine' };
const appRef = 'SV-APP-2026-0123456789ABCDEF';
const fileRef = 'SV-FILE-FEDCBA9876543210';

function ev(result = 'No threats found') {
  return {
    id: 'evt1',
    eventType: 'Microsoft.Security.MalwareScanningResult',
    eventTime: '2026-07-20T00:00:00Z',
    dataVersion: '1.0',
    metadataVersion: '1',
    data: {
      blobUri: `https://acct.blob.core.windows.net/recruitment-quarantine/recruitment/2026/legal-assistant/${appRef}/${fileRef}.pdf`,
      scanResultType: result,
      blobETag: 'etag',
      sha256: 'a'.repeat(64),
      correlationId: 'corr-1'
    }
  };
}

test('normalizes official malware scanning event fields', () => {
  const normalized = normalizeEventGridEvent(ev(), cfg);
  assert.equal(normalized.applicationReference, appRef);
  assert.equal(normalized.fileReference, fileRef);
  assert.equal(normalized.result, 'Clean');
  assert.equal(normalized.blobETag, 'etag');
  assert.equal(normalized.sha256, 'a'.repeat(64));
});

test('rejects malformed and wrong scope events', () => {
  assert.throws(() => normalizeEventGridEvent({ ...ev(), eventType: 'Other' }, cfg));
  assert.throws(() => normalizeEventGridEvent({ ...ev(), data: { ...ev().data, blobUri: `https://other.blob.core.windows.net/recruitment-quarantine/recruitment/2026/r/${appRef}/${fileRef}.pdf` } }, cfg));
  assert.throws(() => normalizeEventGridEvent({ ...ev(), data: { ...ev().data, blobUri: `https://acct.blob.core.windows.net/clean/recruitment/2026/r/${appRef}/${fileRef}.pdf` } }, cfg));
});

test('unknown scan results are not treated as clean', () => {
  assert.throws(() => normalizeEventGridEvent(ev('Suspicious'), cfg));
});

function blobCreated(overrides = {}) {
  return {
    id: 'blob-evt-1',
    eventType: 'Microsoft.Storage.BlobCreated',
    eventTime: '2026-08-08T18:58:36Z',
    data: {
      api: 'PutBlob',
      url: `https://acct.blob.core.windows.net/recruitment-quarantine/recruitment/2026/legal-assistant/${appRef}/${fileRef}.docx`,
      contentLength: 36870
    },
    ...overrides
  };
}

test('normalizes Event Grid and CloudEvents BlobCreated messages', () => {
  const grid = normalizeStorageBlobCreatedEvent(blobCreated(), cfg);
  assert.equal(grid.eventId, 'blob-evt-1');
  assert.equal(grid.roleId, 'legal-assistant');
  assert.equal(grid.applicationReference, appRef);
  assert.equal(grid.fileReference, fileRef);
  assert.equal(grid.extension, 'docx');
  assert.equal(grid.contentLength, 36870);

  const cloud = normalizeStorageBlobCreatedEvent({
    id: 'ce-1',
    type: 'Microsoft.Storage.BlobCreated',
    time: '2026-08-08T18:58:36Z',
    data: {
      url: `https://acct.blob.core.windows.net/recruitment-quarantine/recruitment/2026/legal-assistant/${appRef}/${fileRef}.pdf`
    }
  }, cfg);
  assert.equal(cloud.fileReference, fileRef);
  assert.equal(cloud.extension, 'pdf');
});

test('rejects BlobCreated messages outside the exact quarantine scope', () => {
  assert.throws(
    () => normalizeStorageBlobCreatedEvent(blobCreated({ eventType: 'Microsoft.Storage.BlobDeleted' }), cfg),
    /wrong event type/
  );
  assert.throws(
    () => normalizeStorageBlobCreatedEvent(blobCreated({
      data: { url: `https://other.blob.core.windows.net/recruitment-quarantine/recruitment/2026/r/${appRef}/${fileRef}.docx` }
    }), cfg),
    /wrong storage account/
  );
  assert.throws(
    () => normalizeStorageBlobCreatedEvent(blobCreated({
      data: { url: `https://acct.blob.core.windows.net/recruitment-clean/recruitment/2026/r/${appRef}/${fileRef}.docx` }
    }), cfg),
    /wrong container/
  );
  assert.throws(
    () => normalizeStorageBlobCreatedEvent(blobCreated({
      data: { url: 'https://acct.blob.core.windows.net/recruitment-quarantine/uploads/random.docx' }
    }), cfg),
    /malformed blob path/
  );
});
