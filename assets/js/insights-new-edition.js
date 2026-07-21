/* Insights navigation, article structure and sharing compatibility.
 *
 * China Debt Dynamics articles build their content and share menu asynchronously.
 * Keep sharing reliable, then add presentation hooks once article sections exist.
 */
(function () {
  'use strict';

  var SITE_ORIGIN = 'https://shorevest.com';
  var activeFigureTrigger = null;

  function cleanInsightPath(pathname) {
    var path = String(pathname || '').replace(/\/index\.html$/i, '/');
    var match = path.match(/^\/insights\/china-debt-dynamics\/([^/?#]+)\/?$/i);
    return match ? '/insights/china-debt-dynamics/' + match[1].toLowerCase() + '/' : '';
  }

  function articlePathFromSource() {
    var source = document.body && (
      document.body.dataset.articleSource ||
      document.body.dataset.defaultArticleSource ||
      ''
    );
    var match = String(source).match(/china-debt-dynamics-(v\d+i\d+)\.json/i);
    return match ? '/insights/china-debt-dynamics/' + match[1].toLowerCase() + '/' : '';
  }

  function getExactArticleUrl() {
    var currentPath = cleanInsightPath(window.location.pathname);
    if (currentPath) return SITE_ORIGIN + currentPath;

    var sourcePath = articlePathFromSource();
    if (sourcePath) return SITE_ORIGIN + sourcePath;

    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href) {
      try {
        var canonicalUrl = new URL(canonical.href, SITE_ORIGIN);
        var canonicalPath = cleanInsightPath(canonicalUrl.pathname);
        if (canonicalPath) return SITE_ORIGIN + canonicalPath;
      } catch (_) {}
    }

    return SITE_ORIGIN + '/insights/';
  }

  function getLinkedInShareUrl() {
    return 'https://www.linkedin.com/sharing/share-offsite/?url=' +
      encodeURIComponent(getExactArticleUrl());
  }

  function isLinkedInItem(item) {
    return item &&
      item.classList &&
      item.classList.contains('cdd-share__item') &&
      item.textContent.trim().toLowerCase() === 'linkedin';
  }

  function closeShareMenu() {
    var menu = document.querySelector('[data-cdd-share-menu], .cdd-share__menu');
    if (menu) menu.classList.remove('is-open');
    var toggle = document.querySelector('[data-cdd-share-toggle]');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function upgradeLinkedInShare(root) {
    if (!root || root.nodeType !== 1) return;

    var candidates = [];
    if (root.matches && root.matches('.cdd-share__item')) candidates.push(root);
    if (root.querySelectorAll) {
      candidates = candidates.concat(Array.from(root.querySelectorAll('.cdd-share__item')));
    }

    candidates.forEach(function (item) {
      if (!isLinkedInItem(item)) return;

      var articleUrl = getExactArticleUrl();
      var shareUrl = getLinkedInShareUrl();

      if (item.tagName === 'A') {
        item.href = shareUrl;
        item.target = '_self';
        item.rel = 'noopener noreferrer';
        item.setAttribute('data-share-url', articleUrl);
        return;
      }

      var link = document.createElement('a');
      link.className = item.className;
      link.textContent = item.textContent;
      link.href = shareUrl;
      link.target = '_self';
      link.rel = 'noopener noreferrer';
      link.setAttribute('role', 'menuitem');
      link.setAttribute('aria-label', 'Share this insight on LinkedIn');
      link.setAttribute('data-share-url', articleUrl);
      link.style.textDecoration = 'none';
      item.replaceWith(link);
    });
  }

  function installGuaranteedClickFallback() {
    document.addEventListener('click', function (event) {
      var item = event.target && event.target.closest
        ? event.target.closest('.cdd-share__item')
        : null;
      if (!isLinkedInItem(item)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      closeShareMenu();

      /* Same-tab navigation is not subject to popup or new-window blocking. */
      window.location.assign(getLinkedInShareUrl());
    }, true);
  }

  function installFigureStyles() {
    if (!document.body || !document.body.classList.contains('cdd-article-page')) return;
    if (document.querySelector('link[data-cdd-figure-styles]')) return;

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/cdd-article-figures.css?v=20260722-mobile-figure-viewer-v1';
    link.setAttribute('data-cdd-figure-styles', 'true');
    document.head.appendChild(link);
  }

  function ensureFigureViewer() {
    var existing = document.querySelector('.cdd-figure-viewer');
    if (existing) return existing;

    var viewer = document.createElement('div');
    viewer.className = 'cdd-figure-viewer';
    viewer.hidden = true;
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'Full-size diagram');
    viewer.innerHTML =
      '<div class="cdd-figure-viewer__panel">' +
        '<div class="cdd-figure-viewer__toolbar">' +
          '<p class="cdd-figure-viewer__label">Full diagram</p>' +
          '<button class="cdd-figure-viewer__close" type="button" aria-label="Close full-size diagram">Close</button>' +
        '</div>' +
        '<div class="cdd-figure-viewer__viewport" tabindex="0">' +
          '<img class="cdd-figure-viewer__image" alt="">' +
        '</div>' +
        '<p class="cdd-figure-viewer__caption"></p>' +
      '</div>';

    function closeViewer() {
      viewer.classList.remove('is-open');
      viewer.hidden = true;
      document.body.classList.remove('cdd-figure-viewer-open');
      if (activeFigureTrigger && typeof activeFigureTrigger.focus === 'function') {
        activeFigureTrigger.focus();
      }
      activeFigureTrigger = null;
    }

    viewer.querySelector('.cdd-figure-viewer__close').addEventListener('click', closeViewer);
    viewer.addEventListener('click', function (event) {
      if (event.target === viewer) closeViewer();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !viewer.hidden) closeViewer();
    });

    viewer.closeViewer = closeViewer;
    document.body.appendChild(viewer);
    return viewer;
  }

  function openFigureViewer(img, caption, trigger) {
    if (!img) return;

    var viewer = ensureFigureViewer();
    var viewerImage = viewer.querySelector('.cdd-figure-viewer__image');
    var viewerCaption = viewer.querySelector('.cdd-figure-viewer__caption');
    var viewport = viewer.querySelector('.cdd-figure-viewer__viewport');
    var closeButton = viewer.querySelector('.cdd-figure-viewer__close');
    var captionText = caption ? caption.textContent.trim() : '';

    activeFigureTrigger = trigger || img;
    viewerImage.src = img.currentSrc || img.src;
    viewerImage.alt = img.alt || captionText || 'Diagram';
    viewerCaption.textContent = captionText;
    viewerCaption.hidden = !captionText;
    viewer.hidden = false;
    viewer.classList.add('is-open');
    document.body.classList.add('cdd-figure-viewer-open');
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
    closeButton.focus();
  }

  function upgradeFigure(figure) {
    if (!figure || figure.dataset.cddFigureReady === 'true') return;

    var img = Array.from(figure.children).find(function (child) {
      return child.tagName === 'IMG';
    }) || figure.querySelector('img');
    if (!img) return;

    var caption = figure.querySelector('figcaption');
    var media = document.createElement('div');
    media.className = 'cdd-figure__media';
    figure.insertBefore(media, img);
    media.appendChild(img);

    var button = document.createElement('button');
    button.className = 'cdd-figure__expand';
    button.type = 'button';
    button.innerHTML = '<span>View full diagram</span><span aria-hidden="true">↗</span>';
    button.setAttribute('aria-label', 'View full diagram' + (img.alt ? ': ' + img.alt : ''));
    button.addEventListener('click', function () {
      openFigureViewer(img, caption, button);
    });
    media.appendChild(button);

    img.classList.add('cdd-figure__image');
    img.addEventListener('click', function () {
      if (window.matchMedia('(max-width: 700px)').matches) {
        openFigureViewer(img, caption, img);
      }
    });
    img.addEventListener('keydown', function (event) {
      if (!window.matchMedia('(max-width: 700px)').matches) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFigureViewer(img, caption, img);
      }
    });
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', 'View full diagram' + (img.alt ? ': ' + img.alt : ''));

    figure.dataset.cddFigureReady = 'true';
  }

  function upgradeFigures(root) {
    if (!root || root.nodeType !== 1) return;

    var figures = [];
    if (root.matches && root.matches('.cdd-figure')) figures.push(root);
    if (root.querySelectorAll) {
      figures = figures.concat(Array.from(root.querySelectorAll('.cdd-figure')));
    }
    figures.forEach(upgradeFigure);
  }

  function upgradeSourceEntry(entry) {
    if (!entry || entry.querySelector('.cdd-source-note__copy')) return;

    var text = entry.textContent.trim();
    var match = text.match(/^\[(\d+)\]\s*([\s\S]*)$/);
    if (!match) return;

    entry.classList.add('cdd-source-note');
    entry.textContent = '';

    var index = document.createElement('span');
    index.className = 'cdd-source-note__index';
    index.textContent = '[' + match[1] + ']';

    var copy = document.createElement('span');
    copy.className = 'cdd-source-note__copy';
    copy.textContent = match[2];

    entry.append(index, copy);
  }

  function enhanceCddStructure() {
    if (!document.body || !document.body.classList.contains('cdd-article-page')) return;

    var article = document.querySelector('[data-cdd-body]');
    if (!article) return;

    upgradeFigures(article);

    var headings = Array.from(article.children).filter(function (element) {
      return element.tagName === 'H2';
    });

    headings.forEach(function (heading) {
      var next = heading.nextElementSibling;
      if (next && next.tagName === 'H2') {
        heading.classList.add('cdd-part-label');
        next.classList.add('cdd-section-heading');
      }
    });

    var sourcesHeading = headings.find(function (heading) {
      return heading.textContent.trim().toLowerCase() === 'sources and notes';
    });
    if (!sourcesHeading) return;

    sourcesHeading.classList.add('cdd-sources-heading');

    var node = sourcesHeading.nextElementSibling;
    while (node && node.tagName !== 'H2') {
      if (node.tagName === 'P') {
        upgradeSourceEntry(node);
      } else if (node.tagName === 'UL' || node.tagName === 'OL') {
        node.classList.add('cdd-sources-list');
        node.setAttribute('aria-label', 'Sources and notes');
        Array.from(node.children).forEach(upgradeSourceEntry);
      }
      node = node.nextElementSibling;
    }
  }

  function start() {
    installFigureStyles();
    installGuaranteedClickFallback();
    upgradeLinkedInShare(document.body);
    upgradeFigures(document.body);
    enhanceCddStructure();

    if (!('MutationObserver' in window)) return;
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.from(mutation.addedNodes).forEach(function (node) {
          upgradeLinkedInShare(node);
          upgradeFigures(node);
        });
      });
      enhanceCddStructure();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
