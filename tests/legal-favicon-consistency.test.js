const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const faviconSelector = /<link\s+[^>]*(?:rel="(?:shortcut\s+)?icon"|rel="apple-touch-icon"|rel="manifest")[^>]*>/gi;

function readPage(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1] : undefined;
}

// Favicon hrefs must be page-relative so the site works from the domain
// root and from a subpath (e.g. GitHub Pages project sites) alike. Each
// href is resolved against its page's directory so pages at different
// depths are compared by the file they actually point to.
function faviconLinks(file) {
  const pageDir = path.posix.dirname(file);
  return (readPage(file).match(faviconSelector) || []).map((tag) => {
    const href = attr(tag, 'href');
    assert(href, `${file}: favicon link is missing an href: ${tag}`);
    assert(
      !/^(\/|https?:)/i.test(href),
      `${file}: favicon href must be page-relative, got "${href}"`
    );
    return {
      rel: attr(tag, 'rel'),
      target: path.posix.normalize(path.posix.join(pageDir, href.split(/[?#]/)[0])),
      type: attr(tag, 'type'),
      sizes: attr(tag, 'sizes'),
    };
  });
}

function assertTeamFaviconsAreEarly(page) {
  const html = readPage(page);
  const titleIndex = html.indexOf('<title>');
  const firstFaviconIndex = html.indexOf('<link rel="icon" href="assets/favicon-cinnabar.ico?v=');
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

  homepageLinks.forEach((link) => {
    assert(
      fs.existsSync(path.join(root, link.target)),
      `${homepage}: favicon target does not exist: ${link.target}`
    );
  });

  pages.forEach((page) => {
    assert.deepStrictEqual(
      faviconLinks(page),
      homepageLinks,
      `${page} should reference the same favicon files as ${homepage}`
    );
  });
}

function assertTeamPathRelativeFallbacks(page) {
  const targets = faviconLinks(page).map((link) => link.target);
  [
    'assets/favicon-cinnabar.ico',
    'assets/favicon-cinnabar.svg',
    'assets/favicon-cinnabar-32x32.png',
    'assets/favicon-cinnabar-16x16.png',
    'assets/apple-touch-icon-cinnabar.png',
    'site.webmanifest',
  ].forEach((target) => {
    assert(targets.includes(target), `${page} should include path-relative favicon fallback: ${target}`);
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
  'home.html',
  sitePages().filter((page) => page !== 'home.html')
);

assertTeamFaviconsAreEarly('team.html');
assertTeamFaviconsAreEarly('team_cn.html');

assertTeamPathRelativeFallbacks('team.html');
assertTeamPathRelativeFallbacks('team_cn.html');

console.log('legal favicon consistency tests passed');
