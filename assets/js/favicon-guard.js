(function () {
  var VERSION = "20260722-favicon-cache-bust";

  function removeEmptyLegacyToken() {
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has("t") || url.searchParams.get("t")) return;
      url.searchParams.delete("t");
      var cleanUrl = url.pathname + url.search + url.hash;
      window.history.replaceState(window.history.state, "", cleanUrl);
    } catch (_) {
      // Leave the current URL untouched if the browser cannot rewrite it safely.
    }
  }

  removeEmptyLegacyToken();

  // Resolve the site base from this script's own URL so shared assets work
  // whether the site is served from the domain root or a GitHub Pages subpath.
  var script = document.currentScript;
  var base = "";
  if (script && script.src) {
    base = script.src.replace(/assets\/js\/favicon-guard\.js.*$/, "");
  }

  var ICONS = [
    { rel: "icon", href: base + "assets/favicon-shorevest-20260722.svg", type: "image/svg+xml", sizes: "any" },
    { rel: "icon", href: base + "assets/favicon-shorevest-20260722.ico", sizes: "any" },
    { rel: "shortcut icon", href: base + "assets/favicon-shorevest-20260722.ico" },
    { rel: "icon", href: base + "assets/favicon-shorevest-20260722-32x32.png", type: "image/png", sizes: "32x32" },
    { rel: "icon", href: base + "assets/favicon-shorevest-20260722-16x16.png", type: "image/png", sizes: "16x16" },
    { rel: "apple-touch-icon", href: base + "assets/apple-touch-icon-shorevest-20260722.png", sizes: "180x180" },
    { rel: "manifest", href: base + "site-20260722.webmanifest" }
  ];

  function setAttr(el, key, value) {
    if (value) el.setAttribute(key, value);
  }

  function ensureFavicons() {
    if (!document.head) return;

    // Remove every previous favicon declaration, not only ones added by this
    // script. Safari can otherwise keep selecting a cached retired icon from
    // duplicate link tags even when a newer declaration is present.
    var existing = document.head.querySelectorAll(
      'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"], link[rel="manifest"]'
    );
    for (var i = 0; i < existing.length; i += 1) existing[i].remove();

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

  function isCanonicalHomepage() {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical || !canonical.href) return location.pathname === "/";
    try {
      return new URL(canonical.href, location.href).href === "https://shorevest.com/";
    } catch (_) {
      return false;
    }
  }

  function ensureWebsiteSearchSignals() {
    if (!document.head || !isCanonicalHomepage()) return;

    var siteName = document.head.querySelector('meta[property="og:site_name"]');
    if (!siteName) {
      siteName = document.createElement("meta");
      siteName.setAttribute("property", "og:site_name");
      document.head.appendChild(siteName);
    }
    siteName.setAttribute("content", "ShoreVest");

    var existing = document.head.querySelector('script[data-sv-website-schema="true"]');
    if (existing) return;

    var schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.setAttribute("data-sv-website-schema", "true");
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://shorevest.com/#website",
      "url": "https://shorevest.com/",
      "name": "ShoreVest",
      "alternateName": ["ShoreVest Partners", "shorevest.com"],
      "publisher": { "@id": "https://shorevest.com/#organization" }
    });
    document.head.appendChild(schema);
  }

  ensureFavicons();
  ensureChineseCopyOverrides();
  ensureWebsiteSearchSignals();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureFavicons);
    document.addEventListener("DOMContentLoaded", ensureChineseCopyOverrides);
    document.addEventListener("DOMContentLoaded", ensureWebsiteSearchSignals);
  }
  window.addEventListener("pageshow", ensureFavicons);
  window.addEventListener("pageshow", ensureChineseCopyOverrides);
  window.addEventListener("pageshow", ensureWebsiteSearchSignals);
  document.addEventListener("visibilitychange", ensureFavicons);
})();
