#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INSIGHTS_ROOT = path.join(ROOT, 'insights', 'china-debt-dynamics');
const SITE_ORIGIN = 'https://shorevest.com';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/assets/brand/sv-lockup-fc-dark.png`;
const validateOnly = process.argv.includes('--validate');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function articleFiles() {
  if (!fs.existsSync(INSIGHTS_ROOT)) return [];
  return fs.readdirSync(INSIGHTS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^v\d+i\d+$/i.test(entry.name))
    .map(entry => path.join(INSIGHTS_ROOT, entry.name, 'index.html'))
    .filter(file => fs.existsSync(file));
}

function extract(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1].trim() : '';
}

function removeTag(html, pattern) {
  return html.replace(pattern, '');
}

function metadataFor(file, html) {
  const canonical = extract(html, /<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (!canonical || !canonical.startsWith(`${SITE_ORIGIN}/insights/china-debt-dynamics/`)) {
    throw new Error(`Missing or invalid Insight canonical URL: ${path.relative(ROOT, file)}`);
  }

  const source = extract(html, /data-(?:article-source|default-article-source)=["']([^"']+)["']/i);
  let data = {};
  if (source) {
    const sourcePath = source.split(/[?#]/)[0].replace(/^\//, '');
    const dataFile = path.join(ROOT, sourcePath);
    if (fs.existsSync(dataFile)) {
      data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }
  }

  const documentTitle = extract(html, /<title>([\s\S]*?)<\/title>/i).replace(/\s*\|\s*ShoreVest\s*$/i, '');
  const title = String(data.title || documentTitle || 'China Debt Dynamics').trim();
  const description = String(data.dek || 'Read China Debt Dynamics from ShoreVest.').trim();

  return { canonical, title, description };
}

function metadataBlock(meta) {
  return [
    `  <meta name="description" content="${escapeHtml(meta.description)}">`,
    '  <meta property="og:type" content="article">',
    '  <meta property="og:site_name" content="ShoreVest">',
    `  <meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `  <meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `  <meta property="og:url" content="${escapeHtml(meta.canonical)}">`,
    `  <meta property="og:image" content="${escapeHtml(DEFAULT_IMAGE)}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
    `  <meta name="twitter:image" content="${escapeHtml(DEFAULT_IMAGE)}">`
  ].join('\n');
}

function stripExistingMetadata(html) {
  const patterns = [
    /\s*<meta\s+name=["']description["'][^>]*>\s*/gi,
    /\s*<meta\s+property=["']og:(?:type|site_name|title|description|url|image)["'][^>]*>\s*/gi,
    /\s*<meta\s+name=["']twitter:(?:card|title|description|image)["'][^>]*>\s*/gi
  ];
  return patterns.reduce(removeTag, html);
}

function validate(file, html, meta) {
  const checks = [
    ['og:title', new RegExp(`<meta\\s+property=["']og:title["'][^>]*content=["']${escapeRegExp(escapeHtml(meta.title))}["']`, 'i')],
    ['og:description', new RegExp(`<meta\\s+property=["']og:description["'][^>]*content=["']${escapeRegExp(escapeHtml(meta.description))}["']`, 'i')],
    ['og:url', new RegExp(`<meta\\s+property=["']og:url["'][^>]*content=["']${escapeRegExp(meta.canonical)}["']`, 'i')]
  ];
  for (const [label, pattern] of checks) {
    if (!pattern.test(html)) throw new Error(`${label} mismatch: ${path.relative(ROOT, file)}`);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const files = articleFiles();
if (!files.length) throw new Error('No generated Insight article pages found.');

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const meta = metadataFor(file, original);

  if (validateOnly) {
    validate(file, original, meta);
    continue;
  }

  let updated = stripExistingMetadata(original);
  updated = updated.replace(/<\/head>/i, `${metadataBlock(meta)}\n</head>`);
  validate(file, updated, meta);
  if (updated !== original) fs.writeFileSync(file, updated);
}

console.log(`${validateOnly ? 'Validated' : 'Updated'} LinkedIn metadata for ${files.length} Insight article pages.`);
