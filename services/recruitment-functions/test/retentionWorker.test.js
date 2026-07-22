'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  runPolicyAssignment,
  runRetentionPurge
} = require('../src/retention/worker');

function context() {
  return {
    invocationId: 'worker-1',
    warnings: [],
    warn(event, fields) {
      this.warnings.push({ event, fields });
    }
  };
}

test('retention workers do nothing while the feature is disabled', async () => {
  let called = false;
  const dependencies = {
    retention: {
      async listPolicyCandidates() {
        called = true;
      },
      async claimDueBatch() {
        called = true;
      }
    }
  };

  assert.deepEqual(await runPolicyAssignment({ retention: { enabled: false } }, dependencies, context()), {
    assigned: 0,
    skipped: true
  });
  assert.deepEqual(await runRetentionPurge({
    retention: { enabled: true, deletionEnabled: false }
  }, dependencies, context()), {
    purged: 0,
    skipped: true
  });
  assert.equal(called, false);
});

test('policy assignment processes each candidate independently', async () => {
  const assigned = [];
  const ctx = context();
  const result = await runPolicyAssignment({
    retention: {
      enabled: true,
      policyVersion: 'retention-v1',
      batchSize: 10
    }
  }, {
    retention: {
      async listPolicyCandidates(input) {
        assert.deepEqual(input, { limit: 10, policyVersion: 'retention-v1' });
        return ['APP-1', 'APP-2', 'APP-3'];
      },
      async applyPolicy(reference) {
        if (reference === 'APP-2') throw Object.assign(new Error('conflict'), { code: 'RETENTION_CONFLICT' });
        assigned.push(reference);
        return { status: reference === 'APP-3' ? 'current' : 'updated' };
      }
    }
  }, ctx);

  assert.deepEqual(assigned, ['APP-1', 'APP-3']);
  assert.deepEqual(result, { assigned: 1, examined: 3 });
  assert.equal(ctx.warnings.length, 1);
  assert.equal(ctx.warnings[0].fields.applicationReference, 'APP-2');
});

test('purge claims due applications and deletes each independently', async () => {
  const purged = [];
  const released = [];
  const ctx = context();
  const config = {
    quarantineContainer: 'recruitment-quarantine',
    cleanContainer: 'recruitment-clean',
    retention: {
      enabled: true,
      deletionEnabled: true,
      batchSize: 5,
      leaseSeconds: 900,
      retrySeconds: 3600
    }
  };
  const result = await runRetentionPurge(config, {
    storage: {},
    retention: {
      async claimDueBatch(input) {
        assert.equal(input.limit, 5);
        assert.equal(input.owner, 'worker-1');
        assert.ok(Date.parse(input.leaseExpiresAtUtc) > Date.now());
        return [
          { applicationReference: 'APP-1' },
          { applicationReference: 'APP-2' }
        ];
      },
      async purge(application, storage, containers) {
        assert.deepEqual(containers, {
          quarantine: 'recruitment-quarantine',
          clean: 'recruitment-clean'
        });
        if (application.applicationReference === 'APP-2') {
          throw Object.assign(new Error('storage unavailable'), { code: 'STORAGE_UNAVAILABLE' });
        }
        purged.push(application.applicationReference);
      },
      async release(application, code, retryAtUtc) {
        released.push({ applicationReference: application.applicationReference, code, retryAtUtc });
      }
    }
  }, ctx);

  assert.deepEqual(purged, ['APP-1']);
  assert.equal(released.length, 1);
  assert.equal(released[0].applicationReference, 'APP-2');
  assert.equal(released[0].code, 'STORAGE_UNAVAILABLE');
  assert.ok(Date.parse(released[0].retryAtUtc) > Date.now());
  assert.deepEqual(result, { purged: 1, examined: 2 });
  assert.equal(ctx.warnings.length, 1);
});
