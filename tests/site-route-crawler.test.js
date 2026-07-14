const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skipDirs = new Set(['.git', 'node_modules']);
const externalSchemes = /^(?:https?:|mailto:|tel:|javascript:|data:|#)/i;
const faviconLinks = [
  '<link rel="icon" href="/favicon.ico" sizes="any">',
  '<link rel="shortcut icon" href="/favicon.ico">',
  '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
  '<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">',
  '<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">',
  '<link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">',
  '<link rel="manifest" href="/site.webmanifest">',
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
  return rel === '.' ? 'index.html' : rel;
}

const pages = walk().sort();
assert(pages.includes('index.html'), 'English homepage must exist');
assert(pages.includes('index_cn.html'), 'Chinese homepage must exist');

let internalLinkCount = 0;
const discoveredPages = new Set(['index.html', 'index_cn.html']);

for (const page of pages) {
  const html = read(page);
  assert.match(html, /<!doctype html>/i, `${page} should be an HTML document`);
  assert.match(html, /<html\s+[^>]*lang="(?:en|zh-CN)"/i, `${page} should declare en or zh-CN language`);
  for (const line of faviconLinks) assert(html.includes(line), `${page} should include approved homepage favicon declaration: ${line}`);

  for (const href of faviconLinks.map((line) => attrs(line).href)) {
    const rel = href.slice(1);
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
  ['index.html', 'index_cn.html'],
  ['firm.html', 'firm_cn.html'],
  ['strategy.html', 'strategy_cn.html'],
  ['insights.html', 'insights_cn.html'],
  ['press.html', 'press_cn.html'],
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
