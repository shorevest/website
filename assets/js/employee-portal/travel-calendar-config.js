/* ShoreVest One - defaults for the optional personal Travel calendar link. */
(function (root) {
  'use strict';

  var env = root.SHOREVEST_PORTAL_ENV = root.SHOREVEST_PORTAL_ENV || { mode: 'demo' };
  env.entra = env.entra || {};
  env.entra.scopes = env.entra.scopes || ['User.Read'];
  if (env.entra.scopes.indexOf('Calendars.ReadBasic') === -1) {
    env.entra.scopes.push('Calendars.ReadBasic');
  }

  env.calendar = env.calendar || {};
  if (!env.calendar.travelCalendarName) env.calendar.travelCalendarName = 'Travel';
  if (!env.calendar.demoCurrentTrip) {
    env.calendar.demoCurrentTrip = {
      enabled: true,
      location: 'Dubai',
      startOffsetHours: -12,
      endOffsetHours: 72
    };
  }
})(typeof self !== 'undefined' ? self : this);
