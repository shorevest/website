'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizeEventGridEvent } = require('../src/lib/eventGrid');

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
