const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pairedBases = ['index','firm','strategy','insights','press','team','contact','privacy-policy','cookie-notice','terms-of-use','important-information','legal-notices-disclaimers','investor-access','investor-access-portal-terms'];
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
console.log('site QA route, link, language, and metadata tests passed');
