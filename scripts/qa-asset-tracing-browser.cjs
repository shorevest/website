#!/usr/bin/env node
'use strict';

/*
 * Headless Chrome smoke test for the synthetic ShoreVest One Asset Tracing
 * workspace. Uses only Node built-ins plus the Chrome binary available on the
 * GitHub runner. No production source file is changed at runtime.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 4173;
const ARTIFACT_DIR = path.join(ROOT, 'artifacts', 'asset-tracing-browser');
const QA_HTML = path.join(ROOT, 'employee-portal', '__qa-asset-tracing.html');
const QA_JS = path.join(ROOT, 'employee-portal', '__qa-asset-tracing.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findExecutable(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    const found = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return null;
}

function writeQaFiles() {
  const source = fs.readFileSync(path.join(ROOT, 'employee-portal', 'index.html'), 'utf8');
  const html = source.replace('</body>', '  <script src="./__qa-asset-tracing.js"></script>\n</body>');
  fs.writeFileSync(QA_HTML, html);
  fs.writeFileSync(QA_JS, `
(function () {
  'use strict';
  var mode = new URLSearchParams(location.search).get('qa') || 'report';
  var errors = 0;
  window.addEventListener('error', function () { errors += 1; });
  window.addEventListener('unhandledrejection', function () { errors += 1; });

  function waitFor(test, done, attempts) {
    var left = attempts == null ? 200 : attempts;
    if (test()) { done(); return; }
    if (left <= 0) {
      document.body.dataset.qaReady = 'timeout';
      document.body.dataset.qaErrors = String(errors + 1);
      return;
    }
    setTimeout(function () { waitFor(test, done, left - 1); }, 40);
  }

  function commonReady(name) {
    document.body.dataset.qaReady = name;
    document.body.dataset.qaOverflow = String(document.documentElement.scrollWidth > window.innerWidth + 1);
    document.body.dataset.qaErrors = String(errors);
  }

  function openReport() {
    location.hash = '#/workspace/asset-tracing/case-lanternfish/report';
    waitFor(function () { return document.querySelector('.at-report'); }, function () {
      waitFor(function () {
        var tab = document.querySelector('.at-tab.is-active');
        var report = document.querySelector('.at-report');
        var headers = Array.prototype.slice.call(document.querySelectorAll('.at-report th'));
        return tab && tab.getAttribute('aria-current') === 'page' &&
          report && report.getAttribute('aria-label') === 'Preliminary asset screening report preview' &&
          headers.length && headers.every(function (th) { return th.getAttribute('scope') === 'col'; });
      }, function () {
        document.body.dataset.qaActiveTab = 'true';
        document.body.dataset.qaReportLabel = 'true';
        document.body.dataset.qaTableScopes = 'true';
        commonReady('report');
      });
    });
  }

  function openNewCase() {
    location.hash = '#/workspace/asset-tracing';
    waitFor(function () { return document.querySelector('.at-workspace'); }, function () {
      var button = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) {
        return b.textContent.trim() === 'New case';
      })[0];
      if (!button) { commonReady('missing-new-case'); return; }
      button.click();
      waitFor(function () { return document.querySelector('.drawer'); }, function () {
        waitFor(function () {
          var fields = Array.prototype.slice.call(document.querySelectorAll('.drawer .fld'));
          return fields.length && fields.every(function (field) {
            var label = field.querySelector('label');
            var control = field.querySelector('input, select, textarea');
            return !label || !control || (control.id && label.htmlFor === control.id);
          });
        }, function () {
          document.body.dataset.qaLabels = 'true';
          commonReady('newcase');
        });
      });
    });
  }

  function enter() {
    waitFor(function () { return document.querySelector('.login__submit'); }, function () {
      document.querySelector('.login__submit').click();
      waitFor(function () { return document.querySelector('.ops-shell'); }, function () {
        if (mode === 'newcase') openNewCase();
        else openReport();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enter);
  else enter();
})();
`);
}

function waitForServer(url, timeoutMs = 10000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    function poll() {
      fetch(url).then((response) => {
        if (response.ok) resolve();
        else if (Date.now() - started >= timeoutMs) reject(new Error('Local QA server returned HTTP ' + response.status));
        else setTimeout(poll, 100);
      }).catch((error) => {
        if (Date.now() - started >= timeoutMs) reject(error);
        else setTimeout(poll, 100);
      });
    }
    poll();
  });
}

function chromeArgs(profile, width, height) {
  return [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--disable-background-networking', '--disable-component-update',
    '--disable-default-apps', '--disable-extensions', '--disable-sync',
    '--metrics-recording-only', '--no-first-run',
    '--run-all-compositor-stages-before-draw', '--virtual-time-budget=10000',
    '--window-size=' + width + ',' + height,
    '--user-data-dir=' + profile
  ];
}

function runChrome(chrome, mode, width, height, outputPrefix) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-at-qa-'));
  const url = 'http://127.0.0.1:' + PORT + '/employee-portal/__qa-asset-tracing.html?qa=' + mode;
  try {
    const dump = spawnSync(chrome, chromeArgs(profile, width, height).concat(['--dump-dom', url]), {
      encoding: 'utf8', timeout: 35000, maxBuffer: 10 * 1024 * 1024
    });
    fs.writeFileSync(path.join(ARTIFACT_DIR, outputPrefix + '-chrome.log'), dump.stderr || '');
    fs.writeFileSync(path.join(ARTIFACT_DIR, outputPrefix + '-dom.html'), dump.stdout || '');
    assert(dump.status === 0, outputPrefix + ' Chrome DOM run failed with exit code ' + dump.status + '.');

    const dom = dump.stdout || '';
    assert(dom.includes('data-qa-ready="' + mode + '"'), outputPrefix + ' did not reach the expected ' + mode + ' state.');
    assert(dom.includes('data-qa-overflow="false"'), outputPrefix + ' has horizontal overflow.');
    assert(dom.includes('data-qa-errors="0"'), outputPrefix + ' recorded a browser error.');
    if (mode === 'report') {
      assert(dom.includes('data-qa-active-tab="true"'), 'Active report tab lacks aria-current.');
      assert(dom.includes('data-qa-report-label="true"'), 'Report preview lacks its accessible label.');
      assert(dom.includes('data-qa-table-scopes="true"'), 'Report table headers lack column scope.');
    } else {
      assert(dom.includes('data-qa-labels="true"'), 'New-case fields are missing programmatic labels.');
    }

    const screenshotPath = path.join(ARTIFACT_DIR, outputPrefix + '.png');
    const shot = spawnSync(chrome, chromeArgs(profile, width, height).concat([
      '--screenshot=' + screenshotPath, url
    ]), { encoding: 'utf8', timeout: 35000, maxBuffer: 5 * 1024 * 1024 });
    fs.appendFileSync(path.join(ARTIFACT_DIR, outputPrefix + '-chrome.log'), shot.stderr || '');
    assert(shot.status === 0 && fs.existsSync(screenshotPath), outputPrefix + ' screenshot was not created.');
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

async function run() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const chrome = findExecutable([process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']);
  const python = findExecutable(['python3', 'python']);
  assert(chrome, 'Chrome/Chromium executable not found.');
  assert(python, 'Python executable not found for the local static server.');

  writeQaFiles();
  const serverLog = fs.openSync(path.join(ARTIFACT_DIR, 'server.log'), 'w');
  const server = spawn(python, ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: ROOT, stdio: ['ignore', serverLog, serverLog]
  });

  try {
    await waitForServer('http://127.0.0.1:' + PORT + '/employee-portal/__qa-asset-tracing.html');
    runChrome(chrome, 'report', 1440, 1000, 'desktop-report');
    runChrome(chrome, 'newcase', 390, 844, 'mobile-new-case');
    console.log('✓ Asset Tracing browser smoke test passed.');
    console.log('  QA artifacts: ' + path.relative(ROOT, ARTIFACT_DIR));
  } finally {
    server.kill('SIGTERM');
    fs.closeSync(serverLog);
    fs.rmSync(QA_HTML, { force: true });
    fs.rmSync(QA_JS, { force: true });
  }
}

run().catch((error) => {
  console.error('✗ Asset Tracing browser smoke test failed.');
  console.error(error.stack || error.message);
  process.exit(1);
});
