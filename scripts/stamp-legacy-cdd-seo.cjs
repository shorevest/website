'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://shorevest.com';
const MARKER = 'data-sv-legacy-cdd="true"';

// These filenames are retained in the repository for compatibility/content history,
// but they are not primary clean-route sources in generate-clean-public-urls.js.
const EXCLUDED = new Set([
  'china-debt-dynamics-v8i6.html',
  'china-debt-dynamics-v9i4.html',
  'china-debt-dynamics-print.html'
]);

const OVERRIDES = {
  'china-debt-dynamics-45-beijings-campaign-against-overcapacity-creates-private-credit-opportunities.html': '/insights/china-debt-dynamics/v9i4/',
  'china-debt-dynamics-into-the-shadows-of-us-private-credit.html': '/insights/china-debt-dynamics/v9i3/',
  'china-debt-dynamics-v8i5.html': '/insights/china-debt-dynamics/v8i6/',
  'china-debt-dynamics-v8i3.html': '/insights/china-debt-dynamics/v8i5/',
  'china-debt-dynamics-v8i1.html': '/insights/china-debt-dynamics/v8i3/'
};

function routeForLegacyFile(filename) {
  if (EXCLUDED.has(filename)) return null;
  if (OVERRIDES[filename]) return OVERRIDES[filename];
  const match = filename.match(/^china-debt-dynamics-(v\d+i\d+)\.html$/i);
  return match ? `/insights/china-debt-dynamics/${match[1].toLowerCase()}/` : null;
}

function destinationForRoute(route) {
  return path.join(ROOT, route.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
}

function stripLegacyMarkers(html) {
  return html
    .replace(/\s*<meta\b[^>]*data-sv-legacy-cdd=["']true["'][^>]*>\s*/gi, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function setCanonical(html, route) {
  const absolute = `${SITE_ORIGIN}${route}`;
  const canonical = `<link rel="canonical" href="${absolute}">`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, canonical);
  }
  return html.replace(/<\/head>/i, `  ${canonical}\n</head>`);
}

function stampLegacySource(html, route) {
  let output = stripLegacyMarkers(html);
  output = setCanonical(output, route);
  const signals = [
    `<meta name="robots" content="noindex, follow" ${MARKER}>`,
    `<meta http-equiv="refresh" content="0; url=${route}" ${MARKER}>`
  ].join('\n  ');
  return output.replace(/<\/head>/i, `  ${signals}\n</head>`);
}

function cleanGeneratedRoute(html, route) {
  return setCanonical(stripLegacyMarkers(html), route);
}

function hasExpectedCanonical(html, route) {
  const escaped = `${SITE_ORIGIN}${route}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<link\\s+rel=["']canonical["'][^>]*href=["']${escaped}["']`, 'i').test(html) ||
    new RegExp(`<link\\s+[^>]*href=["']${escaped}["'][^>]*rel=["']canonical["']`, 'i').test(html);
}

function validateLegacySource(filename, route, html) {
  const errors = [];
  if (!html.includes(MARKER)) errors.push(`${filename}: missing static legacy marker`);
  if (!/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*data-sv-legacy-cdd=["']true["']/i.test(html) &&
      !/<meta\b[^>]*data-sv-legacy-cdd=["']true["'][^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
    errors.push(`${filename}: missing static noindex signal`);
  }
  if (!/<meta\b[^>]*http-equiv=["']refresh["'][^>]*data-sv-legacy-cdd=["']true["']/i.test(html) &&
      !/<meta\b[^>]*data-sv-legacy-cdd=["']true["'][^>]*http-equiv=["']refresh["']/i.test(html)) {
    errors.push(`${filename}: missing static redirect signal`);
  }
  if (!hasExpectedCanonical(html, route)) errors.push(`${filename}: canonical does not point to ${route}`);
  return errors;
}

function main() {
  const validateOnly = process.argv.includes('--validate');
  const files = fs.readdirSync(ROOT)
    .filter(name => /^china-debt-dynamics-.+\.html$/i.test(name))
    .sort();

  const errors = [];
  let legacyCount = 0;
  let cleanCount = 0;

  for (const filename of files) {
    const route = routeForLegacyFile(filename);
    if (!route) continue;
    legacyCount += 1;

    const sourcePath = path.join(ROOT, filename);
    const sourceBefore = fs.readFileSync(sourcePath, 'utf8');
    const sourceAfter = stampLegacySource(sourceBefore, route);

    const destinationPath = destinationForRoute(route);
    if (!fs.existsSync(destinationPath)) {
      errors.push(`${filename}: generated clean route is missing at ${path.relative(ROOT, destinationPath)}`);
      continue;
    }

    const destinationBefore = fs.readFileSync(destinationPath, 'utf8');
    const destinationAfter = cleanGeneratedRoute(destinationBefore, route);

    if (!validateOnly) {
      if (sourceAfter !== sourceBefore) fs.writeFileSync(sourcePath, sourceAfter);
      if (destinationAfter !== destinationBefore) fs.writeFileSync(destinationPath, destinationAfter);
    }

    const sourceToCheck = validateOnly ? sourceBefore : sourceAfter;
    const destinationToCheck = validateOnly ? destinationBefore : destinationAfter;
    errors.push(...validateLegacySource(filename, route, sourceToCheck));

    if (destinationToCheck.includes(MARKER)) {
      errors.push(`${path.relative(ROOT, destinationPath)}: inherited legacy noindex/refresh marker`);
    }
    if (!hasExpectedCanonical(destinationToCheck, route)) {
      errors.push(`${path.relative(ROOT, destinationPath)}: canonical does not point to ${route}`);
    }
    cleanCount += 1;
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  console.log(`${validateOnly ? 'Validated' : 'Stamped'} ${legacyCount} legacy CDD URLs and ${cleanCount} clean destinations.`);
}

main();
