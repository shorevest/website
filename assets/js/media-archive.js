(function () {
  'use strict';

  var DATA_URL = '/assets/data/media-archive.json';
  var INITIAL_VISIBLE = 6;
  var PAGE_SIZE = 6;

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
    return ['external', 'video', 'podcast', 'linkedin'].indexOf(item.linkType) !== -1;
  }

  function formatDate(iso) {
    var parts = String(iso || '').split('-');
    if (parts.length !== 3) return iso || '';
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  }

  function actionLabel(item) {
    if (!item.url) return '';
    if (item.linkType === 'video') return 'Watch';
    if (item.linkType === 'podcast') return 'Listen';
    if (item.linkType === 'archive') return 'View archive';
    return 'Read coverage';
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
    meta.appendChild(text('span', 'pr-featured__tag', 'Featured'));
    meta.appendChild(text('span', 'pr-featured__pub', item.publication));
    meta.appendChild(text('span', 'pr-featured__date', formatDate(item.date) + ' · ' + item.type));

    var body = text('div', 'pr-featured__body');
    body.appendChild(text('h3', 'pr-featured__title', item.title));
    if (item.summary) body.appendChild(text('p', 'pr-featured__desc', item.summary));
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
    row.dataset.typeLabel = String(item.type || '').toUpperCase();
    row.dataset.year = String(item.date || '').slice(0, 4);
    row.dataset.publication = item.publication || '';

    var shell = makeLinkedShell(item, 'press-row__item');
    if (item.url && item.linkType === 'archive') shell.classList.add('press-row__item--archived');

    shell.appendChild(text('span', 'press-publication', item.publication));

    var content = text('span', 'press-row__content');
    var typeLine = text('span', 'press-type-line');
    typeLine.appendChild(text('span', 'press-tag', item.type));
    content.appendChild(typeLine);
    content.appendChild(text('span', 'press-headline', item.title));
    if (item.summary) content.appendChild(text('span', 'press-row__summary', item.summary));
    shell.appendChild(content);

    var meta = text('span', 'press-row__meta');
    var date = text('time', 'press-date', formatDate(item.date));
    date.dateTime = item.date;
    meta.appendChild(date);
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
        ? 'Showing ' + shown + ' of ' + filtered.length + ' items'
        : 'No matching coverage';
    }

    if (moreButton) {
      moreButton.hidden = shown >= filtered.length;
      moreButton.textContent = 'Load more';
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

  fetch(DATA_URL, { credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('Media archive request failed: ' + response.status);
      return response.json();
    })
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
    })
    .catch(function (error) {
      console.error(error);
      showFailure();
    });
})();
