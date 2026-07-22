'use strict';

const SAFE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'"
};

function header(req, name) {
  return req.headers && typeof req.headers.get === 'function'
    ? req.headers.get(name)
    : req.headers?.[name] || req.headers?.[name.toLowerCase()];
}

function originAllowed(req, config) {
  const origin = header(req, 'origin');
  if (!origin) return config.requireOrigin !== true;
  return config.allowedOrigins.includes(origin);
}

function withCors(req, config, extra = {}) {
  const origin = header(req, 'origin');
  return {
    ...SAFE_HEADERS,
    ...(origin && config.allowedOrigins.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {}),
    ...extra
  };
}

async function readJson(req, config) {
  const contentType = header(req, 'content-type') || '';
  if (!/^application\/json\b/i.test(contentType)) {
    return { error: { status: 415, body: { success: false, errorCode: 'UNSUPPORTED_MEDIA_TYPE' } } };
  }

  const text = await req.text();
  if (Buffer.byteLength(text) > config.maxBodyBytes) {
    return { error: { status: 413, body: { success: false, errorCode: 'PAYLOAD_TOO_LARGE' } } };
  }

  try {
    return { body: JSON.parse(text) };
  } catch (_) {
    return { error: { status: 400, body: { success: false, errorCode: 'VALIDATION_FAILED' } } };
  }
}

function normalizeForwardedIp(value) {
  if (typeof value !== 'string') return '';
  return value.split(',')[0].trim().slice(0, 128);
}

function requestContext(req) {
  const clientIp = normalizeForwardedIp(
    header(req, 'cf-connecting-ip') ||
    header(req, 'x-azure-clientip') ||
    header(req, 'x-forwarded-for') ||
    ''
  );
  const userAgent = String(header(req, 'user-agent') || '').slice(0, 512);
  return { clientIp, userAgent };
}

function candidate(result) {
  if (!result || result.success !== true) return result;
  const response = { success: true };
  for (const key of [
    'alreadySubmitted',
    'applicationReference',
    'fileReference',
    'applicationStatus',
    'fileStatus',
    'status',
    'retryAfterMs',
    'completionToken',
    'upload'
  ]) {
    if (result[key] !== undefined) response[key] = result[key];
  }
  return response;
}

function unavailable(req, config) {
  return {
    status: 503,
    headers: withCors(req, config, { 'Retry-After': '3600' }),
    jsonBody: { success: false, errorCode: 'SERVICE_UNAVAILABLE' }
  };
}

module.exports = {
  header,
  originAllowed,
  withCors,
  readJson,
  normalizeForwardedIp,
  requestContext,
  candidate,
  unavailable
};
