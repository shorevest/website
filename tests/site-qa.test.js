const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
// 'home' replaced 'index' when the homepage route was renamed; index.html is
// now a meta-refresh stub whose canonical intentionally points at home.html.
const pairedBases = ['home','firm','strategy','insights','media','team','contact','privacy-policy','cookie-notice','terms-of-use','important-information','legal-notices-disclaimers','investor-access','investor-access-portal-terms'];
function hrefs(html){return [...html.matchAll(/<a\s+[^>]*href="([^"]+)"/gi)].map(m=>m[1]);}
function localTarget(from, href){if(!href || href.startsWith('#') || /^(https?:|mailto:|tel:|javascript:)/i.test(href)) return null; return path.normalize(path.join(path.dirname(from), href.split('#')[0].split('?')[0]));}
for (const base of pairedBases) {
  const en = `${base}.html`, cn = `${base}_cn.html`;
  if (!exists(en) || !exists(cn)) continue;
  const enHtml = read(en), cnHtml = read(cn);
  assert.match(enHtml, new RegExp(`<link rel="canonical" href="https://shorevest\\.com/${en}">`), `${en} canonical`);
  assert.match(cnHtml, new RegExp(`<link rel="canonical" href="https://shorevest\\.com/${cn}">`), `${cn} canonical`);
  assert.match(enHtml, new RegExp(`hreflang="zh-Hans" href="https://shorevest\\.com/${cn}"`), `${en} zh alternate`);
  assert.match(cnHtml, new RegExp(`hreflang="en" href="https://shorevest\\.com/${en}"`), `${cn} en alternate`);
  assert.ok(hrefs(enHtml).includes(cn), `${en} links to Chinese equivalent`);
  assert.ok(hrefs(cnHtml).includes(en), `${cn} links to English equivalent`);
}
for (const file of fs.readdirSync(root).filter(f => f.endsWith('.html'))) {
  for (const href of hrefs(read(file))) {
    const target = localTarget(file, href);
    if (target) assert.ok(exists(target), `${file} link ${href} should resolve to ${target}`);
  }
}
// --- Organization JSON-LD structured data (home.html / home_cn.html) ---
function organizationJsonLd(html, label) {
  const blocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
    .map(m => JSON.parse(m[1]))
    .filter(obj => obj['@type'] === 'Organization');
  assert.strictEqual(blocks.length, 1, `${label} should contain exactly one Organization JSON-LD block`);
  return blocks[0];
}
const orgEn = organizationJsonLd(read('home.html'), 'home.html');
const orgCn = organizationJsonLd(read('home_cn.html'), 'home_cn.html');
for (const [label, org] of [['home.html', orgEn], ['home_cn.html', orgCn]]) {
  assert.strictEqual(org['@id'], 'https://shorevest.com/#organization', `${label} organization @id`);
  assert.strictEqual(org.name, 'ShoreVest Partners', `${label} organization name`);
  assert.ok(Array.isArray(org.alternateName), `${label} alternateName is an array`);
  assert.ok(org.alternateName.includes('ShoreVest'), `${label} alternateName includes ShoreVest`);
  assert.ok(org.alternateName.includes('新岸资本'), `${label} alternateName includes 新岸资本`);
  assert.strictEqual(org.url, 'https://shorevest.com/', `${label} organization url`);
  assert.strictEqual(org.foundingDate, '2016', `${label} organization foundingDate`);
  assert.strictEqual(org.founder && org.founder.name, 'Benjamin Fanger', `${label} founder name`);
  assert.ok(Array.isArray(org.sameAs), `${label} sameAs is an array`);
  assert.ok(org.sameAs.includes('https://www.linkedin.com/company/shorevest-partners/'), `${label} sameAs includes LinkedIn`);
  assert.ok(org.sameAs.includes('https://adviserinfo.sec.gov/firm/summary/284681'), `${label} sameAs includes SEC`);
}
// Both language versions must resolve to one stable entity ID.
assert.strictEqual(orgEn['@id'], orgCn['@id'], 'EN and CN homepages share one organization @id');
// The declared logo asset must exist locally.
assert.ok(exists('assets/apple-touch-icon-cinnabar.png'), 'organization logo asset exists');

console.log('site QA route, link, language, metadata, and organization schema tests passed');
