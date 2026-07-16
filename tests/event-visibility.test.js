const assert = require('assert');
const visibility = require('../assets/js/event-visibility.js');

function eventFixture(overrides) {
  return Object.assign({
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    timeZone: 'UTC'
  }, overrides);
}

function atLocalNoon(isoDate, offset) {
  return new Date(`${isoDate}T12:00:00${offset}`);
}

const pdi = eventFixture({ startDate: '2026-06-24', endDate: '2026-06-25', timeZone: 'Asia/Singapore' });
assert.strictEqual(visibility.getEventStatus(pdi, atLocalNoon('2026-07-25', '+08:00')), visibility.STATUS.CONCLUDED);
assert.strictEqual(visibility.isVisibleEvent(pdi, atLocalNoon('2026-07-25', '+08:00')), true);
assert.strictEqual(visibility.getEventStatus(pdi, atLocalNoon('2026-07-26', '+08:00')), visibility.STATUS.HIDDEN);

const superReturn = eventFixture({ startDate: '2026-06-15', endDate: '2026-06-17', timeZone: 'Europe/Amsterdam' });
assert.strictEqual(visibility.getEventStatus(superReturn, atLocalNoon('2026-07-17', '+02:00')), visibility.STATUS.CONCLUDED);
assert.strictEqual(visibility.isVisibleEvent(superReturn, atLocalNoon('2026-07-17', '+02:00')), true);
assert.strictEqual(visibility.getEventStatus(superReturn, atLocalNoon('2026-07-18', '+02:00')), visibility.STATUS.HIDDEN);

const bloomberg = eventFixture({ startDate: '2026-06-10', endDate: '2026-06-10', timeZone: 'Asia/Hong_Kong' });
assert.strictEqual(visibility.getEventStatus(bloomberg, atLocalNoon('2026-07-10', '+08:00')), visibility.STATUS.CONCLUDED);
assert.strictEqual(visibility.isVisibleEvent(bloomberg, atLocalNoon('2026-07-10', '+08:00')), true);
assert.strictEqual(visibility.getEventStatus(bloomberg, atLocalNoon('2026-07-11', '+08:00')), visibility.STATUS.HIDDEN);

const agm = eventFixture({ startDate: '2026-09-18', endDate: '2026-09-18', timeZone: 'Asia/Hong_Kong' });
assert.strictEqual(visibility.getEventStatus(agm, atLocalNoon('2026-09-17', '+08:00')), visibility.STATUS.UPCOMING);
assert.strictEqual(visibility.getEventStatus(agm, atLocalNoon('2026-09-18', '+08:00')), visibility.STATUS.IN_PROGRESS);
assert.strictEqual(visibility.getEventStatus(agm, atLocalNoon('2026-09-19', '+08:00')), visibility.STATUS.CONCLUDED);

assert.strictEqual(visibility.getEventStatus(agm, atLocalNoon('2026-10-18', '+08:00')), visibility.STATUS.CONCLUDED);
assert.strictEqual(visibility.isVisibleEvent(agm, atLocalNoon('2026-10-18', '+08:00')), true);
assert.strictEqual(visibility.getEventStatus(agm, atLocalNoon('2026-10-19', '+08:00')), visibility.STATUS.HIDDEN);

const sameTimestamp = new Date('2026-09-17T22:30:00Z');
assert.strictEqual(visibility.getLocalDateParts(sameTimestamp, 'Asia/Hong_Kong').iso, '2026-09-18');
assert.strictEqual(visibility.getLocalDateParts(sameTimestamp, 'Europe/Amsterdam').iso, '2026-09-18');
const splitTimestamp = new Date('2026-09-17T16:30:00Z');
assert.strictEqual(visibility.getLocalDateParts(splitTimestamp, 'Asia/Hong_Kong').iso, '2026-09-18');
assert.strictEqual(visibility.getLocalDateParts(splitTimestamp, 'Europe/Amsterdam').iso, '2026-09-17');
assert.strictEqual(visibility.getEventStatus(agm, splitTimestamp), visibility.STATUS.IN_PROGRESS);
assert.strictEqual(visibility.getEventStatus(superReturn, splitTimestamp), visibility.STATUS.HIDDEN);

console.log('event visibility tests passed');
