'use strict';

function clone(value) { return value ? JSON.parse(JSON.stringify(value)) : value; }
function isNotFound(error) { return error?.code === 404 || error?.statusCode === 404; }
function isConflict(error) { return error?.code === 409 || error?.statusCode === 409; }
function isPrecondition(error) { return error?.code === 412 || error?.statusCode === 412; }
function retryAfter(error) { return error?.retryAfterInMs || Number(error?.headers?.['x-ms-retry-after-ms']) || 1000; }
function transient(error) { return error?.code === 429 || error?.statusCode === 429 || error?.code >= 500 || error?.statusCode >= 500; }

function mapCosmosError(error) {
  if (error?.code === 429 || error?.statusCode === 429) return { code: 'INFRASTRUCTURE_RETRYABLE', retryAfterMs: retryAfter(error) };
  if (isPrecondition(error)) return { code: 'INFRASTRUCTURE_RETRYABLE' };
  if (transient(error)) return { code: 'INFRASTRUCTURE_RETRYABLE' };
  return { code: 'SUBMISSION_FAILED' };
}

async function read(container, id, partitionKey) {
  try { return (await container.item(id, partitionKey).read()).resource || null; }
  catch (error) { if (isNotFound(error)) return null; throw error; }
}

async function conditionalPatch(container, doc, operations) {
  return container.item(doc.id, doc.applicationReference || doc.idempotencyKey || doc.key).patch(operations, { accessCondition: { type: 'IfMatch', condition: doc._etag } });
}

