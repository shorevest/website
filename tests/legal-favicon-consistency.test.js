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

assertFaviconParity('index.html', [
  'privacy-policy.html',
  'cookie-notice.html',
  'terms-of-use.html',
  'important-information.html',
  'legal-notices-disclaimers.html'
]);

assertFaviconParity('index_cn.html', [
  'privacy-policy_cn.html',
  'cookie-notice_cn.html',
  'terms-of-use_cn.html',
  'important-information_cn.html',
  'legal-notices-disclaimers_cn.html'
]);

console.log('legal favicon consistency tests passed');
