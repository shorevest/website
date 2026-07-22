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

app.timer('outboxWorker', {
  schedule: '0 */5 * * * *',
  handler: async (_, context) => {
    const dependencies = createDeps(loadConfig());
    const batch = await dependencies.applicationStore.claimOutboxBatch({
      limit: 10,
      owner: context.invocationId
    });
    for (const event of batch) {
      await dependencies.applicationStore.markOutboxAttempt(event, 'Pending');
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
