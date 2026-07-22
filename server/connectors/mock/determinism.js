'use strict';

const crypto = require('node:crypto');

/** Deterministic 0..1 value from a string key — stable across runs/restarts. */
function ratio(key) {
  const hex = crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
}

/** Deterministic boolean: true for `share` fraction of keys. */
function chance(key, share) {
  return ratio(key) < share;
}

module.exports = { ratio, chance };
