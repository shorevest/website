'use strict';

const { app } = require('@azure/functions');
const { loadConfig, validateConfig } = require('../lib/config');
const {
  originAllowed,
  withCors,
  readJson,
  requestContext,
  candidate,
  unavailable
} = require('../lib/http');
const { createDeps, flows } = require('../appFactory');
const { normalizeEventGridEvent } = require('../lib/eventGrid');
const { accessCleanDocument } = require('../hr/documentAccess');
const { updateRetentionControl } = require('../hr/retentionControl');
const { runPolicyAssignment, runRetentionPurge } = require('../retention/worker');

async function httpFlow(req, context, flow, options = {}) {
  const config = loadConfig();
  if (!config.apiEnabled) return unavailable(req, config);
  if (req.method !== 'POST') {
    return {
      status: 405,
      headers: withCors(req, config),
      jsonBody: { success: false, errorCode: 'METHOD_NOT_ALLOWED' }
    };
  }
  if (!originAllowed(req, config)) {
    return {
      status: 403,
      headers: withCors(req, config),
      jsonBody: { success: false, errorCode: 'FORBIDDEN' }
    };
  }

  const parsed = await readJson(req, config);
  if (parsed.error) return { ...parsed.error, headers: withCors(req, config) };
  if (!parsed.body || typeof parsed.body !== 'object' || Array.isArray(parsed.body)) {
    return {
      status: 400,
      headers: withCors(req, config),
      jsonBody: { success: false, errorCode: 'VALIDATION_FAILED' }
    };
  }

  const trustedContext = requestContext(req);
  if (options.attachRequestContext === true) {
    parsed.body._requestContext = trustedContext;
  }

  try {
    const dependencies = createDeps(config, trustedContext);
    const result = await flow(parsed.body, dependencies);
    return {
      status: result.success ? 200 : 400,
      headers: withCors(req, config),
      jsonBody: candidate(result)
    };
  } catch (error) {
    context.error('recruitment_http_failed', { code: error.code });
    return {
      status: 500,
      headers: withCors(req, config),
      jsonBody: { success: false, errorCode: 'SUBMISSION_FAILED' }
    };
  }
}

app.http('initiateApplication', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recruitment/applications/initiate',
  handler: (req, context) => httpFlow(req, context, flows.initiateApplication, { attachRequestContext: true })
});

app.http('completeUpload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recruitment/applications/complete',
  handler: (req, context) => httpFlow(req, context, flows.completeUpload)
});

app.http('finalizeApplication', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recruitment/applications/finalize',
  handler: (req, context) => httpFlow(req, context, flows.finalizeApplication)
});

app.http('hrCleanDocumentAccess', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'recruitment/hr/applications/{applicationReference}/files/{fileReference}/access',
  handler: async (req, context) => {
    const config = loadConfig();
    try {
      const dependencies = createDeps(config);
      const result = await accessCleanDocument(req, config, dependencies);
      return {
        ...result,
        headers: withCors(req, config)
      };
    } catch (error) {
      context.error('recruitment_hr_document_access_failed', { code: error.code });
      return {
        status: 500,
        headers: withCors(req, config),
        jsonBody: { success: false, errorCode: 'HR_DOCUMENT_ACCESS_FAILED' }
      };
    }
  }
});

app.http('hrRetentionControl', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'recruitment/hr/applications/{applicationReference}/retention',
  handler: async (req, context) => {
    const config = loadConfig();
    const parsed = await readJson(req, config);
    if (parsed.error) return { ...parsed.error, headers: withCors(req, config) };
    if (!parsed.body || typeof parsed.body !== 'object' || Array.isArray(parsed.body)) {
      return {
        status: 400,
        headers: withCors(req, config),
        jsonBody: { success: false, errorCode: 'RETENTION_CONTROL_INVALID' }
      };
    }
    try {
      const dependencies = createDeps(config);
      const result = await updateRetentionControl(req, config, dependencies, parsed.body);
      return { ...result, headers: withCors(req, config) };
    } catch (error) {
      context.error('recruitment_retention_control_failed', { code: error.code });
      return {
        status: 500,
        headers: withCors(req, config),
        jsonBody: { success: false, errorCode: 'RETENTION_CONTROL_FAILED' }
      };
    }
  }
});

