'use strict';

/**
 * Stable, prefixed, sortable IDs. Deterministic seeding uses `seededId` so the
 * same seed run always produces the same object IDs (tests depend on this).
 */

const crypto = require('node:crypto');

let counter = 0;

function id(prefix) {
  counter += 1;
  const time = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
}

/** Deterministic ID derived from a stable natural key — used by the seeder. */
function seededId(prefix, key) {
  const hash = crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 12);
  return `${prefix}_${hash}`;
}

module.exports = { id, seededId };
