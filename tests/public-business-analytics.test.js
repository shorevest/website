'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const tracker = fs.readFileSync(path.join(ROOT, 'assets/js/sv-analytics-events.js'), 'utf8');
const loader = fs.readFileSync(path.join(ROOT, 'assets/js/site-copy-normalizer.js'), 'utf8');

const expectedEvents = [
  'qualified_visit',
  'contact_email_click',
  'contact_intent',
  'investor_portal_click',
  'investor_portal_login_attempt',
  'careers_apply_click',
  'careers_application_submit_attempt',
  'document_download',
  'outbound_link_click',
];

test('loads the business analytics tracker on public pages', () => {
  assert.match(loader, /assets\/js\/sv-analytics-events\.js/);
  assert.match(loader, /data-sv-business-analytics/);
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
