/* China Debt Dynamics inline citation treatment.
 * Converts manuscript-style markers such as [7] into visible, accessible
 * superscript links and ties them to the matching Sources and Notes entry.
 */
(function () {
  'use strict';

  var STYLE_URL = '/assets/css/cdd-citations.css?v=20260722-inline-citations-v2';
  var observer = null;
  var scheduled = false;

  function withToken(url) {
    if (typeof window.__svTok === 'function') return window.__svTok(url);
    var token = window.__SVT || '';
    if (!token) return url;
    return url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + encodeURIComponent(token);
  }

  function installStyles() {
    if (document.querySelector('link[data-cdd-citation-styles]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = withToken(STYLE_URL);
    link.setAttribute('data-cdd-citation-styles', 'true');
    document.head.appendChild(link);
  }

  function sourceNumber(entry) {
    if (!entry) return '';
    if (entry.dataset && entry.dataset.cddSourceNumber) return entry.dataset.cddSourceNumber;

    var index = entry.querySelector && entry.querySelector('.cdd-source-note__index');
    var text = index ? index.textContent : entry.textContent;
    var match = String(text || '').trim().match(/^\[?(\d+)\]?[.]?/);
    return match ? match[1] : '';
  }

  function sourceCopy(entry, number) {
    var copy = entry.querySelector && entry.querySelector('.cdd-source-note__copy');
    if (copy) return copy.textContent.trim();
    return String(entry.textContent || '')
      .replace(new RegExp('^\\s*\\[' + number + '\\]\\s*'), '')
      .trim();
  }

  function shorten(text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > 180 ? clean.slice(0, 177).trim() + '…' : clean;
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
        Array.from(node.children).forEach(function (entry) {
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

  function replaceCitationMarkers(root, sources) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        return eligibleTextNode(node) && /\[\d+\]/.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(function (textNode) {
      var text = textNode.nodeValue;
      var pattern = /\[(\d+)\]/g;
      var match;
      var cursor = 0;
      var fragment = document.createDocumentFragment();
      var changed = false;

      while ((match = pattern.exec(text))) {
        var source = sources[match[1]];
        if (!source) continue;

        fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));

        var sup = document.createElement('sup');
        sup.className = 'cdd-inline-citation';

        var link = document.createElement('a');
        link.href = '#' + source.id;
        link.textContent = '[' + source.number + ']';
        link.setAttribute('aria-label', 'View source ' + source.number);
        link.setAttribute('data-cdd-citation', source.number);
        if (source.title) link.title = 'Source ' + source.number + ': ' + source.title;

        sup.appendChild(link);
        fragment.appendChild(sup);
        cursor = pattern.lastIndex;
        changed = true;
      }

      if (!changed) return;
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
      textNode.replaceWith(fragment);
    });
  }

  function enhance() {
    scheduled = false;
    if (!document.body || !document.body.classList.contains('cdd-article-page')) return;

    var article = document.querySelector('[data-cdd-body]');
    if (!article) return;

    var headings = Array.from(article.querySelectorAll(':scope > h2'));
    var sourcesHeading = headings.find(function (heading) {
      return heading.textContent.trim().toLowerCase() === 'sources and notes';
    });
    if (!sourcesHeading) return;

    var sources = collectSources(sourcesHeading);
    if (!Object.keys(sources).length) return;

    var node = article.firstElementChild;
    while (node && node !== sourcesHeading) {
      if (node.tagName !== 'H2') replaceCitationMarkers(node, sources);
      node = node.nextElementSibling;
    }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
