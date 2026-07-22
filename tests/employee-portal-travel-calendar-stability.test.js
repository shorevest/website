/* ShoreVest One — synthetic Travel calendar stability tests */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(rootDir, 'assets/js/employee-portal/travel-calendar-demo-stability.js'), 'utf8');
const index = fs.readFileSync(path.join(rootDir, 'employee-portal/index.html'), 'utf8');

async function main() {
  let calls = 0;
  const demoRoot = {
    SHOREVEST_PORTAL_ENV: { mode: 'demo' },
    SVPortalTravelCalendar: {
      getCurrentLocation() {
        calls += 1;
        return Promise.resolve({
          connected: true,
          active: true,
          demo: true,
          locationText: 'New York',
          endsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
        });
      },
      clearCache() {}
    }
  };
  vm.runInNewContext(source, { self: demoRoot, Promise }, { filename: 'travel-calendar-demo-stability.js' });

  const first = await demoRoot.SVPortalTravelCalendar.getCurrentLocation();
  const second = await demoRoot.SVPortalTravelCalendar.getCurrentLocation();
  assert.strictEqual(calls, 1, 'the synthetic calendar should be read once per session');
  assert.strictEqual(first, second, 'subsequent Home renders should receive the same result object');
  assert.strictEqual(first.endsAt, second.endsAt, 'the synthetic trip signature must remain stable');

  await demoRoot.SVPortalTravelCalendar.getCurrentLocation({ force: true });
  assert.strictEqual(calls, 2, 'an explicit force refresh may replace the cached synthetic result');

  const productionGet = () => Promise.resolve({ connected: false });
  const productionRoot = {
    SHOREVEST_PORTAL_ENV: { mode: 'production' },
    SVPortalTravelCalendar: { getCurrentLocation: productionGet }
  };
  vm.runInNewContext(source, { self: productionRoot, Promise }, { filename: 'travel-calendar-demo-stability.js' });
  assert.strictEqual(productionRoot.SVPortalTravelCalendar.getCurrentLocation, productionGet,
    'the production calendar adapter must remain untouched');

  const adapterAt = index.indexOf('employee-portal/travel-calendar.js');
  const stabilityAt = index.indexOf('employee-portal/travel-calendar-demo-stability.js');
  const homeAt = index.indexOf('employee-portal/views-home.js');
  assert.ok(adapterAt !== -1 && stabilityAt > adapterAt, 'stability layer must load after the calendar adapter');
  assert.ok(homeAt !== -1 && stabilityAt < homeAt, 'stability layer must load before Home views');
  assert.ok(index.includes('data-portal-build="20260723c"'), 'portal build key should force fresh files');

  ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon', 'localStorage.setItem'].forEach((token) => {
    assert.ok(!source.includes(token), 'stability layer contains prohibited action: ' + token);
  });

  console.log('✓ ShoreVest One synthetic Travel calendar remains stable across Home renders.');
}

main().catch((error) => {
  console.error('✗ Travel calendar stability test failed.');
  console.error(error.stack || error.message);
  process.exit(1);
});
