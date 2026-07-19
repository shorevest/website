const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skipDirs = new Set(['.git', 'node_modules']);
const externalSchemes = /^(?:https?:|mailto:|tel:|javascript:|data:|#)/i;
// Favicon hrefs are page-relative (prefixed with ../ per directory level)
// so they resolve whether the site is served from the domain root or a
// subpath such as a GitHub Pages project site. The ?v= query forces
// browsers to drop previously cached icon art when the assets change.
const faviconVersion = '20260717';
const faviconLinks = (prefix) => [
  `<link rel="icon" href="${prefix}assets/favicon-cinnabar.ico?v=${faviconVersion}" sizes="any">`,
  `<link rel="shortcut icon" href="${prefix}assets/favicon-cinnabar.ico?v=${faviconVersion}">`,
  `<link rel="icon" href="${prefix}assets/favicon-cinnabar.svg?v=${faviconVersion}" type="image/svg+xml">`,
  `<link rel="icon" type="image/png" sizes="32x32" href="${prefix}assets/favicon-cinnabar-32x32.png?v=${faviconVersion}">`,
  `<link rel="icon" type="image/png" sizes="16x16" href="${prefix}assets/favicon-cinnabar-16x16.png?v=${faviconVersion}">`,
  `<link rel="apple-touch-icon" sizes="180x180" href="${prefix}assets/apple-touch-icon-cinnabar.png?v=${faviconVersion}">`,
  `<link rel="manifest" href="${prefix}site.webmanifest?v=${faviconVersion}">`,
];
const iconMimeByExt = new Map([
  ['.ico', /image\/x-icon|image\/vnd\.microsoft\.icon|application\/octet-stream/],
  ['.svg', /image\/svg\+xml/],
  ['.png', /image\/png/],
  ['.webmanifest', /application\/manifest\+json|application\/json/],
]);

function walk(dir = '.') {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name) || rel === 'assets/email') return [];
      return walk(rel);
    }
    return entry.isFile() && entry.name.endsWith('.html') ? [rel.replace(/^\.\//, '')] : [];
  });
}

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function attrs(tag) {
  const out = {};
  tag.replace(/([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, key, _q, dq, sq) => { out[key] = dq ?? sq ?? ''; });
  return out;
}
function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
}
function resolveInternal(from, url) {
  if (!url || externalSchemes.test(url)) return null;
  const clean = url.split('#')[0].split('?')[0];
  if (!clean) return null;
  const rel = clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), clean));
  return rel === '.' ? 'home.html' : rel;
}

const pages = walk().sort();
assert(pages.includes('home.html'), 'English homepage must exist');
assert(pages.includes('home_cn.html'), 'Chinese homepage must exist');

let internalLinkCount = 0;
const discoveredPages = new Set(['home.html', 'home_cn.html']);

for (const page of pages) {
  const html = read(page);
  assert.match(html, /<!doctype html>/i, `${page} should be an HTML document`);
  assert.match(html, /<html\s+[^>]*lang="(?:en|zh-CN)"/i, `${page} should declare en or zh-CN language`);
  const expectedFavicons = faviconLinks('../'.repeat(page.split('/').length - 1));
  for (const line of expectedFavicons) assert(html.includes(line), `${page} should include approved homepage favicon declaration: ${line}`);

  for (const href of expectedFavicons.map((line) => attrs(line).href)) {
    const rel = resolveInternal(page, href);
    assert(fs.existsSync(path.join(root, rel)), `${page} favicon asset should exist: ${href}`);
    assert(iconMimeByExt.has(path.extname(rel)), `${href} should have an expected icon/manifest extension`);
  }

  const pageIsCn = /_cn\.html$|\/index_cn\.html$/.test(page) || /<html\s+[^>]*lang="zh-CN"/i.test(html);
  if (pageIsCn) assert(!/<html\s+[^>]*lang="en"/i.test(html), `${page} Chinese page must not declare English lang`);

  for (const tagName of ['a', 'link', 'script', 'img', 'form']) {
    for (const tag of tags(html, tagName)) {
      const a = attrs(tag);
      const raw = a.href || a.src || a.action;
      if (!raw) continue;
      if (tagName === 'a') {
        assert.notStrictEqual(raw, '#', `${page} must not contain placeholder link ${tag}`);
        internalLinkCount += resolveInternal(page, raw) ? 1 : 0;
      }
      const rel = resolveInternal(page, raw);
      if (!rel) continue;
      const target = path.join(root, rel);
      assert(fs.existsSync(target), `${page} references missing internal target ${raw} -> ${rel}`);
      if (rel.endsWith('.html')) discoveredPages.add(rel);
    }
  }
}

for (const page of discoveredPages) assert(pages.includes(page), `discovered route should be inventoried: ${page}`);

const routePairs = [
  ['home.html', 'home_cn.html'],
  ['firm.html', 'firm_cn.html'],
  ['strategy.html', 'strategy_cn.html'],
  ['insights.html', 'insights_cn.html'],
  ['media.html', 'media_cn.html'],
  ['team.html', 'team_cn.html'],
  ['contact.html', 'contact_cn.html'],
  ['important-information.html', 'important-information_cn.html'],
  ['privacy-policy.html', 'privacy-policy_cn.html'],
  ['cookie-notice.html', 'cookie-notice_cn.html'],
  ['terms-of-use.html', 'terms-of-use_cn.html'],
  ['legal-notices-disclaimers.html', 'legal-notices-disclaimers_cn.html'],
  ['investor-access.html', 'investor-access_cn.html'],
  ['investor-access-portal-terms.html', 'investor-access-portal-terms_cn.html'],
  ['investor-portal/index.html', 'investor-portal/index_cn.html'],
];
for (const [en, cn] of routePairs) {
  assert(pages.includes(en), `English route exists: ${en}`);
  assert(pages.includes(cn), `Chinese route exists: ${cn}`);
  assert.match(read(en), /<html\s+[^>]*lang="en"/i, `${en} declares English lang`);
  assert.match(read(cn), /<html\s+[^>]*lang="zh-CN"/i, `${cn} declares Chinese lang`);
}

assert(internalLinkCount > 100, `expected broad internal link coverage, got ${internalLinkCount}`);
console.log(`site route crawler tests passed (${pages.length} routes, ${internalLinkCount} internal links)`);
