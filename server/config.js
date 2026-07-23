'use strict';

/**
 * ShoreVest One — runtime configuration and environment modes.
 *
 * The environment mode governs the connector boundary. It is the single switch
 * that later moves the product from fictional data + mock connectors to real
 * Salesforce / Microsoft Graph / SharePoint / Power Automate connections.
 *
 * No secrets, tenant IDs, or credentials live in this file. Real values are
 * supplied through environment variables at deploy time (see `.env.example`).
 */

const path = require('node:path');

const MODES = Object.freeze({
  MOCK: 'MOCK',
  CONNECTED_READ_ONLY: 'CONNECTED_READ_ONLY',
  CONNECTED_CONTROLLED: 'CONNECTED_CONTROLLED',
});

function resolveMode(raw) {
  const value = String(raw || '').trim().toUpperCase();
  if (MODES[value]) return MODES[value];
  return MODES.MOCK;
}

function buildConfig(env = process.env) {
  const mode = resolveMode(env.SHOREVEST_ONE_MODE);
  const repoRoot = path.resolve(__dirname, '..');
  const appDir = path.join(repoRoot, 'app');
  const portalDir = path.join(repoRoot, 'employee-portal');

  return Object.freeze({
    mode,
    modes: MODES,

    /** Whether external writes / execution are *permitted by the environment*. */
    externalWritesEnabled: mode === MODES.CONNECTED_CONTROLLED,
    /** Whether external reads are permitted by the environment. */
    externalReadsEnabled: mode !== MODES.MOCK,

    host: env.SHOREVEST_ONE_HOST || '127.0.0.1',
    port: Number(env.SHOREVEST_ONE_PORT || env.PORT || 4319),

    // Persistence. In MOCK/dev a file-backed SQLite database. Tests override
    // this with ':memory:' or a temp file for isolation.
    databaseFile: env.SHOREVEST_ONE_DB || path.join(repoRoot, 'server', '.data', 'shorevest-one.db'),

    // Compact environment banner shown in the UI.
    banner: bannerFor(mode),

    repoRoot,

    // The established employee portal is the primary Azure frontend. The newer
    // server-backed shell remains available under /app/ while its API-backed
    // views are migrated into the established interface.
    appDir,
    portalDir,
    portalEntry: path.join(portalDir, '/'),
    assetsDir: path.join(repoRoot, 'assets'),
    publicFiles: Object.freeze({
      '/favicon.ico': path.join(repoRoot, 'favicon.ico'),
      '/site.webmanifest': path.join(repoRoot, 'site.webmanifest'),
      '/site-20260722.webmanifest': path.join(repoRoot, 'site-20260722.webmanifest'),
      '/robots.txt': path.join(repoRoot, 'robots.txt'),
    }),

    // Connector configuration placeholders. Real values arrive via env vars.
    // Presence of a value does NOT enable writes — the mode does.
    connectors: {
      salesforce: {
        instanceUrl: env.SF_INSTANCE_URL || '',
        clientId: env.SF_CLIENT_ID || '',
      },
      graph: {
        tenantId: env.GRAPH_TENANT_ID || '',
        clientId: env.GRAPH_CLIENT_ID || '',
      },
      sharepoint: {
        siteUrl: env.SP_SITE_URL || '',
      },
      powerAutomate: {
        approvalFlowUrl: env.PA_APPROVAL_FLOW_URL || '',
        executionFlowUrl: env.PA_EXECUTION_FLOW_URL || '',
      },
    },
  });
}

function bannerFor(mode) {
  switch (mode) {
    case MODES.CONNECTED_CONTROLLED:
      return 'Connected · Controlled execution · Approved writes on';
    case MODES.CONNECTED_READ_ONLY:
      return 'Connected · Read only · External execution off';
    case MODES.MOCK:
    default:
      return 'Internal Preview · Mock connectors · External execution off';
  }
}

module.exports = { MODES, resolveMode, buildConfig, bannerFor };
