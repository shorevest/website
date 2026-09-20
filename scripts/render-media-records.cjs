'use strict';

// Preserve historical ShoreVest detail URLs without reproducing publisher text.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const archive = require('../assets/data/media-archive.json').items;
const source = fs.readFileSync(path.join(root, 'media.html'), 'utf8');
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const footer = source.slice(source.indexOf('</main>') + 7)
  .replace(/<script src="assets\/js\/(event-visibility|press-events|media-archive)\.js[^>]*><\/script>\n/g, '');
let failed = false;
for (const file of fs.readdirSync(root).filter(x => /^media-.+\.html$/.test(x))) {
  const target = path.join(root, file);
  const before = fs.readFileSync(target, 'utf8');
  const match = before.match(/data-media-(?:pdf-source|record-source)="([^"]+)"/);
  if (!match) throw new Error(`Missing record source: ${file}`);
  const record = JSON.parse(fs.readFileSync(path.join(root, match[1]), 'utf8'));
  const item = archive.find(x => x.id === record.archiveId);
  if (!item) throw new Error(`Missing archive item: ${file}`);
  const url = 'https://shorevest.com/media/' + file.slice(6,-5) + '/';
  let header = source.slice(0, source.indexOf('<main'))
    .replace(/<title>.*?<\/title>/, `<title>${escape(item.title)} | ShoreVest</title>`)
    .replace(/<link rel="alternate"[^>]*>\n/g, '')
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}">`)
    .replace(/<meta property="og:[^"]+"[^>]*>\n/g, '')
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(item.summary)}">`);
  const date = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(item.date+'T12:00:00Z'));
  const label = item.linkType === 'podcast' ? 'Listen at the publisher' : item.linkType === 'video' ? 'Watch the original video' : 'Read the original publication';
  const action = item.url
    ? `<p><a class="pr-featured__read" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a></p>${item.access === 'subscription' ? '<p class="press-access">Subscription may be required.</p>' : ''}`
    : '<p class="press-access">Original source unavailable. This historical record is retained from ShoreVest’s archive; its original publication date and URL have not been independently reverified.</p>';
  const after = `${header}<main id="content" data-media-record-source="${match[1]}">
  <section class="pr-archive"><div class="sv-shell media-record">
    <p><a class="pr-featured__read" href="/media/#${escape(item.id)}">← Back to media archive</a></p>
    <p class="pr-featured__tag">${escape(item.publication)} · ${escape(item.type)}</p>
    <h1 class="media-record__title">${escape(item.title)}</h1>
    <p class="press-date">${item.verification.status === 'historical' ? 'Archive date: ' : ''}<time datetime="${item.date}">${date}</time></p>
    <p class="pr-section-sub media-record__summary">${escape(item.summary)}</p>
    ${action}
  </div></section>
  <section class="pr-disclosures"><div class="pr-disclosures__inner"><p class="pr-disclosures__label">Source information</p><p class="pr-disclosures__body">This page contains an original ShoreVest summary. Copyright in the linked publication remains with its publisher and authors. External coverage is provided for informational purposes and does not constitute investment advice or a solicitation to invest.</p></div></section>
</main>${footer}`;
  if (process.argv.includes('--check')) {
    if (after !== before) {console.error(`Record needs regeneration: ${file}`);failed=true;}
  } else fs.writeFileSync(target,after);
}
if (failed) process.exitCode=1;
else console.log(`${process.argv.includes('--check')?'Verified':'Rendered'} 13 preserved media detail pages.`);
