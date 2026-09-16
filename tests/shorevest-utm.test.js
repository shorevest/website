'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { slug, buildUtmUrl } = require('../scripts/shorevest-utm.cjs');

test('normalizes UTM values to lowercase underscore slugs', () => {
  assert.equal(slug('Kelvin Follow-up #1'), 'kelvin_follow_up_1');
  assert.equal(slug('APAC Family Office Summit 2026'), 'apac_family_office_summit_2026');
});

test('builds the standard ShoreVest IR outreach URL', () => {
  assert.equal(
    buildUtmUrl({
      campaign: 'superreturn_asia_2026',
      content: 'kelvin_followup1',
      term: 'asia_insurers',
    }),
    'https://shorevest.com/?utm_source=email&utm_medium=ir_outreach&utm_campaign=superreturn_asia_2026&utm_content=kelvin_followup1&utm_term=asia_insurers'
  );
});

test('preserves required landing-page query parameters and fragments', () => {
  assert.equal(
    buildUtmUrl({
      base: 'https://www.shorevest.com/insights/?lang=en#latest',
      campaign: 'fund3_deals_update_aug26',
      content: 'ben_initial',
    }),
    'https://shorevest.com/insights/?lang=en&utm_source=email&utm_medium=ir_outreach&utm_campaign=fund3_deals_update_aug26&utm_content=ben_initial#latest'
  );
});

test('rejects non-ShoreVest destinations', () => {
  assert.throws(
    () => buildUtmUrl({ base: 'https://example.com/', campaign: 'test' }),
    /only accepts ShoreVest-owned/
  );
});

test('requires a campaign identifier', () => {
  assert.throws(() => buildUtmUrl({}), /utm_campaign is required/);
});
