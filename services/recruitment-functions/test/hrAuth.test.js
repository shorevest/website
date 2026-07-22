'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  parseClientPrincipal,
  principalRoles,
  principalObjectId,
  authorizeHr
} = require('../src/lib/hrAuth');

function request(principal) {
  const encoded = principal == null
    ? null
    : Buffer.from(JSON.stringify(principal)).toString('base64');
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === 'x-ms-client-principal' ? encoded : null;
      }
    }
  };
}

function aadPrincipal(claims = []) {
  return {
    auth_typ: 'aad',
    name_typ: 'name',
    role_typ: 'roles',
    claims
  };
}

test('valid Easy Auth principal exposes roles and object id', () => {
  const principal = parseClientPrincipal(request(aadPrincipal([
    { typ: 'roles', val: 'Recruitment.HR' },
    { typ: 'oid', val: '00000000-0000-0000-0000-000000000001' }
  ])));
  assert.deepEqual(principalRoles(principal), ['Recruitment.HR']);
  assert.equal(principalObjectId(principal), '00000000-0000-0000-0000-000000000001');
});

test('malformed, non-AAD and missing principals are rejected', () => {
  assert.equal(parseClientPrincipal(request(null)), null);
  assert.equal(parseClientPrincipal({ headers: { get: () => 'not-base64-json' } }), null);
  assert.equal(parseClientPrincipal(request({ auth_typ: 'github', claims: [] })), null);
});

test('HR authorization fails closed when platform authentication is disabled', () => {
  const result = authorizeHr(request(aadPrincipal([
    { typ: 'roles', val: 'Recruitment.HR' }
  ])), {
    hrAccess: { enabled: false, requiredRole: 'Recruitment.HR' }
  });
  assert.equal(result.status, 503);
  assert.equal(result.errorCode, 'HR_ACCESS_DISABLED');
});

test('HR authorization requires the exact app role', () => {
  const config = {
    hrAccess: { enabled: true, requiredRole: 'Recruitment.HR' }
  };
  assert.equal(authorizeHr(request(null), config).status, 401);
  const denied = authorizeHr(request(aadPrincipal([
    { typ: 'roles', val: 'Recruitment.Reader' }
  ])), config);
  assert.equal(denied.status, 403);
  assert.equal(denied.errorCode, 'HR_ROLE_REQUIRED');

  const allowed = authorizeHr(request(aadPrincipal([
    { typ: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role', val: 'Recruitment.HR' },
    { typ: 'http://schemas.microsoft.com/identity/claims/objectidentifier', val: 'object-id' }
  ])), config);
  assert.equal(allowed.ok, true);
  assert.equal(allowed.principal.objectId, 'object-id');
});
