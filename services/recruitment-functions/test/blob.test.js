'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sha256, createBlobAdapter } = require('../src/adapters/blob');

function readable(bytes) {
  return (async function* stream() {
    yield bytes;
  }());
}

function storageFixture() {
  const bytes = Buffer.from('%PDF-private-clean-copy');
  let copied = false;
  let copySourceUrl = null;
  const delegationRequests = [];
  const containerPropertyReads = [];

  const sourceBlob = {
    url: 'https://account.blob.core.windows.net/recruitment-quarantine/source.pdf'
  };
  const destinationBlob = {
    url: 'https://account.blob.core.windows.net/recruitment-clean/source.pdf',
    async getProperties() {
      if (!copied) throw Object.assign(new Error('not found'), { statusCode: 404 });
      return {
        copyStatus: 'success',
        contentLength: bytes.length,
        contentType: 'application/pdf',
        etag: 'clean-etag'
      };
    },
    async beginCopyFromURL(url) {
      copySourceUrl = url;
      copied = true;
    },
    async download() {
      return { readableStreamBody: readable(bytes) };
    }
  };

  const serviceClient = {
    async getUserDelegationKey(startsOn, expiresOn) {
      delegationRequests.push({ startsOn, expiresOn });
      return { signedObjectId: 'test' };
    },
    getContainerClient(container) {
      return {
        async getProperties() {
          containerPropertyReads.push(container);
          return { etag: `${container}-etag` };
        },
        getBlockBlobClient() {
          return container === 'recruitment-quarantine' ? sourceBlob : destinationBlob;
        }
      };
    }
  };
  const sdkImpl = {
    BlobSASPermissions: { parse: (value) => value },
    SASProtocol: { Https: 'https' },
    generateBlobSASQueryParameters(input) {
      return { toString: () => `sp=${input.permissions}&sig=test` };
    }
  };

  return {
    bytes,
    serviceClient,
    sdkImpl,
    delegationRequests,
    containerPropertyReads,
    get copySourceUrl() { return copySourceUrl; }
  };
}

function adapter(fixture) {
  return createBlobAdapter({
    accountUrl: 'https://account.blob.core.windows.net',
    containers: {
      quarantine: 'recruitment-quarantine',
      clean: 'recruitment-clean'
    },
    clock: () => new Date('2026-07-22T00:00:00.000Z'),
    serviceClient: fixture.serviceClient,
    sdkImpl: fixture.sdkImpl
  });
}

test('clean promotion authorizes the private quarantine source with an internal read SAS', async () => {
  const fixture = storageFixture();
  const storage = adapter(fixture);

  const result = await storage.promoteClean({
    sourcePath: 'source.pdf',
    destinationPath: 'source.pdf',
    expectedSizeBytes: fixture.bytes.length,
    expectedContentType: 'application/pdf',
    expectedHash: sha256(fixture.bytes)
  });

  assert.deepEqual(result, { status: 'Succeeded' });
  assert.ok(fixture.copySourceUrl.startsWith(
    'https://account.blob.core.windows.net/recruitment-quarantine/source.pdf?'
  ));
  assert.ok(fixture.copySourceUrl.includes('sp=r'));
  assert.equal(fixture.delegationRequests.length, 1);
  assert.equal(
    fixture.delegationRequests[0].expiresOn - fixture.delegationRequests[0].startsOn,
    6 * 60 * 1000
  );
});

test('read SAS rejects excessive or inverted validity windows', async () => {
  const fixture = storageFixture();
  const storage = adapter(fixture);

  await assert.rejects(() => storage.issueRead({
    container: 'recruitment-clean',
    blobPath: 'source.pdf',
    startsAtUtc: '2026-07-22T00:00:00.000Z',
    expiresAtUtc: '2026-07-22T00:06:00.000Z'
  }), /expiry too long/);

  await assert.rejects(() => storage.issueRead({
    container: 'recruitment-clean',
    blobPath: 'source.pdf',
    startsAtUtc: '2026-07-22T00:02:00.000Z',
    expiresAtUtc: '2026-07-22T00:01:00.000Z'
  }), /invalid read sas expiry/);
});

test('storage readiness reads only the two private container properties', async () => {
  const fixture = storageFixture();
  const storage = adapter(fixture);

  assert.deepEqual(await storage.health(), { ok: true });
  assert.deepEqual(fixture.containerPropertyReads.sort(), [
    'recruitment-clean',
    'recruitment-quarantine'
  ]);
  assert.equal(typeof fixture.serviceClient.getProperties, 'undefined');
});
