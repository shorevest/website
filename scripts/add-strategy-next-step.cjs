'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS_PATH = 'assets/css/strategy-rebuild.css';
const SCRIPT_SRC = '/assets/js/strategy-engagement.js?v=20260916-1';
const BLOCK_MARKER = 'data-sv-strategy-next-step="true"';
const CSS_MARKER = 'STRATEGY NEXT STEP — engagement bridge';

const PAGES = [
  {
    source: 'strategy.html',
    generated: 'strategy/index.html',
    disclosure: '<!-- ============================================================ H, DISCLOSURES -->',
    block: `<!-- ============================================================ G, NEXT STEP -->
<section class="st-next" id="next-step" ${BLOCK_MARKER} aria-labelledby="st-next-title">
  <div class="sv-shell st-next__inner">
    <div class="st-next__copy">
      <p class="sv-label">Continue exploring</p>
      <h2 class="sv-h2" id="st-next-title">Research and institutional inquiries</h2>
      <p class="st-next__body">Explore China Debt Dynamics for ShoreVest research on China’s credit markets, or contact ShoreVest for general institutional inquiries.</p>
    </div>
    <div class="st-next__actions" aria-label="Strategy next steps">
      <a class="sv-btn sv-btn--primary" href="/insights/#archive" data-sv-strategy-cta="research">China Debt Dynamics <span class="sv-btn__arrow" aria-hidden="true">→</span></a>
      <a class="sv-btn" href="/contact/" data-sv-strategy-cta="contact">Institutional inquiries <span class="sv-btn__arrow" aria-hidden="true">→</span></a>
    </div>
  </div>
</section>

`
  },
  {
    source: 'strategy_cn.html',
    generated: 'cn/strategy/index.html',
    disclosure: '<!-- H, DISCLOSURES -->',
    block: `<!-- G, NEXT STEP -->
<section class="st-next" id="next-step" ${BLOCK_MARKER} aria-labelledby="st-next-title">
  <div class="sv-shell st-next__inner">
    <div class="st-next__copy">
      <p class="sv-label">进一步了解</p>
      <h2 class="sv-h2" id="st-next-title">研究与机构咨询</h2>
      <p class="st-next__body">阅读《中国债务动态》，了解新岸资本对中国信贷市场的研究；如有一般机构咨询，可联系新岸资本。</p>
    </div>
    <div class="st-next__actions" aria-label="策略下一步">
      <a class="sv-btn sv-btn--primary" href="/cn/insights/#archive" data-sv-strategy-cta="research">中国债务动态 <span class="sv-btn__arrow" aria-hidden="true">→</span></a>
      <a class="sv-btn" href="/cn/contact/" data-sv-strategy-cta="contact">机构咨询 <span class="sv-btn__arrow" aria-hidden="true">→</span></a>
    </div>
  </div>
</section>

`
  }
];

const CSS_BLOCK = `

/* ==========================================================================
   ${CSS_MARKER}
   Quiet institutional continuation path between strategy content and disclosures.
   ========================================================================== */
body.strategy-page .st-next {
  padding-block: clamp(60px, 6.5vw, 92px);
  background: var(--sv-stone);
}
body.strategy-page .st-next__inner {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, .75fr);
  gap: clamp(32px, 6vw, 88px);
  align-items: end;
}
body.strategy-page .st-next__copy .sv-h2 {
  margin-top: 16px;
  max-width: 17ch;
}
body.strategy-page .st-next__body {
  margin: 20px 0 0;
  max-width: 48rem;
  font: 400 16px/1.66 var(--sv-font);
  color: var(--sv-ink-2);
}
body.strategy-page .st-next__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}
body.strategy-page .st-next__actions .sv-btn:not(.sv-btn--primary) {
  background: transparent;
  color: var(--sv-ink);
  border-color: var(--sv-border-light-strong);
}
body.strategy-page .st-next__actions .sv-btn:not(.sv-btn--primary):hover {
  border-color: var(--sv-ink);
}
@media (max-width: 880px) {
  body.strategy-page .st-next__inner { grid-template-columns: 1fr; gap: 28px; }
  body.strategy-page .st-next__copy .sv-h2 { max-width: none; }
  body.strategy-page .st-next__actions { justify-content: flex-start; }
}
`;

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

function removeExistingBlock(html) {
  const pattern = /\s*<!--\s*(?:={10,}\s*)?G, NEXT STEP\s*(?:={10,}\s*)?-->[\s\S]*?<section\b[^>]*data-sv-strategy-next-step=["']true["'][\s\S]*?<\/section>\s*/i;
  return html.replace(pattern, '\n\n');
}

function ensureScript(html) {
  const tag = `<script src="${SCRIPT_SRC}" defer></script>`;
  if (html.includes(SCRIPT_SRC)) return html;
  return html.replace(/<\/body>/i, `${tag}\n</body>`);
}

function applyPage(html, page) {
  let next = removeExistingBlock(html);
  if (!next.includes(page.disclosure)) {
    throw new Error(`${page.source}: disclosure anchor changed`);
  }
  next = next.replace(page.disclosure, `${page.block}${page.disclosure}`);
  next = ensureScript(next);
  return next;
}

function applyCss(css) {
  const start = css.indexOf(`/* ==========================================================================` + `\n   ${CSS_MARKER}`);
  let next = css;
  if (start !== -1) {
    next = css.slice(0, start).replace(/\s+$/, '') + '\n';
  }
  return next.replace(/\s*$/, '') + CSS_BLOCK + '\n';
}

function validatePage(rel) {
  if (!fs.existsSync(path.join(ROOT, rel))) return [`${rel}: missing`];
  const html = read(rel);
  const errors = [];
  if (!html.includes(BLOCK_MARKER)) errors.push(`${rel}: missing Strategy next-step block`);
  if (!html.includes('data-sv-strategy-cta="research"')) errors.push(`${rel}: missing research CTA`);
  if (!html.includes('data-sv-strategy-cta="contact"')) errors.push(`${rel}: missing contact CTA`);
  if (!html.includes(SCRIPT_SRC)) errors.push(`${rel}: missing Strategy engagement analytics script`);
  return errors;
}

function main() {
  const validateOnly = process.argv.includes('--validate');
  const errors = [];
  let changed = 0;

  if (!validateOnly) {
    for (const page of PAGES) {
      if (writeIfChanged(page.source, applyPage(read(page.source), page))) changed += 1;
    }
    if (writeIfChanged(CSS_PATH, applyCss(read(CSS_PATH)))) changed += 1;
  }

  for (const page of PAGES) {
    errors.push(...validatePage(page.source));
    if (validateOnly) errors.push(...validatePage(page.generated));
  }

  const css = read(CSS_PATH);
  if (!css.includes(CSS_MARKER)) errors.push(`${CSS_PATH}: missing Strategy next-step styles`);
  if (!fs.existsSync(path.join(ROOT, 'assets/js/strategy-engagement.js'))) {
    errors.push('assets/js/strategy-engagement.js: missing');
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  console.log(`${validateOnly ? 'Validated' : 'Applied'} Strategy next-step engagement path${validateOnly ? '' : `; changed ${changed} files`}.`);
}

main();
