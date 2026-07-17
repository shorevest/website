(function () {
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
