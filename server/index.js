'use strict';

/**
 * ShoreVest One application server. Serves the typed API and the frontend app.
 * In MOCK mode it auto-seeds an empty database so a fresh checkout runs with
 * one command. Workflow state persists to the SQLite file between restarts.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { buildConfig } = require('./config');
const { createApp } = require('./services/container');
const { seed } = require('./seed/seed');
const { handleApi } = require('./api/router');
const { sendText } = require('./api/http');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

function startServer(overrides = {}) {
  const config = overrides.config || buildConfig();
  const app = createApp(config, {});

  // Auto-seed MOCK databases so the app is immediately usable.
  if (config.mode === 'MOCK' && app.repos.users.count() === 0) {
    seed(app, { reset: false });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (url.pathname.startsWith('/api/')) {
        const handled = await handleApi(app, req, res, url);
        if (!handled) sendText(res, 404, 'Not found');
        return;
      }
      serveStatic(config, url, res);
    } catch (err) {
      sendText(res, 500, `Server error: ${err.message}`);
    }
  });

  return new Promise((resolve) => {
    server.listen(config.port, config.host, () => {
      const address = server.address();
      resolve({ server, app, config, port: address.port, url: `http://${config.host}:${address.port}` });
    });
  });
}

function serveStatic(config, url, res) {
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === '/' || pathname === ''
    ? '/'
    : pathname.replace(/^\/+/, '');
  const appRoot = path.resolve(config.appDir);
  const filePath = path.resolve(appRoot, relativePath);

  // Prevent path traversal outside appDir.
  if (filePath !== appRoot && !filePath.startsWith(`${appRoot}${path.sep}`)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: unknown routes serve the application entry point.
      if (!path.extname(pathname)) {
        fs.readFile(path.join(appRoot, '/'), (fallbackError, html) => {
          if (fallbackError) { sendText(res, 404, 'Not found'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        });
        return;
      }
      sendText(res, 404, 'Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

if (require.main === module) {
  startServer().then(({ url, config }) => {
    // eslint-disable-next-line no-console
    console.log(`ShoreVest One running at ${url}  [${config.mode}] ${config.banner}`);
  });
}

module.exports = { startServer };
