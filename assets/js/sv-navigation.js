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

  // Chrome 150 on macOS can deliver wheel events without moving the root
  // scroller. For that exact browser/version only, take control of vertical
  // wheel input and apply the delta directly. Other browsers keep native scrolling.
  var userAgent = navigator.userAgent || '';
  var needsMacChrome150WheelFix = /Macintosh/.test(userAgent) &&
    /Chrome\/150\./.test(userAgent) &&
    !/(Edg|OPR)\//.test(userAgent);

  if (document.body && document.body.classList.contains('homepage') && needsMacChrome150WheelFix) {
    function normalizedWheelDelta(event) {
      if (event.deltaMode === 1) return event.deltaY * 16;
      if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
      return event.deltaY;
    }

    function scrollableAncestorCanMove(target, deltaY) {
      var node = target instanceof Element ? target : null;
      while (node && node !== document.body && node !== document.documentElement) {
        var style = window.getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
          var canMoveDown = deltaY > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1;
          var canMoveUp = deltaY < 0 && node.scrollTop > 1;
          if (canMoveDown || canMoveUp) return true;
        }
        node = node.parentElement;
      }
      return false;
    }

    document.addEventListener('wheel', function (event) {
      if (!event.deltaY || event.ctrlKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      var target = event.target instanceof Element ? event.target : null;
      if (target && target.closest('.sv-mobile-menu.is-open')) return;
      if (scrollableAncestorCanMove(target, event.deltaY)) return;

      event.preventDefault();
      window.scrollBy(0, normalizedWheelDelta(event));
    }, { passive: false, capture: true });
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
