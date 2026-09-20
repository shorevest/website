(function () {
  'use strict';

  var DATA_URL = '/assets/data/media-archive.json';
  var INITIAL_VISIBLE = 6;
  var PAGE_SIZE = 6;
  var isChinese = document.documentElement.lang.toLowerCase().indexOf('zh') === 0;
  var labels = isChinese ? {
    featured: '精选', watch: '观看', listen: '收听', read: '阅读原文', event: '查看活动',
    unavailable: '原始链接暂不可用', subscription: '可能需要订阅', limited: '访问可能受限',
    archiveDate: '存档日期', more: '加载更多', empty: '暂无匹配报道'
  } : {
    featured: 'Featured', watch: 'Watch', listen: 'Listen', read: 'Read original', event: 'View event',
    unavailable: 'Original source unavailable', subscription: 'Subscription may be required', limited: 'Access may be restricted',
    archiveDate: 'Archive date', more: 'Load more', empty: 'No matching coverage'
  };
  var chineseTypes = {'Article':'文章','Commentary':'评论','Podcast':'播客','Panel':'专题讨论',
    'Sponsored content':'赞助内容','Conference session':'会议环节','Webinar':'网络研讨会',
    'Firm webinar':'公司网络研讨会','Roundtable':'圆桌会议','Opinion':'评论','Press coverage':'媒体报道'};
  function itemType(item) { return isChinese ? (chineseTypes[item.type] || item.type) : item.type; }
  function summary(item) { return isChinese ? (item.summaryZh || item.summary) : item.summary; }
  function accessLabel(item) {
    if (!item.url) return labels.unavailable;
    if (item.access === 'subscription') return labels.subscription;
    if (item.access === 'access-limited') return labels.limited;
    return '';
  }

  var archive = document.getElementById('press-archive');
  var archiveSection = document.getElementById('archive');
  var featuredRoot = document.querySelector('[data-media-featured]');
  var yearSelect = document.getElementById('press-year-select');
  var publicationSelect = document.getElementById('press-publication-select');
  var count = document.getElementById('press-results-count');
  var moreButton = document.getElementById('press-more-btn');

  if (!archive || !featuredRoot) return;

  var allItems = [];
  var visibleLimit = INITIAL_VISIBLE;

  function text(tag, className, value) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined && value !== null) el.textContent = value;
    return el;
  }

  function isExternal(item) {
    return ['external', 'video', 'podcast', 'linkedin', 'event'].indexOf(item.linkType) !== -1;
  }

  function formatDate(iso) {
    var parts = String(iso || '').split('-');
    if (parts.length !== 3) return iso || '';
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return new Intl.DateTimeFormat(isChinese ? 'zh-CN' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  }

  function actionLabel(item) {
    if (!item.url) return '';
    if (item.linkType === 'video') return labels.watch;
    if (item.linkType === 'podcast') return labels.listen;
    if (item.linkType === 'event' || item.type === 'Conference session') return labels.event;
    return labels.read;
  }

  function makeLinkedShell(item, className) {
    var hasLink = Boolean(item.url && item.linkType !== 'none');
    var shell = document.createElement(hasLink ? 'a' : 'div');
    shell.className = className + (hasLink ? '' : ' press-row__item--inactive');
    if (hasLink) {
      shell.href = item.url;
      if (isExternal(item)) {
        shell.target = '_blank';
        shell.rel = 'noopener noreferrer';
      }
    }
    return shell;
  }

  function renderFeatured(item) {
    featuredRoot.replaceChildren();
    if (!item) return;

    var hasLink = Boolean(item.url && item.linkType !== 'none');
    var shell = document.createElement(hasLink ? 'a' : 'div');
    shell.className = 'pr-featured';
    if (hasLink) {
      shell.href = item.url;
      if (isExternal(item)) {
        shell.target = '_blank';
        shell.rel = 'noopener noreferrer';
      }
    }

    var meta = text('div', 'pr-featured__meta');
    meta.appendChild(text('span', 'pr-featured__tag', labels.featured));
    meta.appendChild(text('span', 'pr-featured__pub', item.publication));
    meta.appendChild(text('span', 'pr-featured__date', formatDate(item.date) + ' · ' + itemType(item)));
    if (accessLabel(item)) meta.appendChild(text('span', 'press-access', accessLabel(item)));

    var body = text('div', 'pr-featured__body');
    body.appendChild(text('h3', 'pr-featured__title', item.title));
    if (summary(item)) body.appendChild(text('p', 'pr-featured__desc', summary(item)));
    if (hasLink) {
      var read = text('span', 'pr-featured__read');
      read.appendChild(document.createTextNode(actionLabel(item) + ' '));
      read.appendChild(text('span', '', '→'));
      body.appendChild(read);
    }

    shell.appendChild(meta);
    shell.appendChild(body);
    featuredRoot.appendChild(shell);
  }

  function buildRow(item) {
    var row = text('article', 'press-row');
    row.id = item.id;
    row.dataset.mediaId = item.id;
    row.dataset.typeLabel = String(item.type || '').toUpperCase();
    row.dataset.year = String(item.date || '').slice(0, 4);
    row.dataset.publication = item.publication || '';

    var shell = makeLinkedShell(item, 'press-row__item');
    if (item.url && item.linkType === 'archive') shell.classList.add('press-row__item--archived');

    shell.appendChild(text('span', 'press-publication', item.publication));

    var content = text('span', 'press-row__content');
    var typeLine = text('span', 'press-type-line');
    typeLine.appendChild(text('span', 'press-tag', itemType(item)));
    content.appendChild(typeLine);
    content.appendChild(text('span', 'press-headline', item.title));
    if (summary(item)) content.appendChild(text('span', 'press-row__summary', summary(item)));
    shell.appendChild(content);

    var meta = text('span', 'press-row__meta');
    var date = text('time', 'press-date', formatDate(item.date));
    date.dateTime = item.date;
    meta.appendChild(date);
    if (item.verification && item.verification.status === 'historical') meta.appendChild(text('span', 'press-access', labels.archiveDate));
    if (accessLabel(item)) meta.appendChild(text('span', 'press-access', accessLabel(item)));
    if (item.url) meta.appendChild(text('span', 'press-action', actionLabel(item) + ' ↗'));
    shell.appendChild(meta);

    row.appendChild(shell);
    return row;
  }

  function uniqueSorted(values, sorter) {
    var seen = Object.create(null);
    return values.filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    }).sort(sorter);
  }

  function addOption(select, value, label) {
    if (!select) return;
    var option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function populateFilters(items) {
    if (yearSelect) {
      while (yearSelect.options.length > 1) yearSelect.remove(1);
      uniqueSorted(items.map(function (item) { return item.date.slice(0, 4); }), function (a, b) { return b.localeCompare(a); })
        .forEach(function (year) { addOption(yearSelect, year, year); });
      yearSelect.disabled = false;
    }
    if (publicationSelect) {
      while (publicationSelect.options.length > 1) publicationSelect.remove(1);
      uniqueSorted(items.map(function (item) { return item.publication; }), function (a, b) { return a.localeCompare(b); })
        .forEach(function (publication) { addOption(publicationSelect, publication, publication); });
      publicationSelect.disabled = false;
    }
  }

  function filteredItems() {
    var year = yearSelect ? yearSelect.value : 'All';
    var publication = publicationSelect ? publicationSelect.value : 'All';
    return allItems.filter(function (item) {
      var yearMatch = year === 'All' || item.date.slice(0, 4) === year;
      var publicationMatch = publication === 'All' || item.publication === publication;
      return yearMatch && publicationMatch;
    });
  }

  function updateView() {
    var filtered = filteredItems();
    archive.replaceChildren();

    filtered.forEach(function (item, index) {
      var row = buildRow(item);
      row.hidden = index >= visibleLimit;
      archive.appendChild(row);
    });

    var shown = Math.min(filtered.length, visibleLimit);
    if (count) {
      count.textContent = filtered.length
        ? (isChinese ? '显示 ' + shown + ' 条，共 ' + filtered.length + ' 条' : 'Showing ' + shown + ' of ' + filtered.length + ' items')
        : labels.empty;
    }

    if (moreButton) {
      moreButton.hidden = shown >= filtered.length;
      moreButton.textContent = labels.more;
    }
  }

  function resetAndUpdate() {
    visibleLimit = INITIAL_VISIBLE;
    updateView();
  }

  function setLoaded() {
    if (archiveSection) archiveSection.setAttribute('aria-busy', 'false');
  }

  function showFailure() {
    // Keep the generated archive readable if the optional enhancement fails.
    if (archive.querySelector('[data-media-id]')) {
      if (moreButton) moreButton.hidden = true;
      setLoaded();
      return;
    }
    featuredRoot.replaceChildren();
    var fallback = text('div', 'pr-archive-hold');
    fallback.appendChild(text('p', 'pr-featured__tag', 'Media archive'));
    fallback.appendChild(text('h3', 'pr-section-title', 'Archive temporarily unavailable'));
    fallback.appendChild(text('p', 'pr-section-sub', 'Please check back shortly or contact media@shorevest.com for media inquiries.'));
    featuredRoot.appendChild(fallback);
    archive.replaceChildren();
    if (count) count.textContent = 'Archive unavailable';
    if (moreButton) moreButton.hidden = true;
    setLoaded();
  }

  if (yearSelect) yearSelect.addEventListener('change', resetAndUpdate);
  if (publicationSelect) publicationSelect.addEventListener('change', resetAndUpdate);
  if (moreButton) {
    moreButton.addEventListener('click', function () {
      visibleLimit += PAGE_SIZE;
      updateView();
    });
  }

  var embedded = document.getElementById('media-archive-data');
  var request = embedded
    ? Promise.resolve().then(function () { return JSON.parse(embedded.textContent); })
    : fetch(DATA_URL, { credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('Media archive request failed: ' + response.status);
      return response.json();
    });
  request
    .then(function (data) {
      var items = Array.isArray(data.items) ? data.items : [];
      allItems = items
        .filter(function (item) { return item && item.status === 'published' && item.publication && item.date && item.title; })
        .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

      if (!allItems.length) throw new Error('Media archive contains no published items');

      var featured = allItems.find(function (item) { return item.featured; }) || allItems[0];
      renderFeatured(featured);
      populateFilters(allItems);
      updateView();
      setLoaded();
      // Preserve exact legacy-article destinations, including older hidden rows.
      var targetId = window.location.hash.slice(1);
      try { targetId = decodeURIComponent(targetId); } catch (_) { /* Ignore malformed legacy fragments. */ }
      var targetIndex = allItems.findIndex(function (item) { return item.id === targetId; });
      if (targetIndex >= 0) {
        visibleLimit = Math.max(INITIAL_VISIBLE, targetIndex + 1);
        updateView();
        document.getElementById(targetId).scrollIntoView({ block: 'center' });
      }
    })
    .catch(function (error) {
      console.error(error);
      showFailure();
    });
})();
