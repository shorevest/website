/* Insights navigation and article-sharing compatibility.
 *
 * The Insights / 洞察 link intentionally uses the same standard navigation
 * treatment as every other primary nav item on both English and Chinese pages.
 *
 * China Debt Dynamics articles build their share menu asynchronously. Upgrade
 * the LinkedIn option from a script-opened popup button to a normal external
 * link so it works reliably with popup blocking, Safari, Chrome and mobile
 * browsers. The canonical article URL is shared rather than preview/query URLs.
 */
(function () {
  'use strict';

  function getCanonicalArticleUrl() {
    var canonical = document.querySelector('link[rel="canonical"]');
    var rawUrl = canonical && canonical.href ? canonical.href : window.location.href;

    try {
      var url = new URL(rawUrl, window.location.href);
      url.hash = '';
      ['t', 'source', 'src', 'pdf'].forEach(function (parameter) {
        url.searchParams.delete(parameter);
      });
      return url.href;
    } catch (_) {
      return rawUrl;
    }
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

      var articleUrl = getCanonicalArticleUrl();
      var link = document.createElement('a');
      link.className = item.className;
      link.textContent = item.textContent;
      link.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(articleUrl);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('role', 'menuitem');
      link.setAttribute('aria-label', 'Share this insight on LinkedIn');
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
