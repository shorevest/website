(function () {
  var CAREERS_HREF = 'https://shorevest.github.io/website/careers/?t=';

  // Chrome can fail to chain wheel scrolling from homepage content to the root
  // scroller when the homepage applies overscroll-behavior:none to every element
  // and overflow-x:hidden to body. Restore normal scroll chaining while keeping
  // horizontal overflow clipped. Scoped to the homepage only.
  if (document.body && document.body.classList.contains('homepage') && !document.getElementById('sv-home-scroll-fix')) {
    var scrollFix = document.createElement('style');
    scrollFix.id = 'sv-home-scroll-fix';
    scrollFix.textContent = [
      'html,',
      'body.homepage,',
      'body.homepage * { overscroll-behavior: auto !important; }',
      'body.homepage { overflow-x: clip !important; }'
    ].join('\n');
    document.head.appendChild(scrollFix);
  }

  function isCareersHref(href) {
    if (!href) return false;
    return /^(?:\.\.\/)?careers\.html(?:[?#].*)?$/i.test(href) ||
      /^(?:\.\.\/)?careers\/(?:[?#].*)?$/i.test(href) ||
      /^\/careers\/(?:[?#].*)?$/i.test(href) ||
      /^https:\/\/shorevest\.com\/careers(?:\.html|\/)?(?:[?#].*)?$/i.test(href);
  }

  function fixCareersLinks(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var links = scope.querySelectorAll('a[href]');
    links.forEach(function (link) {
      if (isCareersHref(link.getAttribute('href'))) {
        link.setAttribute('href', CAREERS_HREF);
      }
    });
  }

  fixCareersLinks(document);

  if (window.MutationObserver) {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('a[href]') && isCareersHref(node.getAttribute('href'))) {
            node.setAttribute('href', CAREERS_HREF);
          }
          fixCareersLinks(node);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  function resetNavigation() {
    var burgers = document.querySelectorAll('.sv-burger');
    var menus = document.querySelectorAll('.sv-mobile-menu');
    menus.forEach(function (menu) { menu.classList.remove('is-open'); });
    burgers.forEach(function (burger) {
      burger.setAttribute('aria-expanded', 'false');
      if (/关闭|Close/i.test(burger.getAttribute('aria-label') || '')) {
        burger.setAttribute('aria-label', document.documentElement.lang && document.documentElement.lang.indexOf('zh') === 0 ? '打开菜单' : 'Open menu');
      }
    });
  }

  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('.sv-mobile-menu a[href]') : null;
    if (link) resetNavigation();
  }, true);

  window.addEventListener('pagehide', resetNavigation);
  window.addEventListener('pageshow', resetNavigation);
  window.addEventListener('resize', function () {
    if (window.matchMedia && window.matchMedia('(min-width: 981px)').matches) resetNavigation();
  });
})();
