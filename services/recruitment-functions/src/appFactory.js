'use strict';

const crypto = require('crypto');
const { DefaultAzureCredential } = require('@azure/identity');
const {
  initiateApplication,
  completeUpload,
  processScanResult,
  retryQuarantineCleanup
} = require('../../../api/recruitment/core/flows');
const { loadConfig } = require('./lib/config');
const { loadManifest } = require('./lib/manifest');
const { createCosmosAdapters } = require('./adapters/cosmos');
const { createBlobAdapter } = require('./adapters/blob');
const {
  createSecretProvider,
  createTokenAdapter,
  createFingerprintAdapter
} = require('./adapters/secrets');
const { createBotVerifier } = require('./adapters/bot');
const { createRateLimiter } = require('./adapters/rateLimit');

function createDeps(config = loadConfig(), requestContext = {}) {
  const credential = new DefaultAzureCredential();
  const secretProvider = createSecretProvider({ vaultUrl: config.keyVaultUrl, credential });
  const fingerprints = createFingerprintAdapter(secretProvider, config.fingerprintSecretName);
  const cosmos = createCosmosAdapters({
    endpoint: config.cosmosEndpoint,
    databaseId: config.cosmosDatabase,
    credential
  });
  const storage = createBlobAdapter({
    accountUrl: config.storageAccountUrl,
    credential,
    containers: {
      quarantine: config.quarantineContainer,
      clean: config.cleanContainer
    }
  });

  return {
    ...cosmos,
    storage,
    sas: storage,
    tokens: createTokenAdapter(secretProvider, config.completionTokenSecretName),
    fingerprints,
    rateLimiter: createRateLimiter({
      endpoint: config.cosmosEndpoint,
      databaseId: config.cosmosDatabase,
      credential,
      enabled: config.rateLimit.enabled,
      limit: config.rateLimit.limit,
      windowSeconds: config.rateLimit.windowSeconds,
      fingerprint: fingerprints,
      requestContext
    }),
    botVerifier: createBotVerifier({
      mode: config.botVerification.mode,
      environment: config.environment,
      secretProvider,
      secretName: config.botVerification.secretName,
      endpoint: config.botVerification.endpoint,
      expectedHostname: config.botVerification.expectedHostname
    }),
    now: async () => new Date(),
    loadManifest: async () => loadManifest(),
    references: {
      async application() {
        return `SV-APP-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      },
      async file() {
        return `SV-FILE-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      },
      async tokenId() {
        return crypto.randomUUID();
      }
    },
    logger: { async log() {} }
  };
}

module.exports = {
  createDeps,
  flows: { initiateApplication, completeUpload, processScanResult, retryQuarantineCleanup }
};
