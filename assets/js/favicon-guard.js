(function () {
  var VERSION = "20260721-cn-copy";

  // Resolve the site base from this script's own URL so shared assets work
  // whether the site is served from the domain root or a subpath
  // (e.g. GitHub Pages project sites).
  var script = document.currentScript;
  var base = "";
  if (script && script.src) {
    base = script.src.replace(/assets\/js\/favicon-guard\.js.*$/, "");
  }

  var ICONS = [
    { rel: "icon", href: base + "assets/favicon-cinnabar.ico?v=" + VERSION, sizes: "any" },
    { rel: "shortcut icon", href: base + "assets/favicon-cinnabar.ico?v=" + VERSION },
    { rel: "icon", href: base + "assets/favicon-cinnabar.svg?v=" + VERSION, type: "image/svg+xml" },
    { rel: "icon", href: base + "assets/favicon-cinnabar-32x32.png?v=" + VERSION, type: "image/png", sizes: "32x32" },
    { rel: "icon", href: base + "assets/favicon-cinnabar-16x16.png?v=" + VERSION, type: "image/png", sizes: "16x16" },
    { rel: "apple-touch-icon", href: base + "assets/apple-touch-icon-cinnabar.png?v=" + VERSION, sizes: "180x180" },
    { rel: "manifest", href: base + "site.webmanifest?v=" + VERSION },
  ];

  function setAttr(el, key, value) {
    if (value) el.setAttribute(key, value);
  }

  function ensureFavicons() {
    if (!document.head) return;
    var old = document.head.querySelectorAll('link[data-sv-favicon-guard="true"]');
    for (var i = 0; i < old.length; i += 1) old[i].remove();

    ICONS.forEach(function (icon) {
      var link = document.createElement("link");
      link.setAttribute("data-sv-favicon-guard", "true");
      setAttr(link, "rel", icon.rel);
      setAttr(link, "href", icon.href);
      setAttr(link, "type", icon.type);
      setAttr(link, "sizes", icon.sizes);
      document.head.appendChild(link);
    });
  }

  function ensureChineseCopyOverrides() {
    if (!document.head) return;
    var language = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    var chinesePage = language.indexOf("zh") === 0 || /_cn(?:\.html)?(?:$|[?#])/.test(location.pathname);
    if (!chinesePage || document.querySelector('script[data-sv-cn-copy="true"]')) return;

    var copyScript = document.createElement("script");
    copyScript.src = base + "assets/js/chinese-copy-overrides.js?v=" + VERSION;
    copyScript.defer = true;
    copyScript.setAttribute("data-sv-cn-copy", "true");
    document.head.appendChild(copyScript);
  }

  ensureFavicons();
  ensureChineseCopyOverrides();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureFavicons);
    document.addEventListener("DOMContentLoaded", ensureChineseCopyOverrides);
  }
  window.addEventListener("pageshow", ensureFavicons);
  window.addEventListener("pageshow", ensureChineseCopyOverrides);
  document.addEventListener("visibilitychange", ensureFavicons);
})();
