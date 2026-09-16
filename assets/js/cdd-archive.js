/* China Debt Dynamics Archive — filter chips, row navigation, keyboard a11y */
(function () {
  const root = document.querySelector('[data-cdd-arc]');
  if (!root) return;

  const rows = Array.from(root.querySelectorAll('.cdd-arc__row'));
  const chips = Array.from(root.querySelectorAll('.cdd-arc__chip'));
  const yearMarkers = Array.from(root.querySelectorAll('.cdd-arc__year'));
  const counter = root.querySelector('[data-cdd-arc-count]');
  const search = root.querySelector('[data-cdd-arc-search]');
  const empty = root.querySelector('[data-cdd-arc-empty]');
  const reset = root.querySelector('[data-cdd-arc-reset]');
  const ANALYTICS_CONSENT_KEY = 'sv_analytics_consent_v1';

  function analyticsEnabled() {
    try {
      const raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      if (!raw) return false;
      const stored = JSON.parse(raw);
      return Boolean(stored && stored.choice === 'accepted');
    } catch (_) {
      return false;
    }
  }

  function trackAnalyticsEvent(name, parameters) {
    if (!analyticsEnabled() || typeof window.gtag !== 'function') return;
    window.gtag('event', name, Object.assign({ transport_type: 'beacon' }, parameters || {}));
  }

  function trackedPath(href) {
    try {
      return new URL(href, window.location.href).pathname;
    } catch (_) {
      return String(href || '').split('?')[0].split('#')[0];
    }
  }

  function rowAnalytics(row, href, interaction) {
    return {
      content_path: trackedPath(href),
      archive_topic: row ? (row.getAttribute('data-topic') || 'unknown') : 'unknown',
      interaction: interaction,
      site_language: (document.documentElement.lang || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
    };
  }

  /* Fragment-only links resolve against <base href="/"> on clean routes.
     Keep the subscription CTA on the current Insights page instead. */
  const subscriptionTarget = document.getElementById('subscribe');
  const subscriptionLinks = Array.from(document.querySelectorAll('a[href="#subscribe"]'));
  const currentPath = window.location.pathname.replace(/\/index\.html$/i, '/');

  subscriptionLinks.forEach((link) => {
    const destination = currentPath + '#subscribe';
    link.setAttribute('href', destination);

    link.addEventListener('click', (event) => {
      if (!subscriptionTarget) return;

      trackAnalyticsEvent('research_subscribe_cta', {
        source_page: currentPath,
        site_language: (document.documentElement.lang || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
      });

      event.preventDefault();
      subscriptionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });

      if (window.location.hash !== '#subscribe') {
        try {
          window.history.pushState(null, '', destination);
        } catch (_) {
          window.location.hash = 'subscribe';
        }
      }
    });
  });

  /* GitHub Pages has no subscription backend. Open a complete, reviewable
     subscription request rather than submitting to a nonexistent page anchor. */
  const subscriptionForm = document.querySelector('.research-sub__form');
  if (subscriptionForm) {
    const recipient = 'inquiries@shorevest.com';
    subscriptionForm.setAttribute('action', 'mailto:' + recipient);
    subscriptionForm.setAttribute('method', 'post');
    subscriptionForm.setAttribute('enctype', 'text/plain');

    subscriptionForm.addEventListener('submit', (event) => {
      event.preventDefault();

      if (typeof subscriptionForm.reportValidity === 'function' && !subscriptionForm.reportValidity()) {
        return;
      }

      const nameField = subscriptionForm.querySelector('[name="name"]');
      const emailField = subscriptionForm.querySelector('[name="email"]');
      const name = nameField ? nameField.value.trim() : '';
      const email = emailField ? emailField.value.trim() : '';
      const isChinese = (document.documentElement.lang || '').toLowerCase().indexOf('zh') === 0;
      const subject = isChinese
        ? '订阅新岸资本《中国债务动态》'
        : 'Subscribe to ShoreVest China Debt Dynamics';
      const body = isChinese
        ? ['您好，', '', '请将我加入《中国债务动态》更新名单。', '', '姓名：' + name, '电邮：' + email].join('\n')
        : ['Hello,', '', 'Please add me to the China Debt Dynamics update list.', '', 'Name: ' + name, 'Email: ' + email].join('\n');

      /* Deliberately do not send name/email to GA4. This event records only
         that a valid subscription attempt happened. */
      trackAnalyticsEvent('research_subscribe_intent', {
        source_page: currentPath,
        site_language: isChinese ? 'zh' : 'en'
      });

      window.location.href = 'mailto:' + recipient +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
    });
  }

  // Track explicit Read/PDF links without collecting any visitor-entered text.
  root.addEventListener('click', (event) => {
    const link = event.target && event.target.closest ? event.target.closest('a') : null;
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const row = link.closest('.cdd-arc__row');
    if (link.classList.contains('cdd-arc__pdf') || /\.pdf(?:$|[?#])/i.test(href)) {
      trackAnalyticsEvent('research_pdf_download', rowAnalytics(row, href, 'link'));
      return;
    }

    if (link.classList.contains('cdd-arc__read') || /china-debt-dynamics/i.test(href)) {
      trackAnalyticsEvent('research_article_open', rowAnalytics(row, href, 'link'));
    }
  });

  // Cache each row's searchable text once (title + excerpt + category).
  rows.forEach((row) => {
    row.dataset.cddArcText = (row.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
  });

  let activeTopic = 'all';
  let activeQuery = '';

  /* --- Whole-row navigation + keyboard (Enter opens article) --- */
  rows.forEach((row) => {
    const href = row.getAttribute('data-href');
    if (!href) return;

    row.addEventListener('click', (event) => {
      // Let real links (Read / PDF) behave normally.
      if (event.target.closest('a')) return;
      trackAnalyticsEvent('research_article_open', rowAnalytics(row, href, 'row'));
      window.open(href, '_blank', 'noopener');
    });

    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        trackAnalyticsEvent('research_article_open', rowAnalytics(row, href, 'keyboard'));
        window.open(href, '_blank', 'noopener');
      }
    });
  });

  /* --- Combined topic + search filter --- */
  const applyFilter = () => {
    let visible = 0;

    rows.forEach((row) => {
      const topicMatch = activeTopic === 'all' || row.getAttribute('data-topic') === activeTopic;
      const textMatch = !activeQuery || (row.dataset.cddArcText || '').indexOf(activeQuery) !== -1;
      const match = topicMatch && textMatch;
      row.hidden = !match;
      // Request-only placeholders (no readable article) are shown under "All"
      // but never counted as readable articles.
      if (match && !row.hasAttribute('data-cdd-arc-exclude')) visible += 1;
    });

    // Hide a year marker when none of its rows are visible.
    yearMarkers.forEach((marker) => {
      let next = marker.nextElementSibling;
      let hasVisible = false;
      while (next && !next.classList.contains('cdd-arc__year')) {
        if (next.classList.contains('cdd-arc__row') && !next.hidden) {
          hasVisible = true;
          break;
        }
        next = next.nextElementSibling;
      }
      marker.hidden = !hasVisible;
    });

    if (counter) {
      counter.textContent = String(visible);
    }
    if (empty) {
      empty.hidden = visible !== 0;
    }
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        c.classList.toggle('is-active', c === chip);
        c.setAttribute('aria-selected', c === chip ? 'true' : 'false');
      });
      activeTopic = chip.getAttribute('data-topic') || 'all';
      trackAnalyticsEvent('research_archive_filter', {
        archive_topic: activeTopic,
        site_language: (document.documentElement.lang || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
      });
      applyFilter();
    });
  });

  if (search) {
    search.addEventListener('input', () => {
      activeQuery = search.value.toLowerCase().trim();
      applyFilter();
    });
  }

  /* --- Clear-filters button in the empty state --- */
  if (reset) {
    reset.addEventListener('click', () => {
      activeQuery = '';
      activeTopic = 'all';
      if (search) search.value = '';
      chips.forEach((c) => {
        const isAll = c.getAttribute('data-topic') === 'all';
        c.classList.toggle('is-active', isAll);
        c.setAttribute('aria-selected', isAll ? 'true' : 'false');
      });
      applyFilter();
      if (search) search.focus();
    });
  }
})();
