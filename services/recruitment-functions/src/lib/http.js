'use strict';

const crypto = require('node:crypto');

const SAFE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'"
};

function header(req, name) {
  return req.headers && typeof req.headers.get === 'function' ? req.headers.get(name) : req.headers?.[name];
}

function originAllowed(req, cfg) {
  const origin = header(req, 'origin');
  return !origin || cfg.allowedOrigins.includes(origin);
}

function withCors(req, cfg, extra = {}) {
  const origin = header(req, 'origin');
  const cors = origin && cfg.allowedOrigins.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
  return { ...SAFE_HEADERS, ...cors, ...extra };
}

function preflight(req, cfg) {
  if (!originAllowed(req, cfg)) return { status: 403, headers: withCors(req, cfg), jsonBody: { success: false, errorCode: 'FORBIDDEN' } };
  return {
    status: 204,
    headers: withCors(req, cfg, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type,x-correlation-id',
      'Access-Control-Max-Age': '600'
    })
  };
}

async function readJson(req, cfg) {
  const contentLength = Number(header(req, 'content-length') || 0);
  if (contentLength > cfg.maxBodyBytes) return { error: { status: 413, jsonBody: { success: false, errorCode: 'PAYLOAD_TOO_LARGE' } } };
  const contentType = header(req, 'content-type') || '';
  if (!/^application\/json\b/i.test(contentType)) return { error: { status: 415, jsonBody: { success: false, errorCode: 'UNSUPPORTED_MEDIA_TYPE' } } };
  const text = await req.text();
  if (Buffer.byteLength(text) > cfg.maxBodyBytes) return { error: { status: 413, jsonBody: { success: false, errorCode: 'PAYLOAD_TOO_LARGE' } } };
  try { return { body: JSON.parse(text) }; } catch (_) { return { error: { status: 400, jsonBody: { success: false, errorCode: 'VALIDATION_FAILED' } } }; }
}

function candidate(result) {
  if (!result || result.success !== true) return result;
  const response = { success: true };
  for (const key of ['alreadySubmitted', 'applicationReference', 'fileReference', 'applicationStatus', 'fileStatus', 'status', 'retryAfterMs', 'completionToken', 'upload']) {
    if (result[key] !== undefined) response[key] = result[key];
  }
  return response;
}

function unavailable(req, cfg) {
  return { status: 503, headers: withCors(req, cfg, { 'Retry-After': '3600' }), jsonBody: { success: false, errorCode: 'SERVICE_UNAVAILABLE' } };
}

function deriveRateLimitKey({ route, networkIdentifier, roleId, secret }) {
  return crypto.createHmac('sha256', secret).update([route, networkIdentifier || 'unknown', roleId || 'none'].join('\n')).digest('hex');
}

module.exports = { originAllowed, withCors, preflight, readJson, candidate, unavailable, deriveRateLimitKey, header };
