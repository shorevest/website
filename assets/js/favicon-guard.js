(function () {
  var VERSION = "20260715";

  // Resolve the site base from this script's own URL so favicons work
  // whether the site is served from the domain root or a subpath
  // (e.g. GitHub Pages project sites).
  var script = document.currentScript;
  var base = "";
  if (script && script.src) {
    base = script.src.replace(/assets\/js\/favicon-guard\.js.*$/, "");
  }

  var ICONS = [
    { rel: "icon", href: base + "favicon.ico?v=" + VERSION, sizes: "any" },
    { rel: "shortcut icon", href: base + "favicon.ico?v=" + VERSION },
    { rel: "icon", href: base + "assets/favicon.svg?v=" + VERSION, type: "image/svg+xml" },
    { rel: "icon", href: base + "assets/favicon-32x32.png?v=" + VERSION, type: "image/png", sizes: "32x32" },
    { rel: "icon", href: base + "assets/favicon-16x16.png?v=" + VERSION, type: "image/png", sizes: "16x16" },
    { rel: "apple-touch-icon", href: base + "assets/apple-touch-icon.png?v=" + VERSION, sizes: "180x180" },
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

  ensureFavicons();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureFavicons);
  }
  window.addEventListener("pageshow", ensureFavicons);
  document.addEventListener("visibilitychange", ensureFavicons);
})();
