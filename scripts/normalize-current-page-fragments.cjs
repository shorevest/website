'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'assets', 'data', 'clean-url-manifest.json');
const INQUIRY_EMAIL = 'inquiries@shorevest.com';

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

function setAttribute(tag, name, value) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(["'])[^"']*\\1`, 'i');
  if (pattern.test(tag)) return tag.replace(pattern, `${name}="${value}"`);
  return tag.replace(/>$/, ` ${name}="${value}">`);
}

function normalizeManagedForms(html) {
  return html.replace(/<form\b[^>]*>/gi, tag => {
    const isContact = /\bid\s*=\s*["']cp-form["']/i.test(tag);
    const isSubscription = /\bclass\s*=\s*["'][^"']*\bresearch-sub__form\b[^"']*["']/i.test(tag);
    if (!isContact && !isSubscription) return tag;

    let normalized = setAttribute(tag, 'action', `mailto:${INQUIRY_EMAIL}`);
    normalized = setAttribute(normalized, 'method', 'post');
    normalized = setAttribute(normalized, 'enctype', 'text/plain');
    return normalized;
  });
}

function normalizeChineseInvestorPortal(html, route) {
  if (route !== '/cn/investor-portal/') return html;

  return html
    .replace(/href=(["'])\/cn\/index\/\1/gi, 'href="/cn/investor-portal/"')
    .replace(/(<a\b[^>]*\bclass=["'][^"']*\bsv-lang\b[^"']*["'][^>]*\bhref=)(["'])\/\2/gi, '$1"/investor-portal/"')
    .replace(/(<a\b[^>]*\bclass=["'][^"']*\bsv-util-btn\b[^"']*["'][^>]*\bhref=)(["'])\/\2([^>]*>\s*EN\s*<\/a>)/gi, '$1"/investor-portal/"$3');
}

for (const item of routes) {
  if (!item.destination) continue;
  const absolute = path.join(ROOT, item.destination);
  if (!fs.existsSync(absolute)) throw new Error(`Missing generated destination: ${item.destination}`);

  const before = fs.readFileSync(absolute, 'utf8');
  let after = before;
  let pageLinks = 0;

  if (/<base\s+href=["']\/["'][^>]*>/i.test(after)) {
    const ids = idsIn(after);
    after = after.replace(
      /<a\b([^>]*?)\bhref\s*=\s*(["'])#([A-Za-z][A-Za-z0-9_:.-]*)\2([^>]*)>/gi,
      (match, beforeHref, quote, fragment, afterHref) => {
        if (!ids.has(fragment)) {
          throw new Error(`${item.route} links to missing section #${fragment}`);
        }
        pageLinks += 1;
        return `<a${beforeHref}href=${quote}${item.route}#${fragment}${quote}${afterHref}>`;
      }
    );
  }

  after = normalizeManagedForms(after);
  after = normalizeChineseInvestorPortal(after, item.route);

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

console.log(`Normalized ${changedLinks} same-page section link(s) and repaired managed public destinations across ${changedPages} generated page(s).`);
