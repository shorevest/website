'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const tracker = fs.readFileSync(path.join(ROOT, 'assets/js/sv-analytics-events.js'), 'utf8');
const loader = fs.readFileSync(path.join(ROOT, 'assets/js/site-copy-normalizer.js'), 'utf8');
const v10i3 = fs.readFileSync(path.join(ROOT, 'insights/china-debt-dynamics/v10i3/index.html'), 'utf8');

const expectedEvents = [
  'qualified_visit',
  'contact_email_click',
  'contact_intent',
  'investor_portal_click',
  'investor_portal_login_attempt',
  'careers_apply_click',
  'careers_application_submit_attempt',
  'document_download',
  'research_pdf_click',
  'research_pdf_open',
  'outbound_link_click',
];

test('loads the business analytics tracker on public pages', () => {
  assert.match(loader, /assets\/js\/sv-analytics-events\.js/);
  assert.match(loader, /data-sv-business-analytics/);
  assert.match(loader, /sv-analytics-events\.js\?v=20260919-research-pdf-2/);
});

test('business analytics requires explicit analytics consent', () => {
  assert.match(tracker, /sv_analytics_consent_v1/);
  assert.match(tracker, /stored\.choice === "accepted"/);
});

test('tracks the agreed business event taxonomy', () => {
  for (const eventName of expectedEvents) {
    assert.match(tracker, new RegExp('"' + eventName + '"'));
  }
});

test('tracks China Debt Dynamics PDF clicks and successful PDF-route opens', () => {
  assert.match(tracker, /china-debt-dynamics\\\/print/);
  assert.match(tracker, /searchParams\.get\("pdf"\) !== "1"/);
  assert.match(tracker, /research_pdf_click/);
  assert.match(tracker, /research_pdf_open/);
  assert.match(tracker, /research_issue/);
});

test('does not send visitor-entered PII to GA4', () => {
  assert.doesNotMatch(tracker, /\.value\b/);
  assert.doesNotMatch(tracker, /full[_-]?name|first[_-]?name|last[_-]?name|phone_number|company_name/i);
  assert.doesNotMatch(tracker, /email_address|user_email|contact_email\s*:/i);
});

test('does not configure GA4 or emit duplicate page views', () => {
  assert.doesNotMatch(tracker, /gtag\(["']config["']/);
  assert.doesNotMatch(tracker, /page_view/);
});

test('qualified visit requires time plus a real interaction', () => {
  assert.match(tracker, /QUALIFIED_DELAY_MS = 15000/);
  assert.match(tracker, /interactionSeen/);
  assert.match(tracker, /visibleTimeReached/);
});

function runTracker({ url, consent = 'accepted', language = 'en', referrer = '', executeTwice = false }) {
  const listeners = new Map();
  const calls = [];
  const location = new URL(url);
  const document = {
    visibilityState: 'visible',
    referrer,
    documentElement: {
      getAttribute(name) {
        return name === 'lang' ? language : null;
      },
    },
    addEventListener(type, listener) {
      const registered = listeners.get(type) || [];
      registered.push(listener);
      listeners.set(type, registered);
    },
  };
  const window = {
    location,
    localStorage: {
      getItem(key) {
        if (key !== 'sv_analytics_consent_v1' || consent === null) return null;
        return JSON.stringify({ choice: consent, savedAt: Date.now() });
      },
    },
    gtag(...args) {
      calls.push(args);
    },
    setTimeout() {},
  };
  const context = { window, document, URL };

  vm.runInNewContext(tracker, context);
  if (executeTwice) vm.runInNewContext(tracker, context);

  return {
    calls,
    click(href) {
      const link = {
        getAttribute(name) {
          return name === 'href' ? href : null;
        },
      };
      const event = {
        target: {
          closest(selector) {
            return selector === 'a[href]' ? link : null;
          },
        },
      };
      for (const listener of listeners.get('click') || []) listener(event);
    },
  };
}

function events(calls, name) {
  return calls.filter((call) => call[0] === 'event' && call[1] === name);
}

test('tracks the actual v10i3 PDF button as research_pdf_click', () => {
  const pdfButton = v10i3.match(/<a[\s\S]*?href="([^"]*china-debt-dynamics\/print\/[^"]*pdf=1)"[\s\S]*?>\s*PDF\s*<\/a>/i);
  assert.ok(pdfButton, 'v10i3 must contain the public PDF anchor');

  const analytics = runTracker({
    url: 'https://shorevest.com/insights/china-debt-dynamics/v10i3/',
  });
  analytics.click(pdfButton[1].replace(/&amp;/g, '&'));

  const clickEvents = events(analytics.calls, 'research_pdf_click');
  assert.equal(clickEvents.length, 1);
  assert.deepEqual({ ...clickEvents[0][2] }, {
    site_language: 'en',
    page_path: '/insights/china-debt-dynamics/v10i3/',
    transport_type: 'beacon',
    research_series: 'china_debt_dynamics',
    research_issue: 'v10i3',
    content_path: '/insights/china-debt-dynamics/v10i3/',
    document_path: '/insights/china-debt-dynamics/print/',
  });
  assert.equal(events(analytics.calls, 'document_download').length, 0);
});

test('tracks a successful PDF route load once, including after repeated script execution', () => {
  const analytics = runTracker({
    url: 'https://shorevest.com/insights/china-debt-dynamics/print/?source=assets/data/china-debt-dynamics-v9i4.json&pdf=1',
    referrer: 'https://shorevest.com/insights/china-debt-dynamics/v9i4/',
    executeTwice: true,
  });

  const openEvents = events(analytics.calls, 'research_pdf_open');
  assert.equal(openEvents.length, 1);
  assert.deepEqual({ ...openEvents[0][2] }, {
    site_language: 'en',
    page_path: '/insights/china-debt-dynamics/print/',
    transport_type: 'beacon',
    research_series: 'china_debt_dynamics',
    research_issue: 'v9i4',
    content_path: '/insights/china-debt-dynamics/v9i4/',
    document_path: '/insights/china-debt-dynamics/print/',
  });
});

test('keeps genuine PDF links on document_download tracking', () => {
  const analytics = runTracker({ url: 'https://shorevest.com/insights/' });
  analytics.click('/assets/research/sample.pdf?download=1');

  const downloads = events(analytics.calls, 'document_download');
  assert.equal(downloads.length, 1);
  assert.deepEqual({ ...downloads[0][2] }, {
    site_language: 'en',
    page_path: '/insights/',
    transport_type: 'beacon',
    document_path: '/assets/research/sample.pdf',
  });
  assert.equal(events(analytics.calls, 'research_pdf_click').length, 0);
});

test('does not track research PDF clicks or opens without accepted consent', async (t) => {
  for (const consent of [null, 'rejected']) {
    await t.test(consent === null ? 'no saved choice' : 'rejected', () => {
      const openAnalytics = runTracker({
        url: 'https://shorevest.com/insights/china-debt-dynamics/print/?source=assets/data/china-debt-dynamics-v10i3.json&pdf=1',
        consent,
      });
      const clickAnalytics = runTracker({
        url: 'https://shorevest.com/insights/china-debt-dynamics/v10i3/',
        consent,
      });
      clickAnalytics.click('/insights/china-debt-dynamics/print/?source=assets/data/china-debt-dynamics-v10i3.json&pdf=1');

      assert.equal(events(openAnalytics.calls, 'research_pdf_open').length, 0);
      assert.equal(events(clickAnalytics.calls, 'research_pdf_click').length, 0);
    });
  }
});
