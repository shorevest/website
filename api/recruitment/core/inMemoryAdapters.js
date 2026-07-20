'use strict';

const crypto = require('crypto');
const { CONTAINERS, SCAN_EVENT_STATES } = require('./constants');

function timingSafeStringEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hmacTokenAdapter(secret, now) {
  const signingSecret = secret || 'test-only-recruitment-token-secret-do-not-use-in-production';

  function signPayload(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', signingSecret).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  return {
    async sign(payload) {
      return signPayload(payload);
    },
    async verify(token) {
      const [body, signature, extra] = String(token || '').split('.');
      if (!body || !signature || extra !== undefined) throw new Error('invalid token format');
      const expected = crypto.createHmac('sha256', signingSecret).update(body).digest('base64url');
      if (!timingSafeStringEqual(signature, expected)) throw new Error('invalid token signature');
      return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    }
  };
}

function createMemoryAdapters(opts = {}) {
  const asyncMode = opts.async === true;
  const now = opts.now || (() => new Date('2026-07-20T00:00:00Z'));
  const apps = new Map();
  const files = new Map();
  const idem = new Map();
  const scanEventRecords = new Map();
  const outboxEvents = [];
  const notifications = outboxEvents;
  const logs = [];
  const blobs = new Map();
  const counters = { applications: 0, files: 0, sas: 0, outbox: 0 };
  const failures = opts.failures || {};
  let sequence = 1;

  const later = (value) => (asyncMode ? Promise.resolve().then(() => value) : value);
  const failIf = (name) => {
    if (failures[name] > 0) {
      failures[name] -= 1;
      throw new Error(`${name} injected failure`);
    }
  };

  const adapter = {
    now: () => now(),
    async loadManifest() {
      failIf('loadManifest');
      return later(opts.manifest);
    },
    rateLimiter: { async check() { failIf('rateLimiter'); return later({ allowed: true }); } },
    botVerifier: { async verify() { failIf('botVerifier'); return later({ ok: true }); } },
    references: {
      async application() {
        return later(`SV-APP-${now().getUTCFullYear()}-${String(sequence++).padStart(6, '0')}`);
      },
      async file() {
        return later(`SV-FILE-${String(sequence++).padStart(8, '0')}`);
      },
      async tokenId() {
        return later(`tok-${String(sequence++).padStart(8, '0')}`);
      }
    },
    tokens: hmacTokenAdapter(opts.tokenSecret, now),
    sas: {
      async issue(grant) {
        failIf('sas');
        counters.sas += 1;
        return later({
          url: `https://example.invalid/${grant.container}/${grant.blobPath}?sas=write-only`,
          expiresAtUtc: grant.expiresAtUtc,
          method: 'PUT',
          requiredHeaders: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': grant.contentType }
        });
      }
    },
    applicationStore: {
      apps,
      files,
      async reserveSubmission({ application, file }) {
        failIf('reserveSubmission');
        if (failures.afterApplicationCreate > 0) {
          failures.afterApplicationCreate -= 1;
          apps.set(application.applicationReference, application);
          counters.applications += 1;
          apps.delete(application.applicationReference);
          throw new Error('file create injected failure');
        }
        if (failures.afterFileCreate > 0) {
          failures.afterFileCreate -= 1;
          files.set(file.fileReference, file);
          counters.files += 1;
          files.delete(file.fileReference);
          throw new Error('application finalisation injected failure');
        }
        apps.set(application.applicationReference, application);
        files.set(file.fileReference, file);
        counters.applications += 1;
        counters.files += 1;
        return later({ application, file });
      },
      async updateApplicationAndFile({ application, file, outboxEvent }) {
        failIf('repositoryWrite');
        apps.set(application.applicationReference, application);
        files.set(file.fileReference, file);
        if (outboxEvent && !outboxEvents.some((event) => event.idempotencyKey === outboxEvent.idempotencyKey)) {
          failIf('outbox');
          outboxEvents.push({ ...outboxEvent, delivered: false });
          counters.outbox += 1;
        }
        return later({ application, file });
      },
      async getApplication(reference) { return later(apps.get(reference)); },
      async getFile(reference) { return later(files.get(reference)); }
    },
    applications: { apps, get: (reference) => apps.get(reference), create: (record) => apps.set(record.applicationReference, record), update: (record) => apps.set(record.applicationReference, record) },
    files: { files, get: (reference) => files.get(reference), create: (record) => files.set(record.fileReference, record), update: (record) => files.set(record.fileReference, record) },
    idempotency: {
      async begin(key) {
        failIf('idempotencyBegin');
        const existing = idem.get(key);
        if (existing?.state === 'Completed') return later({ status: 'completed', result: existing.result });
        if (existing?.state === 'Processing' && existing.promise) return later({ status: 'in_progress', promise: existing.promise });
        let resolve;
        const promise = new Promise((done) => { resolve = done; });
        idem.set(key, { state: 'Processing', promise, resolve });
        return later({ status: 'claimed' });
      },
      async complete(key, result) {
        failIf('idempotencyComplete');
        const existing = idem.get(key);
        idem.set(key, { state: 'Completed', result });
        if (existing?.resolve) existing.resolve(result);
        return later(result);
      },
      async fail(key, reason) {
        const existing = idem.get(key);
        idem.delete(key);
        if (existing?.resolve) existing.resolve({ success: false, errorCode: reason });
        return later(undefined);
      },
      async getCompleted(key) { return later(idem.get(key)?.state === 'Completed' ? idem.get(key).result : null); }
    },
    scanEvents: {
      records: scanEventRecords,
      async claim(key) {
        failIf('eventClaim');
        const existing = scanEventRecords.get(key);
        if (existing?.state === SCAN_EVENT_STATES.Completed) return later({ status: 'completed', result: existing.result });
        if (existing?.state === SCAN_EVENT_STATES.Processing) return later({ status: 'in_progress' });
        scanEventRecords.set(key, { state: SCAN_EVENT_STATES.Processing });
        return later({ status: 'claimed' });
      },
      async complete(key, result) { scanEventRecords.set(key, { state: SCAN_EVENT_STATES.Completed, result }); return later(result); },
      async retryableFailure(key, reason) { scanEventRecords.set(key, { state: SCAN_EVENT_STATES.RetryableFailure, reason }); return later(undefined); },
      async permanentFailure(key, reason) { scanEventRecords.set(key, { state: SCAN_EVENT_STATES.PermanentFailure, reason }); return later(undefined); }
    },
    storage: {
      put(container, path, bytes, contentType, hash) {
        blobs.set(`${container}/${path}`, { bytes: Buffer.from(bytes), sizeBytes: Buffer.byteLength(bytes), contentType, hash });
      },
      exists(container, path) { return blobs.has(`${container}/${path}`); },
      async properties(container, path) { failIf('blobProperties'); return later(blobs.get(`${container}/${path}`)); },
      async read(container, path, options = {}) {
        failIf('blobRead');
        const blob = blobs.get(`${container}/${path}`);
        if (!blob) return later(undefined);
        return later(blob.bytes.subarray(0, options.maxBytes || blob.bytes.length));
      },
      async promoteClean({ sourceContainer, sourcePath, destinationContainer, destinationPath, expectedSizeBytes, expectedContentType, expectedHash }) {
        failIf('promoteClean');
        const source = blobs.get(`${sourceContainer}/${sourcePath}`);
        if (!source) return later({ status: 'Failed', reason: 'missing source' });
        if (source.copyStatus === 'pending') return later({ status: 'Pending' });
        if (source.copyStatus === 'failed') return later({ status: 'Failed' });
        if (source.sizeBytes !== expectedSizeBytes) return later({ status: 'Failed', reason: 'size' });
        if (source.contentType !== expectedContentType) return later({ status: 'Failed', reason: 'contentType' });
        if (expectedHash && source.hash && expectedHash !== source.hash) return later({ status: 'Failed', reason: 'hash' });
        blobs.set(`${destinationContainer}/${destinationPath}`, { ...source });
        return later({ status: 'Succeeded' });
      },
      async delete(container, path) { failIf('quarantineDelete'); return later(blobs.delete(`${container}/${path}`)); }
    },
    outbox: { events: outboxEvents, async enqueue(event) { failIf('outbox'); outboxEvents.push(event); counters.outbox += 1; return later(event); } },
    notifications: { emit: (event) => outboxEvents.push(event), notifications },
    logger: { async log(event, fields) { logs.push({ event, fields }); return later(undefined); }, logs },
    counters,
    failures
  };

  return adapter;
}

module.exports = { createMemoryAdapters, hmacTokenAdapter };
