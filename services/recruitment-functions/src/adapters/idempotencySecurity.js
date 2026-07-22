'use strict';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sanitizeIdempotencyRecord(record) {
  if (!record || typeof record !== 'object') return record;
  const sanitized = clone(record);
  delete sanitized.result;
  delete sanitized.upload;
  delete sanitized.completionToken;
  if (sanitized.record && typeof sanitized.record === 'object') {
    delete sanitized.record.result;
    delete sanitized.record.upload;
    delete sanitized.record.completionToken;
  }
  return sanitized;
}

function secureIdempotencyAdapter(idempotency) {
  if (!idempotency || typeof idempotency.credentialsIssued !== 'function') {
    throw new Error('idempotency adapter unavailable');
  }

  return {
    ...idempotency,
    async claim(...args) {
      return sanitizeIdempotencyRecord(await idempotency.claim(...args));
    },
    async get(...args) {
      return sanitizeIdempotencyRecord(await idempotency.get(...args));
    },
    async credentialsIssued(key, _credentialResult, stableResult) {
      return idempotency.credentialsIssued(key, null, stableResult);
    }
  };
}

module.exports = {
  sanitizeIdempotencyRecord,
  secureIdempotencyAdapter
};
