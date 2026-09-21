'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

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
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replaceTagContent(html, selectorClass, value) {
  const pattern = new RegExp(`(<[^>]+class=["'][^"']*\\b${selectorClass}\\b[^"']*["'][^>]*>)[\\s\\S]*?(<\\/[^>]+>)`, 'i');
  return html.replace(pattern, `$1${value}$2`);
}

function replaceMeta(html, attribute, name, value) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${escapedName}["']\\s+content=["'][^"']*["']\\s*\\/?>(?:\\s*)`, 'i');
  const tag = `<meta ${attribute}="${name}" content="${escapeHtml(value)}">\n`;
  return pattern.test(html) ? html.replace(pattern, tag) : html;
}

const LATEST = {
  slug: 'v10i3',
  issue: '10.3',
  globalIssue: '48',
  volumeIssue: 'Volume 10 | Issue 3',
  published: 'September 2026',
  archiveDate: 'Sep 2026',
  title: 'Perceptions Versus Reality in China Real Estate',
  seoTitle: 'China Real Estate Private Credit: Perceptions Versus Reality',
  seoDescription: 'ShoreVest examines China real estate private credit, separating the residential downturn from income-producing commercial assets and asset-backed credit opportunities.',
  dek: 'Shanghai or Ghost Town? A tale of two markets, and why the distinction matters for asset-backed credit.',
  excerpt: "China's residential downturn is real, but completed commercial assets continue to transact, attract tenants and generate cash flow.",
  data: 'assets/data/china-debt-dynamics-v10i3.json',
  article: 'china-debt-dynamics-v10i3.html',
  cleanHref: '/insights/china-debt-dynamics/v10i3/',
  printHref: '/insights/china-debt-dynamics/print/?source=assets/data/china-debt-dynamics-v10i3.json&pdf=1',
  zhTitle: '中国房地产：认知与现实',
  zhExcerpt: '中国住宅开发下行确实存在，但已建成商业资产仍在交易、吸引租户并产生现金流。',
  zhHeroIssue: '第 48 期，第 10 卷第 3 期，2026 年 9 月',
  zhHomeIssue: '第 48 期，2026 年 9 月',
  zhArchiveDate: '2026 年 9 月'
};

let changed = 0;

// Build the new issue from the currently approved article shell. The content itself
// remains in JSON so screen and print/PDF views stay on the same publication template.
{
  const templateRel = 'china-debt-dynamics-v10i2.html';
  let html = read(templateRel);
  html = html.replace(/v10i2/g, LATEST.slug);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(LATEST.seoTitle)} | ShoreVest</title>`);
  html = replaceMeta(html, 'name', 'description', LATEST.seoDescription);
  html = replaceMeta(html, 'property', 'og:title', LATEST.seoTitle);
  html = replaceMeta(html, 'property', 'og:description', LATEST.seoDescription);
  html = replaceMeta(html, 'property', 'og:url', `https://shorevest.com${LATEST.cleanHref}`);
  html = replaceMeta(html, 'name', 'twitter:title', LATEST.seoTitle);
  html = replaceMeta(html, 'name', 'twitter:description', LATEST.seoDescription);
  html = html.replace(
    /<link rel="canonical" href="[^"]+">/i,
    `<link rel="canonical" href="https://shorevest.com${LATEST.cleanHref}">`
  );
  if (writeIfChanged(LATEST.article, html)) changed += 1;
}

