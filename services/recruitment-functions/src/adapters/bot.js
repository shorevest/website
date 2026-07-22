'use strict';

function createBotVerifier({
  mode = 'disabled',
  environment = 'production',
  secretProvider,
  secretName,
  endpoint = 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  expectedHostname = '',
  fetchImpl = globalThis.fetch
} = {}) {
  return {
    async verify(request) {
      if (mode === 'disabled') return { ok: environment !== 'production' && environment !== 'prod' };
      if (mode !== 'turnstile' || !secretProvider || !secretName || typeof fetchImpl !== 'function') {
        return { ok: false };
      }

      const token = request?.botToken;
      if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return { ok: false };

      try {
        const secret = await secretProvider.get(secretName);
        const form = new URLSearchParams({ secret, response: token });
        const remoteIp = request?._requestContext?.clientIp;
        if (remoteIp) form.set('remoteip', remoteIp);

        const options = {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: form
        };
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
          options.signal = AbortSignal.timeout(5000);
        }

        const response = await fetchImpl(endpoint, options);
        if (!response || response.ok !== true) return { ok: false };
        const result = await response.json();
        if (result?.success !== true) return { ok: false };
        if (expectedHostname && result.hostname !== expectedHostname) return { ok: false };
        return { ok: true };
      } catch (_) {
        return { ok: false };
      }
    }
  };
}

module.exports = { createBotVerifier };
