#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://shorevest.com';
const MANIFEST_PATH = path.join(ROOT, 'assets', 'data', 'clean-url-manifest.json');

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function slugFromFilename(filename) {
  return filename.replace(/\.html$/i, '').replace(/_cn$/i, '');
}

function routeForSource(source) {
  const overrides = {
    'home.html': '/',
    'index.html': '/',
    'home_cn.html': '/cn/',
    'index_cn.html': '/cn/',
    'careers.html': '/careers/',
    'careers/index.html': '/careers/',
    'careers_cn.html': '/cn/careers/',
    'investor-portal.html': '/investor-portal/',
    'investor-portal/index.html': '/investor-portal/',
    'investor-portal/index_cn.html': '/cn/investor-portal/',
    'investor-access-portal-terms.html': '/investor-access/terms/',
    'investor-access-portal-terms_cn.html': '/cn/investor-access/terms/',
    'china-debt-dynamics-print.html': '/insights/china-debt-dynamics/print/',
    'china-debt-dynamics-45-beijings-campaign-against-overcapacity-creates-private-credit-opportunities.html': '/insights/china-debt-dynamics/v9i4/',
    'china-debt-dynamics-into-the-shadows-of-us-private-credit.html': '/insights/china-debt-dynamics/v9i3/',
    'china-debt-dynamics-v8i5.html': '/insights/china-debt-dynamics/v8i6/',
    'china-debt-dynamics-v8i3.html': '/insights/china-debt-dynamics/v8i5/',
    'china-debt-dynamics-v8i1.html': '/insights/china-debt-dynamics/v8i3/'
  };

  if (overrides[source]) return overrides[source];

  if (!source.includes('/')) {
    if (!source.endsWith('.html') || source === '404.html') return null;
    if (/^china-debt-dynamics-v\d+i\d+\.html$/i.test(source)) {
      return `/insights/china-debt-dynamics/${slugFromFilename(source).replace('china-debt-dynamics-', '')}/`;
    }
    if (/^media-.+\.html$/i.test(source)) {
      return `/media/${slugFromFilename(source).replace(/^media-/, '')}/`;
    }
    const isChinese = /_cn\.html$/i.test(source);
    const slug = slugFromFilename(source);
    return isChinese ? `/cn/${slug}/` : `/${slug}/`;
  }

  if (/^careers\/[^/]+\.html$/i.test(source)) {
    if (source === 'careers/index.html') return '/careers/';
    const filename = path.basename(source);
    const isChinese = /_cn\.html$/i.test(filename);
    const slug = slugFromFilename(filename);
    return isChinese ? `/cn/careers/${slug}/` : `/careers/${slug}/`;
  }

  if (/^investor-portal\/[^/]+\.html$/i.test(source)) {
    const filename = path.basename(source);
    if (filename === 'index.html') return '/investor-portal/';
    return `/investor-portal/${slugFromFilename(filename)}/`;
  }

  return null;
}

