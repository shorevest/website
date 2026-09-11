/* China Debt Dynamics citation treatment.
 * Manuscript markers such as [7], [1][2] or [1, 2] are rendered as
 * clean linked superscript numerals and tied to Sources and Notes.
 */
(function () {
  'use strict';

  var VERSION = '20260911-references-5';
  var STYLE_URL = '/assets/css/cdd-citations.css?v=' + VERSION;
  var observer = null;
  var scheduled = false;

  window.__CDD_CITATIONS_VERSION = VERSION;

  function withToken(url) {
    if (typeof window.__svTok === 'function') return window.__svTok(url);
    var token = window.__SVT || '';
    if (!token) return url;
    return url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + encodeURIComponent(token);
  }

  function installStyles() {
    var desired = withToken(STYLE_URL);
    var link = document.querySelector('link[data-cdd-citation-styles]');
    if (link) {
      if (link.href.indexOf('v=' + VERSION) === -1) link.href = desired;
      return link;
    }
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = desired;
    link.setAttribute('data-cdd-citation-styles', 'true');
    document.head.appendChild(link);
    return link;
  }

  function sourceNumber(entry) {
    if (!entry) return '';
    if (entry.dataset && entry.dataset.cddSourceNumber) return entry.dataset.cddSourceNumber;

    var index = entry.querySelector && entry.querySelector('.cdd-source-note__index');
    var text = index ? index.textContent : entry.textContent;
    var match = String(text || '').trim().match(/^\[?(\d+)\]?[.)]?/);
    return match ? match[1] : '';
  }

  function sourceCopy(entry, number) {
    var copy = entry.querySelector && entry.querySelector('.cdd-source-note__copy');
    if (copy) return copy.textContent.trim();
    return String(entry.textContent || '')
      .replace(new RegExp('^\\s*(?:\\[' + number + '\\]|' + number + '[.)]?)\\s*'), '')
      .trim();
  }

  function shorten(text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > 180 ? clean.slice(0, 177).trim() + '…' : clean;
  }

  function linkifySourceUrls(copy) {
    if (!copy || copy.querySelector('a[data-cdd-source-url]')) return;

    var text = copy.textContent || '';
    var pattern = /https?:\/\/[^\s]+/g;
    var match;
    var cursor = 0;
    var fragment = document.createDocumentFragment();
    var changed = false;

    while ((match = pattern.exec(text))) {
      fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));

      var href = match[0].replace(/[.,;)]+$/, '');
      var trailing = match[0].slice(href.length);
      var link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('data-cdd-source-url', 'true');

      try {
        var host = new URL(href).hostname.replace(/^www\./, '');
        if (host.indexOf('savills') !== -1) link.textContent = 'Savills';
        else if (host.indexOf('cbre') !== -1) link.textContent = 'CBRE';
        else if (host.indexOf('jll') !== -1) link.textContent = 'JLL';
        else link.textContent = 'Source';
      } catch (_) {
        link.textContent = 'Source';
      }

      fragment.appendChild(link);
      if (trailing) fragment.appendChild(document.createTextNode(trailing));
      cursor = match.index + match[0].length;
      changed = true;
    }

    if (!changed) return;
    fragment.appendChild(document.createTextNode(text.slice(cursor)));
    copy.textContent = '';
    copy.appendChild(fragment);
  }

  function upgradeSourceEntry(entry) {
    var number = sourceNumber(entry);
    if (!number) return null;

    var copyText = sourceCopy(entry, number);
    var copy = entry.querySelector('.cdd-source-note__copy');
    var index = entry.querySelector('.cdd-source-note__index');

    if (!copy || !index) {
      entry.textContent = '';
      index = document.createElement('span');
      index.className = 'cdd-source-note__index';
      copy = document.createElement('span');
      copy.className = 'cdd-source-note__copy';
      copy.textContent = copyText;
      entry.append(index, copy);
    }

    entry.classList.add('cdd-source-note');
    entry.dataset.cddSourceNumber = number;
    entry.id = 'cdd-source-' + number;
    index.textContent = number + '.';
    linkifySourceUrls(copy);

    return {
      number: number,
      id: entry.id,
      title: shorten(copy.textContent)
    };
  }

  function collectSources(sourcesHeading) {
    var sources = {};
    var node = sourcesHeading.nextElementSibling;

    sourcesHeading.classList.add('cdd-sources-heading');

    while (node && node.tagName !== 'H2') {
      if (node.tagName === 'P') {
        var paragraphSource = upgradeSourceEntry(node);
        if (paragraphSource) sources[paragraphSource.number] = paragraphSource;
      } else if (node.tagName === 'UL' || node.tagName === 'OL') {
        node.classList.add('cdd-sources-list');
        node.setAttribute('aria-label', 'Sources and notes');
        Array.from(node.children).forEach(function (entry, index) {
          if (!sourceNumber(entry) && node.tagName === 'OL') {
            entry.dataset.cddSourceNumber = String(index + 1);
          }
          var listSource = upgradeSourceEntry(entry);
          if (listSource) sources[listSource.number] = listSource;
        });
      }
      node = node.nextElementSibling;
    }

    return sources;
  }

  function eligibleTextNode(node) {
    if (!node || !node.nodeValue || node.nodeValue.indexOf('[') === -1) return false;
    var parent = node.parentElement;
    if (!parent) return false;
    return !parent.closest('a, sup, code, pre, script, style, .cdd-source-note');
  }

  function makeCitationGroup(numbers, sources) {
    var sup = document.createElement('sup');
    sup.className = 'cdd-inline-citation';

    numbers.forEach(function (number, index) {
      var source = sources[number];
      if (index) {
        var separator = document.createElement('span');
        separator.className = 'cdd-inline-citation__separator';
        separator.textContent = ',';
        separator.setAttribute('aria-hidden', 'true');
        sup.appendChild(separator);
      }

      var link = document.createElement('a');
      link.href = '#' + source.id;
      link.textContent = source.number;
      link.setAttribute('aria-label', 'View source ' + source.number);
      link.setAttribute('data-cdd-citation', source.number);
      if (source.title) link.title = 'Source ' + source.number + ': ' + source.title;
      sup.appendChild(link);
    });

    return sup;
  }

  function replaceCitationMarkers(root, sources) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        return eligibleTextNode(node) && /\[\s*\d+/.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(function (textNode) {
      var text = textNode.nodeValue;
      var pattern = /(?:\[(?:\d+(?:\s*[,;]\s*\d+)*)\])(?:\s*\[(?:\d+(?:\s*[,;]\s*\d+)*)\])*/g;
      var match;
      var cursor = 0;
      var fragment = document.createDocumentFragment();
      var changed = false;

      while ((match = pattern.exec(text))) {
        var numbers = (match[0].match(/\d+/g) || []).filter(function (number, index, all) {
          return all.indexOf(number) === index;
        });
        if (!numbers.length || numbers.some(function (number) { return !sources[number]; })) continue;

        fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        fragment.appendChild(makeCitationGroup(numbers, sources));
        cursor = pattern.lastIndex;
        changed = true;
      }

      if (!changed) return;
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
      textNode.replaceWith(fragment);
    });
  }

  function isSourcesHeading(heading) {
    var text = heading.textContent.trim().toLowerCase().replace(/\s+/g, ' ');
    return text === 'sources and notes' ||
      text === 'sources & notes' ||
      text === 'notes and sources' ||
      text === 'sources' ||
      text === 'references';
  }

  function enhance() {
    scheduled = false;
    if (!document.body) return;
    var supported = document.body.classList.contains('cdd-article-page') ||
      document.body.classList.contains('cdd-print-layout');
    if (!supported) return;

    var article = document.querySelector('[data-cdd-body]');
    if (!article) return;
    if (article.dataset.cddCitationsEnhanced === VERSION) return;

    var headings = Array.from(article.querySelectorAll(':scope > h2'));
    var sourcesHeading = headings.find(isSourcesHeading);
    if (!sourcesHeading) return;

    var sources = collectSources(sourcesHeading);
    if (!Object.keys(sources).length) return;

    var node = article.firstElementChild;
    while (node && node !== sourcesHeading) {
      if (node.tagName !== 'H2') replaceCitationMarkers(node, sources);
      node = node.nextElementSibling;
    }

    article.dataset.cddCitationsEnhanced = VERSION;
  }

  function scheduleEnhance() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(enhance);
  }

  function start() {
    installStyles();
    scheduleEnhance();

    if (!('MutationObserver' in window) || observer) return;
    observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.__cddEnhanceCitations = function () {
    installStyles();
    enhance();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
