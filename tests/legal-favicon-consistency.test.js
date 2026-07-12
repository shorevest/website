const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const faviconSelector = /<link\s+[^>]*(?:rel="(?:shortcut\s+)?icon"|rel="apple-touch-icon"|rel="manifest")[^>]*>/gi;

function readPage(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function faviconLinks(file) {
  return readPage(file).match(faviconSelector) || [];
}

function assertFaviconParity(homepage, pages) {
  const homepageLinks = faviconLinks(homepage);
  assert(homepageLinks.length > 0, `${homepage} should define favicon links`);

  pages.forEach((page) => {
    assert.deepStrictEqual(
      faviconLinks(page),
      homepageLinks,
      `${page} should use the same favicon links as ${homepage}`
    );
  });
}

function topLevelPagesMatching(pattern) {
  return fs
    .readdirSync(root)
    .filter((file) => pattern.test(file))
    .sort();
}

assertFaviconParity('index.html', [
  'team.html',
  'contact.html',
  'investor-portal.html',
  'investor-portal/index.html',
  'privacy-policy.html',
  'cookie-notice.html',
  'terms-of-use.html',
  'important-information.html',
  'legal-notices-disclaimers.html'
]);

assertFaviconParity(
  'index_cn.html',
  topLevelPagesMatching(/_cn\.html$/).filter((page) => page !== 'index_cn.html')
);

assert.deepStrictEqual(
  faviconLinks('investor-portal/index_cn.html'),
  faviconLinks('index_cn.html').map((link) => link.replace(/href="(?!\.\.\/)/, 'href="../')),
  'investor-portal/index_cn.html should use the same Chinese favicon links with paths adjusted for its nested directory'
);

console.log('legal favicon consistency tests passed');
