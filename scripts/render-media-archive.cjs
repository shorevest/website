'use strict';

// One reviewed source for English, Chinese and no-JavaScript readers.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = require('../assets/data/media-archive.json');
const items = data.items.filter(x => x.status === 'published').sort((a, b) => b.date.localeCompare(a.date));
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types = {'Article':'文章','Commentary':'评论','Podcast':'播客','Panel':'专题讨论','Sponsored content':'赞助内容','Conference session':'会议环节','Webinar':'网络研讨会','Firm webinar':'公司网络研讨会','Roundtable':'圆桌会议','Opinion':'评论','Press coverage':'媒体报道'};

function render(zh) {
  const l = zh ? {heading:'报道与公开活动',intro:'精选第三方报道、访谈及公开活动。赞助内容单独标注；部分原文可能需要订阅。历史记录予以保留，尚未确认来源的条目会明确标注。',featured:'精选',archive:'媒体档案',year:'年份',allYears:'全部年份',publication:'出版机构',allPublications:'全部出版机构',more:'加载更多',read:'阅读原文',watch:'观看',listen:'收听',event:'查看活动',subscription:'可能需要订阅',unavailable:'原始链接暂不可用',limited:'访问可能受限',archiveDate:'存档日期'} : {heading:'Coverage & appearances',intro:'Selected reporting, interviews and public appearances. Sponsored content is identified; some publishers require a subscription. Historical records are retained and labeled where the original source is unavailable.',featured:'Featured',archive:'Media archive',year:'Year',allYears:'All years',publication:'Publication',allPublications:'All publications',more:'Load more',read:'Read original',watch:'Watch',listen:'Listen',event:'View event',subscription:'Subscription may be required',unavailable:'Original source unavailable',limited:'Access may be restricted',archiveDate:'Archive date'};
  const date = x => new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(x.date+'T12:00:00Z'));
  const type = x => zh ? types[x.type] || x.type : x.type;
  const summary = x => zh ? x.summaryZh || x.summary : x.summary;
  const action = x => x.linkType === 'video' ? l.watch : x.linkType === 'podcast' ? l.listen : x.linkType === 'event' || x.type === 'Conference session' ? l.event : l.read;
  const access = x => !x.url ? l.unavailable : x.access === 'subscription' ? l.subscription : x.access === 'access-limited' ? l.limited : '';
  function shell(x, cls, inner) {return x.url ? `<a class="${cls}" href="${escape(x.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="${cls} press-row__item--inactive">${inner}</div>`;}
  const featured = items.find(x => x.featured) || items[0];
  const lead = shell(featured,'pr-featured',`<div class="pr-featured__meta"><span class="pr-featured__tag">${l.featured}</span><span class="pr-featured__pub">${escape(featured.publication)}</span><span class="pr-featured__date">${date(featured)} · ${type(featured)}</span><span class="press-access">${access(featured)}</span></div><div class="pr-featured__body"><h3 class="pr-featured__title" lang="en">${escape(featured.title)}</h3><p class="pr-featured__desc">${escape(summary(featured))}</p><span class="pr-featured__read">${action(featured)} <span aria-hidden="true">→</span></span></div>`);
  const rows = items.map(x => `<article class="press-row" id="${escape(x.id)}" data-media-id="${escape(x.id)}" data-year="${x.date.slice(0,4)}" data-publication="${escape(x.publication)}">${shell(x,'press-row__item',`<span class="press-publication" lang="en">${escape(x.publication)}</span><span class="press-row__content"><span class="press-type-line"><span class="press-tag">${type(x)}</span></span><span class="press-headline" lang="en">${escape(x.title)}</span><span class="press-row__summary">${escape(summary(x))}</span></span><span class="press-row__meta"><time class="press-date" datetime="${x.date}">${date(x)}</time>${x.verification?.status==='historical'?`<span class="press-access">${l.archiveDate}</span>`:''}${access(x)?`<span class="press-access">${access(x)}</span>`:''}${x.url?`<span class="press-action">${action(x)} ↗</span>`:''}</span>`)}</article>`).join('\n');
  const displayData = {items:items.map(({verification, ...x}) => ({...x,verification:{status:verification.status}}))};
  return `<section class="pr-archive" id="archive" data-screen-label="${l.archive}" aria-labelledby="pr-archive-title" aria-busy="false">
    <div class="sv-shell">
      <div class="pr-section-head"><div class="pr-section-head__l"><h2 class="pr-section-title" id="pr-archive-title">${l.heading}</h2><p class="pr-section-sub">${l.intro}</p></div></div>
      <div data-media-featured>${lead}</div>
      <div class="pr-toolbar" aria-label="${l.archive}">
        <div class="pr-toolbar__meta"><p class="pr-toolbar__label">${l.archive}</p><p class="pr-toolbar__count" id="press-results-count" aria-live="polite">${zh ? '共 '+items.length+' 条' : items.length+' items'}</p></div>
        <div class="pr-filters" id="press-filters">
          <div class="pr-filter-group"><label class="pr-filter-label" for="press-year-select">${l.year}</label><select class="pr-filter-select" id="press-year-select" disabled><option value="All">${l.allYears}</option></select></div>
          <div class="pr-filter-group"><label class="pr-filter-label" for="press-publication-select">${l.publication}</label><select class="pr-filter-select" id="press-publication-select" disabled><option value="All">${l.allPublications}</option></select></div>
        </div>
      </div>
      <section class="press-list" id="press-archive" aria-label="${l.archive}">${rows}</section>
      <div class="pr-more-wrap"><button class="pr-more" id="press-more-btn" type="button" aria-controls="press-archive" hidden>${l.more}</button></div>
    </div>
    <script type="application/json" id="media-archive-data">${JSON.stringify(displayData).replace(/</g,'\\u003c')}</script>
  </section>`;
}

let failed = false;
for (const [file,zh] of [['media.html',false],['media_cn.html',true]]) {
  const filename = path.join(root,file);
  const before = fs.readFileSync(filename,'utf8');
  const start = before.indexOf('<section class="pr-archive"');
  const end = before.indexOf('<section class="pr-disclosures"',start);
  if (start < 0 || end < 0) throw new Error(`Archive boundaries missing in ${file}`);
  const after = before.slice(0,start)+render(zh)+'\n\n  '+before.slice(end);
  if (process.argv.includes('--check')) {
    if (after !== before) { console.error(`Media archive needs regeneration: ${file}`); failed=true; }
  } else fs.writeFileSync(filename,after);
}
if (failed) process.exitCode=1;
else console.log(`${process.argv.includes('--check')?'Verified':'Rendered'} ${items.length} media records in English and Chinese.`);
