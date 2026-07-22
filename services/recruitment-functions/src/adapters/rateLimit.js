'use strict';

function errorCode(error) {
  return error?.code || error?.statusCode;
}

function createRateLimiter({
  endpoint,
  databaseId,
  credential,
  client,
  enabled = false,
  limit = 5,
  windowSeconds = 300,
  fingerprint,
  requestContext = {},
  now = () => new Date()
} = {}) {
  const cosmosClient = client || (
    endpoint && credential
      ? new (require('@azure/cosmos').CosmosClient)({ endpoint, aadCredentials: credential })
      : null
  );
  const container = cosmosClient?.database(databaseId).container('rateLimits');

  return {
    async check() {
      if (!enabled) return { allowed: true };
      if (!container || !fingerprint || typeof fingerprint.hmac !== 'function') {
        const error = new Error('rate limiter unavailable');
        error.code = 'INTERNAL_CONFIGURATION_ERROR';
        throw error;
      }

      const identity = {
        clientIp: requestContext.clientIp || 'unknown-app-service-client'
      };
      const digest = await fingerprint.hmac(JSON.stringify({
        scope: 'application-initiate',
        identity
      }));
      const currentTime = now();
      const nowSeconds = Math.floor(currentTime.getTime() / 1000);
      const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
      const windowEnd = windowStart + windowSeconds;
      const key = `init:${digest}:${windowStart}`;
      const retryAfterMs = Math.max(1000, (windowEnd - nowSeconds) * 1000);
      const initial = {
        id: key,
        key,
        docType: 'rateLimit',
        count: 1,
        windowStartUtc: new Date(windowStart * 1000).toISOString(),
        windowEndUtc: new Date(windowEnd * 1000).toISOString(),
        ttl: windowSeconds + 60
      };

      try {
        await container.items.create(initial);
        return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterMs: 0 };
      } catch (error) {
        if (errorCode(error) !== 409) throw error;
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await container.item(key, key).read();
        const record = response?.resource;
        if (!record) continue;
        if ((record.count || 0) >= limit) return { allowed: false, remaining: 0, retryAfterMs };

        const replacement = { ...record, count: (record.count || 0) + 1 };
        try {
          await container.item(key, key).replace(replacement, {
            accessCondition: { type: 'IfMatch', condition: record._etag }
          });
          return {
            allowed: true,
            remaining: Math.max(0, limit - replacement.count),
            retryAfterMs: 0
          };
        } catch (error) {
          if (errorCode(error) !== 412) throw error;
        }
      }

      const error = new Error('rate limit contention');
      error.code = 'INFRASTRUCTURE_RETRYABLE';
      throw error;
    }
  };
}

module.exports = { createRateLimiter };