// Make the generic print route default to the newest issue when opened directly.
{
  const rel = 'china-debt-dynamics-print.html';
  let html = read(rel);
  html = html.replace(
    /data-default-article-source="assets\/data\/china-debt-dynamics-v10i2\.json"/i,
    `data-default-article-source="${LATEST.data}"`
  );
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(LATEST.title)} | ShoreVest</title>`);
  if (writeIfChanged(rel, html)) changed += 1;
}

// Homepage featured report, English and Chinese.
{
  const rel = 'home.html';
  let html = read(rel);
  const feature = `<a class="sv-cdd__feature" href="${LATEST.cleanHref}">\n        <div class="sv-cdd__feature-meta">\n          <span class="sv-cdd__feature-tag">Featured report</span>\n          <span class="sv-cdd__feature-issue">Issue ${LATEST.globalIssue}, ${LATEST.published}</span>\n        </div>\n        <div class="sv-cdd__feature-main">\n          <h3 class="sv-cdd__feature-title">${LATEST.title}</h3>\n          <span class="sv-cdd__feature-read">Read issue <span aria-hidden="true">→</span></span>\n        </div>\n      </a>`;
  html = html.replace(/<a class="sv-cdd__feature" href="\/insights\/china-debt-dynamics\/v10i2\/">[\s\S]*?<\/a>/i, feature);
  if (writeIfChanged(rel, html)) changed += 1;
}

{
  const rel = 'home_cn.html';
  let html = read(rel);
  const feature = `<a class="sv-cdd__feature" href="${LATEST.cleanHref}">\n        <div class="sv-cdd__feature-meta">\n          <span class="sv-cdd__feature-tag">精选报告</span>\n          <span class="sv-cdd__feature-issue">${LATEST.zhHomeIssue}</span>\n        </div>\n        <div class="sv-cdd__feature-main">\n          <h3 class="sv-cdd__feature-title">${LATEST.zhTitle}</h3>\n          <span class="sv-cdd__feature-read">阅读本期 <span aria-hidden="true">→</span></span>\n        </div>\n      </a>`;
  html = html.replace(/<a class="sv-cdd__feature" href="\/insights\/china-debt-dynamics\/v10i2\/">[\s\S]*?<\/a>/i, feature);
  if (writeIfChanged(rel, html)) changed += 1;
}

// English Insights hero + archive.
{
  const rel = 'insights.html';
  let html = read(rel);
  html = html.replace(
    /<p class="cdd-hero__panel-issue">[\s\S]*?<\/p>/i,
    `<p class="cdd-hero__panel-issue">Issue ${LATEST.globalIssue}, Volume 10 Issue 3, ${LATEST.published}</p>`
  );
  html = html.replace(
    /<h2 class="cdd-hero__panel-title">[\s\S]*?<\/h2>/i,
    `<h2 class="cdd-hero__panel-title">${LATEST.title}</h2>`
  );
  html = html.replace(
    /<a class="cdd-hero__panel-cta" href="[^"]+">Read issue <span aria-hidden="true">→<\/span><\/a>/i,
    `<a class="cdd-hero__panel-cta" href="${LATEST.cleanHref}">Read issue <span aria-hidden="true">→</span></a>`
  );
  html = html.replace(/<span class="cdd-stat__num">21<\/span><span class="cdd-stat__label">Issues in archive<\/span>/, '<span class="cdd-stat__num">22</span><span class="cdd-stat__label">Issues in archive</span>');
  html = html.replace(/<span data-cdd-arc-count>21<\/span> articles/, '<span data-cdd-arc-count>22</span> articles');

  if (!html.includes(`data-href="${LATEST.cleanHref}"`)) {
    html = html.replace(
      /<article class="cdd-arc__row cdd-arc__row--featured" data-topic="markets" data-href="\/insights\/china-debt-dynamics\/v10i2\/"/,
      '<article class="cdd-arc__row" data-topic="markets" data-href="/insights/china-debt-dynamics/v10i2/"'
    );
    html = html.replace(/\n\s*<span class="cdd-arc__latest-tag">Latest<\/span>(?=\n\s*<div class="cdd-arc__meta">\n\s*<span class="cdd-arc__chip-issue">10\.2<\/span>)/, '');
    const marker = '<div class="cdd-arc__year"><span>2026</span></div>';
    const row = `${marker}\n            <article class="cdd-arc__row cdd-arc__row--featured" data-topic="markets" data-href="${LATEST.cleanHref}" tabindex="0" role="link" aria-label="${LATEST.title} — read article">\n              <span class="cdd-arc__latest-tag">Latest</span>\n              <div class="cdd-arc__meta">\n                <span class="cdd-arc__chip-issue">${LATEST.issue}</span>\n                <span class="cdd-arc__date">${LATEST.archiveDate}</span>\n              </div>\n              <span class="cdd-arc__cat">Markets</span>\n              <div class="cdd-arc__body">\n                <h3 class="cdd-arc__row-title">${LATEST.title}</h3>\n                <p class="cdd-arc__excerpt">${LATEST.excerpt}</p>\n              </div>\n              <div class="cdd-arc__actions">\n                <a class="cdd-arc__read" href="${LATEST.cleanHref}">Read <span aria-hidden="true">→</span></a>\n                <a class="cdd-arc__pdf" href="${LATEST.printHref.replace(/&/g, '&amp;')}" target="_blank" rel="noopener">PDF</a>\n              </div>\n            </article>`;
    if (!html.includes(marker)) throw new Error('Unable to locate the 2026 archive marker.');
    html = html.replace(marker, row);
  }
  if (writeIfChanged(rel, html)) changed += 1;
}

// Chinese Insights keeps the same public English article/PDF destination, with
// approved concise Chinese archive copy matching the existing bilingual treatment.
{
  const rel = 'insights_cn.html';
  let html = read(rel);
  html = html.replace(
    /<p class="cdd-hero__panel-issue">[\s\S]*?<\/p>/i,
    `<p class="cdd-hero__panel-issue">${LATEST.zhHeroIssue}</p>`
  );
  html = html.replace(
    /<h2 class="cdd-hero__panel-title">[\s\S]*?<\/h2>/i,
    `<h2 class="cdd-hero__panel-title">${LATEST.zhTitle}</h2>`
  );
  html = html.replace(
    /<a class="cdd-hero__panel-cta" href="[^"]+">阅读本期 <span aria-hidden="true">→<\/span><\/a>/i,
    `<a class="cdd-hero__panel-cta" href="${LATEST.cleanHref}">阅读本期 <span aria-hidden="true">→</span></a>`
  );
  html = html.replace(/<span class="cdd-stat__num">21<\/span><span class="cdd-stat__label">档案库期数<\/span>/, '<span class="cdd-stat__num">22</span><span class="cdd-stat__label">档案库期数</span>');
  html = html.replace(/<span data-cdd-arc-count>21<\/span> 篇文章/, '<span data-cdd-arc-count>22</span> 篇文章');

  if (!html.includes(`data-href="${LATEST.cleanHref}"`)) {
    html = html.replace(
      /<article class="cdd-arc__row cdd-arc__row--featured" data-topic="markets" data-href="\/insights\/china-debt-dynamics\/v10i2\/"/,
      '<article class="cdd-arc__row" data-topic="markets" data-href="/insights/china-debt-dynamics/v10i2/"'
    );
    html = html.replace(/\n\s*<span class="cdd-arc__latest-tag">最新<\/span>(?=\n\s*<div class="cdd-arc__meta">\n\s*<span class="cdd-arc__chip-issue">10\.2<\/span>)/, '');
    const marker = '<div class="cdd-arc__year"><span>2026</span></div>';
    const row = `${marker}\n            <article class="cdd-arc__row cdd-arc__row--featured" data-topic="markets" data-href="${LATEST.cleanHref}" tabindex="0" role="link" aria-label="${LATEST.zhTitle} — 阅读文章">\n              <span class="cdd-arc__latest-tag">最新</span>\n              <div class="cdd-arc__meta">\n                <span class="cdd-arc__chip-issue">${LATEST.issue}</span>\n                <span class="cdd-arc__date">${LATEST.zhArchiveDate}</span>\n              </div>\n              <span class="cdd-arc__cat">市场</span>\n              <div class="cdd-arc__body">\n                <h3 class="cdd-arc__row-title">${LATEST.zhTitle}</h3>\n                <p class="cdd-arc__excerpt">${LATEST.zhExcerpt}</p>\n              </div>\n              <div class="cdd-arc__actions">\n                <a class="cdd-arc__read" href="${LATEST.cleanHref}">阅读 <span aria-hidden="true">→</span></a>\n                <a class="cdd-arc__pdf" href="${LATEST.printHref.replace(/&/g, '&amp;')}" target="_blank" rel="noopener">PDF</a>\n              </div>\n            </article>`;
    if (!html.includes(marker)) throw new Error('Unable to locate the Chinese 2026 archive marker.');
    html = html.replace(marker, row);
  }
  if (writeIfChanged(rel, html)) changed += 1;
}

// Article previous/next pager, newest first.
{
  const rel = 'assets/js/cdd-issue-pager.js';
  let js = read(rel);
  if (!js.includes(`file: "${LATEST.cleanHref}"`)) {
    js = js.replace(
      /var ISSUES = \[\n/,
      `var ISSUES = [\n    { file: "${LATEST.cleanHref}", label: "${LATEST.issue}", title: "${LATEST.title}" },\n`
    );
  }
  if (writeIfChanged(rel, js)) changed += 1;
}

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
