'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'assets/data/clean-url-manifest.json');
const REPORT = path.join(ROOT, 'cdd-completeness-report.json');

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const wordCount = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;
const clean = value => String(value == null ? '' : value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const normalize = value => clean(value)
  .replace(/&amp;/gi, '&')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .toLowerCase();

function listFiles(dir, predicate, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const name of fs.readdirSync(abs)) {
    const rel = path.posix.join(dir, name);
    const stat = fs.statSync(path.join(ROOT, rel));
    if (stat.isDirectory()) listFiles(rel, predicate, out);
    else if (predicate(rel)) out.push(rel);
  }
  return out;
}

function archiveRows() {
  const html = read('insights.html');
  const rows = new Map();
  for (const match of html.matchAll(/<article\b[\s\S]*?<\/article>/gi)) {
    const block = match[0];
    const route = /data-href=["'](\/insights\/china-debt-dynamics\/v\d+i\d+\/)["']/i.exec(block);
    if (!route) continue;
    const title = /class=["'][^"']*cdd-arc__row-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i.exec(block);
    const pdf = /class=["'][^"']*cdd-arc__pdf[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(block);
    rows.set(route[1], { title: title ? clean(title[1]) : '', pdf: pdf ? pdf[1] : '' });
  }
  return rows;
}

function printSource(href) {
  try {
    const url = new URL(href, 'https://shorevest.com');
    return (url.searchParams.get('source') || '').replace(/^\//, '');
  } catch (_) {
    return '';
  }
}

if (!fs.existsSync(MANIFEST)) throw new Error('Missing clean URL manifest.');
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const routes = (manifest.routes || []).filter(item => /^\/insights\/china-debt-dynamics\/v\d+i\d+\/$/i.test(item.route));
const archive = archiveRows();
const errors = [];
const warnings = [];
const issues = [];
const usedData = new Set();
const usedFigures = new Set();

for (const item of routes) {
  const result = { route: item.route, source: item.source, indexable: item.indexable, errors: [], warnings: [] };
  const fail = message => { result.errors.push(message); errors.push(`${item.route}: ${message}`); };
  const warn = message => { result.warnings.push(message); warnings.push(`${item.route}: ${message}`); };

  if (!exists(item.source)) {
    fail(`missing source HTML ${item.source}`);
    issues.push(result);
    continue;
  }

  const html = read(item.source);
  const sourceMatch = /data-(?:article-source|default-article-source)=["']([^"']+)["']/i.exec(html);
  if (!sourceMatch) {
    fail('source HTML has no article data source');
    issues.push(result);
    continue;
  }

  const dataRel = sourceMatch[1].replace(/^\//, '').split(/[?#]/)[0];
  result.data = dataRel;
  usedData.add(dataRel);
  if (!exists(dataRel)) {
    fail(`missing article data ${dataRel}`);
    issues.push(result);
    continue;
  }

  let data;
  try { data = JSON.parse(read(dataRel)); }
  catch (error) {
    fail(`invalid JSON: ${error.message}`);
    issues.push(result);
    continue;
  }

  for (const field of ['series', 'volumeIssue', 'published', 'title', 'dek', 'disclaimer', 'copyright']) {
    if (!clean(data[field])) fail(`missing ${field}`);
  }
  if (!Array.isArray(data.keyFindings) || data.keyFindings.length < 2) fail('fewer than two key findings');
  if (!Array.isArray(data.sections) || data.sections.length < 2) fail('fewer than two article sections');

  const routeIssue = /\/v(\d+)i(\d+)\/$/i.exec(item.route);
  const dataIssue = /volume\s*(\d+)\s*[|·-]\s*issue\s*(\d+)/i.exec(data.volumeIssue || '');
  if (!dataIssue) fail(`unparseable volumeIssue: ${data.volumeIssue}`);
  else if (routeIssue && (routeIssue[1] !== dataIssue[1] || routeIssue[2] !== dataIssue[2])) {
    fail(`route numbering does not match ${data.volumeIssue}`);
  }

  const pubYears = String(data.published || '').match(/\b20\d{2}\b/g) || [];
  const copyright = /©\s*(20\d{2})/.exec(data.copyright || '');
  const pubYear = pubYears.length ? Number(pubYears[pubYears.length - 1]) : 0;
  const copyYear = copyright ? Number(copyright[1]) : 0;
  if (!pubYear) fail(`unparseable publication date: ${data.published}`);
  if (!copyYear) fail(`unparseable copyright: ${data.copyright}`);
  if (pubYear && copyYear && copyYear < pubYear) fail(`copyright year ${copyYear} predates publication year ${pubYear}`);

  let words = 0;
  let figures = 0;
  for (const [sectionIndex, section] of (data.sections || []).entries()) {
    const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs : [];
    const bullets = Array.isArray(section.bullets) ? section.bullets : [];
    const images = Array.isArray(section.images) ? section.images : [];
    words += paragraphs.reduce((sum, value) => sum + wordCount(value), 0);
    words += bullets.reduce((sum, value) => sum + wordCount(value), 0);
    if (!paragraphs.length && !bullets.length && !images.length) fail(`section ${sectionIndex + 1} has no content`);
    for (const value of [...paragraphs, ...bullets]) {
      if (!clean(value)) fail(`section ${sectionIndex + 1} contains empty copy`);
      if (/�|Ã.|â(?:€|€™|€œ|€)/.test(value)) fail(`section ${sectionIndex + 1} contains broken encoding`);
      if (/\b(?:lorem ipsum|placeholder copy|content coming soon|insert (?:chart|figure|text)|tbd)\b/i.test(value)) fail(`section ${sectionIndex + 1} contains placeholder content`);
    }
    for (const image of images) {
      figures += 1;
      const src = clean(image && image.src).replace(/^\//, '').split(/[?#]/)[0];
      if (!src) { fail(`section ${sectionIndex + 1} has a figure without src`); continue; }
      usedFigures.add(src);
      if (!clean(image.alt)) fail(`figure ${src} has no alt text`);
      if (!clean(image.caption)) fail(`figure ${src} has no caption`);
      if (!exists(src)) { fail(`missing figure ${src}`); continue; }
      const stat = fs.statSync(path.join(ROOT, src));
      if (!stat.size) fail(`figure ${src} is empty`);
      if (/\.svg$/i.test(src)) {
        const svg = read(src);
        if (!/<svg\b/i.test(svg)) fail(`figure ${src} is not SVG markup`);
        if (!/viewBox\s*=|(?:\bwidth\s*=.*\bheight\s*=)/is.test(svg)) fail(`figure ${src} has no usable dimensions`);
        if (/\b(?:todo|placeholder|replace me|sample chart)\b/i.test(svg)) fail(`figure ${src} contains placeholder text`);
      }
    }
  }
  result.wordCount = words;
  result.figureCount = figures;
  if (item.indexable && words < 500) fail(`indexable article is only ${words} words`);
  else if (words < 500) warn(`non-indexable article is only ${words} words`);

  const title = /<title>([\s\S]*?)<\/title>/i.exec(html);
  const staticTitle = title ? clean(title[1]).replace(/\s*\|\s*ShoreVest\s*$/i, '') : '';
  if (!staticTitle) fail('missing static page title');
  else if (normalize(staticTitle) !== normalize(data.title)) fail('static page title does not match article title');
  if (!/cdd-article-template\.js/i.test(html)) fail('missing article renderer script');
  if (!/cdd-article-template\.css/i.test(html)) fail('missing article stylesheet');

  const pdf = /href=["']([^"']*\/insights\/china-debt-dynamics\/print\/[^"']*)["']/i.exec(html);
  if (!pdf) fail('missing PDF/print link');
  else {
    const source = printSource(pdf[1]);
    if (source && source !== dataRel) fail(`PDF link loads ${source}, expected ${dataRel}`);
  }

  const row = archive.get(item.route);
  result.inArchive = Boolean(row);
  if (item.indexable && !row) fail('indexable issue is missing from the archive');
  if (row) {
    if (normalize(row.title) !== normalize(data.title)) fail('archive title does not match article title');
    const source = printSource(row.pdf);
    if (source && source !== dataRel) fail(`archive PDF loads ${source}, expected ${dataRel}`);
  }
  issues.push(result);
}

for (const rel of listFiles('assets/data', value => /^assets\/data\/china-debt-dynamics-.+\.json$/i.test(value))) {
  if (!usedData.has(rel)) warnings.push(`orphaned CDD data file: ${rel}`);
}
for (const rel of listFiles('assets/images/insights', value => /\.(?:svg|png|jpe?g|webp)$/i.test(value))) {
  if (!usedFigures.has(rel)) warnings.push(`unreferenced insight figure: ${rel}`);
}

const summary = {
  generatedAt: new Date().toISOString(),
  issueCount: issues.length,
  indexableIssueCount: issues.filter(item => item.indexable).length,
  archiveIssueCount: archive.size,
  totalWords: issues.reduce((sum, item) => sum + (item.wordCount || 0), 0),
  totalFigures: issues.reduce((sum, item) => sum + (item.figureCount || 0), 0),
  errors: errors.length,
  warnings: warnings.length
};
fs.writeFileSync(REPORT, `${JSON.stringify({ summary, issues, errors, warnings }, null, 2)}\n`);
console.log(`CDD audit checked ${summary.issueCount} issues, ${summary.totalWords} article words, and ${summary.totalFigures} figures.`);
if (warnings.length) warnings.forEach(message => console.warn(`WARNING: ${message}`));
if (errors.length) {
  errors.forEach(message => console.error(`ERROR: ${message}`));
  process.exit(1);
}
console.log(`CDD completeness audit passed with ${summary.archiveIssueCount} archive entries.`);
