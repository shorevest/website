#!/usr/bin/env node
// Renders templates/media-coverage/media-coverage-print.html with a structured
// content JSON file and prints it to PDF via headless Chrome/Chromium, so the
// output matches the branded print stylesheet exactly.
//
// Usage:
//   node scripts/generate-media-coverage-pdf.mjs content/media-pdfs/<slug>.json [--preview] [--chrome <path>]
//
// Publication gate: output is written to public/media/archive-pdfs/ only when
// the JSON's permissionStatus starts with "confirmed" or "shorevest-owned".
// Anything else (placeholder, pending, unknown) requires --preview, which
// writes to templates/media-coverage/preview/ (git-ignored) for QA only.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templateDir = path.join(root, 'templates/media-coverage');
const publicOutDir = path.join(root, 'public/media/archive-pdfs');
const previewOutDir = path.join(templateDir, 'preview');

const args = process.argv.slice(2);
const preview = args.includes('--preview');
const chromeFlagIdx = args.indexOf('--chrome');
const chromeOverride = chromeFlagIdx === -1 ? '' : args[chromeFlagIdx + 1];
const input = args.filter((a, i) => a !== '--preview' && a !== '--chrome' && (chromeFlagIdx === -1 || i !== chromeFlagIdx + 1))[0];
if (!input) {
  console.error('Usage: node scripts/generate-media-coverage-pdf.mjs content/media-pdfs/<slug>.json [--preview] [--chrome <path>]');
  process.exit(1);
}

const dataPath = path.resolve(root, input);
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const approved = /^(confirmed|shorevest-owned)\b/i.test(String(data.permissionStatus || '').trim());
if (!approved && !preview) {
  console.error(`Refusing to write to public/: permissionStatus is "${data.permissionStatus || ''}".`);
  console.error('Set permissionStatus to "confirmed — <evidence>" or "shorevest-owned" once rights are');
  console.error('established, or re-run with --preview to generate a QA copy outside the public folder.');
  process.exit(1);
}

const outDir = preview ? previewOutDir : publicOutDir;
fs.mkdirSync(outDir, { recursive: true });
const slug = slugify(data.pdfSlug || [data.publication, data.date, data.title].filter(Boolean).join('-'));
const pdfPath = path.join(outDir, `shorevest-third-party-coverage-${slug}.pdf`);

const chrome = findChrome(chromeOverride);
const tempHtml = path.join(templateDir, `print-${process.pid}.gen.html`);
const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-media-pdf-'));
try {
  const template = fs.readFileSync(path.join(templateDir, 'media-coverage-print.html'), 'utf8');
  const payload = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = template.replace(
    '<script src="media-coverage-print.js"></script>',
    `<script>window.__MEDIA_PDF_DATA__=${payload};</script>\n  <script src="media-coverage-print.js"></script>`
  );
  if (html === template) throw new Error('Could not find renderer script tag in media-coverage-print.html');
  fs.writeFileSync(tempHtml, html);

  const flags = [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    `--user-data-dir=${tempProfile}`,
    '--no-pdf-header-footer',
    '--virtual-time-budget=10000',
    `--print-to-pdf=${pdfPath}`,
  ];
  if (typeof process.getuid === 'function' && process.getuid() === 0) flags.push('--no-sandbox');
  execFileSync(chrome, [...flags, `file://${tempHtml}`], { stdio: 'pipe' });

  const head = fs.readFileSync(pdfPath).subarray(0, 5).toString();
  if (head !== '%PDF-') throw new Error(`Chrome did not produce a valid PDF at ${pdfPath}`);
  console.log(`Wrote ${path.relative(root, pdfPath)}${preview ? ' (QA preview — not for publication)' : ''}`);
} finally {
  fs.rmSync(tempHtml, { force: true });
  fs.rmSync(tempProfile, { recursive: true, force: true });
}

function slugify(s) { return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140); }

function findChrome(override) {
  const candidates = [
    override,
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/opt/pw-browsers/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [name], { stdio: 'pipe' }).toString().trim() || undefined; } catch { /* keep looking */ }
  }
  console.error('Could not find Chrome/Chromium. Install it, or pass --chrome <path> or set CHROME_PATH.');
  process.exit(1);
}
