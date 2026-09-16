'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GA_ID = 'G-CLVYF17N9H';
const INSTALLER_VERSION = '20260916-consent-1';

const LEGACY_GA_BLOCK = [
  '<!-- Google tag (gtag.js) -->',
  `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>`,
  '<script>',
  '  window.dataLayer = window.dataLayer || [];',
  '  function gtag(){dataLayer.push(arguments);}',
  "  gtag('js', new Date());",
  '',
  `  gtag('config', '${GA_ID}');`,
  '  window.__SV_GA4_INSTALLED = true;',
  '</script>'
].join('\n');

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function isPublicHtml(absolute) {
  if (!absolute.toLowerCase().endsWith('.html')) return false;
  const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
  if (/^(?:internal-preview|employee-portal|shorevest-one|docs|tests|api|services|infra|templates)(?:\/|$)/.test(relative)) return false;
  if (/^assets\/email\//.test(relative)) return false;
  return true;
}

function removeLegacyDirectTag(html) {
  if (!html.includes(GA_ID)) return html;
  return html
    .replace(LEGACY_GA_BLOCK, '')
    .replace(/\n{3,}/g, '\n\n');
}

function hasLegacyDirectTag(html) {
  return html.includes(`googletagmanager.com/gtag/js?id=${GA_ID}`) ||
    html.includes(`gtag('config', '${GA_ID}')`) ||
    html.includes(`gtag(\"config\", \"${GA_ID}\")`);
}

function updateSecurityHeaders() {
  const headersPath = path.join(ROOT, '_headers');
  if (!fs.existsSync(headersPath)) return false;

  const before = fs.readFileSync(headersPath, 'utf8');
  let after = before;

  after = after.replace(
    "script-src 'self' 'unsafe-inline';",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com;"
  );

  after = after.replace(
    "connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com;",
    "connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com https://www.google-analytics.com https://region1.google-analytics.com https://*.google-analytics.com;"
  );

  if (after === before) return false;
  fs.writeFileSync(headersPath, after);
  return true;
}

function main() {
  const validate = process.argv.includes('--validate');
  const publicHtml = walk(ROOT).filter(isPublicHtml);
  const changed = [];
  const remaining = [];

  for (const absolute of publicHtml) {
    const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
    const before = fs.readFileSync(absolute, 'utf8');
    const after = removeLegacyDirectTag(before);

    if (after !== before) {
      changed.push(relative);
      if (!validate) fs.writeFileSync(absolute, after);
    }

    const inspected = validate ? before : after;
    if (hasLegacyDirectTag(inspected)) remaining.push(relative);
  }

  const headersChanged = validate ? false : updateSecurityHeaders();

  if (validate && remaining.length) {
    console.error(`Unconditional Google Analytics tag remains in ${remaining.length} public HTML file(s): ${remaining.slice(0, 30).join(', ')}`);
    process.exit(1);
  }

  if (!validate) {
    console.log(`Consent normalizer ${INSTALLER_VERSION}: removed unconditional ${GA_ID} tags from ${changed.length} of ${publicHtml.length} public HTML file(s).`);
    if (headersChanged) console.log('Updated the static-host Content Security Policy for consent-gated Google Analytics.');
  } else {
    console.log(`Consent normalizer ${INSTALLER_VERSION}: validated ${publicHtml.length} public HTML file(s) have no unconditional ${GA_ID} tag.`);
  }
}

main();
