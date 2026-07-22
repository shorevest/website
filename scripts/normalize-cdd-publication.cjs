'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function writeIfChanged(rel, content) {
  const abs = path.join(ROOT, rel);
  const before = fs.readFileSync(abs, 'utf8');
  if (before === content) return false;
  fs.writeFileSync(abs, content);
  return true;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let changed = 0;

// Keep static page titles aligned with the JSON that renders the article.
for (const file of fs.readdirSync(ROOT).filter(name => /^china-debt-dynamics-.+\.html$/i.test(name))) {
  let html = read(file);
  const sourceMatch = /\bdata-(?:article-source|default-article-source)=["']([^"']+)["']/i.exec(html);
  if (!sourceMatch) continue;
  const dataRel = sourceMatch[1].replace(/^\//, '').split(/[?#]/)[0];
  const dataAbs = path.join(ROOT, dataRel);
  if (!fs.existsSync(dataAbs)) continue;
  const data = JSON.parse(fs.readFileSync(dataAbs, 'utf8'));
  if (data.title) {
    const title = `<title>${escapeHtml(data.title)} | ShoreVest</title>`;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, title);
  }
  if (file === 'china-debt-dynamics-v7i4.html') {
    html = html.replace(/\s*<meta\s+name=["']robots["'][^>]*>\s*/i, '\n');
  }
  if (writeIfChanged(file, html)) changed += 1;
}

// Present v7i4's three-part policy mechanism as an actual list instead of one dense paragraph.
{
  const rel = 'assets/data/china-debt-dynamics-v7i4.json';
  const data = JSON.parse(read(rel));
  const section = (data.sections || []).find(item => item.heading === 'Helping local governments help themselves');
  if (section && !Array.isArray(section.bullets)) {
    const denseIndex = (section.paragraphs || []).findIndex(value => /^1\. Refinancing bonds:/i.test(value));
    if (denseIndex >= 0) {
      const dense = section.paragraphs[denseIndex];
      const match = dense.match(/^1\. Refinancing bonds:\s*([\s\S]*?)\s*2\. Cutting the cord:\s*([\s\S]*?)\s*3\. Loan renegotiations:\s*([\s\S]*)$/i);
      if (match) {
        section.paragraphs.splice(denseIndex, 1);
        section.bullets = [
          `Refinancing bonds: ${match[1].trim()}`,
          `Cutting the cord: ${match[2].trim()}`,
          `Loan renegotiations: ${match[3].trim()}`
        ];
      }
    }
  }
  const output = `${JSON.stringify(data, null, 2)}\n`;
  if (writeIfChanged(rel, output)) changed += 1;
}

// The Chinese archive already contains v7i4. Restore the approved issue to the English archive as well.
{
  const rel = 'insights.html';
  let html = read(rel);
  html = html.replace(
    /Bailing Out the Banks: The Hidden Significance of Beijing Property Support Measures/g,
    'Bailing Out the Banks: The Hidden Significance of Beijing’s Property Support Measures'
  );

  if (!html.includes('data-href="/insights/china-debt-dynamics/v7i4/"')) {
    const marker = '<div class="cdd-arc__year"><span>2023</span></div>';
    const row = `${marker}\n            <article class="cdd-arc__row" data-topic="policy" data-href="/insights/china-debt-dynamics/v7i4/" tabindex="0" role="link" aria-label="Beijing’s Strategy for Dealing With Local Government Debt: No Bailouts, but a Helping Hand — read article">\n              <div class="cdd-arc__meta">\n                <span class="cdd-arc__chip-issue">7.4</span>\n                <span class="cdd-arc__date">Dec 2023</span>\n              </div>\n              <span class="cdd-arc__cat">Policy</span>\n              <div class="cdd-arc__body">\n                <h3 class="cdd-arc__row-title">Beijing’s Strategy for Dealing With Local Government Debt: No Bailouts, but a Helping Hand</h3>\n                <p class="cdd-arc__excerpt">Beijing’s approach combines refinancing, asset sales, and targeted liquidity while avoiding a blanket bailout of local governments and their financing vehicles.</p>\n              </div>\n              <div class="cdd-arc__actions">\n                <a class="cdd-arc__read" href="/insights/china-debt-dynamics/v7i4/">Read <span aria-hidden="true">→</span></a>\n                <a class="cdd-arc__pdf" href="/insights/china-debt-dynamics/print/?source=assets/data/china-debt-dynamics-v7i4.json&amp;pdf=1" target="_blank" rel="noopener">PDF</a>\n              </div>\n            </article>`;
    if (!html.includes(marker)) throw new Error('Unable to locate the 2023 archive marker.');
    html = html.replace(marker, row);
  }

  html = html.replace(/<span class="cdd-stat__num">20<\/span><span class="cdd-stat__label">Issues in archive<\/span>/, '<span class="cdd-stat__num">21</span><span class="cdd-stat__label">Issues in archive</span>');
  html = html.replace(/<span data-cdd-arc-count>20<\/span> articles/, '<span data-cdd-arc-count>21</span> articles');
  if (writeIfChanged(rel, html)) changed += 1;
}

console.log(`Normalized China Debt Dynamics publication files (${changed} file${changed === 1 ? '' : 's'} changed).`);
