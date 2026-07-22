'use strict';

const ROLE_CLAIM_TYPES = new Set([
  'roles',
  'role',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
]);

function header(req, name) {
  return req?.headers && typeof req.headers.get === 'function'
    ? req.headers.get(name)
    : req?.headers?.[name] || req?.headers?.[name.toLowerCase()];
}

function parseClientPrincipal(req) {
  const encoded = header(req, 'x-ms-client-principal');
  if (typeof encoded !== 'string' || !encoded.trim()) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    if (String(payload.auth_typ || '').toLowerCase() !== 'aad') return null;
    if (!Array.isArray(payload.claims)) return null;
    const claims = payload.claims
      .filter((claim) => claim && typeof claim.typ === 'string' && typeof claim.val === 'string')
      .map((claim) => ({ typ: claim.typ, val: claim.val }));
    return {
      authType: payload.auth_typ,
      nameType: payload.name_typ || null,
      roleType: payload.role_typ || 'roles',
      claims
    };
  } catch (_) {
    return null;
  }
}

function claimValues(principal, acceptedTypes) {
  if (!principal || !Array.isArray(principal.claims)) return [];
  const types = new Set(acceptedTypes);
  return principal.claims
    .filter((claim) => types.has(claim.typ))
    .map((claim) => claim.val);
}

function principalRoles(principal) {
  if (!principal) return [];
  const types = new Set(ROLE_CLAIM_TYPES);
  if (principal.roleType) types.add(principal.roleType);
  return [...new Set(claimValues(principal, types))];
}

function principalObjectId(principal) {
  return claimValues(principal, [
    'oid',
    'http://schemas.microsoft.com/identity/claims/objectidentifier'
  ])[0] || null;
}

function authorizeHr(req, config) {
  if (config?.hrAccess?.enabled !== true) {
    return { ok: false, status: 503, errorCode: 'HR_ACCESS_DISABLED' };
  }
  const principal = parseClientPrincipal(req);
  if (!principal) {
    return { ok: false, status: 401, errorCode: 'AUTHENTICATION_REQUIRED' };
  }
  const requiredRole = config.hrAccess.requiredRole;
  if (!requiredRole || !principalRoles(principal).includes(requiredRole)) {
    return { ok: false, status: 403, errorCode: 'HR_ROLE_REQUIRED' };
  }
  return {
    ok: true,
    principal: {
      objectId: principalObjectId(principal),
      roles: principalRoles(principal)
    }
  };
}

module.exports = {
  ROLE_CLAIM_TYPES,
  parseClientPrincipal,
  claimValues,
  principalRoles,
  principalObjectId,
  authorizeHr
};
