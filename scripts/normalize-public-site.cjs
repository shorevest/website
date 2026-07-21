#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://shorevest.com';
const EXCLUDED_CDD_ROUTE = '/insights/china-debt-dynamics/v7i4/';
const EXCLUDED_CDD_SOURCE = 'china-debt-dynamics-v7i4.html';
const validate = process.argv.includes('--validate');

function trackedFiles(...patterns) {
  return execFileSync('git', ['ls-files', ...patterns], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function writeIfChanged(rel, content) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  const before = fs.readFileSync(abs, 'utf8');
  if (before !== content) fs.writeFileSync(abs, content);
}

function ensureNoindex(html) {
  if (/<meta[^>]+name=["']robots["']/i.test(html)) {
    return html.replace(
      /<meta[^>]+name=["']robots["'][^>]*>/i,
      '<meta name="robots" content="noindex, nofollow">'
    );
  }
  return html.replace(
    /(<meta[^>]+name=["']viewport["'][^>]*>)/i,
    '$1\n<meta name="robots" content="noindex, nofollow">'
  );
}

function removeExcludedCddRow(html) {
  const route = EXCLUDED_CDD_ROUTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const legacy = 'china-debt-dynamics-v7i4';
  const rowPattern = new RegExp(
    '<article\\b(?=[^>]*(?:data-href|href)=["\\\'][^"\\\']*(?:' + route + '|' + legacy + ')[^"\\\']*["\\\'])[^>]*>[\\s\\S]*?<\\/article>\\s*',
    'gi'
  );
  let output = html.replace(rowPattern, '');
  output = output
    .replace(/(<span class="cdd-stat__num">)21(<\/span><span class="cdd-stat__label">Issues in archive)/g, '$120$2')
    .replace(/(<span data-cdd-arc-count>)21(<\/span> articles)/g, '$120$2');
  return output;
}

function normalizeTokenPlumbing(content) {
  let output = content;

  output = output.replace(
    /if\s*\(\s*([A-Za-z_$][\w$]*)\.origin\s*===\s*location\.origin\s*&&\s*!\1\.searchParams\.get\((['"])t\2\)\s*\)/g,
    (_match, variable) => `if(T&&${variable}.origin===location.origin&&!${variable}.searchParams.get('t'))`
  );

  output = output.replace(
    /if\s*\(\s*!([A-Za-z_$][\w$]*)\.searchParams\.get\((['"])t\2\)\s*\)\s*\1\.searchParams\.set\((['"])t\3,\s*T\s*\);/g,
    (_match, variable) => `if(T&&!${variable}.searchParams.get('t'))${variable}.searchParams.set('t',T);`
  );

  output = output.replace(
    /function\s+([A-Za-z_$][\w$]*)\(u\)\{return\s+u\+\(u\.indexOf\((['"])\?\2\)>-1\?\2&\2:\2\?\2\)\+\2t=\2\+T;\}/g,
    (_match, fn) => `function ${fn}(u){return T?u+(u.indexOf('?')>-1?'&':'?')+'t='+T:u;}`
  );

  return output
    .replace(/&t='\+window\.__SVT\+'/g, '')
    .replace(/\?t='\+window\.__SVT\+'/g, '')
    .replace(/&t="\+window\.__SVT\+"/g, '')
    .replace(/\?t="\+window\.__SVT\+"/g, '');
}

function mediaAliasPairs() {
  return trackedFiles('media-*.html').map(source => {
    const slug = path.basename(source, '.html');
    return {
      legacy: `/${slug}/`,
      clean: `/media/${slug.replace(/^media-/, '')}/`
    };
  });
}

function normalizeMediaAliases(content, pairs) {
  let output = content;
  for (const { legacy, clean } of pairs) {
    output = output.split(legacy).join(clean);
  }
  return output;
}

function normalizeFiles() {
  const pairs = mediaAliasPairs();
  const publicFiles = trackedFiles('*.html', '**/*.html', '*.js', 'assets/js/*.js');

  for (const rel of [...new Set(publicFiles)]) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    let content = fs.readFileSync(abs, 'utf8');
    content = normalizeTokenPlumbing(content);
    content = normalizeMediaAliases(content, pairs);
    if (rel === 'insights.html' || rel === 'insights/index.html') {
      content = removeExcludedCddRow(content);
    }
    if (rel === EXCLUDED_CDD_SOURCE || rel === 'insights/china-debt-dynamics/v7i4/index.html') {
      content = ensureNoindex(content);
    }
    writeIfChanged(rel, content);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateArticles() {
  const manifest = JSON.parse(read('assets/data/clean-url-manifest.json'));
  const articleRoutes = manifest.routes.filter(item =>
    (item.route.startsWith('/insights/china-debt-dynamics/') && item.route !== '/insights/china-debt-dynamics/print/') ||
    (item.route.startsWith('/media/') && item.route !== '/media/')
  );
  const indexableArticles = articleRoutes.filter(item => item.indexable);
  const cddArticles = indexableArticles.filter(item => item.route.startsWith('/insights/'));
  const mediaArticles = indexableArticles.filter(item => item.route.startsWith('/media/'));

  for (const item of articleRoutes) {
    const abs = path.join(ROOT, item.destination);
    assert(fs.existsSync(abs), `Missing article destination: ${item.destination}`);
    const html = fs.readFileSync(abs, 'utf8');
    const canonical = `<link rel="canonical" href="${SITE_ORIGIN}${item.route}">`;
    assert(html.includes(canonical), `Incorrect canonical URL in ${item.destination}`);
    assert(/<title>[^<]+<\/title>/i.test(html), `Missing title in ${item.destination}`);
    assert(!/href=["']\/media-[^"']+\/["']/i.test(html), `Legacy media route remains in ${item.destination}`);
    assert(!/function\s+\w+\(u\)\{return\s+u\+\(u\.indexOf\(["']\?["']\)/.test(html), `Unguarded t helper remains in ${item.destination}`);
    assert(!/if\s*\(\s*\w+\.origin\s*===\s*location\.origin\s*&&\s*!\w+\.searchParams\.get\(["']t["']\)/.test(html), `Unguarded t propagation remains in ${item.destination}`);

    if (item.route.startsWith('/insights/china-debt-dynamics/') && item.route !== EXCLUDED_CDD_ROUTE) {
      const sourceMatch = html.match(/data-article-source=["']([^"']+)["']/i);
      assert(sourceMatch, `Missing article data source in ${item.destination}`);
      assert(fs.existsSync(path.join(ROOT, sourceMatch[1])), `Missing JSON data source for ${item.destination}: ${sourceMatch[1]}`);
    }
  }

  const insightsIndex = read('insights/index.html');
  for (const item of cddArticles) {
    assert(insightsIndex.includes(`href="${item.route}"`) || insightsIndex.includes(`data-href="${item.route}"`), `Insights archive does not link ${item.route}`);
  }
  assert(!insightsIndex.includes(EXCLUDED_CDD_ROUTE), 'Excluded CDD 36 route remains in the Insights archive');
  assert(/<span class="cdd-stat__num">20<\/span><span class="cdd-stat__label">Issues in archive/.test(insightsIndex), 'Insights issue count is not 20');

  const mediaIndex = read('media/index.html');
  assert(!/href=["']\/media-[^"']+\/["']/i.test(mediaIndex), 'Legacy media article links remain on the Media page');

  const sitemap = read('sitemap.xml');
  for (const item of indexableArticles) {
    assert(sitemap.includes(`<loc>${SITE_ORIGIN}${item.route}</loc>`), `Sitemap is missing ${item.route}`);
  }
  assert(!sitemap.includes(`${SITE_ORIGIN}${EXCLUDED_CDD_ROUTE}`), 'Excluded CDD 36 route remains in sitemap.xml');

  console.log(`Validated ${cddArticles.length} China Debt Dynamics articles and ${mediaArticles.length} media article pages.`);
}

normalizeFiles();
if (validate) validateArticles();
