/* Insights navigation and article-sharing compatibility.
 *
 * China Debt Dynamics articles build their share menu asynchronously. Make the
 * LinkedIn option work even if the menu appears after page load or a browser
 * blocks scripted popups. The exact clean ShoreVest article URL is always used.
 */
(function () {
  'use strict';

  var SITE_ORIGIN = 'https://shorevest.com';

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
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
        item.setAttribute('data-share-url', articleUrl);
        return;
      }

      var link = document.createElement('a');
      link.className = item.className;
      link.textContent = item.textContent;
      link.href = shareUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('role', 'menuitem');
      link.setAttribute('aria-label', 'Share this insight on LinkedIn');
      link.setAttribute('data-share-url', articleUrl);
      link.style.textDecoration = 'none';
      link.addEventListener('click', closeShareMenu);
      item.replaceWith(link);
    });
  }

  function installGuaranteedClickFallback() {
    document.addEventListener('click', function (event) {
      var item = event.target && event.target.closest
        ? event.target.closest('.cdd-share__item')
        : null;
      if (!isLinkedInItem(item) || item.tagName === 'A') return;

      event.preventDefault();
      event.stopImmediatePropagation();
      closeShareMenu();

      /* A direct navigation cannot be blocked as a popup. */
      window.location.assign(getLinkedInShareUrl());
    }, true);
  }

  function start() {
    installGuaranteedClickFallback();
    upgradeLinkedInShare(document.body);

    if (!('MutationObserver' in window)) return;
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.from(mutation.addedNodes).forEach(upgradeLinkedInShare);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();