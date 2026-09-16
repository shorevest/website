#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ARCHIVE_PATH = resolve(process.cwd(), 'assets/data/media-archive.json');
const LOOKBACK_DAYS = 45;
const MAX_NEW_ITEMS = 8;
const QUERIES = [
  '"ShoreVest"',
  '"ShoreVest Partners"',
  '"Benjamin Fanger" ShoreVest'
];

const SENSITIVE_TERMS = [
  'allegation', 'allegations', 'complaint', 'controversy', 'fraud', 'investigation',
  'lawsuit', 'litigation', 'loss', 'losses', 'misconduct', 'probe', 'sanction',
  'scandal', 'sued', 'warning'
];

function decodeEntities(value = '') {
  const named = {
    amp: '&', apos: "'", gt: '>', lt: '<', quot: '"', nbsp: ' '
  };
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match)
    .trim();
}

function stripHtml(value = '') {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeEntities(match[1]) : '';
}

function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const block = match[1];
    const source = getTag(block, 'source');
    let title = getTag(block, 'title');
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
    const link = getTag(block, 'link');
    const pubDate = getTag(block, 'pubDate');
    const description = stripHtml(getTag(block, 'description'));
    return { title, source, link, pubDate, description };
  });
}

function normalize(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isRelevant(candidate) {
  const haystack = normalize(`${candidate.title} ${candidate.description}`);
  if (haystack.includes('shorevest')) return true;
  return haystack.includes('benjamin fanger') || haystack.includes('ben fanger');
}

function withinLookback(pubDate) {
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return date.getTime() >= cutoff && date.getTime() <= Date.now() + 24 * 60 * 60 * 1000;
}

function dateOnly(pubDate) {
  const date = new Date(pubDate);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function slug(value = '') {
  return normalize(value).replace(/\s+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
}

function fingerprint(item) {
  return `${normalize(item.publication)}|${normalize(item.title)}`;
}

function sensitivityFlags(candidate) {
  const title = normalize(candidate.title);
  const flags = ['automated-discovery', 'verify-positive-framing', 'verify-canonical-link'];
  if (SENSITIVE_TERMS.some((term) => title.includes(term))) flags.push('potentially-sensitive');
  return flags;
}

async function fetchFeed(query) {
  const q = `${query} when:${LOOKBACK_DAYS}d`;
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', q);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');

  const response = await fetch(url, {
    headers: { 'user-agent': 'ShoreVestMediaMonitor/1.0 (+https://shorevest.com/media/)' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Google News RSS returned ${response.status} for ${query}`);
  return parseItems(await response.text()).map((item) => ({ ...item, sourceQuery: query }));
}

const archive = JSON.parse(await readFile(ARCHIVE_PATH, 'utf8'));
if (!archive || !Array.isArray(archive.items)) throw new Error('Invalid media archive: expected items array');

const existingUrls = new Set(archive.items.map((item) => item.url).filter(Boolean));
const existingFingerprints = new Set(archive.items.map(fingerprint));
const candidates = [];
const feedErrors = [];

for (const query of QUERIES) {
  try {
    candidates.push(...await fetchFeed(query));
  } catch (error) {
    feedErrors.push(`${query}: ${error.message}`);
  }
}

if (!candidates.length && feedErrors.length === QUERIES.length) {
  throw new Error(`All media discovery feeds failed:\n${feedErrors.join('\n')}`);
}

const seenThisRun = new Set();
const discoveredAt = new Date().toISOString().slice(0, 10);
const additions = [];

for (const candidate of candidates) {
  if (additions.length >= MAX_NEW_ITEMS) break;
  if (!candidate.title || !candidate.source || !candidate.link || !candidate.pubDate) continue;
  if (!isRelevant(candidate) || !withinLookback(candidate.pubDate)) continue;

  const date = dateOnly(candidate.pubDate);
  const candidateItem = { publication: candidate.source, title: candidate.title };
  const fp = fingerprint(candidateItem);
  if (seenThisRun.has(fp) || existingFingerprints.has(fp) || existingUrls.has(candidate.link)) continue;
  seenThisRun.add(fp);

  additions.push({
    id: `${slug(candidate.source)}-${date}-${slug(candidate.title)}`,
    publication: candidate.source,
    date,
    type: 'Press coverage',
    title: candidate.title,
    summary: '',
    url: candidate.link,
    linkType: 'external',
    status: 'published',
    featured: false,
    autoDiscovered: true,
    discoveredAt,
    sourceQuery: candidate.sourceQuery,
    reviewFlags: sensitivityFlags(candidate)
  });
}

if (!additions.length) {
  console.log('No new ShoreVest media coverage found.');
  if (feedErrors.length) console.warn(`Partial feed errors:\n${feedErrors.join('\n')}`);
  process.exit(0);
}

archive.items.push(...additions);
archive.items.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.publication).localeCompare(String(b.publication)));
archive.updatedAt = discoveredAt;

await writeFile(ARCHIVE_PATH, `${JSON.stringify(archive, null, 2)}\n`, 'utf8');

console.log(`Added ${additions.length} candidate media item${additions.length === 1 ? '' : 's'} for review:`);
for (const item of additions) {
  console.log(`- ${item.date} | ${item.publication} | ${item.title}`);
  console.log(`  flags: ${item.reviewFlags.join(', ')}`);
}
if (feedErrors.length) console.warn(`Partial feed errors:\n${feedErrors.join('\n')}`);