function destinationForRoute(route) {
  if (route === '/') return 'index.html';
  return `${route.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
}

function choosePrimarySource(route, sources) {
  const preferred = {
    '/': ['home.html', 'index.html'],
    '/cn/': ['home_cn.html', 'index_cn.html'],
    '/careers/': ['careers/index.html', 'careers.html'],
    '/investor-portal/': ['investor-portal/index.html', 'investor-portal.html']
  };
  for (const candidate of preferred[route] || []) {
    if (sources.includes(candidate)) return candidate;
  }
  return sources[0];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildReplacementPairs(sourceToRoute) {
  const pairs = [];
  for (const [source, route] of sourceToRoute.entries()) {
    const clean = route;
    const absoluteLegacy = `${SITE_ORIGIN}/${source}`.replace(/\/+/g, '/').replace('https:/', 'https://');
    pairs.push([absoluteLegacy, `${SITE_ORIGIN}${clean}`]);
    pairs.push([`/${source}`, clean]);
    pairs.push([source, clean]);
  }
  return pairs.sort((a, b) => b[0].length - a[0].length);
}

function rewriteKnownUrls(content, pairs) {
  let output = content;
  for (const [legacy, clean] of pairs) {
    output = output.replace(new RegExp(escapeRegExp(legacy), 'g'), clean);
  }
  return output;
}

function rewriteHtmlAttributes(content, currentFile, sourceToRoute) {
  const currentDir = path.posix.dirname(currentFile);
  const attributePattern = /(\b(?:href|action|data-href|content)\s*=\s*)(["'])([^"']*)\2/gi;

  return content.replace(attributePattern, (match, prefix, quote, value) => {
    if (!value || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(value)) return match;

    let legacyPath = null;
    let suffix = '';
    let wasAbsolute = false;

    try {
      if (/^https?:\/\//i.test(value)) {
        const url = new URL(value);
        const isShoreVest = url.origin === SITE_ORIGIN ||
          (url.origin === 'https://shorevest.github.io' && url.pathname.startsWith('/website/'));
        if (!isShoreVest) return match;
        wasAbsolute = true;
        legacyPath = url.origin === SITE_ORIGIN
          ? url.pathname.replace(/^\//, '')
          : url.pathname.replace(/^\/website\//, '');
        suffix = `${url.search}${url.hash}`;
      } else {
        const splitAt = value.search(/[?#]/);
        const pathname = splitAt === -1 ? value : value.slice(0, splitAt);
        suffix = splitAt === -1 ? '' : value.slice(splitAt);
        if (pathname.startsWith('//')) return match;
        legacyPath = pathname.startsWith('/')
          ? pathname.replace(/^\//, '')
          : path.posix.normalize(path.posix.join(currentDir, pathname));
      }
    } catch (_) {
      return match;
    }

    if (!sourceToRoute.has(legacyPath)) return match;
    const route = sourceToRoute.get(legacyPath);
    const replacement = wasAbsolute ? `${SITE_ORIGIN}${route}${suffix}` : `${route}${suffix}`;
    return `${prefix}${quote}${replacement}${quote}`;
  });
}

function ensureBaseHref(html) {
  if (/<base\s+href=["']\/["'][^>]*>/i.test(html)) return html;
  return html.replace(/<head(\s[^>]*)?>/i, match => `${match}\n<base href="/">`);
}

function setCanonicalRoute(html, route) {
  const absolute = `${SITE_ORIGIN}${route}`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${absolute}">`);
  } else {
    html = html.replace(/<\/head>/i, `  <link rel="canonical" href="${absolute}">\n</head>`);
  }

  if (/<meta\s+property=["']og:url["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${absolute}">`);
  }
  return html;
}

function isPublicTextFile(rel) {
  if (/^(internal-preview|employee-portal|docs|tests|api|services|infra|templates)\//.test(rel)) return false;
  if (/^assets\/email\//.test(rel) || /^assets\/js\/employee-portal\//.test(rel)) return false;
  if (rel === 'scripts/generate-clean-public-urls.js') return false;
  return /\.(html|js|json|xml)$/i.test(rel);
}

function writeIfChanged(rel, content) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const before = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (before !== content) fs.writeFileSync(abs, content);
}

function buildSitemap(routes) {
  const urls = routes
    .filter(item => item.indexable)
    .map(item => item.route)
    .filter((route, index, all) => all.indexOf(route) === index)
    .sort((a, b) => a.localeCompare(b));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(route => `  <url><loc>${SITE_ORIGIN}${route}</loc></url>`),
    '</urlset>',
    ''
  ].join('\n');
}

