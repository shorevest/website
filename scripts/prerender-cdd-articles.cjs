'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RENDERER = 'assets/js/cdd-article-template.js';
const PRERENDER_ATTR = 'data-cdd-prerendered="true"';
const SCHEMA_ATTR = 'data-cdd-article-schema="true"';
const RENDERER_MARKER = 'Static CDD HTML is prerendered for crawlers and no-JS readers.';

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function writeIfChanged(rel, content) {
  const abs = path.join(ROOT, rel);
  const before = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (before === content) return false;
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return true;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clean(value) {
  return String(value == null ? '' : value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value) {
  return clean(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase();
}

function wordCount(value) {
  return clean(value).split(/\s+/).filter(Boolean).length;
}

function expectedArticleWords(data) {
  return (data.sections || []).reduce((sum, section) => {
    const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs : [];
    const bullets = Array.isArray(section.bullets) ? section.bullets : [];
    return sum + paragraphs.reduce((n, value) => n + wordCount(value), 0) + bullets.reduce((n, value) => n + wordCount(value), 0);
  }, 0);
}

function replaceElement(html, tag, dataAttr, inner, addPrerenderMarker) {
  const pattern = new RegExp(`(<${tag}\\b(?=[^>]*\\b${dataAttr}\\b)[^>]*>)[\\s\\S]*?(<\\/${tag}>)`, 'i');
  if (!pattern.test(html)) throw new Error(`Missing <${tag}> with ${dataAttr}`);
  return html.replace(pattern, (match, open, close) => {
    let nextOpen = open;
    if (addPrerenderMarker && !/\bdata-cdd-prerendered\s*=/.test(nextOpen)) {
      nextOpen = nextOpen.replace(/>$/, ` ${PRERENDER_ATTR}>`);
    }
    return `${nextOpen}${inner}${close}`;
  });
}

function renderList(items) {
  return (items || []).map(item => `\n            <li>${escapeHtml(item)}</li>`).join('') + ((items || []).length ? '\n          ' : '');
}

function renderBody(data) {
  const out = [];
  for (const section of data.sections || []) {
    if (section.heading) out.push(`\n          <h2>${escapeHtml(section.heading)}</h2>`);
    for (const paragraph of section.paragraphs || []) {
      out.push(`\n          <p>${escapeHtml(paragraph)}</p>`);
    }
    if (Array.isArray(section.bullets) && section.bullets.length) {
      out.push('\n          <ul>');
      for (const bullet of section.bullets) out.push(`\n            <li>${escapeHtml(bullet)}</li>`);
      out.push('\n          </ul>');
    }
    for (const image of section.images || []) {
      if (!image || !image.src) continue;
      out.push('\n          <figure class="cdd-figure">');
      out.push(`\n            <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || image.caption || '')}" loading="lazy" decoding="async">`);
      if (image.caption) out.push(`\n            <figcaption>${escapeHtml(image.caption)}</figcaption>`);
      out.push('\n          </figure>');
    }
  }
  return out.join('') + (out.length ? '\n        ' : '');
}

function canonicalFromHtml(html) {
  const match = /<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i.exec(html) ||
    /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i.exec(html);
  return match ? match[1] : '';
}

function publishedIso(value) {
  const match = /^\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\s*$/i.exec(String(value || ''));
  if (!match) return null;
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  return `${match[2]}-${String(months.indexOf(match[1].toLowerCase()) + 1).padStart(2, '0')}`;
}

function absoluteUrl(value) {
  if (!value) return null;
  try { return new URL(value, 'https://shorevest.com').href; }
  catch (_) { return null; }
}

function addSchema(html, data, canonical) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: String(data.title || ''),
    description: String(data.dek || ''),
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    publisher: {
      '@type': 'Organization',
      name: 'ShoreVest Partners',
      url: 'https://shorevest.com/'
    },
    isPartOf: {
      '@type': 'CreativeWorkSeries',
      name: String(data.series || 'China Debt Dynamics')
    },
    articleSection: 'China Debt Dynamics'
  };
  const datePublished = publishedIso(data.published);
  if (datePublished) schema.datePublished = datePublished;
  const image = absoluteUrl(data.socialImage);
  if (image) schema.image = image;

  let next = html.replace(/\s*<script\b[^>]*data-cdd-article-schema=["']true["'][^>]*>[\s\S]*?<\/script>\s*/gi, '\n');
  const json = JSON.stringify(schema).replace(/</g, '\\u003c');
  const script = `<script type="application/ld+json" ${SCHEMA_ATTR}>${json}</script>`;
  next = next.replace(/<\/head>/i, `  ${script}\n</head>`);
  return next;
}

function prerenderHtml(html, data) {
  const canonical = canonicalFromHtml(html);
  if (!canonical) throw new Error('Missing canonical URL');

  const words = expectedArticleWords(data);
  const readMins = Math.max(1, Math.round(words / 220));
  const findingCount = Array.isArray(data.keyFindings) ? data.keyFindings.length : 0;
  const metaBits = [
    data.published ? `Published ${escapeHtml(data.published)}` : '',
    `${readMins} min read`,
    findingCount ? `${findingCount} key finding${findingCount === 1 ? '' : 's'}` : ''
  ].filter(Boolean);
  const meta = metaBits.map(value => `<span>${value}</span>`).join('');

  let next = html;
  next = replaceElement(next, 'div', 'data-cdd-meta', meta, false);
  next = replaceElement(next, 'h1', 'data-cdd-title', escapeHtml(data.title), false);
  next = replaceElement(next, 'p', 'data-cdd-dek', escapeHtml(data.dek), false);
  next = replaceElement(next, 'ul', 'data-cdd-findings', renderList(data.keyFindings || []), false);
  next = replaceElement(next, 'article', 'data-cdd-body', renderBody(data), true);
  next = replaceElement(next, 'p', 'data-cdd-disclaimer', escapeHtml(data.disclaimer), false);
  next = replaceElement(next, 'p', 'data-cdd-copyright', escapeHtml(data.copyright), false);
  next = addSchema(next, data, canonical);
  return next;
}

function patchRenderer() {
  const before = read(RENDERER);
  if (before.includes(RENDERER_MARKER)) return false;
  const needle = '  (data.sections || []).forEach((section) => {';
  if (!before.includes(needle)) throw new Error('CDD renderer section loop changed; prerender reset cannot be installed safely.');
  const insertion = [
    `  // ${RENDERER_MARKER}`,
    '  // Replace that static copy only after the JSON payload has loaded successfully.',
    "  body.innerHTML = '';",
    '',
    needle
  ].join('\n');
  return writeIfChanged(RENDERER, before.replace(needle, insertion));
}

function articleFiles() {
  return fs.readdirSync(ROOT)
    .filter(name => /^china-debt-dynamics-.+\.html$/i.test(name))
    .filter(name => name !== 'china-debt-dynamics-print.html')
    .sort();
}

function articleContext(filename) {
  const html = read(filename);
  const sourceMatch = /data-article-source=["']([^"']+)["']/i.exec(html);
  if (!sourceMatch) return null;
  const dataRel = sourceMatch[1].replace(/^\//, '').split(/[?#]/)[0];
  const dataAbs = path.join(ROOT, dataRel);
  if (!fs.existsSync(dataAbs)) throw new Error(`${filename}: missing ${dataRel}`);
  return { html, dataRel, data: JSON.parse(fs.readFileSync(dataAbs, 'utf8')) };
}

function destinationFromCanonical(html) {
  const canonical = canonicalFromHtml(html);
  if (!canonical) return null;
  let url;
  try { url = new URL(canonical); }
  catch (_) { return null; }
  if (url.hostname !== 'shorevest.com' && url.hostname !== 'www.shorevest.com') return null;
  const pathname = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  return pathname ? `${pathname}/index.html` : 'index.html';
}

function validateHtml(label, html, data) {
  const errors = [];
  const titleMatch = /<h1\b(?=[^>]*\bdata-cdd-title\b)[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (!titleMatch || normalize(titleMatch[1]) !== normalize(data.title)) errors.push(`${label}: static H1 is missing or does not match article title`);

  const bodyMatch = /<article\b(?=[^>]*\bdata-cdd-body\b)[^>]*>([\s\S]*?)<\/article>/i.exec(html);
  if (!bodyMatch) errors.push(`${label}: static article body is missing`);
  else {
    const expected = expectedArticleWords(data);
    const actual = wordCount(bodyMatch[1]);
    if (!bodyMatch[0].includes(PRERENDER_ATTR)) errors.push(`${label}: static article body lacks prerender marker`);
    if (expected > 0 && actual < Math.floor(expected * 0.8)) errors.push(`${label}: static article body has ${actual} words; expected at least ${Math.floor(expected * 0.8)}`);
  }

  if (!new RegExp(`<script\\b[^>]*${SCHEMA_ATTR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>`, 'i').test(html)) {
    errors.push(`${label}: Article structured data is missing`);
  }
  return errors;
}

function validateRenderer() {
  const js = read(RENDERER);
  return js.includes(RENDERER_MARKER) && /body\.innerHTML\s*=\s*['"]{2}/.test(js)
    ? []
    : [`${RENDERER}: does not clear prerendered body after JSON loads`];
}

function main() {
  const validateOnly = process.argv.includes('--validate');
  let changed = 0;
  const errors = [];

  if (!validateOnly && patchRenderer()) changed += 1;
  errors.push(...validateRenderer());

  let count = 0;
  for (const filename of articleFiles()) {
    const context = articleContext(filename);
    if (!context) continue;
    count += 1;

    if (!validateOnly) {
      const rendered = prerenderHtml(context.html, context.data);
      if (writeIfChanged(filename, rendered)) changed += 1;
    }

    const sourceHtml = read(filename);
    errors.push(...validateHtml(filename, sourceHtml, context.data));

    if (validateOnly) {
      const destination = destinationFromCanonical(sourceHtml);
      if (destination && fs.existsSync(path.join(ROOT, destination))) {
        errors.push(...validateHtml(destination, read(destination), context.data));
      }
    }
  }

  if (!count) errors.push('No CDD article source files were found.');
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  console.log(`${validateOnly ? 'Validated' : 'Prerendered'} ${count} CDD articles${validateOnly ? '' : `; changed ${changed} files`}.`);
}

main();