function createCosmosAdapters({ endpoint, databaseId, credential, client, now = () => new Date() } = {}) {
  const cosmosClient = client || (endpoint && credential ? new (require('@azure/cosmos').CosmosClient)({ endpoint, aadCredentials: credential }) : null);
  if (!cosmosClient) throw new Error('cosmos unavailable');

  const database = cosmosClient.database(databaseId);
  const submissions = database.container('submissions');
  const idempotencyContainer = database.container('idempotency');
  const rateLimits = database.container('rateLimits');

  const applicationStore = {
    async reserveSubmission(reservation) { return clone(reservation); },

    async createInitialRecords({ application, file, idempotencyKey, reservation }) {
      const partitionKey = application.applicationReference;
      const appDoc = { id: 'application', docType: 'application', aggregateVersion: 0, idempotencyKey, ...application };
      const fileDoc = { id: `file:${file.fileReference}`, docType: 'file', ...file };
      try {
        const response = await submissions.items.batch(partitionKey).create(appDoc).create(fileDoc).execute();
        if (response.code >= 400) throw Object.assign(new Error('batch failed'), { code: response.code });
        return { application: appDoc, file: fileDoc };
      } catch (error) {
        if (!isConflict(error) && error.code !== 409) throw error;
        const existingApp = await this.getApplication(application.applicationReference);
        const existingFile = await this.getFile(application.applicationReference, file.fileReference);
        const ok = existingApp && existingFile && reservation &&
          existingApp.idempotencyKey === idempotencyKey &&
          existingApp.requestFingerprint === reservation.requestFingerprint &&
          existingFile.applicationReference === reservation.applicationReference &&
          existingFile.quarantineBlobPath === reservation.quarantineBlobPath &&
          existingFile.sizeBytes === reservation.expectedSizeBytes &&
          existingFile.declaredMimeType === reservation.expectedMimeType;
        if (!ok) throw Object.assign(new Error('reservation integrity conflict'), { code: 'RESERVATION_INTEGRITY_CONFLICT' });
        return { application: existingApp, file: existingFile };
      }
    },

    async commitAggregate({ expectedVersion, application, files, outboxEvents = [] }) {
      const partitionKey = application.applicationReference;
      const current = await this.getApplication(partitionKey);
      if (!current || current.aggregateVersion !== expectedVersion) throw Object.assign(new Error('stale aggregate'), { code: 'AGGREGATE_CONFLICT' });
      let batch = submissions.items.batch(partitionKey).replace('application', { ...application, id: 'application', docType: 'application', aggregateVersion: expectedVersion + 1 }, { ifMatch: current._etag });
      for (const file of files) batch = batch.replace(`file:${file.fileReference}`, { ...file, id: `file:${file.fileReference}`, docType: 'file' });
      for (const event of outboxEvents) {
        batch = batch.create({ id: `outbox:${event.type}:${event.idempotencyKey}`, docType: 'outbox', state: 'Pending', attemptCount: 0, applicationReference: partitionKey, notBeforeUtc: now().toISOString(), ...event });
      }
      const response = await batch.execute();
      if (response.code >= 400) throw Object.assign(new Error('batch failed'), { code: response.code });
      return { application: { ...application, aggregateVersion: expectedVersion + 1 }, files };
    },

    async getApplication(applicationReference) { return read(submissions, 'application', applicationReference); },
    async getFile(applicationReference, fileReference) { return read(submissions, `file:${fileReference}`, applicationReference); },
    async hasOutboxEvent({ applicationReference, idempotencyKey, type }) { return !!(await read(submissions, `outbox:${type}:${idempotencyKey}`, applicationReference)); },

    async claimCleanupBatch({ limit = 10, owner, leaseExpiresAtUtc }) {
      const query = { query: 'SELECT TOP @limit * FROM c WHERE c.docType = "file" AND c.quarantineRemovalPending = true AND (NOT IS_DEFINED(c.cleanupLeaseExpiresAtUtc) OR c.cleanupLeaseExpiresAtUtc < @now)', parameters: [{ name: '@limit', value: limit }, { name: '@now', value: now().toISOString() }] };
      const { resources } = await submissions.items.query(query, { maxItemCount: limit }).fetchAll();
      const claimed = [];
      for (const file of resources) {
        try {
          await conditionalPatch(submissions, file, [{ op: 'set', path: '/cleanupLeaseOwner', value: owner }, { op: 'set', path: '/cleanupLeaseExpiresAtUtc', value: leaseExpiresAtUtc }, { op: 'incr', path: '/cleanupAttemptCount', value: 1 }]);
          claimed.push(file);
        } catch (error) { if (!isPrecondition(error) && !isConflict(error)) throw error; }
      }
      return claimed;
    },

    async claimOutboxBatch({ limit = 10, owner, leaseExpiresAtUtc }) {
      const query = { query: 'SELECT TOP @limit * FROM c WHERE c.docType = "outbox" AND (c.state = "Pending" OR c.state = "RetryableFailure") AND (NOT IS_DEFINED(c.notBeforeUtc) OR c.notBeforeUtc <= @now)', parameters: [{ name: '@limit', value: limit }, { name: '@now', value: now().toISOString() }] };
      const { resources } = await submissions.items.query(query, { maxItemCount: limit }).fetchAll();
      const claimed = [];
      for (const event of resources) {
        try {
          await conditionalPatch(submissions, event, [{ op: 'set', path: '/state', value: 'Processing' }, { op: 'set', path: '/leaseOwner', value: owner }, { op: 'set', path: '/leaseExpiresAtUtc', value: leaseExpiresAtUtc }, { op: 'incr', path: '/attemptCount', value: 1 }]);
          claimed.push(event);
        } catch (error) { if (!isPrecondition(error) && !isConflict(error)) throw error; }
      }
      return claimed;
    },

    async markOutboxAttempt(event, state = 'RetryableFailure') {
      const next = { ...event, state, attemptCount: (event.attemptCount || 0) + 1, notBeforeUtc: new Date(now().getTime() + 5 * 60 * 1000).toISOString() };
      return submissions.item(event.id, event.applicationReference).replace(next, { accessCondition: { type: 'IfMatch', condition: event._etag } });
    }
  };

  const idempotency = {
    async claim(key, owner, leaseExpiresAtUtc, requestFingerprint) {
      const doc = { id: key, idempotencyKey: key, state: 'Claimed', leaseOwner: owner, leaseExpiresAtUtc, requestFingerprint, createdAtUtc: now().toISOString() };
      try { await idempotencyContainer.items.create(doc); return { status: 'claimed', record: doc }; }
      catch (error) {
        if (!isConflict(error)) throw error;
        const record = await read(idempotencyContainer, key, key);
        if (record.requestFingerprint && record.requestFingerprint !== requestFingerprint) return { status: 'conflict' };
        if (record.state === 'PermanentFailure') return { status: 'permanent_failure', record };
        if (record.state === 'CredentialIssuing' && Date.parse(record.leaseExpiresAtUtc) > now().getTime()) return { status: 'in_progress', retryAfterMs: 1000 };
        return { status: 'reserved', reservation: record.reservation, record };
      }
    },
    get: (key) => read(idempotencyContainer, key, key),
    async recordReservation(key, reservation) { const record = await read(idempotencyContainer, key, key); return conditionalPatch(idempotencyContainer, record, [{ op: 'set', path: '/state', value: 'SubmissionReserved' }, { op: 'set', path: '/reservation', value: reservation }, { op: 'set', path: '/requestFingerprint', value: reservation.requestFingerprint }]); },
    async beginCredentialIssuance(key, owner, leaseExpiresAtUtc) { const record = await read(idempotencyContainer, key, key); if (record.state === 'CredentialIssuing' && Date.parse(record.leaseExpiresAtUtc) > now().getTime()) return { status: 'in_progress', retryAfterMs: 1000 }; const generation = (record.credentialGeneration || record.reservation?.credentialGeneration || 0) + 1; await conditionalPatch(idempotencyContainer, record, [{ op: 'set', path: '/state', value: 'CredentialIssuing' }, { op: 'set', path: '/leaseOwner', value: owner }, { op: 'set', path: '/leaseExpiresAtUtc', value: leaseExpiresAtUtc }, { op: 'set', path: '/credentialGeneration', value: generation }]); return { status: 'claimed', generation }; },
    async credentialsIssued(key, result, stable) { if (stable === undefined) stable = result; const record = await read(idempotencyContainer, key, key); return conditionalPatch(idempotencyContainer, record, [{ op: 'set', path: '/state', value: 'CredentialsIssued' }, { op: 'set', path: '/stableResult', value: stable }, { op: 'set', path: '/reservation', value: { ...record.reservation, credentialGeneration: stable.credentialGeneration, lastCredentialExpiryUtc: stable.lastCredentialExpiryUtc } }]); },
    async credentialRetryableFailure(key, reason) { const record = await read(idempotencyContainer, key, key); return conditionalPatch(idempotencyContainer, record, [{ op: 'set', path: '/state', value: 'CredentialRetryable' }, { op: 'set', path: '/reason', value: reason }]); },
    async retryableFailure(key, reason) { const record = await read(idempotencyContainer, key, key); if (!record || record.state === 'PermanentFailure') return undefined; return conditionalPatch(idempotencyContainer, record, [{ op: 'set', path: '/state', value: 'RetryableFailure' }, { op: 'set', path: '/reason', value: reason }]); },
    async permanentFailure(key, reason) { const record = await read(idempotencyContainer, key, key); if (!record) return undefined; return conditionalPatch(idempotencyContainer, record, [{ op: 'set', path: '/state', value: 'PermanentFailure' }, { op: 'set', path: '/reason', value: reason }]); }
  };

  function partitionedClaims(prefix) {
    return {
      async claim(args, owner, leaseExpiresAtUtc) {
        const input = typeof args === 'object' ? args : { claimKey: args, leaseOwner: owner, leaseExpiresAtUtc };
        const applicationReference = input.applicationReference;
        const key = input.claimKey || input.eventKey;
        const id = `${prefix}:${key}`;
        const doc = { id, applicationReference, docType: prefix, key, fileReference: input.fileReference, eventId: input.eventId, eventKey: input.eventKey, state: 'Processing', leaseOwner: input.leaseOwner, leaseExpiresAtUtc: input.leaseExpiresAtUtc, attemptCount: 1 };
        try { await submissions.items.create(doc); return { status: 'claimed' }; }
        catch (error) {
          if (!isConflict(error)) throw error;
          const existing = await read(submissions, id, applicationReference);
          if (existing.state === 'Completed') return { status: 'completed', result: existing.result };
          if (existing.state === 'PermanentFailure') return { status: 'permanent_failure', result: existing.result };
          if (Date.parse(existing.leaseExpiresAtUtc) > now().getTime()) return { status: 'in_progress', retryAfterMs: 1000 };
          await conditionalPatch(submissions, existing, [{ op: 'set', path: '/state', value: 'Processing' }, { op: 'set', path: '/leaseOwner', value: input.leaseOwner }, { op: 'set', path: '/leaseExpiresAtUtc', value: input.leaseExpiresAtUtc }, { op: 'incr', path: '/attemptCount', value: 1 }]);
          return { status: 'claimed' };
        }
      },
      complete: (args, result) => { const input = typeof args === 'object' ? args : { claimKey: args }; return submissions.item(`${prefix}:${input.claimKey || input.eventKey}`, input.applicationReference).patch([{ op: 'set', path: '/state', value: 'Completed' }, { op: 'set', path: '/result', value: result }]); },
      retryableFailure: (args, reason) => { const input = typeof args === 'object' ? args : { claimKey: args }; return submissions.item(`${prefix}:${input.claimKey || input.eventKey}`, input.applicationReference).patch([{ op: 'set', path: '/state', value: 'RetryableFailure' }, { op: 'set', path: '/reason', value: reason }]); },
      permanentFailure: (args, reason) => { const input = typeof args === 'object' ? args : { claimKey: args }; return submissions.item(`${prefix}:${input.claimKey || input.eventKey}`, input.applicationReference).patch([{ op: 'set', path: '/state', value: 'PermanentFailure' }, { op: 'set', path: '/reason', value: reason }, { op: 'set', path: '/result', value: { success: false, errorCode: reason } }]); }
    };
  }

  const rateLimiter = {
    async check(key, options = {}) {
      const limit = options.limit || 5;
      const windowSeconds = options.windowSeconds || 300;
      const id = key;
      const current = await read(rateLimits, id, id);
      const resetAt = current?.resetAtUtc ? Date.parse(current.resetAtUtc) : 0;
      if (!current || resetAt <= now().getTime()) {
        await rateLimits.items.upsert({ id, key: id, count: 1, ttl: windowSeconds, resetAtUtc: new Date(now().getTime() + windowSeconds * 1000).toISOString() });
        return { allowed: true, remaining: limit - 1 };
      }
      if (current.count >= limit) return { allowed: false, retryAfterMs: Math.max(1000, resetAt - now().getTime()) };
      await rateLimits.item(id, id).patch([{ op: 'incr', path: '/count', value: 1 }], { accessCondition: { type: 'IfMatch', condition: current._etag } });
      return { allowed: true, remaining: limit - current.count - 1 };
    }
  };

  return { applicationStore, idempotency, completionClaims: partitionedClaims('completion'), scanEvents: partitionedClaims('scan'), rateLimiter, mapCosmosError, async health() { await database.read(); return { ok: true }; } };
}

module.exports = { createCosmosAdapters, mapCosmosError };
