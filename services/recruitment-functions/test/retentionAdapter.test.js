'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  redactApplication,
  redactFile,
  createRetentionAdapter
} = require('../src/adapters/retention');

function fakeClient(seed = {}) {
  const submissions = new Map();
  const idempotency = new Map();
  let etag = 1;

  function recordKey(partitionKey, id) {
    return `${partitionKey}::${id}`;
  }

  for (const document of seed.submissions || []) {
    submissions.set(recordKey(document.applicationReference, document.id), {
      ...document,
      _etag: document._etag || `etag-${etag++}`
    });
  }
  for (const document of seed.idempotency || []) {
    idempotency.set(recordKey(document.idempotencyKey, document.id), {
      ...document,
      _etag: document._etag || `etag-${etag++}`
    });
  }

  function container(records, name) {
    return {
      records,
      items: {
        query(spec, options = {}) {
          return {
            async fetchAll() {
              let values = [...records.values()];
              if (options.partitionKey) {
                values = values.filter((item) => item.applicationReference === options.partitionKey);
              }
              if (spec.query.includes("c.docType = @type")) {
                values = values.filter((item) => item.docType === 'file');
              }
              if (spec.query.includes('c.retentionDeleteAfterUtc <= @now')) {
                const now = spec.parameters.find((item) => item.name === '@now').value;
                values = values.filter((item) =>
                  item.docType === 'application' &&
                  item.retentionState === 'Active' &&
                  item.legalHold !== true &&
                  item.retentionDeleteAfterUtc <= now
                );
              }
              if (spec.query.includes('c.retentionPolicyVersion')) {
                values = values
                  .filter((item) => item.docType === 'application')
                  .map((item) => ({ applicationReference: item.applicationReference }));
              }
              return { resources: values };
            }
          };
        },
        async batch(operations, partitionKey) {
          for (const operation of operations) {
            if (operation.operationType === 'Replace') {
              const key = recordKey(partitionKey, operation.id);
              const current = records.get(key);
              if (!current || current._etag !== operation.ifMatch) {
                return { result: [{ statusCode: 412 }] };
              }
              records.set(key, {
                ...operation.resourceBody,
                _etag: `etag-${etag++}`
              });
            } else if (operation.operationType === 'Create') {
              const body = operation.resourceBody;
              records.set(recordKey(partitionKey, body.id), {
                ...body,
                _etag: `etag-${etag++}`
              });
            }
          }
          return { result: operations.map(() => ({ statusCode: 200 })) };
        }
      },
      item(id, partitionKey) {
        return {
          async read() {
            const resource = records.get(recordKey(partitionKey, id));
            if (!resource) throw Object.assign(new Error('not found'), { code: 404 });
            return { resource: { ...resource } };
          },
          async replace(body, options = {}) {
            const key = recordKey(partitionKey, id);
            const current = records.get(key);
            if (!current) throw Object.assign(new Error('not found'), { code: 404 });
            if (options.accessCondition?.condition !== current._etag) {
              throw Object.assign(new Error('precondition failed'), { code: 412 });
            }
            const resource = { ...body, _etag: `etag-${etag++}` };
            records.set(key, resource);
            return { resource };
          },
          async delete() {
            const deleted = records.delete(recordKey(partitionKey, id));
            if (!deleted) throw Object.assign(new Error('not found'), { code: 404 });
            return {};
          }
        };
      }
    };
  }

  return {
    submissions,
    idempotency,
    database() {
      return {
        container(name) {
          return name === 'submissions'
            ? container(submissions, name)
            : container(idempotency, name);
        }
      };
    }
  };
}

function application(patch = {}) {
  return {
    id: 'application',
    docType: 'application',
    applicationReference: 'SV-APP-2026-ABC123',
    idempotencyKey: 'init:legal-assistant:uuid',
    aggregateVersion: 4,
    candidateName: 'Candidate Name',
    candidateEmail: 'candidate@example.com',
    candidateTelephone: '+1 212 555 0100',
    candidateLocation: 'New York, US',
    linkedInUrl: 'https://linkedin.example/candidate',
    coverNote: 'private note',
    requestFingerprint: 'fingerprint',
    candidateSubmissionStatus: 'Submitted',
    technicalStatus: 'Ready',
    hiringStage: 'New',
    retentionState: 'Processing',
    retentionDeleteAfterUtc: '2026-07-22T00:00:00.000Z',
    legalHold: false,
    ...patch
  };
}

function file(patch = {}) {
  return {
    id: 'file:SV-FILE-ABC12345',
    docType: 'file',
    applicationReference: 'SV-APP-2026-ABC123',
    fileReference: 'SV-FILE-ABC12345',
    originalFileName: 'candidate-cv.pdf',
    expectedHash: 'a'.repeat(64),
    quarantineBlobPath: 'recruitment/quarantine/cv.pdf',
    cleanBlobPath: 'recruitment/clean/cv.pdf',
    requestFingerprint: 'fingerprint',
    technicalStatus: 'Ready',
    legalHold: false,
    ...patch
  };
}

