'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { authorizeRetentionAdmin } = require('../src/lib/hrAuth');

function request(role) {
  const encoded = role == null ? null : Buffer.from(JSON.stringify({
    auth_typ: 'aad',
    role_typ: 'roles',
    claims: [
      { typ: 'roles', val: role },
      { typ: 'oid', val: 'object-id' }
    ]
  })).toString('base64');
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === 'x-ms-client-principal' ? encoded : null;
      }
    }
  };
}

test('retention administration is separately disabled and separately authorized', () => {
  assert.equal(authorizeRetentionAdmin(request('Recruitment.RetentionAdmin'), {
    retention: { enabled: false, adminRole: 'Recruitment.RetentionAdmin' }
  }).errorCode, 'RETENTION_DISABLED');

  assert.equal(authorizeRetentionAdmin(request(null), {
    retention: { enabled: true, adminRole: 'Recruitment.RetentionAdmin' }
  }).status, 401);

  assert.equal(authorizeRetentionAdmin(request('Recruitment.HR'), {
    retention: { enabled: true, adminRole: 'Recruitment.RetentionAdmin' }
  }).errorCode, 'RETENTION_ADMIN_ROLE_REQUIRED');

  const allowed = authorizeRetentionAdmin(request('Recruitment.RetentionAdmin'), {
    retention: { enabled: true, adminRole: 'Recruitment.RetentionAdmin' }
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.principal.objectId, 'object-id');
});
