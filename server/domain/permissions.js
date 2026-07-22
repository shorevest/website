'use strict';

/**
 * Permission framework. Permissions are checked in the service layer on every
 * material action — never hardcoded inside UI components. The motherboard grants
 * broad preview access, but the checks still execute (so wiring real Entra ID
 * roles later is a data change, not a rewrite).
 */

const PERMISSIONS = Object.freeze([
  'view_workspace', 'edit_audience', 'resolve_held_record', 'edit_draft',
  'use_sender', 'submit_approval', 'approve_package', 'request_execution',
  'manage_templates', 'manage_connectors', 'view_audit',
]);

// Role → permissions. The "admin" role is the all-access motherboard role.
const ROLE_PERMISSIONS = Object.freeze({
  associate: [
    'view_workspace', 'edit_audience', 'resolve_held_record', 'edit_draft',
    'submit_approval', 'view_audit',
  ],
  director: [
    'view_workspace', 'edit_audience', 'resolve_held_record', 'edit_draft',
    'use_sender', 'submit_approval', 'request_execution', 'view_audit',
  ],
  approver: [
    'view_workspace', 'approve_package', 'view_audit',
  ],
  admin: PERMISSIONS.slice(),
});

class PermissionError extends Error {
  constructor(permission, role) {
    super(`Permission denied: role "${role}" lacks "${permission}"`);
    this.name = 'PermissionError';
    this.code = 'PERMISSION_DENIED';
    this.status = 403;
    this.permission = permission;
  }
}

function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function can(user, permission) {
  if (!user) return false;
  return permissionsFor(user.role).includes(permission);
}

function requirePermission(user, permission) {
  if (!can(user, permission)) {
    throw new PermissionError(permission, user ? user.role : 'anonymous');
  }
}

module.exports = { PERMISSIONS, ROLE_PERMISSIONS, permissionsFor, can, requirePermission, PermissionError };
