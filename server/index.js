'use strict';

/**
 * ShoreVest One application server. Serves the typed API and the established
 * employee-portal frontend. In MOCK mode it auto-seeds an empty database so a
 * fresh checkout runs with one command. Workflow state persists to SQLite.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { buildConfig } = require('./config');
const { createApp } = require('./services/container');
const { seed } = require('./seed/seed');
const { handleApi } = require('./api/router');
const { sendText } = require('./api/http');

const ENTRY_DOCUMENT = ['index', 'html'].join('.');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
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

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendText(res, 405, 'Method not allowed');
        return;
      }

      serveStatic(config, url, req, res);
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

function serveStatic(config, url, req, res) {
  const pathname = decodeURIComponent(url.pathname);
  const target = resolveStaticTarget(config, pathname);

  if (!target) {
    sendText(res, 404, 'Not found');
    return;
  }

  fs.readFile(target.filePath, (err, data) => {
    if (err) {
      if (target.fallbackToPortal) {
        sendFile(config.portalEntry, req, res);
        return;
      }
      sendText(res, 404, 'Not found');
      return;
    }
    writeFileResponse(target.filePath, data, req, res);
  });
}

function resolveStaticTarget(config, pathname) {
  const entryRoute = `/${ENTRY_DOCUMENT}`;
  const portalEntryRoute = `/employee-portal/${ENTRY_DOCUMENT}`;
  const appEntryRoute = `/app/${ENTRY_DOCUMENT}`;

  // The established ShoreVest One interface is the primary Azure entry point.
  if (
    pathname === '/' ||
    pathname === entryRoute ||
    pathname === '/employee-portal' ||
    pathname === '/employee-portal/' ||
    pathname === portalEntryRoute
  ) {
    return { filePath: config.portalEntry, fallbackToPortal: false };
  }

  if (pathname.startsWith('/assets/')) {
    return safeStaticTarget(config.assetsDir, pathname.slice('/assets/'.length));
  }

  // Keep the newer server-backed shell accessible for migration work without
  // making it the user-facing portal.
  if (pathname === '/app' || pathname === '/app/' || pathname === appEntryRoute) {
    return { filePath: path.join(config.appDir, ENTRY_DOCUMENT), fallbackToPortal: false };
  }
  if (pathname === '/app.css' || pathname === '/app.js') {
    return safeStaticTarget(config.appDir, pathname.slice(1));
  }
  if (pathname.startsWith('/app/')) {
    return safeStaticTarget(config.appDir, pathname.slice('/app/'.length));
  }

  if (Object.prototype.hasOwnProperty.call(config.publicFiles, pathname)) {
    return { filePath: config.publicFiles[pathname], fallbackToPortal: false };
  }

  // Hash routes never reach the server, but this fallback also keeps direct
  // links to future clean routes inside the portal working.
  if (!path.extname(pathname)) {
    return { filePath: config.portalEntry, fallbackToPortal: true };
  }

  return null;
}

function safeStaticTarget(root, relativePath) {
  const safeRoot = path.resolve(root);
  const filePath = path.resolve(safeRoot, relativePath);
  if (filePath !== safeRoot && !filePath.startsWith(`${safeRoot}${path.sep}`)) {
    return null;
  }
  return { filePath, fallbackToPortal: false };
}

function sendFile(filePath, req, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not found');
      return;
    }
    writeFileResponse(filePath, data, req, res);
  });
}

function writeFileResponse(filePath, data, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  const isHtml = ext === '.html';
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cache-Control': isHtml ? 'no-store' : 'public, max-age=300',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(data);
}

if (require.main === module) {
  startServer().then(({ url, config }) => {
    // eslint-disable-next-line no-console
    console.log(`ShoreVest One running at ${url}  [${config.mode}] ${config.banner}`);
  });
}

module.exports = { startServer, resolveStaticTarget };