app.eventGrid('defenderScanResult', {
  handler: async (event, context) => {
    const config = loadConfig();
    try {
      const normalized = normalizeEventGridEvent(event, config);
      const dependencies = createDeps(config);
      return flows.processScanResult(normalized, dependencies);
    } catch (error) {
      context.warn('recruitment_scan_event_rejected', { reason: error.message });
      return undefined;
    }
  }
});

app.timer('quarantineCleanup', {
  schedule: '0 */10 * * * *',
  handler: async (_, context) => {
    const dependencies = createDeps(loadConfig());
    const batch = await dependencies.applicationStore.claimCleanupBatch({
      limit: 10,
      owner: context.invocationId,
      leaseExpiresAtUtc: new Date(Date.now() + 300000).toISOString()
    });
    for (const file of batch) {
      await flows.retryQuarantineCleanup({ fileReference: file.fileReference }, dependencies);
    }
  }
});

app.timer('retentionPolicyAssignment', {
  schedule: '0 15 * * * *',
  handler: async (_, context) => {
    const config = loadConfig();
    if (config.retention.enabled !== true) {
      context.log('recruitment_retention_disabled');
      return;
    }
    await runPolicyAssignment(config, createDeps(config), context);
  }
});

app.timer('retentionPurge', {
  schedule: '0 45 * * * *',
  handler: async (_, context) => {
    const config = loadConfig();
    if (config.retention.enabled !== true || config.retention.deletionEnabled !== true) {
      context.log('recruitment_retention_deletion_disabled');
      return;
    }
    await runRetentionPurge(config, createDeps(config), context);
  }
});

app.timer('outboxWorker', {
  schedule: '0 */5 * * * *',
  handler: async (_, context) => {
    const config = loadConfig();
    if (config.outboxDelivery.enabled !== true) {
      context.log('recruitment_outbox_delivery_disabled');
      return;
    }

    const dependencies = createDeps(config);
    if (!dependencies.outboxDispatcher || typeof dependencies.outboxDispatcher.deliver !== 'function') {
      throw Object.assign(new Error('Recruitment outbox dispatcher is not configured'), {
        code: 'INTERNAL_CONFIGURATION_ERROR'
      });
    }

    const now = Date.now();
    const batch = await dependencies.applicationStore.claimOutboxBatch({
      limit: 10,
      owner: context.invocationId,
      leaseExpiresAtUtc: new Date(now + config.outboxDelivery.leaseSeconds * 1000).toISOString()
    });

    for (const event of batch) {
      try {
        const delivery = await dependencies.outboxDispatcher.deliver(event, dependencies);
        const durableEvent = delivery?.event || event;
        await dependencies.applicationStore.completeOutboxEvent(durableEvent, delivery || {});
      } catch (error) {
        const durableEvent = error.event || event;
        if ((durableEvent.attemptCount || 0) >= config.outboxDelivery.maxAttempts || error.permanent === true) {
          await dependencies.applicationStore.failOutboxEvent(
            durableEvent,
            error.code || 'DELIVERY_FAILED'
          );
          continue;
        }
        const providerDelay = Number(error.retryAfterMs || 0);
        const retryDelay = Math.max(
          config.outboxDelivery.retrySeconds * 1000,
          Number.isFinite(providerDelay) ? providerDelay : 0
        );
        await dependencies.applicationStore.retryOutboxEvent(
          durableEvent,
          error.code || 'DELIVERY_RETRYABLE',
          new Date(Date.now() + retryDelay).toISOString()
        );
      }
    }
  }
});

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'recruitment/health',
  handler: async (req) => {
    const config = loadConfig();
    const shape = validateConfig(config);
    return {
      status: shape.ok ? 200 : 503,
      headers: withCors(req, config),
      jsonBody: {
        ok: shape.ok,
        runtime: 'active',
        configuration: shape.ok ? 'valid' : 'invalid'
      }
    };
  }
});
