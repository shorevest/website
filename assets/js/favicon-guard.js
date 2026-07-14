(function () {
  var VERSION = "20260714";
  var ICONS = [
    { rel: "icon", href: "/favicon.ico?v=" + VERSION, sizes: "any" },
    { rel: "shortcut icon", href: "/favicon.ico?v=" + VERSION },
    { rel: "icon", href: "/assets/favicon.svg?v=" + VERSION, type: "image/svg+xml" },
    { rel: "icon", href: "/assets/favicon-32x32.png?v=" + VERSION, type: "image/png", sizes: "32x32" },
    { rel: "icon", href: "/assets/favicon-16x16.png?v=" + VERSION, type: "image/png", sizes: "16x16" },
    { rel: "apple-touch-icon", href: "/assets/apple-touch-icon.png?v=" + VERSION, sizes: "180x180" },
    { rel: "manifest", href: "/site.webmanifest?v=" + VERSION },
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
