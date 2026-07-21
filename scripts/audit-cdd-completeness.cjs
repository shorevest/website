'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'assets', 'data', 'clean-url-manifest.json');
const ARCHIVE = path.join(ROOT, 'insights.html');
const REPORT = path.join(ROOT, 'cdd-completeness-report.json');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}
function words(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}
function text(value) {
  return String(value == null ? '' : value).trim();
}
function normalize(value) {
  return text(value)
    .replace(/&amp;/gi, '&')
    .replace(/&rsquo;/gi, '’')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
function stripTags(value) {
  return text(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function listFiles(dirRel, predicate, out = []) {
  const abs = path.join(ROOT, dirRel);
  if (!fs.existsSync(abs)) return out;
  for (const name of fs.readdirSync(abs)) {
    const rel = path.posix.join(dirRel.replace(/\\/g, '/'), name);
    const item = path.join(ROOT, rel);
    const stat = fs.statSync(item);
    if (stat.isDirectory()) listFiles(rel, predicate, out);
    else if (!predicate || predicate(rel)) out.push(rel);
  }
  return out;
}
function parseArchive(html) {
  const rows = new Map();
  const pattern = /<article\b[\s\S]*?<\/article>/gi;
  for (const match of html.matchAll(pattern)) {
    const block = match[0];
    const hrefMatch = /data-href\s*=\s*["']([^"']+)["']/i.exec(block) || /href=["'](\/insights\/china-debt-dynamics\/v\d+i\d+\/)["']/i.exec(block);
    if (!hrefMatch) continue;
    const href = hrefMatch[1].split('?')[0].split('#')[0];
    if (!/^\/insights\/china-debt-dynamics\/v\d+i\d+\/$/i.test(href)) continue;
    const titleMatch = /class=["'][^"']*cdd-arc__row-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i.exec(block);
    const issueMatch = /class=["'][^"']*cdd-arc__chip-issue[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(block);
    const dateMatch = /class=["'][^"']*cdd-arc__date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(block);
    const pdfMatch = /class=["'][^"']*cdd-arc__pdf[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(block);
    rows.set(href, {
      title: titleMatch ? stripTags(titleMatch[1]) : '',
      issue: issueMatch ? stripTags(issueMatch[1]) : '',
      date: dateMatch ? stripTags(dateMatch[1]) : '',
      pdf: pdfMatch ? pdfMatch[1] : ''
    });
  }
  return rows;
}
function collectStrings(data) {
  const values = [data.title, data.dek, data.disclaimer, data.copyright, ...(data.keyFindings || [])];
  for (const section of data.sections || []) {
    values.push(section.heading);
    values.push(...(section.paragraphs || []));
    values.push(...(section.bullets || []));
    for (const image of section.images || []) values.push(image.alt, image.caption);
  }
  return values.map(text).filter(Boolean);
}
function parseIssue(value) {
  const match = String(value || '').match(/volume\s*(\d+)\s*[|·-]\s*issue\s*(\d+)/i);
  return match ? { volume: Number(match[1]), issue: Number(match[2]) } : null;
}
function parseRouteIssue(route) {
  const match = route.match(/\/v(\d+)i(\d+)\/$/i);
  return match ? { volume: Number(match[1]), issue: Number(match[2]) } : null;
}
function publishedYear(value) {
  const matches = String(value || '').match(/\b(20\d{2})\b/g);
  return matches ? Number(matches[matches.length - 1]) : null;
}
function copyrightYear(value) {
  const match = String(value || '').match(/©\s*(20\d{2})/);
  return match ? Number(match[1]) : null;
}
function sourceFromPrintHref(href) {
  if (!href) return '';
  try {
    const url = new URL(href, 'https://shorevest.com');
    return url.searchParams.get('source') || url.searchParams.get('src') || '';
  } catch (_) {
    return '';
  }
}
function checkSvg(rel, errors, warnings, issueRoute) {
  const content = read(rel);
  if (!/<svg\b/i.test(content)) errors.push(`${issueRoute}: figure ${rel} is not valid SVG markup`);
  if (!/viewBox\s*=|(?:\bwidth\s*=.*\bheight\s*=)/is.test(content)) {
    errors.push(`${issueRoute}: figure ${rel} has no usable SVG dimensions`);
  }
  if (/\b(?:todo|placeholder|replace me|sample chart)\b/i.test(content)) {
    errors.push(`${issueRoute}: figure ${rel} contains placeholder text`);
  }
  if (content.length < 300) warnings.push(`${issueRoute}: figure ${rel} is unusually small (${content.length} bytes)`);
  for (const match of content.matchAll(/(?:href|xlink:href)=["']([^"']+)["']/gi)) {
    const value = match[1];
    if (/^(?:data:|#|https?:|\/\/)/i.test(value)) continue;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), value));
    if (!exists(target)) errors.push(`${issueRoute}: SVG ${rel} embeds missing asset ${target}`);
  }
}

if (!fs.existsSync(MANIFEST)) throw new Error('Missing clean URL manifest.');
if (!fs.existsSync(ARCHIVE)) throw new Error('Missing insights archive.');

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const archiveRows = parseArchive(fs.readFileSync(ARCHIVE, 'utf8'));
const routes = (manifest.routes || []).filter(item => /^\/insights\/china-debt-dynamics\/v\d+i\d+\/$/i.test(item.route));
const errors = [];
const warnings = [];
const issues = [];
const usedDataFiles = new Set();
const usedFigureFiles = new Set();

for (const item of routes) {
  const issue = { route: item.route, source: item.source, indexable: item.indexable, errors: [], warnings: [] };
  const fail = message => { issue.errors.push(message); errors.push(`${item.route}: ${message}`); };
  const warn = message => { issue.warnings.push(message); warnings.push(`${item.route}: ${message}`); };

  if (!exists(item.source)) {
    fail(`missing source HTML ${item.source}`);
    issues.push(issue);
    continue;
  }

  const html = read(item.source);
  const dataMatch = /\bdata-(?:article-source|default-article-source)\s*=\s*["']([^"']+)["']/i.exec(html);
  if (!dataMatch) {
    fail('source HTML has no data-article-source');
    issues.push(issue);
    continue;
  }

  const dataRel = dataMatch[1].replace(/^\//, '').split('?')[0].split('#')[0];
  issue.data = dataRel;
  usedDataFiles.add(dataRel);
  if (!exists(dataRel)) {
    fail(`missing article data ${dataRel}`);
    issues.push(issue);
    continue;
  }

  let data;
  try { data = JSON.parse(read(dataRel)); }
  catch (error) {
    fail(`invalid JSON in ${dataRel}: ${error.message}`);
    issues.push(issue);
    continue;
  }

  for (const field of ['series', 'volumeIssue', 'published', 'title', 'dek', 'disclaimer', 'copyright']) {
    if (!text(data[field])) fail(`missing ${field}`);
  }
  if (data.series !== 'China Debt Dynamics') warn(`unexpected series name: ${data.series}`);
  if (!Array.isArray(data.keyFindings) || data.keyFindings.length < 2) warn('fewer than two key findings');
  if (!Array.isArray(data.sections) || data.sections.length < 2) fail('article has fewer than two sections');

  const routeIssue = parseRouteIssue(item.route);
  const dataIssue = parseIssue(data.volumeIssue);
  if (!dataIssue) fail(`cannot parse volumeIssue: ${data.volumeIssue}`);
  else if (routeIssue && (routeIssue.volume !== dataIssue.volume || routeIssue.issue !== dataIssue.issue)) {
    fail(`route issue v${routeIssue.volume}i${routeIssue.issue} does not match ${data.volumeIssue}`);
  }

  const pubYear = publishedYear(data.published);
  const copyYear = copyrightYear(data.copyright);
  issue.publishedYear = pubYear;
  issue.copyrightYear = copyYear;
  if (!pubYear) fail(`cannot parse published year: ${data.published}`);
  if (!copyYear) fail(`cannot parse copyright year: ${data.copyright}`);
  if (pubYear && copyYear && copyYear < pubYear) fail(`copyright year ${copyYear} predates publication year ${pubYear}`);

  const allStrings = collectStrings(data);
  const articleWordCount = (data.sections || []).reduce((total, section) => {
    return total + (section.paragraphs || []).reduce((n, p) => n + words(p), 0) + (section.bullets || []).reduce((n, b) => n + words(b), 0);
  }, 0);
  issue.wordCount = articleWordCount;
  if (item.indexable && articleWordCount < 500) fail(`indexable article is only ${articleWordCount} words`);
  else if (articleWordCount < 500) warn(`hidden article is only ${articleWordCount} words`);

  const badEncoding = allStrings.find(value => /�|Ã.|â(?:€|€™|€œ|€)|\uFFFD/.test(value));
  if (badEncoding) fail(`contains broken character encoding near: ${badEncoding.slice(0, 90)}`);
  const placeholder = allStrings.find(value => /\b(?:lorem ipsum|placeholder copy|content coming soon|insert (?:chart|figure|text)|tbd)\b/i.test(value));
  if (placeholder) fail(`contains placeholder content near: ${placeholder.slice(0, 90)}`);
  const truncation = allStrings.find(value => /(?:\.\.\.|…)$/.test(value) && words(value) > 8);
  if (truncation) warn(`text may be truncated near: ${truncation.slice(0, 90)}`);

  let figureCount = 0;
  let sourceCaptionCount = 0;
  let emptySections = 0;
  for (let index = 0; index < (data.sections || []).length; index += 1) {
    const section = data.sections[index] || {};
    const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs : [];
    const bullets = Array.isArray(section.bullets) ? section.bullets : [];
    const images = Array.isArray(section.images) ? section.images : [];
    if (!paragraphs.length && !bullets.length && !images.length) {
      const next = data.sections[index + 1] || {};
      const allowedPartLabel = text(section.heading) && text(next.heading);
      if (!allowedPartLabel) emptySections += 1;
    }
    for (const paragraph of paragraphs) {
      if (!text(paragraph)) fail(`section ${index + 1} contains an empty paragraph`);
      if ((String(paragraph).match(/(?:^|\s)\d+\.\s/g) || []).length >= 3) {
        warn(`section ${index + 1} contains a numbered list embedded in one paragraph`);
      }
    }
    for (const bullet of bullets) if (!text(bullet)) fail(`section ${index + 1} contains an empty bullet`);
    for (const image of images) {
      figureCount += 1;
      if (!image || !text(image.src)) { fail(`section ${index + 1} has a figure without src`); continue; }
      const rel = text(image.src).replace(/^\//, '').split('?')[0].split('#')[0];
      usedFigureFiles.add(rel);
      if (!text(image.alt)) fail(`figure ${image.src} has no alt text`);
      if (!text(image.caption)) fail(`figure ${image.src} has no caption`);
      if (/\bsource\s*:/i.test(text(image.caption))) sourceCaptionCount += 1;
      if (!exists(rel)) { fail(`missing figure asset ${rel}`); continue; }
      const stat = fs.statSync(path.join(ROOT, rel));
      if (stat.size === 0) fail(`figure asset ${rel} is empty`);
      if (/\.svg$/i.test(rel)) checkSvg(rel, issue.errors, issue.warnings, item.route);
      else if (stat.size < 1024) warn(`figure asset ${rel} is unusually small (${stat.size} bytes)`);
    }
  }
  if (emptySections) fail(`${emptySections} section(s) have no content`);
  issue.figureCount = figureCount;
  if (figureCount && sourceCaptionCount < figureCount) warn(`${figureCount - sourceCaptionCount} figure caption(s) do not identify a source`);

  const referenceNumbers = [];
  for (const value of allStrings) {
    for (const match of value.matchAll(/\[(\d+)\]/g)) referenceNumbers.push(Number(match[1]));
  }
  const maxReference = referenceNumbers.length ? Math.max(...referenceNumbers) : 0;
  issue.maxReference = maxReference;
  if (maxReference) {
    const sourcesSection = (data.sections || []).find(section => /sources?(?: and notes)?|notes and sources/i.test(text(section.heading)));
    if (!sourcesSection) fail(`uses references through [${maxReference}] but has no Sources and Notes section`);
    else {
      const sourceText = [...(sourcesSection.paragraphs || []), ...(sourcesSection.bullets || [])].join('\n');
      const sourceNumbers = new Set([...sourceText.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1])));
      for (let n = 1; n <= maxReference; n += 1) if (!sourceNumbers.has(n)) fail(`Sources and Notes is missing reference [${n}]`);
    }
  }

  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
  const htmlTitle = titleMatch ? stripTags(titleMatch[1]).replace(/\s*\|\s*ShoreVest\s*$/i, '') : '';
  if (!htmlTitle) fail('source HTML has no page title');
  else if (normalize(htmlTitle) !== normalize(data.title)) fail('HTML title does not match JSON title');
  if (!/cdd-article-template\.js/i.test(html)) fail('article template script is missing');
  if (!/cdd-article-template\.css/i.test(html)) fail('article template stylesheet is missing');

  const articlePdfMatch = /class=["'][^"']*cdd-btn[^"']*cdd-btn--solid[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(html) || /href=["']([^"']*china-debt-dynamics\/print\/[^"']*)["']/i.exec(html);
  const articlePdf = articlePdfMatch ? articlePdfMatch[1] : '';
  if (!articlePdf) fail('article has no PDF/print link');
  else {
    const printSource = sourceFromPrintHref(articlePdf);
    if (printSource && printSource.replace(/^\//, '') !== dataRel) fail(`article PDF link loads ${printSource}, expected ${dataRel}`);
  }

  const archive = archiveRows.get(item.route);
  issue.inArchive = Boolean(archive);
  if (item.indexable && !archive) fail('indexable issue is missing from Insights archive');
  if (archive) {
    if (normalize(archive.title) !== normalize(data.title)) fail('archive title does not match JSON title');
    const archiveIssue = String(archive.issue || '').match(/(\d+)\.(\d+)/);
    if (routeIssue && archiveIssue && (Number(archiveIssue[1]) !== routeIssue.volume || Number(archiveIssue[2]) !== routeIssue.issue)) {
      fail(`archive issue ${archive.issue} does not match route`);
    }
    const archivePdfSource = sourceFromPrintHref(archive.pdf);
    if (archivePdfSource && archivePdfSource.replace(/^\//, '') !== dataRel) fail(`archive PDF link loads ${archivePdfSource}, expected ${dataRel}`);
    if (pubYear && archive.date && !archive.date.includes(String(pubYear))) warn(`archive date ${archive.date} does not show publication year ${pubYear}`);
  }

  issues.push(issue);
}

const allDataFiles = listFiles('assets/data', rel => /^assets\/data\/china-debt-dynamics-.+\.json$/i.test(rel));
for (const rel of allDataFiles) {
  if (!usedDataFiles.has(rel)) warnings.push(`orphaned CDD data file is not used by any issue route: ${rel}`);
}
const allInsightFigures = listFiles('assets/images/insights', rel => /\.(?:svg|png|jpe?g|webp)$/i.test(rel));
for (const rel of allInsightFigures) {
  if (!usedFigureFiles.has(rel)) warnings.push(`unreferenced insight figure asset: ${rel}`);
}

const summary = {
  generatedAt: new Date().toISOString(),
  issueCount: issues.length,
  indexableIssueCount: issues.filter(issue => issue.indexable).length,
  archiveIssueCount: archiveRows.size,
  totalWords: issues.reduce((sum, issue) => sum + (issue.wordCount || 0), 0),
  totalFigures: issues.reduce((sum, issue) => sum + (issue.figureCount || 0), 0),
  errors: errors.length,
  warnings: warnings.length
};
fs.writeFileSync(REPORT, `${JSON.stringify({ summary, issues, errors, warnings }, null, 2)}\n`);

console.log(`CDD completeness audit: ${summary.issueCount} routes, ${summary.totalWords} article words, ${summary.totalFigures} figures.`);
console.log(`Archive contains ${summary.archiveIssueCount} issue rows; ${summary.indexableIssueCount} issue routes are indexable.`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach(message => console.log(`- ${message}`));
}
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}
console.log('CDD completeness audit passed.');
