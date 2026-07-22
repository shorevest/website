#!/usr/bin/env node
'use strict';

/*
 * Headless browser smoke test for the synthetic ShoreVest One Asset Tracing
 * workspace. Uses only Node built-ins and the Chrome DevTools Protocol.
 *
 * It serves the checked-out repository locally, enters the demo profile, opens
 * Asset Tracing, checks routed views and accessibility semantics, verifies
 * desktop/mobile overflow, and writes two screenshots for CI review.
 */

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts', 'asset-tracing-browser');
const HTTP_PORT = 4173;
const DEVTOOLS_PORT = 9229;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
  }[ext] || 'application/octet-stream';
}

function startServer() {
  const server = http.createServer((req, res) => {
    const raw = decodeURIComponent((req.url || '/').split('?')[0]);
    let relative = raw.replace(/^\/+/, '');
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const resolved = path.resolve(ROOT, relative);
    if (!resolved.startsWith(ROOT + path.sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.readFile(resolved, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime(resolved), 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(HTTP_PORT, '127.0.0.1', () => resolve(server));
  });
}

function findChrome() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error('Chrome/Chromium executable not found on this runner.');
}

async function waitForJson(url, timeoutMs = 15000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      last = new Error('HTTP ' + response.status);
    } catch (err) { last = err; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for ' + url + ': ' + (last ? last.message : 'unknown error'));
}

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let id = 0;
    const listeners = new Map();

    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            id += 1;
            pending.set(id, { res, rej });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        on(method, fn) {
          const list = listeners.get(method) || [];
          list.push(fn); listeners.set(method, list);
        },
        close() { socket.close(); }
      });
    });
    socket.addEventListener('error', () => reject(new Error('Chrome DevTools WebSocket failed.')));
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id); pending.delete(message.id);
        if (message.error) item.rej(new Error(message.error.message));
        else item.res(message.result || {});
        return;
      }
      const list = listeners.get(message.method) || [];
      list.forEach((fn) => fn(message.params || {}));
    });
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error('Browser evaluation failed: ' + (result.exceptionDetails.text || expression));
  return result.result ? result.result.value : undefined;
}

async function waitFor(cdp, expression, label, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, 'Boolean(' + expression + ')')) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for ' + label + '.');
}

async function screenshot(cdp, filename) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACT_DIR, filename), Buffer.from(shot.data, 'base64'));
}

async function run() {
  const server = await startServer();
  const chromePath = findChrome();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-asset-tracing-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--disable-background-networking', '--disable-component-update',
    '--disable-default-apps', '--disable-extensions', '--disable-sync',
    '--metrics-recording-only', '--no-first-run',
    '--remote-debugging-port=' + DEVTOOLS_PORT,
    '--user-data-dir=' + profile,
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let stderr = '';
  chrome.stderr.on('data', (chunk) => { stderr += String(chunk); });

  try {
    await waitForJson('http://127.0.0.1:' + DEVTOOLS_PORT + '/json/version');
    const pages = await waitForJson('http://127.0.0.1:' + DEVTOOLS_PORT + '/json/list');
    assert(pages.length && pages[0].webSocketDebuggerUrl, 'No Chrome page target was available.');
    const cdp = await connectCdp(pages[0].webSocketDebuggerUrl);
    const browserErrors = [];

    cdp.on('Runtime.exceptionThrown', (event) => {
      const detail = event.exceptionDetails || {};
      browserErrors.push(detail.text || 'Unhandled browser exception');
    });
    cdp.on('Log.entryAdded', (event) => {
      const entry = event.entry || {};
      if (entry.level === 'error') browserErrors.push(entry.text || 'Browser log error');
    });

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + HTTP_PORT + '/employee-portal/' });

    await waitFor(cdp, "document.querySelector('.login__submit')", 'the ShoreVest One demo entry');
    await evaluate(cdp, "document.querySelector('.login__submit').click(); true");
    await waitFor(cdp, "document.querySelector('.ops-shell')", 'the signed-in ShoreVest One shell');

    await evaluate(cdp, "location.hash = '#/workspace/asset-tracing'; true");
    await waitFor(cdp, "document.querySelector('.at-workspace')", 'the Asset Tracing case queue');

    assert(await evaluate(cdp, "Boolean(document.querySelector('a[href=\"#/workspace/asset-tracing\"]'))"), 'Asset Tracing navigation link is missing.');
    assert((await evaluate(cdp, "document.querySelectorAll('.at-workspace table.tbl tbody tr').length")) >= 3, 'Synthetic case fixtures did not render.');

    await evaluate(cdp, "Array.from(document.querySelectorAll('button')).find(function (b) { return b.textContent.trim() === 'New case'; }).click(); true");
    await waitFor(cdp, "document.querySelector('.drawer')", 'the new-case drawer');
    const labelsValid = await evaluate(cdp, "Array.from(document.querySelectorAll('.drawer .fld')).every(function (f) { var l=f.querySelector('label'); var c=f.querySelector('input,select,textarea'); return !l || !c || (c.id && l.htmlFor === c.id); })");
    assert(labelsValid, 'A new-case field is missing a programmatic label.');
    await evaluate(cdp, "document.querySelector('.drawer__close').click(); true");

    await evaluate(cdp, "location.hash = '#/workspace/asset-tracing/case-lanternfish/report'; true");
    await waitFor(cdp, "document.querySelector('.at-report')", 'the report preview');
    assert(await evaluate(cdp, "document.querySelector('.at-tab.is-active').getAttribute('aria-current') === 'page'"), 'Active report tab lacks aria-current.');
    assert(await evaluate(cdp, "document.querySelector('.at-report').getAttribute('aria-label') === 'Preliminary asset screening report preview'"), 'Report preview lacks an accessible label.');
    assert(await evaluate(cdp, "Array.from(document.querySelectorAll('.at-report th')).every(function (th) { return th.getAttribute('scope') === 'col'; })"), 'Report table headers lack column scope.');

    const desktopOverflow = await evaluate(cdp, "document.documentElement.scrollWidth > window.innerWidth + 1");
    assert(!desktopOverflow, 'Asset Tracing overflows horizontally at desktop width.');
    await screenshot(cdp, 'desktop-report.png');

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const mobileOverflow = await evaluate(cdp, "document.documentElement.scrollWidth > window.innerWidth + 1");
    assert(!mobileOverflow, 'Asset Tracing overflows horizontally at 390px mobile width.');
    await screenshot(cdp, 'mobile-report.png');

    const relevantErrors = browserErrors.filter((message) => !/favicon|manifest/i.test(message));
    assert(!relevantErrors.length, 'Browser errors: ' + relevantErrors.join(' | '));

    cdp.close();
    console.log('✓ Asset Tracing browser smoke test passed.');
    console.log('  Desktop and mobile screenshots: ' + path.relative(ROOT, ARTIFACT_DIR));
  } finally {
    server.close();
    chrome.kill('SIGTERM');
    fs.rmSync(profile, { recursive: true, force: true });
    if (chrome.exitCode && chrome.exitCode !== 0) process.stderr.write(stderr);
  }
}

run().catch((error) => {
  console.error('✗ Asset Tracing browser smoke test failed.');
  console.error(error.stack || error.message);
  process.exit(1);
});
