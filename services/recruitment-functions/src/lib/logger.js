'use strict';

const SAFE_FIELDS = new Set([
  'applicationReference',
  'fileReference',
  'roleId',
  'credentialGeneration',
  'idempotencyKey',
  'eventId',
  'errorCode',
  'status',
  'outcome',
  'attemptCount',
  'deliveryType',
  'retentionCategory',
  'retentionState',
  'legalHold',
  'policyVersion',
  'worker'
]);

const MAX_EVENT_LENGTH = 80;
const MAX_STRING_LENGTH = 160;

function safeEventName(value) {
  const event = String(value || '').trim();
  if (!/^[a-z][a-z0-9_]{0,79}$/.test(event)) return 'recruitment_event';
  return event.slice(0, MAX_EVENT_LENGTH);
}

function safeValue(value) {
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return undefined;
}

function sanitizeFields(fields) {
  const output = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (!SAFE_FIELDS.has(key)) continue;
    const safe = safeValue(value);
    if (safe !== undefined) output[key] = safe;
  }
  return output;
}

function createStructuredLogger({ sink = console, now = () => new Date() } = {}) {
  if (!sink || typeof sink.log !== 'function') {
    throw new TypeError('logger sink must expose log()');
  }

  return {
    async log(event, fields = {}) {
      const payload = {
        timestampUtc: now().toISOString(),
        event: safeEventName(event),
        ...sanitizeFields(fields)
      };
      sink.log(JSON.stringify(payload));
      return payload;
    }
  };
}

module.exports = {
  SAFE_FIELDS,
  MAX_EVENT_LENGTH,
  MAX_STRING_LENGTH,
  safeEventName,
  sanitizeFields,
  createStructuredLogger
};
