'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GUARD_VERSION = '20260722-favicon-cache-bust';
const FAVICON_SVG = '/assets/favicon-shorevest-20260722.svg';
const FAVICON_ICO = '/assets/favicon-shorevest-20260722.ico';
const FAVICON_32 = '/assets/favicon-shorevest-20260722-32x32.png';
const FAVICON_16 = '/assets/favicon-shorevest-20260722-16x16.png';
const APPLE_TOUCH = '/assets/apple-touch-icon-shorevest-20260722.png';
const MANIFEST = '/site-20260722.webmanifest';

const FAVICON_BLOCK = [
  '<!-- ShoreVest favicon: versioned paths prevent Safari and browser cache fallback to the retired mark. -->',
  `<link rel="icon" href="${FAVICON_SVG}" type="image/svg+xml" sizes="any">`,
  `<link rel="icon" href="${FAVICON_ICO}" sizes="any">`,
  `<link rel="shortcut icon" href="${FAVICON_ICO}">`,
  `<link rel="icon" href="${FAVICON_32}" type="image/png" sizes="32x32">`,
  `<link rel="icon" href="${FAVICON_16}" type="image/png" sizes="16x16">`,
  `<link rel="apple-touch-icon" href="${APPLE_TOUCH}" sizes="180x180">`,
  `<link rel="manifest" href="${MANIFEST}">`
].join('\n');

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function isPublicHtml(absolute) {
  if (!absolute.toLowerCase().endsWith('.html')) return false;
  const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
  if (/^(?:internal-preview|employee-portal|docs|tests|api|services|infra|templates)(?:\/|$)/.test(relative)) return false;
  if (/^assets\/email\//.test(relative)) return false;
  return true;
}

function stripExistingFaviconLinks(html) {
  return html.replace(/^[ \t]*<link\b[^>]*>\s*\r?\n?/gim, tag => {
    const match = tag.match(/\brel\s*=\s*(["'])(.*?)\1/i);
    if (!match) return tag;
    const rels = match[2].toLowerCase().trim().split(/\s+/).filter(Boolean);
    const faviconRel = rels.some(rel =>
      rel === 'icon' ||
      rel === 'shortcut' ||
      rel === 'apple-touch-icon' ||
      rel === 'mask-icon' ||
      rel === 'manifest'
    );
    return faviconRel ? '' : tag;
  });
}

function refreshGuardVersion(html) {
  return html.replace(/<script\b[^>]*\bsrc=(["'])([^"']*assets\/js\/favicon-guard\.js)(?:\?[^"']*)?\1[^>]*>/gi, tag =>
    tag.replace(/favicon-guard\.js(?:\?[^"']*)?/i, `favicon-guard.js?v=${GUARD_VERSION}`)
  );
}

function insertFaviconBlock(html) {
  const viewport = /<meta\b[^>]*\bname=(["'])viewport\1[^>]*>\s*/i;
  if (viewport.test(html)) {
    return html.replace(viewport, match => `${match}\n${FAVICON_BLOCK}\n`);
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${FAVICON_BLOCK}\n</head>`);
  }
  return html;
}

function normalize(html) {
  if (!/<head(?:\s|>)/i.test(html)) return html;
  let output = stripExistingFaviconLinks(html);
  output = refreshGuardVersion(output);
  output = insertFaviconBlock(output);
  return output;
}

function main() {
  const validate = process.argv.includes('--validate');
  const changed = [];
  const invalid = [];

  for (const absolute of walk(ROOT).filter(isPublicHtml)) {
    const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
    const before = fs.readFileSync(absolute, 'utf8');
    const after = normalize(before);

    if (after !== before) {
      changed.push(relative);
      if (!validate) fs.writeFileSync(absolute, after);
    }

    const inspected = validate ? before : after;
    if (/<head(?:\s|>)/i.test(inspected)) {
      const hasVersionedIcon = inspected.includes(FAVICON_SVG) && inspected.includes(FAVICON_ICO);
      const hasRetiredReference = /favicon-cinnabar|assets\/favicon\.svg|site\.webmanifest/i.test(inspected);
      if (!hasVersionedIcon || hasRetiredReference) invalid.push(relative);
    }
  }

  if (validate && (changed.length || invalid.length)) {
    if (changed.length) console.error(`Favicon normalization required in ${changed.length} file(s): ${changed.slice(0, 10).join(', ')}`);
    if (invalid.length) console.error(`Invalid favicon declarations in ${invalid.length} file(s): ${invalid.slice(0, 10).join(', ')}`);
    process.exit(1);
  }

  if (!validate) console.log(`Normalized favicon declarations across ${changed.length} public HTML file(s).`);
  else console.log('Validated versioned favicon declarations across public HTML files.');
}

main();
