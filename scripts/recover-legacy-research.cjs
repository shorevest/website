'use strict';

// Exact replacements verified against the September 2026 Search Console 404
// examples and the published CDD archive. No wildcard/homepage fallback.
// GitHub Pages does not support server redirect rules: HTML aliases use an
// immediate meta refresh; PDF aliases serve the unchanged original PDF bytes.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = require('../assets/data/legacy-research-recovery.json');

function redirectHtml(target) {
  if (!/^\/insights\/china-debt-dynamics\/v\d+i\d+\/$/.test(target)) {
    throw new Error(`Invalid research destination: ${target}`);
  }
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex, follow">
  <meta http-equiv="refresh" content="0; url=${target}">
  <link rel="canonical" href="https://shorevest.com${target}">
  <title>Redirecting | ShoreVest</title>
  <script>window.location.replace(${JSON.stringify(target)} + (window.location.search || '') + (window.location.hash || ''));</script>
<!-- ShoreVest favicon: dated filenames prevent browsers from reusing retired tab artwork. -->
<link rel="icon" href="/assets/favicon-shorevest-20260724.svg" type="image/svg+xml" sizes="any">
<link rel="icon" href="/assets/favicon-shorevest-20260724.ico" sizes="any">
<link rel="shortcut icon" href="/assets/favicon-shorevest-20260724.ico">
<link rel="icon" href="/assets/favicon-shorevest-20260724-32x32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/assets/favicon-shorevest-20260724-16x16.png" type="image/png" sizes="16x16">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-shorevest-20260724.png" sizes="180x180">
<link rel="manifest" href="/site-20260724.webmanifest">
</head>
<body><p>This research has moved. <a href="${target}">Read China Debt Dynamics</a>.</p></body>
</html>
`;
}

function outputs() {
  const result = [];
  for (const [route, target] of Object.entries(manifest.redirects)) {
    if (!/^\/(china-debt-dynamics|news-insights)\/[a-z0-9-]+\/$/.test(route)) throw new Error(`Invalid alias: ${route}`);
    if (!fs.existsSync(path.join(root, target, 'index.html'))) throw new Error(`Missing article: ${target}`);
    result.push({ file: path.join(root, route, 'index.html'), content: Buffer.from(redirectHtml(target)) });
  }
  for (const [route, source] of Object.entries(manifest.pdfs)) {
    if (!/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+\.pdf$/.test(route) || !/^assets\/pdfs\/[^/]+\.pdf$/.test(source)) throw new Error(`Invalid PDF alias: ${route}`);
    const content = fs.readFileSync(path.join(root, source));
    if (content.subarray(0, 5).toString() !== '%PDF-') throw new Error(`Invalid PDF source: ${source}`);
    result.push({ file: path.join(root, route), content });
  }
  return result;
}

if (require.main === module) {
  const files = outputs();
  // Refuse to overwrite different existing content. Validate everything before
  // writing anything, so re-running is safe and unrelated changes are retained.
  for (const { file, content } of files) {
    if (fs.existsSync(file) && !fs.readFileSync(file).equals(content)) throw new Error(`Existing content differs: ${file}`);
    if (process.argv.includes('--check') && !fs.existsSync(file)) throw new Error(`Missing alias: ${file}`);
  }
  if (!process.argv.includes('--check')) {
    for (const { file, content } of files) {
      if (fs.existsSync(file)) continue;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content, { flag: 'wx' });
    }
  }
  console.log(`Verified ${Object.keys(manifest.redirects).length} article aliases and ${Object.keys(manifest.pdfs).length} original PDF aliases.`);
}

module.exports = { redirectHtml, outputs };
