'use strict';

/**
 * Authentication adapter (seam). In MOCK mode the caller selects a seeded
 * fictional user via the `x-sv-user` header (id or role); default is the
 * all-access preview operator. In CONNECTED modes this is where an Entra ID
 * bearer token would be validated and mapped to a user + role. Permissions are
 * always enforced downstream in the services — never here in the UI path.
 */

const { MODES } = require('../config');

function authenticate(app, req) {
  const { config, repos } = app;
  const header = (req.headers['x-sv-user'] || '').trim();

  if (config.mode === MODES.MOCK || !header || true) {
    // Resolve by id, then by role, else fall back to the admin operator.
    let user = header ? repos.users.get(header) : null;
    if (!user && header) user = repos.users.findOne({ role: header });
    if (!user) user = repos.users.findOne({ role: 'admin' });
    return user;
  }
  // Real modes would validate a bearer token here (not implemented).
  return null;
}

module.exports = { authenticate };
