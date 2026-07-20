'use strict';
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
  return { ...SAFE_HEADERS, ...(origin && cfg.allowedOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}), ...extra };
}
async function readJson(req, cfg) {
  const ct = header(req, 'content-type') || '';
  if (!/^application\/json\b/i.test(ct)) return { error: { status: 415, body: { success: false, errorCode: 'UNSUPPORTED_MEDIA_TYPE' } } };
  const text = await req.text();
  if (Buffer.byteLength(text) > cfg.maxBodyBytes) return { error: { status: 413, body: { success: false, errorCode: 'PAYLOAD_TOO_LARGE' } } };
  try { return { body: JSON.parse(text) }; } catch (error) { return { error: { status: 400, body: { success: false, errorCode: 'VALIDATION_FAILED' } } }; }
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
module.exports = { originAllowed, withCors, readJson, candidate, unavailable };
