'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'data', 'clean-url-manifest.json');

if (!fs.existsSync(MANIFEST_PATH)) {
  throw new Error('Missing clean URL manifest. Run scripts/generate-clean-public-urls.js first.');
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const routes = Array.isArray(manifest.routes) ? manifest.routes : [];
let changedPages = 0;
let changedLinks = 0;

function idsIn(html) {
  return new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]));
}

for (const item of routes) {
  if (!item.destination) continue;
  const absolute = path.join(ROOT, item.destination);
  if (!fs.existsSync(absolute)) throw new Error(`Missing generated destination: ${item.destination}`);

  const before = fs.readFileSync(absolute, 'utf8');
  if (!/<base\s+href=["']\/["'][^>]*>/i.test(before)) continue;

  const ids = idsIn(before);
  let pageLinks = 0;
  const after = before.replace(
    /<a\b([^>]*?)\bhref\s*=\s*(["'])#([A-Za-z][A-Za-z0-9_:.-]*)\2([^>]*)>/gi,
    (match, beforeHref, quote, fragment, afterHref) => {
      if (!ids.has(fragment)) {
        throw new Error(`${item.route} links to missing section #${fragment}`);
      }
      pageLinks += 1;
      return `<a${beforeHref}href=${quote}${item.route}#${fragment}${quote}${afterHref}>`;
    }
  );

  if (after !== before) {
    fs.writeFileSync(absolute, after);
    changedPages += 1;
    changedLinks += pageLinks;
  }

  const remaining = [...after.matchAll(/<a\b[^>]*\bhref\s*=\s*["']#([A-Za-z][A-Za-z0-9_:.-]*)["'][^>]*>/gi)];
  if (remaining.length) {
    throw new Error(`${item.destination} still contains a bare same-page fragment: #${remaining[0][1]}`);
  }
}

console.log(`Normalized ${changedLinks} same-page section link(s) across ${changedPages} generated page(s).`);
