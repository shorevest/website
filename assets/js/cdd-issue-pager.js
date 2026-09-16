/* China Debt Dynamics — issue pager.
   Injects a quiet prev/next-issue navigation + "All issues" link at the foot of
   each article (before the legal disclosures). Chronological, newest → oldest.
   Shared across every CDD article page; identifies the current issue from the
   canonical clean route so both clean URLs and legacy source pages work. */
(function () {
  // Newest first. file = public destination; label = public issue number; title = short title.
  var ISSUES = [
    { file: "/insights/china-debt-dynamics/v10i3/", label: "10.3", title: "Perceptions Versus Reality in China Real Estate" },
    { file: "/insights/china-debt-dynamics/v10i2/", label: "10.2", title: "The Paradox of High Private Credit Returns in China\u2019s Low-rate Environment" },
    { file: "/insights/china-debt-dynamics/v10i1/", label: "10.1", title: "The End of the \u201CChina Is Uninvestable\u201D Myth" },
    { file: "/insights/china-debt-dynamics/v9i4/", label: "9.4", title: "Beijing\u2019s Campaign Against Overcapacity Creates Private Credit Opportunities" },
    { file: "/insights/china-debt-dynamics/v9i3/", label: "9.3", title: "Into the Shadows of US Private Credit" },
    { file: "/insights/china-debt-dynamics/v9i2/", label: "9.2", title: "China: An Uncorrelated Harbor in a Stormy World" },
    { file: "/insights/china-debt-dynamics/v9i1/", label: "9.1", title: "Green Finance: Sowing the Seeds of China\u2019s Next Wave of NPLs" },
    { file: "/insights/china-debt-dynamics/v8i6/", label: "8.6", title: "United States of China" },
    { file: "/insights/china-debt-dynamics/v8i5/", label: "8.5", title: "Private Credit in a Reset World Order" },
    { file: "/insights/china-debt-dynamics/v8i4/", label: "8.4", title: "Quantifying China\u2019s NPL Market" },
    { file: "/insights/china-debt-dynamics/v8i3/", label: "8.3", title: "Bailing Out the Banks: The Hidden Significance of Beijing Property Support Measures" },
    { file: "/insights/china-debt-dynamics/v8i2/", label: "8.2", title: "China Refocuses on Financial Risk and Ramps Up NPL Disposals" },
    { file: "/insights/china-debt-dynamics/v7i4/", label: "7.4", title: "Beijing\u2019s Strategy for Dealing With Local Government Debt: No Bailouts, but a Helping Hand" },
    { file: "/insights/china-debt-dynamics/v7i3/", label: "7.3", title: "Where\u2019s the Stimulus? Parsing Beijing\u2019s Lackluster Response to Growth" },
    { file: "/insights/china-debt-dynamics/v7i2/", label: "7.2", title: "Bank Exposure to Developers: A Challenge but Not a Risk" },
    { file: "/insights/china-debt-dynamics/v7i1/", label: "7.1", title: "New Regulations Set to Accelerate NPL Disposals" },
    { file: "/insights/china-debt-dynamics/v6i3/", label: "6.3", title: "China\u2019s Property Support Measures: Rescue, not Reflation" },
    { file: "/insights/china-debt-dynamics/v5i7/", label: "5.7", title: "Evergrande: A Result of China Deleveraging and What Next" },
    { file: "/insights/china-debt-dynamics/v5i4/", label: "5.4", title: "Sustained Shadow Banking Contraction Creating Private Credit Opportunities" },
    { file: "/insights/china-debt-dynamics/v4i4/", label: "4.4", title: "Dealing With a Coming Surge in Nonperforming Loans" },
    { file: "/insights/china-debt-dynamics/v3i5/", label: "3.5", title: "A Look at the Tools Being Deployed to Help China\u2019s Banks Dispose of Their NPLs" },
    { file: "/insights/china-debt-dynamics/v2i4/", label: "2.4", title: "\u201CDisclose & Dispose\u201D: Stricter Accounting Requirements to Push Up NPLs Further" }
  ];

  var ANALYTICS_CONSENT_KEY = "sv_analytics_consent_v1";
  var ANALYTICS_CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

  function withToken(href) {
    var t = window.__SVT || "";
    if (!t) return href;
    return href + (href.indexOf("?") > -1 ? "&" : "?") + "t=" + t;
  }

  function cleanPath(value) {
    try {
      var url = new URL(value, document.baseURI);
      var pathname = (url.pathname || "/").replace(/\/{2,}/g, "/");
      if (pathname.length > 1 && pathname.charAt(pathname.length - 1) !== "/" && !/\.[^/]+$/.test(pathname)) {
        pathname += "/";
      }
      return pathname.toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function currentIssuePath() {
    var canonical = document.querySelector('link[rel="canonical"]');
    return cleanPath(canonical && canonical.href ? canonical.href : window.location.href);
  }

  function analyticsAllowed() {
    try {
      var raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      if (!raw) return false;
      var stored = JSON.parse(raw);
      if (!stored || stored.choice !== "accepted") return false;
      if (!stored.savedAt || Date.now() - stored.savedAt > ANALYTICS_CONSENT_TTL_MS) return false;
      return typeof window.gtag === "function";
    } catch (_) {
      return false;
    }
  }

  function trackEvent(name, parameters) {
    if (!analyticsAllowed()) return false;
    var payload = parameters || {};
    payload.transport_type = "beacon";
    window.gtag("event", name, payload);
    return true;
  }

  function siteLanguage() {
    var lang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    return lang.indexOf("zh") === 0 ? "zh" : "en";
  }

  function trackIssueNavigation(direction, targetPath) {
    trackEvent("research_issue_navigation", {
      direction: direction,
      content_path: currentIssuePath(),
      target_path: cleanPath(targetPath),
      site_language: siteLanguage()
    });
  }

  function installReadingQualityTracking() {
    if (!document.body || !document.body.classList.contains("cdd-article-page")) return;
    if (document.body.getAttribute("data-cdd-reading-quality-ready") === "true") return;
    document.body.setAttribute("data-cdd-reading-quality-ready", "true");

    var sent50 = false;
    var sent90 = false;
    var engagedSent = false;
    var visibleStartedAt = document.visibilityState === "visible" ? Date.now() : null;
    var visibleMs = 0;
    var timer = null;
    var scrollQueued = false;

    function basePayload() {
      return {
        content_path: currentIssuePath(),
        site_language: siteLanguage()
      };
    }

    function activeWindow() {
      if (document.visibilityState !== "visible") return false;
      if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
      return true;
    }

    function flushVisibleTime() {
      if (visibleStartedAt !== null) {
        visibleMs += Math.max(0, Date.now() - visibleStartedAt);
        visibleStartedAt = null;
      }
    }

    function syncVisibleClock() {
      if (activeWindow()) {
        if (visibleStartedAt === null) visibleStartedAt = Date.now();
      } else {
        flushVisibleTime();
      }
    }

    function currentVisibleMs() {
      return visibleMs + (visibleStartedAt !== null ? Math.max(0, Date.now() - visibleStartedAt) : 0);
    }

    function maybeTrackEngagedRead() {
      syncVisibleClock();
      if (engagedSent || currentVisibleMs() < 30000) return;
      var payload = basePayload();
      payload.engaged_seconds = 30;
      if (trackEvent("research_engaged_read", payload)) {
        engagedSent = true;
        if (timer) window.clearInterval(timer);
      }
    }

    function maybeTrackDepth() {
      scrollQueued = false;
      var doc = document.documentElement;
      var total = Math.max(doc.scrollHeight || 0, document.body ? document.body.scrollHeight || 0 : 0, 1);
      var bottom = Math.max(0, window.pageYOffset || doc.scrollTop || 0) + Math.max(window.innerHeight || 0, doc.clientHeight || 0);
      var percent = Math.min(100, Math.max(0, Math.round((bottom / total) * 100)));

      if (!sent50 && percent >= 50) {
        var p50 = basePayload();
        p50.percent_scrolled = 50;
        if (trackEvent("research_read_depth", p50)) sent50 = true;
      }
      if (!sent90 && percent >= 90) {
        var p90 = basePayload();
        p90.percent_scrolled = 90;
        if (trackEvent("research_read_depth", p90)) sent90 = true;
      }
    }

    function onScroll() {
      if (scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(maybeTrackDepth);
    }

    document.addEventListener("visibilitychange", syncVisibleClock);
    window.addEventListener("focus", syncVisibleClock);
    window.addEventListener("blur", syncVisibleClock);
    window.addEventListener("scroll", onScroll, { passive: true });
    timer = window.setInterval(maybeTrackEngagedRead, 1000);
  }

  function loadCitationEnhancer() {
    if (document.querySelector('script[data-cdd-citations]')) return;
    var script = document.createElement('script');
    script.src = withToken('/assets/js/cdd-citations.js?v=20260911-references-5');
    script.async = false;
    script.setAttribute('data-cdd-citations', 'true');
    document.head.appendChild(script);
  }

  function build() {
    var disc = document.querySelector(".cdd-disclaimer");
    if (!disc || document.querySelector(".cdd-pager")) return;
    var current = currentIssuePath();
    var idx = ISSUES.findIndex(function (it) { return cleanPath(it.file) === current; });
    if (idx === -1) return;
    var newer = idx > 0 ? ISSUES[idx - 1] : null;
    var older = idx < ISSUES.length - 1 ? ISSUES[idx + 1] : null;

    var nav = document.createElement("nav");
    nav.className = "cdd-pager";
    nav.setAttribute("aria-label", "Issue navigation");

    nav.appendChild(side("prev", older, "Older issue"));
    var home = document.createElement("a");
    home.className = "cdd-pager__home";
    home.href = withToken("/insights/#archive");
    home.textContent = "All issues";
    home.addEventListener("click", function () {
      trackIssueNavigation("all_issues", "/insights/#archive");
    });
    nav.appendChild(home);
    nav.appendChild(side("next", newer, "Newer issue"));

    disc.parentNode.insertBefore(nav, disc);
  }

  function side(kind, issue, dirLabel) {
    if (!issue) {
      var span = document.createElement("span");
      span.className = "cdd-pager__side cdd-pager__side--empty cdd-pager__" + kind;
      return span;
    }
    var a = document.createElement("a");
    a.className = "cdd-pager__side cdd-pager__" + kind;
    a.href = withToken(issue.file);
    a.addEventListener("click", function () {
      trackIssueNavigation(kind === "prev" ? "older" : "newer", issue.file);
    });
    var dir = document.createElement("span");
    dir.className = "cdd-pager__dir";
    dir.textContent = (kind === "prev" ? "\u2190 " : "") + dirLabel + ", " + issue.label + (kind === "next" ? " \u2192" : "");
    var t = document.createElement("span");
    t.className = "cdd-pager__title";
    t.textContent = issue.title;
    a.appendChild(dir);
    a.appendChild(t);
    return a;
  }

  function initialize() {
    installReadingQualityTracking();
    build();
  }

  loadCitationEnhancer();
  if (document.readyState !== "loading") initialize();
  else document.addEventListener("DOMContentLoaded", initialize);
  window.addEventListener("load", function () { setTimeout(initialize, 300); });
})();
