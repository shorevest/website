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


function assertTeamFaviconsAreEarly(page) {
  const html = readPage(page);
  const titleIndex = html.indexOf('<title>');
  const firstFaviconIndex = html.indexOf('<link rel="icon" href="/favicon.ico" sizes="any">');
  const firstStylesheetIndex = html.indexOf('rel="stylesheet"');

  assert(titleIndex !== -1, `${page} should define a title`);
  assert(firstFaviconIndex !== -1, `${page} should define the primary favicon link`);
  assert(
    firstFaviconIndex > titleIndex,
    `${page} should keep favicon declarations immediately after the document title`
  );
  assert(
    firstStylesheetIndex === -1 || firstFaviconIndex < firstStylesheetIndex,
    `${page} should expose favicon declarations before stylesheet discovery`
  );
}

function assertFaviconParity(homepage, pages) {
  const homepageLinks = faviconLinks(homepage);
  assert(homepageLinks.length > 0, `${homepage} should define favicon links`);

  pages.forEach((page) => {
    const pageLinks = faviconLinks(page);
    homepageLinks.forEach((link) => {
      assert(
        pageLinks.includes(link),
        `${page} should include approved homepage favicon declaration: ${link}`
      );
    });
  });
}

function assertTeamPathRelativeFallbacks(page) {
  const links = faviconLinks(page);
  [
    '<link rel="icon" href="favicon.ico" sizes="any">',
    '<link rel="shortcut icon" href="favicon.ico">',
    '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">',
    '<link rel="manifest" href="site.webmanifest">',
  ].forEach((link) => {
    assert(links.includes(link), `${page} should include path-relative favicon fallback: ${link}`);
  });
}

function sitePages() {
  const pages = [];

  function walk(dir) {
    fs.readdirSync(path.join(root, dir), { withFileTypes: true }).forEach((entry) => {
      const relativePath = path.posix.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === '.git' || relativePath === 'assets/email') return;
        walk(relativePath);
        return;
      }

      if (entry.isFile() && entry.name.endsWith('.html')) pages.push(relativePath);
    });
  }

  walk('.');
  return pages.sort();
}

assertFaviconParity(
  'index.html',
  sitePages().filter((page) => page !== 'index.html')
);

assertTeamFaviconsAreEarly('team.html');
assertTeamFaviconsAreEarly('team_cn.html');
assertTeamPathRelativeFallbacks('team.html');
assertTeamPathRelativeFallbacks('team_cn.html');

console.log('legal favicon consistency tests passed');
