'use strict';

/** Shared test harness: an in-memory app + seeded data, plus a fresh clock. */

const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildConfig } = require('../../server/config');
const { createApp } = require('../../server/services/container');
const { seed } = require('../../server/seed/seed');

function newApp(mode = 'MOCK') {
  // Use a unique temp file so each test is isolated and can restart.
  const dbFile = path.join(os.tmpdir(), `svone-test-${crypto.randomUUID()}.db`);
  const env = { SHOREVEST_ONE_MODE: mode, SHOREVEST_ONE_DB: dbFile };
  const config = buildConfig(env);
  const app = createApp(config, {});
  seed(app, { reset: true });
  return { app, dbFile, env };
}

/** Reopen the same database file — simulates a server / browser restart. */
function reopen(dbFile, mode = 'MOCK') {
  const config = buildConfig({ SHOREVEST_ONE_MODE: mode, SHOREVEST_ONE_DB: dbFile });
  return createApp(config, {});
}

function userByRole(app, role) {
  return app.repos.users.findOne({ role });
}

module.exports = { newApp, reopen, userByRole };
