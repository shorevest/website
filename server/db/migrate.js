'use strict';

/** CLI: `node server/db/migrate.js` — applies pending migrations. */

const { buildConfig } = require('../config');
const { openDatabase } = require('./database');

function main() {
  const config = buildConfig();
  const db = openDatabase(config.databaseFile); // runs migrations on open
  const applied = db.prepare('SELECT id FROM _migrations ORDER BY id').all().map((r) => r.id);
  db.close();
  // eslint-disable-next-line no-console
  console.log('Migrations applied:', applied.join(', ') || '(none)');
}

main();
