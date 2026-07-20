'use strict';

const crypto = require('node:crypto');

function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function createBlobAdapter({ accountUrl, credential, containers = {}, clock = () => new Date(), serviceClient } = {}) {
  const sdk = require('@azure/storage-blob');
  const blobService = serviceClient || (accountUrl && credential ? new sdk.BlobServiceClient(accountUrl, credential) : null);
  const quarantineContainer = containers.quarantine || 'recruitment-quarantine';
  const cleanContainer = containers.clean || 'recruitment-clean';

  function blockBlob(container, path) {
    if (!blobService) throw new Error('storage unavailable');
    return blobService.getContainerClient(container).getBlockBlobClient(path);
  }

  async function sourceReadSas(container, blobPath, startsOn, expiresOn) {
    const delegationKey = await blobService.getUserDelegationKey(startsOn, expiresOn);
    const accountName = new URL(accountUrl).hostname.split('.')[0];
    return sdk.generateBlobSASQueryParameters({
      containerName: container,
      blobName: blobPath,
      permissions: sdk.BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: sdk.SASProtocol.Https
    }, delegationKey, accountName).toString();
  }

  return {
    async issue({ container, blobPath, permissions, httpsOnly, expiresAtUtc, startsAtUtc, contentType }) {
      if (container !== quarantineContainer) throw new Error('invalid upload container');
      if (httpsOnly !== true) throw new Error('https is required');
      if (JSON.stringify(permissions) !== JSON.stringify(['create', 'write'])) throw new Error('invalid sas permissions');

      const expiresOn = new Date(expiresAtUtc);
      const startsOn = new Date(startsAtUtc || clock().getTime() - 300000);
      if (expiresOn.getTime() - clock().getTime() > 10 * 60 * 1000 + 1000) throw new Error('sas expiry too long');

      const delegationKey = await blobService.getUserDelegationKey(startsOn, expiresOn);
      const accountName = new URL(accountUrl).hostname.split('.')[0];
      const sas = sdk.generateBlobSASQueryParameters({
        containerName: container,
        blobName: blobPath,
        permissions: sdk.BlobSASPermissions.parse('cw'),
        startsOn,
        expiresOn,
        protocol: sdk.SASProtocol.Https
      }, delegationKey, accountName).toString();

      return {
        url: `${blockBlob(container, blobPath).url}?${sas}`,
        expiresAtUtc: expiresOn.toISOString(),
        method: 'PUT',
        requiredHeaders: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType }
      };
    },

    async properties(container, path) {
      try {
        const properties = await blockBlob(container, path).getProperties();
        return { sizeBytes: properties.contentLength, contentType: properties.contentType, etag: properties.etag, sha256: properties.metadata?.sha256 };
      } catch (error) {
        if (error.statusCode === 404) return undefined;
        throw error;
      }
    },

    async read(container, path, { maxBytes }) {
      const response = await blockBlob(container, path).download(0, maxBytes);
      const chunks = [];
      for await (const chunk of response.readableStreamBody) chunks.push(chunk);
      return Buffer.concat(chunks).subarray(0, maxBytes);
    },

    async verify({ container, path, expectedSizeBytes, expectedContentType, expectedHash, expectedETag, maxBytes }) {
      const properties = await this.properties(container, path);
      if (!properties) return { ok: false, reason: 'missing' };
      if (expectedETag && properties.etag !== expectedETag) return { ok: false, reason: 'etag' };
      if (properties.sizeBytes !== expectedSizeBytes || properties.contentType !== expectedContentType) return { ok: false, reason: 'properties' };
      const bytes = await this.read(container, path, { maxBytes: Math.min(maxBytes || expectedSizeBytes, expectedSizeBytes) });
      if (bytes.length !== expectedSizeBytes) return { ok: false, reason: 'bounded-read' };
      const calculatedHash = sha256(bytes);
      if (expectedHash && calculatedHash !== expectedHash) return { ok: false, reason: 'hash' };
      return { ok: true, etag: properties.etag, sha256: calculatedHash };
    },

    async promoteClean({ sourceContainer = quarantineContainer, sourcePath, destinationContainer = cleanContainer, destinationPath, expectedSizeBytes, expectedContentType, expectedHash, expectedSourceETag }) {
      const source = blockBlob(sourceContainer, sourcePath);
      const destination = blockBlob(destinationContainer, destinationPath);
      const sourceCheck = await this.verify({ container: sourceContainer, path: sourcePath, expectedSizeBytes, expectedContentType, expectedHash, expectedETag: expectedSourceETag, maxBytes: expectedSizeBytes });
      if (!sourceCheck.ok) return { status: 'Failed', reason: `source ${sourceCheck.reason}` };

      try {
        await destination.getProperties();
        return { status: 'Failed', reason: 'conflicting destination' };
      } catch (error) {
        if (error.statusCode !== 404) throw error;
      }

      const startsOn = new Date(clock().getTime() - 5 * 60 * 1000);
      const expiresOn = new Date(clock().getTime() + 10 * 60 * 1000);
      const sas = await sourceReadSas(sourceContainer, sourcePath, startsOn, expiresOn);
      const poller = await destination.beginCopyFromURL(`${source.url}?${sas}`, {
        sourceConditions: expectedSourceETag ? { ifMatch: expectedSourceETag } : undefined,
        conditions: { ifNoneMatch: '*' }
      });

      if (poller.pollUntilDone) await poller.pollUntilDone();
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const properties = await destination.getProperties();
        if (properties.copyStatus === 'success') break;
        if (['failed', 'aborted'].includes(properties.copyStatus)) return { status: 'Failed', reason: properties.copyStatus };
        if (attempt === 7) return { status: 'Pending' };
        await delay(250);
      }

      const destinationCheck = await this.verify({ container: destinationContainer, path: destinationPath, expectedSizeBytes, expectedContentType, expectedHash, maxBytes: expectedSizeBytes });
      if (!destinationCheck.ok) return { status: 'Failed', reason: `destination ${destinationCheck.reason}` };
      return { status: 'Succeeded', sourceETag: sourceCheck.etag, sha256: destinationCheck.sha256 };
    },

    async delete(container, path) {
      try { await blockBlob(container, path).deleteIfExists(); return true; }
      catch (error) { if (error.statusCode === 404) return false; throw error; }
    },

    async health() { await blobService.getProperties(); return { ok: true }; }
  };
}

module.exports = { createBlobAdapter };
