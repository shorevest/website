(function () {
  "use strict";

  var CONSENT_KEY = "sv_analytics_consent_v1";
  var QUALIFIED_DELAY_MS = 15000;
  var qualifiedSent = false;
  var interactionSeen = false;
  var visibleTimeReached = false;

  function isPublicPage() {
    var host = (window.location.hostname || "").toLowerCase();
    var path = window.location.pathname || "/";
    if (host !== "shorevest.com" && host !== "www.shorevest.com") return false;
    if (/^\/(?:employee-portal|shorevest-one|api)(?:\/|$)/i.test(path)) return false;
    try { return !(new URL(window.location.href)).searchParams.has("t"); } catch (_) { return true; }
  }

  function analyticsEnabled() {
    try {
      var raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      var stored = JSON.parse(raw);
      return Boolean(stored && stored.choice === "accepted");
    } catch (_) {
      return false;
    }
  }

  function language() {
    return (document.documentElement.getAttribute("lang") || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }

  function cleanPath(value) {
    try { return new URL(value, window.location.href).pathname; }
    catch (_) { return String(value || "").split("?")[0].split("#")[0]; }
  }

  function track(name, parameters) {
    if (!isPublicPage() || !analyticsEnabled() || typeof window.gtag !== "function") return;
    var payload = Object.assign({
      site_language: language(),
      page_path: window.location.pathname || "/",
      transport_type: "beacon"
    }, parameters || {});
    window.gtag("event", name, payload);
  }

  function cddPdfContext(url) {
    if (!url || url.origin !== window.location.origin) return null;
    if (!/^\/insights\/china-debt-dynamics\/print\/?$/i.test(url.pathname)) return null;
    if (url.searchParams.get("pdf") !== "1") return null;

    var source = url.searchParams.get("source") || "";
    var issueMatch = source.match(/china-debt-dynamics-(v\d+i\d+)\.json$/i);

    return {
      research_series: "china_debt_dynamics",
      research_issue: issueMatch ? issueMatch[1].toLowerCase() : "unknown",
      document_path: url.pathname
    };
  }

  function trackCurrentCddPdfOpen() {
    var context;
    try { context = cddPdfContext(new URL(window.location.href)); }
    catch (_) { return; }
    if (!context) return;
    track("research_pdf_open", context);
  }

  function maybeQualifiedVisit() {
    if (qualifiedSent || !interactionSeen || !visibleTimeReached || document.visibilityState !== "visible") return;
    qualifiedSent = true;
    track("qualified_visit", { qualification_seconds: 15 });
  }

  function noteInteraction() {
    interactionSeen = true;
    maybeQualifiedVisit();
  }

  ["pointerdown", "keydown", "touchstart", "wheel"].forEach(function (type) {
    document.addEventListener(type, noteInteraction, { once: true, passive: type !== "keydown" });
  });

  window.setTimeout(function () {
    visibleTimeReached = true;
    maybeQualifiedVisit();
  }, QUALIFIED_DELAY_MS);

  document.addEventListener("visibilitychange", maybeQualifiedVisit);
  trackCurrentCddPdfOpen();

  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;
    var href = link.getAttribute("href") || "";

    if (/^mailto:/i.test(href)) {
      var mailbox = href.replace(/^mailto:/i, "").split("?")[0].toLowerCase();
      var channel = mailbox === "inquiries@shorevest.com" ? "inquiries" : mailbox === "media@shorevest.com" ? "media" : "other";
      track("contact_email_click", { contact_channel: channel });
      return;
    }

    var url;
    try { url = new URL(href, window.location.href); } catch (_) { return; }

    var cddPdf = cddPdfContext(url);
    if (cddPdf) {
      cddPdf.content_path = window.location.pathname || "/";
      track("research_pdf_click", cddPdf);
    }

    if (/\.pdf(?:$|[?#])/i.test(href)) {
      track("document_download", { document_path: cleanPath(url.href) });
    }

    if (url.origin === window.location.origin) {
      if (/^\/(?:cn\/)?investor-portal\/?$/i.test(url.pathname)) {
        track("investor_portal_click", { destination_path: url.pathname });
      }
      if (/^\/(?:cn\/)?careers\/apply(?:\/|\.html|$)/i.test(url.pathname) || link.getAttribute("data-analytics") === "careers_apply") {
        track("careers_apply_click", { destination_path: url.pathname });
      }
      return;
    }

    if (/^https?:$/i.test(url.protocol)) {
      track("outbound_link_click", { destination_host: url.hostname.toLowerCase() });
    }
  }, true);

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || form.nodeType !== 1) return;
    if (typeof form.checkValidity === "function" && !form.checkValidity()) return;

    if (form.id === "cp-form") {
      track("contact_intent");
      return;
    }

    if (form.id === "vdr-login-form") {
      track("investor_portal_login_attempt", { portal_provider: "ideals" });
      return;
    }

    if (form.matches && form.matches("[data-application-form], .careers-application__form")) {
      track("careers_application_submit_attempt");
    }
  }, true);
})();
