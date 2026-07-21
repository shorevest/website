'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://shorevest.com';
const MANIFEST_PATH = path.join(ROOT, 'assets', 'data', 'clean-url-manifest.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function decodeAttribute(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/g, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function idsIn(html) {
  return new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]));
}

function attributesIn(html) {
  const found = [];
  const pattern = /\b(href|data-href|action)\s*=\s*(["'])(.*?)\2/gi;
  let match;
  while ((match = pattern.exec(html))) {
    found.push({ attribute: match[1].toLowerCase(), value: decodeAttribute(match[3]) });
  }
  return found;
}

function localFileForPath(pathname) {
  const rel = pathname.replace(/^\//, '');
  if (!rel) return 'index.html';
  if (pathname.endsWith('/')) return `${rel}index.html`;
  return rel;
}

function fail(errors, page, attribute, value, reason) {
  errors.push(`${page}: ${attribute}="${value}" ${reason}`);
}

if (!fs.existsSync(MANIFEST_PATH)) {
  throw new Error('Missing clean URL manifest. Run scripts/generate-clean-public-urls.js first.');
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const routes = Array.isArray(manifest.routes) ? manifest.routes : [];
const routeMap = new Map(routes.map(item => [item.route, item.destination]));
const pageCache = new Map();
const errors = [];
let checkedLinks = 0;
let checkedPages = 0;

for (const item of routes) {
  if (!item.destination || !exists(item.destination)) {
    fail(errors, item.route, 'route', item.destination || '', 'has no generated destination');
    continue;
  }

  const html = read(item.destination);
  pageCache.set(item.route, { html, ids: idsIn(html) });
  checkedPages += 1;
}

for (const item of routes) {
  const page = pageCache.get(item.route);
  if (!page) continue;

  const hasRootBase = /<base\s+href=["']\/["'][^>]*>/i.test(page.html);
  const baseUrl = hasRootBase ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${item.route}`;

  for (const link of attributesIn(page.html)) {
    const value = link.value.trim();
    if (!value) {
      fail(errors, item.route, link.attribute, link.value, 'is empty');
      continue;
    }

    checkedLinks += 1;

    if (/^javascript:/i.test(value)) {
      fail(errors, item.route, link.attribute, value, 'uses a javascript URL');
      continue;
    }

    if (/^(mailto:|tel:|sms:|data:|blob:)/i.test(value)) continue;

    if (value === '#') {
      fail(errors, item.route, link.attribute, value, 'is a placeholder destination');
      continue;
    }

    if (value.startsWith('#')) {
      const fragment = decodeURIComponent(value.slice(1));
      if (!page.ids.has(fragment)) {
        fail(errors, item.route, link.attribute, value, `points to missing id="${fragment}"`);
      }
      if (hasRootBase && link.attribute !== 'action') {
        fail(errors, item.route, link.attribute, value, 'is a bare fragment on a page with <base href="/">');
      }
      continue;
    }

    if (/^\/\//.test(value)) continue;

    let url;
    try {
      url = new URL(value, baseUrl);
    } catch (_) {
      fail(errors, item.route, link.attribute, value, 'is not a valid URL');
      continue;
    }

    if (url.origin !== SITE_ORIGIN) {
      if (link.attribute === 'data-href') {
        fail(errors, item.route, link.attribute, value, 'uses an external destination in data-href');
      }
      continue;
    }

    if (/\.html$/i.test(url.pathname)) {
      fail(errors, item.route, link.attribute, value, 'uses a legacy .html destination');
      continue;
    }

    const exactRoute = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    const destination = routeMap.get(exactRoute);

    if (destination) {
      if (url.hash) {
        const target = pageCache.get(exactRoute);
        const fragment = decodeURIComponent(url.hash.slice(1));
        if (!target || !target.ids.has(fragment)) {
          fail(errors, item.route, link.attribute, value, `points to missing ${exactRoute}#${fragment}`);
        }
      }
      continue;
    }

    const file = localFileForPath(url.pathname);
    if (!exists(file)) {
      fail(errors, item.route, link.attribute, value, `does not resolve to a public route or file (${file})`);
    }
  }

  for (const match of page.html.matchAll(/<a\b([^>]*)target=["']_blank["']([^>]*)>/gi)) {
    const attrs = `${match[1]} ${match[2]}`;
    const rel = /\brel=["']([^"']*)["']/i.exec(attrs);
    if (!rel || !/\bnoopener\b/i.test(rel[1])) {
      fail(errors, item.route, 'target', '_blank', 'is missing rel="noopener"');
    }
  }
}

if (errors.length) {
  console.error(`Public link audit failed with ${errors.length} issue(s):`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Public link audit passed: ${checkedLinks} destinations across ${checkedPages} generated pages.`);
