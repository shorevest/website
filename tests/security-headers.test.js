const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const headersPath = path.join(root, '_headers');
assert.ok(fs.existsSync(headersPath), '_headers must exist at the static publish root');

const headers = fs.readFileSync(headersPath, 'utf8');

function assertHeader(name, valuePattern) {
  const linePattern = new RegExp('^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*(.+)$', 'im');
  const match = headers.match(linePattern);
  assert.ok(match, `${name} header must be configured`);
  if (valuePattern) assert.match(match[1], valuePattern, `${name} header must match ${valuePattern}`);
  return match[1];
}

const csp = assertHeader('Content-Security-Policy');
[
  /default-src\s+'self'/,
  /base-uri\s+'self'/,
  /object-src\s+'none'/,
  /frame-ancestors\s+'none'/,
  /form-action\s+'self'/,
  /script-src\s+'self'/,
  /connect-src\s+'self'/,
  /upgrade-insecure-requests/
].forEach((directive) => assert.match(csp, directive, `CSP must include ${directive}`));
assert.doesNotMatch(csp, /default-src[^;]*\*/i, 'CSP default-src must not allow every origin');
assert.doesNotMatch(csp, /object-src[^;]*\*/i, 'CSP object-src must not allow plugins from every origin');
assert.doesNotMatch(csp, /frame-ancestors[^;]*\*/i, 'CSP frame-ancestors must not allow clickjacking from every origin');

assertHeader('X-Content-Type-Options', /^nosniff$/i);
assertHeader('X-Frame-Options', /^DENY$/i);
assertHeader('Referrer-Policy', /^strict-origin-when-cross-origin$/i);
const permissions = assertHeader('Permissions-Policy');
[/camera=\(\)/, /microphone=\(\)/, /geolocation=\(\)/].forEach((directive) => {
  assert.match(permissions, directive, `Permissions-Policy must include ${directive}`);
});
assertHeader('Cross-Origin-Opener-Policy', /^same-origin$/i);
assertHeader('Cross-Origin-Resource-Policy', /^same-origin$/i);
assertHeader('X-Permitted-Cross-Domain-Policies', /^none$/i);

console.log('security header checks passed');
