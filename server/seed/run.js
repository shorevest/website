'use strict';

/** CLI: `node server/seed/run.js` — (re)seeds the MOCK database deterministically. */

const { buildConfig } = require('../config');
const { createApp } = require('../services/container');
const { seed } = require('./seed');

function main() {
  const config = buildConfig();
  const app = createApp(config, {});
  const reset = !process.argv.includes('--no-reset');
  const result = seed(app, { reset });
  app.close();
  // eslint-disable-next-line no-console
  console.log('Seeded ShoreVest One (deterministic):', JSON.stringify(result));
}

main();
