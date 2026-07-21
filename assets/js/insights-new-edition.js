/* Insights navigation and article-sharing compatibility.
 *
 * The Insights / 洞察 link intentionally uses the same standard navigation
 * treatment as every other primary nav item on both English and Chinese pages.
 *
 * China Debt Dynamics articles build their share menu asynchronously. Replace
 * the LinkedIn popup button with a normal external link and derive the target
 * from the article itself, never from preview, tracking or homepage state.
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

  function upgradeLinkedInShare(root) {
    if (!root || root.nodeType !== 1) return;

    var candidates = [];
    if (root.matches && root.matches('.cdd-share__item')) candidates.push(root);
    if (root.querySelectorAll) {
      candidates = candidates.concat(Array.from(root.querySelectorAll('.cdd-share__item')));
    }

    candidates.forEach(function (item) {
      if (item.tagName !== 'BUTTON' || item.textContent.trim().toLowerCase() !== 'linkedin') return;

      var articleUrl = getExactArticleUrl();
      var link = document.createElement('a');
      link.className = item.className;
      link.textContent = item.textContent;
      link.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(articleUrl);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('role', 'menuitem');
      link.setAttribute('aria-label', 'Share this insight on LinkedIn');
      link.setAttribute('data-share-url', articleUrl);
      link.style.textDecoration = 'none';

      link.addEventListener('click', function () {
        var menu = link.closest('.cdd-share__menu');
        if (menu) menu.classList.remove('is-open');
        var toggle = document.querySelector('[data-cdd-share-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });

      item.replaceWith(link);
    });
  }

  function start() {
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