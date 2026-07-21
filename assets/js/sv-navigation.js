(function () {
  var CAREERS_HREF = '/careers/';

  // Preserve native vertical scrolling while clipping accidental horizontal
  // overflow from full-bleed page elements.
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

  // Keep the current desktop navigation item visibly selected after page load.
  if (document.body && document.body.classList.contains('homepage') && !document.getElementById('sv-active-nav-indicator')) {
    var activeNavStyle = document.createElement('style');
    activeNavStyle.id = 'sv-active-nav-indicator';
    activeNavStyle.textContent = [
      'body.homepage .sv-nav a[aria-current="page"]::after {',
      '  transform: scaleX(1) !important;',
      '}'
    ].join('\n');
    document.head.appendChild(activeNavStyle);
  }

  function isCareersPage() {
    return !!(
      document.body &&
      (
        document.body.classList.contains('careers-preview-page') ||
        document.body.classList.contains('careers-role-page')
      )
    );
  }

  // Careers index pages use a root <base> tag so generated role-detail links
  // resolve correctly. Without this adjustment, bare fragment links such as
  // #open-roles resolve to the homepage instead of the current Careers page.
  function fixCareersHashLinks(root) {
    if (!isCareersPage()) return;

    var scope = root && root.querySelectorAll ? root : document;
    var links = scope.querySelectorAll('a[href^="#"]');
    var currentPath = window.location.pathname || CAREERS_HREF;

    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (/^#[A-Za-z][A-Za-z0-9_:.-]*$/.test(href || '')) {
        link.setAttribute('href', currentPath + href);
      }
    });
  }

  function isCareersHref(href) {
    if (!href) return false;
    return /^(?:\.\.\/)?careers\.html(?:[?#].*)?$/i.test(href) ||
      /^(?:\.\.\/)?careers\/(?:[?#].*)?$/i.test(href) ||
      /^\/careers\/(?:[?#].*)?$/i.test(href) ||
      /^https:\/\/shorevest\.com\/careers(?:\.html|\/)?(?:[?#].*)?$/i.test(href) ||
      /^https:\/\/shorevest\.github\.io\/website\/careers\/(?:[?#].*)?$/i.test(href);
  }

  function cleanCareersHref(href) {
    var hashIndex = href ? href.indexOf('#') : -1;
    return CAREERS_HREF + (hashIndex >= 0 ? href.slice(hashIndex) : '');
  }

  function fixCareersLinks(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var links = scope.querySelectorAll('a[href]');
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (isCareersHref(href)) {
        link.setAttribute('href', cleanCareersHref(href));
      }
    });
  }

  fixCareersHashLinks(document);
  fixCareersLinks(document);

  if (window.MutationObserver) {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          fixCareersHashLinks(node);
          if (node.matches && node.matches('a[href]') && isCareersHref(node.getAttribute('href'))) {
            node.setAttribute('href', cleanCareersHref(node.getAttribute('href')));
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
