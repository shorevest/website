'use strict';

const crypto = require('crypto');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function validBlobPath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 1024 && !value.includes('..');
}

function createBlobAdapter({
  accountUrl,
  credential,
  containers = {},
  clock = () => new Date(),
  serviceClient
} = {}) {
  const sdk = require('@azure/storage-blob');
  const service = serviceClient || (accountUrl && credential
    ? new sdk.BlobServiceClient(accountUrl, credential)
    : null);
  const quarantine = containers.quarantine || 'recruitment-quarantine';
  const clean = containers.clean || 'recruitment-clean';

  function blob(container, path) {
    if (!service) throw new Error('storage unavailable');
    if (!validBlobPath(path)) throw new Error('invalid blob path');
    return service.getContainerClient(container).getBlockBlobClient(path);
  }

  function accountName() {
    const url = new URL(accountUrl);
    return url.hostname.split('.')[0];
  }

  async function delegationSas({ container, blobPath, permissions, startsOn, expiresOn }) {
    const key = await service.getUserDelegationKey(startsOn, expiresOn);
    return sdk.generateBlobSASQueryParameters({
      containerName: container,
      blobName: blobPath,
      permissions: sdk.BlobSASPermissions.parse(permissions),
      startsOn,
      expiresOn,
      protocol: sdk.SASProtocol.Https
    }, key, accountName()).toString();
  }

  return {
    async issue({
      container,
      blobPath,
      permissions,
      expiresAtUtc,
      startsAtUtc,
      contentType
    }) {
      if (container !== quarantine) throw new Error('invalid upload container');
      if (JSON.stringify(permissions) !== JSON.stringify(['create', 'write'])) {
        throw new Error('invalid sas permissions');
      }
      const expiresOn = new Date(expiresAtUtc);
      const startsOn = new Date(startsAtUtc || clock().getTime() - 300000);
      if (!Number.isFinite(expiresOn.getTime()) || expiresOn <= clock()) throw new Error('invalid sas expiry');
      if (expiresOn - clock() > 10 * 60 * 1000 + 1000) throw new Error('sas expiry too long');
      const sas = await delegationSas({
        container,
        blobPath,
        permissions: 'cw',
        startsOn,
        expiresOn
      });
      return {
        url: `${blob(container, blobPath).url}?${sas}`,
        expiresAtUtc: expiresOn.toISOString(),
        method: 'PUT',
        requiredHeaders: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': contentType
        }
      };
    },

    async issueRead({ container, blobPath, expiresAtUtc, startsAtUtc }) {
      if (container !== clean) throw new Error('invalid read container');
      const expiresOn = new Date(expiresAtUtc);
      const startsOn = new Date(startsAtUtc || clock().getTime() - 60000);
      if (!Number.isFinite(expiresOn.getTime()) || expiresOn <= clock()) throw new Error('invalid sas expiry');
      if (expiresOn - clock() > 5 * 60 * 1000 + 1000) throw new Error('read sas expiry too long');
      const sas = await delegationSas({
        container,
        blobPath,
        permissions: 'r',
        startsOn,
        expiresOn
      });
      return {
        url: `${blob(container, blobPath).url}?${sas}`,
        expiresAtUtc: expiresOn.toISOString(),
        method: 'GET'
      };
    },

    async properties(container, path) {
      try {
        const properties = await blob(container, path).getProperties();
        return {
          sizeBytes: properties.contentLength,
          contentType: properties.contentType,
          etag: properties.etag,
          sha256: properties.metadata?.sha256
        };
      } catch (error) {
        if (error.statusCode === 404) return undefined;
        throw error;
      }
    },

    async read(container, path, { maxBytes }) {
      const response = await blob(container, path).download(0, maxBytes);
      const chunks = [];
      for await (const chunk of response.readableStreamBody) chunks.push(chunk);
      return Buffer.concat(chunks).subarray(0, maxBytes);
    },

    async verify({ container, path, expectedSizeBytes, expectedContentType, expectedHash, maxBytes }) {
      const properties = await this.properties(container, path);
      if (!properties) return { ok: false, reason: 'missing' };
      if (properties.sizeBytes !== expectedSizeBytes || properties.contentType !== expectedContentType) {
        return { ok: false, reason: 'properties' };
      }
      const bytes = await this.read(container, path, {
        maxBytes: Math.min(maxBytes || expectedSizeBytes, expectedSizeBytes)
      });
      if (bytes.length !== expectedSizeBytes) return { ok: false, reason: 'bounded-read' };
      if (expectedHash && sha256(bytes) !== expectedHash) return { ok: false, reason: 'hash' };
      return { ok: true, etag: properties.etag, sha256: sha256(bytes) };
    },

    async promoteClean({
      sourceContainer = quarantine,
      sourcePath,
      destinationContainer = clean,
      destinationPath,
      expectedSizeBytes,
      expectedContentType,
      expectedHash
    }) {
      const destination = blob(destinationContainer, destinationPath);
      const valid = async () => {
        const result = await this.verify({
          container: destinationContainer,
          path: destinationPath,
          expectedSizeBytes,
          expectedContentType,
          expectedHash,
          maxBytes: expectedSizeBytes
        }).catch(() => ({ ok: false }));
        return result.ok;
      };
      if (await valid()) return { status: 'Succeeded' };
      try {
        await destination.getProperties();
        return { status: 'Failed', reason: 'conflicting destination' };
      } catch (error) {
        if (error.statusCode !== 404) throw error;
      }

      const source = blob(sourceContainer, sourcePath);
      await destination.beginCopyFromURL(source.url);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const properties = await destination.getProperties();
        if (properties.copyStatus === 'success') break;
        if (['failed', 'aborted'].includes(properties.copyStatus)) {
          return { status: 'Failed', reason: properties.copyStatus };
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!(await valid())) return { status: 'Failed', reason: 'verification' };
      return { status: 'Succeeded' };
    },

    async delete(container, path) {
      try {
        await blob(container, path).deleteIfExists();
        return true;
      } catch (error) {
        if (error.statusCode === 404) return false;
        throw error;
      }
    },

    async health() {
      await service.getProperties();
      return { ok: true };
    }
  };
}

module.exports = {
  sha256,
  validBlobPath,
  createBlobAdapter
};
