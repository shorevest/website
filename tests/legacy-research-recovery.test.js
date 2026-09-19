'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { redirectHtml, outputs } = require('../scripts/recover-legacy-research.cjs');
const manifest = require('../assets/data/legacy-research-recovery.json');
const root = path.resolve(__dirname, '..');

test('all exact recovery files match the manifest and original PDF bytes', () => {
  for (const { file, content } of outputs()) assert.deepEqual(fs.readFileSync(file), content, file);
});

test('article aliases preserve campaign parameters and fragments without adding analytics', () => {
  for (const [route, target] of Object.entries(manifest.redirects)) {
    const html = redirectHtml(target);
    assert.ok(html.includes(`content="0; url=${target}"`));
    assert.ok(html.includes(`href="https://shorevest.com${target}"`));
    assert.ok(html.includes('content="noindex, follow"'));
    assert.doesNotMatch(html, /gtag|dataLayer|google-analytics|googletagmanager|sv-analytics/);
    const calls = [];
    vm.runInNewContext(html.match(/<script>(.*?)<\/script>/s)[1], {
      window: { location: { search: '?utm_source=rss', hash: '#section', replace: value => calls.push(value) } }
    });
    assert.deepEqual(calls, [target + '?utm_source=rss#section'], route);
    assert.notEqual(route, target);
  }
});

test('recovery aliases do not pollute the canonical sitemap', () => {
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  for (const route of [...Object.keys(manifest.redirects), ...Object.keys(manifest.pdfs)]) assert.ok(!sitemap.includes(route), route);
});

test('redirect renderer refuses external or unknown destinations', () => {
  for (const target of ['https://example.com/', '//example.com/', '/', '/unknown/', '/insights/china-debt-dynamics/v1i1/?x=1']) {
    assert.throws(() => redirectHtml(target));
  }
});

test('unrelated and bot URLs retain the existing 404 behavior', () => {
  const code = fs.readFileSync(path.join(root, 'assets/js/legacy-404-redirects.js'), 'utf8');
  for (const pathname of ['/definitely-missing/', '/wp-admin/*', '/wp-content/plugins/*', '/send-mail']) {
    const calls = [];
    vm.runInNewContext(code, { window: { location: { pathname, search: '', hash: '', replace: value => calls.push(value) } } });
    assert.deepEqual(calls, []);
  }
});
