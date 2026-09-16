(function () {
  var VERSION = "20260916-analytics-consent-2";

  var GOOGLE_ANALYTICS_ID = "G-CLVYF17N9H";
  var ANALYTICS_CONSENT_KEY = "sv_analytics_consent_v1";
  var ANALYTICS_CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

  function isPublicAnalyticsPage() {
    var hostname = (window.location.hostname || "").toLowerCase();
    var pathname = window.location.pathname || "/";

    if (hostname !== "shorevest.com" && hostname !== "www.shorevest.com") return false;
    if (/^\/(?:employee-portal|shorevest-one|api)(?:\/|$)/i.test(pathname)) return false;

    try {
      return !(new URL(window.location.href)).searchParams.has("t");
    } catch (_) {
      return true;
    }
  }

  function readAnalyticsConsent() {
    try {
      var raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      if (!raw) return null;
      var stored = JSON.parse(raw);
      if (!stored || (stored.choice !== "accepted" && stored.choice !== "rejected")) return null;
      if (!stored.savedAt || Date.now() - stored.savedAt > ANALYTICS_CONSENT_TTL_MS) {
        window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
        return null;
      }
      return stored.choice;
    } catch (_) {
      return null;
    }
  }

  function writeAnalyticsConsent(choice) {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, JSON.stringify({
        choice: choice,
        savedAt: Date.now()
      }));
    } catch (_) {}
  }

  function ensureGtagQueue() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
  }

  function ensureGoogleAnalytics() {
    if (!document.head || !isPublicAnalyticsPage() || readAnalyticsConsent() !== "accepted") return;
    ensureGtagQueue();

    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });

    if (!window.__SV_GA4_CONFIGURED) {
      window.__SV_GA4_CONFIGURED = true;
      window.gtag("js", new Date());
      window.gtag("config", GOOGLE_ANALYTICS_ID, {
        send_page_view: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
    }

    if (document.querySelector('script[data-sv-google-analytics="true"]')) return;
    var analyticsScript = document.createElement("script");
    analyticsScript.async = true;
    analyticsScript.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GOOGLE_ANALYTICS_ID);
    analyticsScript.setAttribute("data-sv-google-analytics", "true");
    document.head.appendChild(analyticsScript);
  }

  function clearGoogleAnalyticsCookies() {
    try {
      var cookies = document.cookie ? document.cookie.split(";") : [];
      for (var i = 0; i < cookies.length; i += 1) {
        var name = cookies[i].split("=")[0].trim();
        if (name !== "_ga" && name.indexOf("_ga_") !== 0) continue;
        document.cookie = name + "=; Max-Age=0; path=/; SameSite=Lax";
        document.cookie = name + "=; Max-Age=0; path=/; domain=.shorevest.com; SameSite=Lax";
      }
    } catch (_) {}
  }

  function disableGoogleAnalytics() {
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      });
    }
    clearGoogleAnalyticsCookies();
  }

  function setAnalyticsConsent(choice) {
    writeAnalyticsConsent(choice);
    if (choice === "accepted") ensureGoogleAnalytics();
    else disableGoogleAnalytics();
    var banner = document.getElementById("sv-analytics-consent");
    if (banner) banner.remove();
  }

  function ensureAnalyticsConsentStyles() {
    if (!document.head || document.getElementById("sv-analytics-consent-styles")) return;
    var style = document.createElement("style");
    style.id = "sv-analytics-consent-styles";
    style.textContent = [
      "#sv-analytics-consent{position:fixed;left:20px;right:20px;bottom:20px;z-index:2147483000;max-width:760px;margin:0 auto;padding:18px 20px;background:#fffdf7;color:#1f2b22;border:1px solid rgba(31,43,34,.18);box-shadow:0 12px 40px rgba(0,0,0,.18);font:14px/1.55 Arial,Helvetica,sans-serif}",
      "#sv-analytics-consent strong{display:block;margin-bottom:4px;font-size:15px}",
      "#sv-analytics-consent p{margin:0 0 12px}",
      "#sv-analytics-consent a{color:inherit;text-decoration:underline;text-underline-offset:2px}",
      "#sv-analytics-consent .sv-consent-actions{display:flex;gap:10px;flex-wrap:wrap}",
      "#sv-analytics-consent button{min-height:38px;padding:8px 14px;border:1px solid #2e4a18;background:transparent;color:#2e4a18;font:600 13px/1 Arial,Helvetica,sans-serif;cursor:pointer}",
      "#sv-analytics-consent button[data-choice=accepted]{background:#2e4a18;color:#fff}",
      ".sv-cookie-settings-button{appearance:none;border:0;background:none;padding:0;color:inherit;font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:2px}",
      "@media(max-width:600px){#sv-analytics-consent{left:12px;right:12px;bottom:12px;padding:16px}#sv-analytics-consent .sv-consent-actions{display:grid;grid-template-columns:1fr}#sv-analytics-consent button{width:100%}}"
    ].join("");
    document.head.appendChild(style);
  }

  function showAnalyticsConsentBanner() {
    if (!isPublicAnalyticsPage() || !document.body) return;
    ensureAnalyticsConsentStyles();
    var existing = document.getElementById("sv-analytics-consent");
    if (existing) existing.remove();

    var chinese = isChinesePage();
    var banner = document.createElement("section");
    banner.id = "sv-analytics-consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-label", chinese ? "Cookie 偏好设置" : "Cookie preferences");

    var noticeHref = chinese ? "/cn/cookie-notice/" : "/cookie-notice/";
    banner.innerHTML = chinese
      ? '<strong>Cookie 偏好设置</strong><p>新岸资本仅在您同意后启用可选的分析 Cookie，以了解网站的使用情况。您可以接受分析 Cookie，或拒绝非必要 Cookie。详见 <a href="' + noticeHref + '">Cookie 通知</a>。</p><div class="sv-consent-actions"><button type="button" data-choice="accepted">接受分析 Cookie</button><button type="button" data-choice="rejected">拒绝非必要 Cookie</button></div>'
      : '<strong>Cookie preferences</strong><p>ShoreVest only enables optional analytics cookies after you consent. You can accept analytics cookies or reject non-essential cookies. See the <a href="' + noticeHref + '">Cookie Notice</a>.</p><div class="sv-consent-actions"><button type="button" data-choice="accepted">Accept analytics</button><button type="button" data-choice="rejected">Reject non-essential</button></div>';

    banner.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("button[data-choice]") : null;
      if (!button) return;
      setAnalyticsConsent(button.getAttribute("data-choice"));
    });
    document.body.appendChild(banner);
  }

  function ensureCookieSettingsControl() {
    if (!document.body || !isPublicAnalyticsPage() || document.querySelector(".sv-cookie-settings-button")) return;
    ensureAnalyticsConsentStyles();
    var footerLinks = document.querySelector(".sv-footer__links");
    if (!footerLinks) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "sv-cookie-settings-button";
    button.textContent = isChinesePage() ? "Cookie 设置" : "Cookie settings";
    button.addEventListener("click", showAnalyticsConsentBanner);
    footerLinks.appendChild(button);
  }

  function initializeAnalyticsConsent() {
    if (!isPublicAnalyticsPage()) return;
    var choice = readAnalyticsConsent();
    if (choice === "accepted") ensureGoogleAnalytics();
    else if (choice === "rejected") disableGoogleAnalytics();
    else showAnalyticsConsentBanner();
    ensureCookieSettingsControl();
  }

  function trackAnalyticsEvent(name, parameters) {
    if (!isPublicAnalyticsPage() || readAnalyticsConsent() !== "accepted" || typeof window.gtag !== "function") return;
    var payload = parameters || {};
    payload.transport_type = "beacon";
    window.gtag("event", name, payload);
  }

  function ensureAnalyticsIntentTracking() {
    if (!document.documentElement || document.documentElement.getAttribute("data-sv-analytics-intent-ready") === "true") return;
    document.documentElement.setAttribute("data-sv-analytics-intent-ready", "true");

    document.addEventListener("submit", function (event) {
      var form = event.target;
      if (!form || form.id !== "cp-form") return;
      if (typeof form.checkValidity === "function" && !form.checkValidity()) return;

      var typeField = form.querySelector('[name="inquiry_type"]');
      trackAnalyticsEvent("contact_email_open", {
        inquiry_type: typeField && typeField.value ? typeField.value : "general",
        site_language: isChinesePage() ? "zh" : "en"
      });
    }, true);
  }

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

  function legacyInsightTarget() {
    var pathname = window.location.pathname || "/";
    var legacyPrefix = "/china-debt-dynamics-";
    var legacySuffix = ".html";
    var overrides = {};
    overrides[legacyPrefix + "v8i5" + legacySuffix] = "/insights/china-debt-dynamics/v8i6/";
    overrides[legacyPrefix + "v8i3" + legacySuffix] = "/insights/china-debt-dynamics/v8i5/";
    overrides[legacyPrefix + "v8i1" + legacySuffix] = "/insights/china-debt-dynamics/v8i3/";
    if (overrides[pathname]) return overrides[pathname];

    var match = pathname.match(/^\/china-debt-dynamics-(v\d+i\d+)\.html$/i);
    return match ? "/insights/china-debt-dynamics/" + match[1].toLowerCase() + "/" : null;
  }

  function redirectLegacyInsightPage() {
    var target = legacyInsightTarget();
    if (!target) return false;

    try {
      var current = new URL(window.location.href);
      if (current.searchParams.has("t")) return false;
    } catch (_) {}

    if (document.head) {
      var robots = document.head.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement("meta");
        robots.setAttribute("name", "robots");
        document.head.appendChild(robots);
      }
      robots.setAttribute("content", "noindex, follow");

      var canonical = document.head.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", "https://shorevest.com" + target);
    }

    window.location.replace(target + (window.location.search || "") + (window.location.hash || ""));
    return true;
  }

  removeEmptyLegacyToken();
  if (redirectLegacyInsightPage()) return;
  ensureAnalyticsIntentTracking();

  // Resolve the site base from this script's own URL so shared assets work
  // whether the site is served from the domain root or a GitHub Pages subpath.
  var script = document.currentScript;
  var base = "";
  if (script && script.src) {
    base = script.src.replace(/assets\/js\/favicon-guard\.js.*$/, "");
  }

  // Use only dated favicon filenames so browsers cannot reuse retired tab art.
  var iconVersion = "?v=" + VERSION;
  var ICONS = [
    { rel: "icon", href: base + "assets/favicon-shorevest-20260724.svg" + iconVersion, type: "image/svg+xml", sizes: "any" },
    { rel: "icon", href: base + "assets/favicon-shorevest-20260724.ico" + iconVersion, sizes: "any" },
    { rel: "shortcut icon", href: base + "assets/favicon-shorevest-20260724.ico" + iconVersion },
    { rel: "icon", href: base + "assets/favicon-shorevest-20260724-32x32.png" + iconVersion, type: "image/png", sizes: "32x32" },
    { rel: "icon", href: base + "assets/favicon-shorevest-20260724-16x16.png" + iconVersion, type: "image/png", sizes: "16x16" },
    { rel: "apple-touch-icon", href: base + "assets/apple-touch-icon-shorevest-20260724.png" + iconVersion, sizes: "180x180" },
    { rel: "manifest", href: base + "site-20260724.webmanifest" + iconVersion }
  ];

  function setAttr(el, key, value) {
    if (value) el.setAttribute(key, value);
  }

  function isChinesePage() {
    var language = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    return language.indexOf("zh") === 0 || /(?:^|\/)cn(?:\/|$)|_cn(?:\.html)?(?:$|[?#])/.test(location.pathname);
  }

  function ensureFavicons() {
    if (!document.head) return;

    // Keep one consistent icon set after navigation or browser page restoration.
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
    if (!document.head || !isChinesePage() || document.querySelector('script[data-sv-cn-copy="true"]')) return;

    var copyScript = document.createElement("script");
    copyScript.src = base + "assets/js/chinese-copy-overrides.js?v=" + VERSION;
    copyScript.defer = true;
    copyScript.setAttribute("data-sv-cn-copy", "true");
    document.head.appendChild(copyScript);
  }

  function ensureChineseFontUniformity() {
    if (!document.head || !isChinesePage()) return;

    document.documentElement.classList.add("sv-cn-font-unified");
    if (document.querySelector('link[data-sv-cn-font="true"]')) return;

    var fontStylesheet = document.createElement("link");
    fontStylesheet.rel = "stylesheet";
    fontStylesheet.href = base + "assets/css/chinese-font-uniform.css?v=" + VERSION;
    fontStylesheet.setAttribute("data-sv-cn-font", "true");
    document.head.appendChild(fontStylesheet);
  }

  function ensureSiteCopyNormalizer() {
    if (!document.head || document.querySelector('script[data-sv-copy-normalizer="true"]')) return;

    var copyNormalizer = document.createElement("script");
    copyNormalizer.src = base + "assets/js/site-copy-normalizer.js?v=" + VERSION;
    copyNormalizer.async = false;
    copyNormalizer.setAttribute("data-sv-copy-normalizer", "true");
    document.head.appendChild(copyNormalizer);
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

  function ensureInvestorPortalEmailLogin() {
    var form = document.getElementById("vdr-login-form");
    if (!form) return;

    var emailField = form.querySelector('input[name="email"]');
    if (!emailField) return;

    var formGroup = emailField.closest(".form-group");
    if (formGroup) {
      formGroup.hidden = false;
      formGroup.removeAttribute("hidden");
      formGroup.removeAttribute("aria-hidden");
    }

    emailField.disabled = false;
    emailField.required = true;
    emailField.type = "email";
    emailField.autocomplete = "email";

    var isChinese = isChinesePage();
    var title = document.querySelector(".ip-signin__title");
    var note = document.querySelector(".ip-signin__note");
    if (title) title.textContent = isChinese ? "输入电子邮箱以打开数据室。" : "Enter your email to open the data room.";
    if (note) note.textContent = isChinese
      ? "已获授权的投资者将直接进入 ShoreVest iDeals 数据室。"
      : "Authorized investors are sent directly into the ShoreVest iDeals data room.";

    if (form.getAttribute("data-sv-email-login-ready") === "true") return;
    form.setAttribute("data-sv-email-login-ready", "true");

    var error = formGroup ? formGroup.querySelector(".error") : null;
    function clearError() {
      if (formGroup) formGroup.classList.remove("has-error");
      if (error) error.textContent = "";
      emailField.setCustomValidity("");
    }

    emailField.addEventListener("input", clearError);
    emailField.addEventListener("change", clearError);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();

      var email = emailField.value.trim();
      var valid = email !== "" && emailField.checkValidity();
      if (!valid) {
        if (formGroup) formGroup.classList.add("has-error");
        if (error) {
          error.textContent = email === ""
            ? (isChinese ? "请填写后继续" : "Fill in to continue")
            : (isChinese ? "请输入有效的电子邮件" : "Enter a valid email");
        }
        emailField.focus();
        return;
      }

      trackAnalyticsEvent("investor_portal_access", {
        portal_provider: "ideals",
        site_language: isChinese ? "zh" : "en"
      });
      window.location.href = "https://app.idealsvdr.com/projects/all/documents?email=" + encodeURIComponent(email);
    }, true);
  }

  function runDomReadyTasks() {
    initializeAnalyticsConsent();
    ensureCookieSettingsControl();
    ensureFavicons();
    ensureChineseCopyOverrides();
    ensureChineseFontUniformity();
    ensureSiteCopyNormalizer();
    ensureWebsiteSearchSignals();
    ensureInvestorPortalEmailLogin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runDomReadyTasks);
  } else {
    runDomReadyTasks();
  }

  window.addEventListener("pageshow", function () {
    initializeAnalyticsConsent();
    ensureCookieSettingsControl();
    ensureFavicons();
    ensureChineseCopyOverrides();
    ensureChineseFontUniformity();
    ensureSiteCopyNormalizer();
    ensureWebsiteSearchSignals();
    ensureInvestorPortalEmailLogin();
  });
  document.addEventListener("visibilitychange", ensureFavicons);
})();