function removeEmptyParents(rel) {
  let current = path.dirname(path.join(ROOT, rel));
  while (current !== ROOT && current.startsWith(ROOT)) {
    if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) break;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

function main() {
  let previousDestinations = [];
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const previous = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      previousDestinations = Array.isArray(previous.routes) ? previous.routes.map(item => item.destination).filter(Boolean) : [];
    } catch (_) {
      previousDestinations = [];
    }
  }

  const tracked = trackedFiles();
  const sourceCandidates = tracked.filter(rel => routeForSource(rel));

  const sourceToRoute = new Map();
  for (const source of sourceCandidates) {
    const route = routeForSource(source);
    if (route) sourceToRoute.set(source, route);
  }

  const grouped = new Map();
  for (const [source, route] of sourceToRoute.entries()) {
    if (!grouped.has(route)) grouped.set(route, []);
    grouped.get(route).push(source);
  }

  const primaryRoutes = [];
  for (const [route, sources] of grouped.entries()) {
    const source = choosePrimarySource(route, sources);
    const original = fs.readFileSync(path.join(ROOT, source), 'utf8');
    const indexable = !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(original) &&
      !route.includes('/investor-portal/') &&
      route !== '/insights/china-debt-dynamics/print/';
    primaryRoutes.push({ source, route, destination: destinationForRoute(route), indexable });
  }

  const currentDestinations = new Set(primaryRoutes.map(item => item.destination));
  for (const stale of previousDestinations) {
    if (currentDestinations.has(stale)) continue;
    const staleAbs = path.join(ROOT, stale);
    if (fs.existsSync(staleAbs) && fs.statSync(staleAbs).isFile()) {
      fs.unlinkSync(staleAbs);
      removeEmptyParents(stale);
    }
  }

  const replacementPairs = buildReplacementPairs(sourceToRoute);

  for (const rel of tracked.filter(isPublicTextFile)) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    let rewritten = fs.readFileSync(abs, 'utf8');
    if (/\.html$/i.test(rel)) rewritten = rewriteHtmlAttributes(rewritten, rel, sourceToRoute);
    rewritten = rewriteKnownUrls(rewritten, replacementPairs);
    writeIfChanged(rel, rewritten);
  }

  for (const item of primaryRoutes) {
    const sourceAbs = path.join(ROOT, item.source);
    let html = fs.readFileSync(sourceAbs, 'utf8');
    html = rewriteHtmlAttributes(html, item.source, sourceToRoute);
    html = rewriteKnownUrls(html, replacementPairs);
    html = ensureBaseHref(html);
    html = setCanonicalRoute(html, item.route);
    writeIfChanged(item.destination, html);
  }

  writeIfChanged('sitemap.xml', buildSitemap(primaryRoutes));

  const manifest = {
    generatedBy: 'scripts/generate-clean-public-urls.js',
    siteOrigin: SITE_ORIGIN,
    note: 'Legacy .html files remain available for compatibility. Internal navigation and canonical URLs use the clean routes.',
    routes: primaryRoutes.sort((a, b) => a.route.localeCompare(b.route))
  };
  writeIfChanged(path.relative(ROOT, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`);

  for (const item of primaryRoutes) {
    if (!fileExists(item.destination)) throw new Error(`Missing generated destination: ${item.destination}`);
    const html = fs.readFileSync(path.join(ROOT, item.destination), 'utf8');
    if (!/<base\s+href="\/">/i.test(html)) throw new Error(`Missing base href in ${item.destination}`);
    if (!html.includes(`${SITE_ORIGIN}${item.route}`)) throw new Error(`Missing clean canonical URL in ${item.destination}`);
    const localHtmlLinks = [...html.matchAll(/(?:href|action|data-href)=["']([^"']+)["']/gi)]
      .map(match => match[1])
      .filter(value => !/^https?:\/\//i.test(value) && /\.html(?:[?#]|$)/i.test(value));
    if (localHtmlLinks.length) throw new Error(`Legacy .html link remains in ${item.destination}: ${localHtmlLinks[0]}`);
  }

  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  if (/\.html(?:<|\?|#)/i.test(sitemap)) throw new Error('sitemap.xml still contains .html URLs');

  console.log(`Prepared ${primaryRoutes.length} clean public routes.`);
}

main();
