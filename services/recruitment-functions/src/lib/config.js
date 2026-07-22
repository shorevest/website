'use strict';

function bool(value) {
  return String(value || '').toLowerCase() === 'true';
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function loadConfig(env = process.env) {
  const environment = env.RECRUITMENT_ENVIRONMENT || 'production';
  const production = environment === 'production' || environment === 'prod';
  const origins = (env.RECRUITMENT_ALLOWED_ORIGINS || (production ? 'https://shorevest.com,https://www.shorevest.com' : ''))
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    apiEnabled: bool(env.RECRUITMENT_API_ENABLED),
    environment,
    allowedOrigins: origins,
    requireOrigin: env.RECRUITMENT_REQUIRE_ORIGIN == null ? production : bool(env.RECRUITMENT_REQUIRE_ORIGIN),
    maxBodyBytes: positiveInteger(env.RECRUITMENT_MAX_BODY_BYTES, 65536),
    managedIdentityClientId: env.RECRUITMENT_MANAGED_IDENTITY_CLIENT_ID || env.AZURE_CLIENT_ID,
    cosmosEndpoint: env.RECRUITMENT_COSMOS_ENDPOINT,
    cosmosDatabase: env.RECRUITMENT_COSMOS_DATABASE,
    storageAccountUrl: env.RECRUITMENT_STORAGE_ACCOUNT_URL,
    keyVaultUrl: env.RECRUITMENT_KEYVAULT_URL,
    completionTokenSecretName: env.RECRUITMENT_COMPLETION_TOKEN_SECRET_NAME,
    fingerprintSecretName: env.RECRUITMENT_FINGERPRINT_SECRET_NAME,
    quarantineContainer: env.RECRUITMENT_QUARANTINE_CONTAINER || 'recruitment-quarantine',
    cleanContainer: env.RECRUITMENT_CLEAN_CONTAINER || 'recruitment-clean',
    uploadStorageAccountName: env.RECRUITMENT_UPLOAD_STORAGE_ACCOUNT_NAME,
    rateLimit: {
      enabled: bool(env.RECRUITMENT_RATE_LIMIT_ENABLED),
      limit: positiveInteger(env.RECRUITMENT_RATE_LIMIT_COUNT, 5),
      windowSeconds: positiveInteger(env.RECRUITMENT_RATE_LIMIT_WINDOW_SECONDS, 300)
    },
    botVerification: {
      mode: (env.RECRUITMENT_BOT_VERIFICATION_MODE || 'disabled').toLowerCase(),
      secretName: env.RECRUITMENT_BOT_VERIFICATION_SECRET_NAME,
      endpoint: env.RECRUITMENT_BOT_VERIFICATION_ENDPOINT || 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expectedHostname: env.RECRUITMENT_BOT_VERIFICATION_HOSTNAME || ''
    },
    outboxDelivery: {
      enabled: bool(env.RECRUITMENT_OUTBOX_DELIVERY_ENABLED),
      leaseSeconds: positiveInteger(env.RECRUITMENT_OUTBOX_LEASE_SECONDS, 300),
      retrySeconds: positiveInteger(env.RECRUITMENT_OUTBOX_RETRY_SECONDS, 900),
      maxAttempts: positiveInteger(env.RECRUITMENT_OUTBOX_MAX_ATTEMPTS, 10)
    }
  };
}

function validateConfig(config) {
  const missing = [];
  const invalid = [];

  for (const key of [
    'cosmosEndpoint',
    'cosmosDatabase',
    'storageAccountUrl',
    'keyVaultUrl',
    'completionTokenSecretName',
    'fingerprintSecretName'
  ]) {
    if (!config[key]) missing.push(key);
  }

  if (!Array.isArray(config.allowedOrigins) || config.allowedOrigins.length === 0) {
    invalid.push('allowedOrigins');
  }

  if (!['disabled', 'turnstile'].includes(config.botVerification?.mode)) {
    invalid.push('botVerification.mode');
  }

  if (config.apiEnabled) {
    if (!config.managedIdentityClientId) missing.push('managedIdentityClientId');
    if (config.rateLimit?.enabled !== true) invalid.push('rateLimit.enabled');
    if (config.botVerification?.mode !== 'turnstile') invalid.push('botVerification.mode');
    if (!config.botVerification?.secretName) missing.push('botVerification.secretName');
    if (config.outboxDelivery?.enabled !== true) invalid.push('outboxDelivery.enabled');
  }

  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid };
}

module.exports = { bool, positiveInteger, loadConfig, validateConfig };
