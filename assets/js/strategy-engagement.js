(function () {
  'use strict';

  var CONSENT_KEY = 'sv_analytics_consent_v1';
  var CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000;

  function analyticsAllowed() {
    try {
      var raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      var stored = JSON.parse(raw);
      if (!stored || stored.choice !== 'accepted') return false;
      if (!stored.savedAt || Date.now() - stored.savedAt > CONSENT_TTL_MS) return false;
      return typeof window.gtag === 'function';
    } catch (_) {
      return false;
    }
  }

  function siteLanguage() {
    var lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    return lang.indexOf('zh') === 0 ? 'zh' : 'en';
  }

  function track(target) {
    if (!analyticsAllowed()) return;
    window.gtag('event', 'strategy_next_step_click', {
      engagement_target: target,
      content_path: '/strategy/',
      site_language: siteLanguage(),
      transport_type: 'beacon'
    });
  }

  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest
      ? event.target.closest('[data-sv-strategy-cta]')
      : null;
    if (!link) return;
    track(link.getAttribute('data-sv-strategy-cta') || 'unknown');
  });
})();
