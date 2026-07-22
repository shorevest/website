#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/clean-url-manifest.json'), 'utf8'));
const INSIGHTS = fs.readFileSync(path.join(ROOT, 'insights/index.html'), 'utf8');

const findings = [];
const rows = [];

function cleanText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;|&#8217;|&#x2019;/gi, '’')
    .replace(/&ldquo;|&#8220;|&#x201c;/gi, '“')
    .replace(/&rdquo;|&#8221;|&#x201d;/gi, '”')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function issueSlug(volumeIssue) {
  const match = String(volumeIssue || '').match(/Volume\s*(\d+)\s*\|\s*Issue\s*(\d+)/i);
  return match ? `v${match[1]}i${match[2]}` : null;
}

function routeSlug(route) {
  const match = route.match(/\/([^/]+)\/$/);
  return match ? match[1] : null;
}

function archiveArticle(route) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = INSIGHTS.match(new RegExp(`<article\\b[^>]*(?:data-href|[^>]*href)=["']${escaped}["'][^>]*>[\\s\\S]*?<\\/article>`, 'i'));
  return match ? match[0] : null;
}

function field(html, regex) {
  const match = html && html.match(regex);
  return match ? cleanText(match[1]) : null;
}

function add(level, route, message) {
  findings.push({ level, route, message });
}

const articleRoutes = MANIFEST.routes
  .filter(item => item.indexable && /^\/insights\/china-debt-dynamics\/v\d+i\d+\/$/i.test(item.route))
  .sort((a, b) => a.route.localeCompare(b.route, undefined, { numeric: true }));

for (const item of articleRoutes) {
  const pagePath = path.join(ROOT, item.destination);
  const page = fs.readFileSync(pagePath, 'utf8');
  const sourceMatch = page.match(/data-article-source=["']([^"']+)["']/i);
  if (!sourceMatch) {
    add('ERROR', item.route, 'Missing data-article-source.');
    continue;
  }

  const source = sourceMatch[1];
  const sourcePath = path.join(ROOT, source);
  if (!fs.existsSync(sourcePath)) {
    add('ERROR', item.route, `Missing JSON source ${source}.`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const archive = archiveArticle(item.route);
  const routeIssue = routeSlug(item.route);
  const jsonIssue = issueSlug(data.volumeIssue);
  const archiveIssue = field(archive, /cdd-arc__chip-issue[^>]*>([^<]+)</i);
  const archiveTitle = field(archive, /cdd-arc__row-title[^>]*>([\s\S]*?)<\/h3>/i);
  const archiveDate = field(archive, /cdd-arc__date[^>]*>([^<]+)</i);
  const archivePdf = field(archive, /cdd-arc__pdf[^>]+href=["'][^"']*source=([^&"']+)/i);
  const pageTitle = field(page, /<title>([\s\S]*?)\s*\|\s*ShoreVest<\/title>/i);
  const canonical = field(page, /<link\s+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
  const publishedYear = String(data.published || '').match(/(20\d{2})/)?.[1] || null;
  const copyrightYear = String(data.copyright || '').match(/(20\d{2})/)?.[1] || null;

  rows.push({ route: item.route, source, routeIssue, jsonIssue, published: data.published, title: data.title });

  if (!archive) add('ERROR', item.route, 'Missing from the public Insights archive.');
  if (jsonIssue !== routeIssue) add('WARN', item.route, `JSON says ${data.volumeIssue}; public route is ${routeIssue}.`);
  if (archiveIssue && archiveIssue.replace('.', 'i').replace(/^/, 'v') !== routeIssue) add('ERROR', item.route, `Archive issue label ${archiveIssue} does not match route ${routeIssue}.`);
  if (archiveTitle && cleanText(data.title) !== archiveTitle) add('ERROR', item.route, `Archive title differs from JSON title: “${archiveTitle}” vs “${data.title}”.`);
  if (pageTitle && cleanText(data.title) !== pageTitle) add('ERROR', item.route, `Page title differs from JSON title: “${pageTitle}” vs “${data.title}”.`);
  if (archivePdf && decodeURIComponent(archivePdf) !== source) add('ERROR', item.route, `PDF uses ${decodeURIComponent(archivePdf)} but page uses ${source}.`);
  if (canonical !== `https://shorevest.com${item.route}`) add('ERROR', item.route, `Canonical is ${canonical || 'missing'}.`);
  if (publishedYear && copyrightYear && publishedYear !== copyrightYear) add('WARN', item.route, `Published ${publishedYear} but copyright says ${copyrightYear}.`);
  if (archiveDate && data.published && !data.published.toLowerCase().includes(archiveDate.split(' ').pop().toLowerCase())) {
    add('WARN', item.route, `Archive date “${archiveDate}” may not match JSON published date “${data.published}”.`);
  }
}

const qaNotes = [...INSIGHTS.matchAll(/<!--\s*QA NOTE:([\s\S]*?)-->/gi)].map(match => cleanText(match[1]));
for (const note of qaNotes) add('WARN', '/insights/', `Public HTML contains QA note: ${note}`);

const issueCounts = new Map();
for (const row of rows) {
  issueCounts.set(row.jsonIssue, (issueCounts.get(row.jsonIssue) || 0) + 1);
}
for (const [issue, count] of issueCounts) {
  if (issue && count > 1) add('ERROR', '/insights/', `Duplicate JSON issue identifier ${issue} appears ${count} times.`);
}

console.log(`Audited ${rows.length} published China Debt Dynamics articles.`);
console.log('');
for (const row of rows) {
  console.log(`${row.route}\t${row.source}\t${row.jsonIssue || 'NO ISSUE'}\t${row.published || 'NO DATE'}\t${row.title || 'NO TITLE'}`);
}
console.log('');
if (!findings.length) {
  console.log('No consistency findings.');
  process.exit(0);
}
for (const item of findings) console.log(`${item.level}\t${item.route}\t${item.message}`);
const errors = findings.filter(item => item.level === 'ERROR').length;
const warnings = findings.filter(item => item.level === 'WARN').length;
console.log(`\n${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