test('redaction removes candidate PII and document paths while preserving audit references', () => {
  const redactedApplication = redactApplication(application(), '2026-07-22T01:00:00.000Z');
  assert.equal(redactedApplication.applicationReference, 'SV-APP-2026-ABC123');
  assert.equal(redactedApplication.candidateName, '[deleted]');
  assert.equal(redactedApplication.candidateEmail, null);
  assert.equal(redactedApplication.coverNote, null);
  assert.equal(redactedApplication.technicalStatus, 'Deleted');
  assert.equal(redactedApplication.retentionState, 'Purged');

  const redactedFile = redactFile(file(), '2026-07-22T01:00:00.000Z');
  assert.equal(redactedFile.fileReference, 'SV-FILE-ABC12345');
  assert.equal(redactedFile.originalFileName, '[deleted]');
  assert.equal(redactedFile.quarantineBlobPath, null);
  assert.equal(redactedFile.cleanBlobPath, null);
  assert.equal(redactedFile.technicalStatus, 'Removed');
});

test('legal hold prevents any Blob deletion or redaction', async () => {
  const client = fakeClient({
    submissions: [application({ legalHold: true }), file()]
  });
  const adapter = createRetentionAdapter({
    client,
    databaseId: 'recruitment',
    now: () => new Date('2026-07-22T01:00:00.000Z')
  });
  let deletes = 0;
  await assert.rejects(
    () => adapter.purge(application({ legalHold: true }), {
      async delete() { deletes += 1; }
    }, {
      quarantine: 'recruitment-quarantine',
      clean: 'recruitment-clean'
    }),
    (error) => error.code === 'LEGAL_HOLD_ACTIVE' && error.permanent === true
  );
  assert.equal(deletes, 0);
  assert.equal(client.submissions.get('SV-APP-2026-ABC123::application').candidateEmail, 'candidate@example.com');
});

test('purge deletes both Blob copies, redacts Cosmos, removes idempotency and emits projection event', async () => {
  const client = fakeClient({
    submissions: [application(), file()],
    idempotency: [{
      id: 'init:legal-assistant:uuid',
      idempotencyKey: 'init:legal-assistant:uuid',
      state: 'CredentialsIssued'
    }]
  });
  const adapter = createRetentionAdapter({
    client,
    databaseId: 'recruitment',
    now: () => new Date('2026-07-22T01:00:00.000Z')
  });
  const deleted = [];
  const result = await adapter.purge(application(), {
    async delete(container, path) {
      deleted.push({ container, path });
      return true;
    }
  }, {
    quarantine: 'recruitment-quarantine',
    clean: 'recruitment-clean'
  });

  assert.deepEqual(deleted, [
    { container: 'recruitment-quarantine', path: 'recruitment/quarantine/cv.pdf' },
    { container: 'recruitment-clean', path: 'recruitment/clean/cv.pdf' }
  ]);
  assert.equal(result.success, true);
  assert.equal(result.filesPurged, 1);

  const redactedApplication = client.submissions.get('SV-APP-2026-ABC123::application');
  const redactedFile = client.submissions.get('SV-APP-2026-ABC123::file:SV-FILE-ABC12345');
  assert.equal(redactedApplication.candidateEmail, null);
  assert.equal(redactedApplication.retentionState, 'Purged');
  assert.equal(redactedFile.cleanBlobPath, null);
  assert.equal(redactedFile.retentionState, 'Purged');
  assert.equal(client.idempotency.size, 0);

  const outbox = [...client.submissions.values()].find((item) => item.type === 'RetentionPurged');
  assert.ok(outbox);
  assert.equal(outbox.applicationReference, 'SV-APP-2026-ABC123');
  assert.equal(outbox.state, 'Pending');
});

test('due-application claims skip held records and use conditional leases', async () => {
  const client = fakeClient({
    submissions: [
      application({ applicationReference: 'APP-DUE', idempotencyKey: 'due', retentionState: 'Active' }),
      application({ applicationReference: 'APP-HELD', idempotencyKey: 'held', retentionState: 'Active', legalHold: true })
    ]
  });
  const adapter = createRetentionAdapter({
    client,
    databaseId: 'recruitment',
    now: () => new Date('2026-07-22T01:00:00.000Z')
  });
  const claimed = await adapter.claimDueBatch({
    limit: 10,
    owner: 'worker-1',
    leaseExpiresAtUtc: '2026-07-22T01:15:00.000Z'
  });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].applicationReference, 'APP-DUE');
  assert.equal(claimed[0].retentionState, 'Processing');
  assert.equal(claimed[0].retentionLeaseOwner, 'worker-1');
});
