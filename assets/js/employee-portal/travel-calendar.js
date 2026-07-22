/* ShoreVest One - privacy-minimised Outlook travel-calendar adapter. */
(function (root) {
  'use strict';

  var I = root.SVPortalIntegrations;
  var ENV = root.SHOREVEST_PORTAL_ENV || { mode: 'demo' };
  if (!I || !I.EntraAuth) return;

  var GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
  var CACHE_MS = 10 * 60 * 1000;
  var memoryCache = null;

  function demoMode() { return ENV.mode !== 'production'; }

  function calendarConfig() {
    return ENV.calendar || {};
  }

  function configuredName() {
    return calendarConfig().travelCalendarName || 'Travel';
  }

  function demoResult() {
    var cfg = calendarConfig().demoCurrentTrip || {};
    if (cfg.enabled === false || !cfg.location) {
      return {
        connected: true,
        active: false,
        demo: true,
        calendarName: configuredName(),
        detail: 'Demo travel calendar connected; no current trip.'
      };
    }

    var now = Date.now();
    var startOffsetHours = Number(cfg.startOffsetHours == null ? -12 : cfg.startOffsetHours);
    var endOffsetHours = Number(cfg.endOffsetHours == null ? 72 : cfg.endOffsetHours);
    return {
      connected: true,
      active: true,
      demo: true,
      calendarName: configuredName(),
      locationText: String(cfg.location),
      startsAt: new Date(now + startOffsetHours * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now + endOffsetHours * 60 * 60 * 1000).toISOString(),
      detail: 'Synthetic Travel calendar event for the demonstration.'
    };
  }

  function acquireAccessToken() {
    var auth = I.EntraAuth;
    return auth.initialize().then(function () {
      var msalClient = auth._msal;
      var account = auth._account || (msalClient && msalClient.getActiveAccount());
      if (!msalClient || !account) throw new Error('Microsoft sign-in is required.');

      return msalClient.acquireTokenSilent({
        account: account,
        scopes: ['Calendars.ReadBasic']
      }).then(function (result) {
        if (!result || !result.accessToken) throw new Error('No Microsoft Graph access token was returned.');
        return result.accessToken;
      });
    });
  }

  function graphGet(path, token) {
    return root.fetch(GRAPH_ROOT + path, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
        Prefer: 'outlook.timezone="UTC"'
      }
    }).then(function (response) {
      if (!response.ok) {
        var error = new Error('Microsoft Graph returned HTTP ' + response.status + '.');
        error.status = response.status;
        throw error;
      }
      return response.json();
    });
  }

  function findTravelCalendar(calendars) {
    var target = configuredName().trim().toLowerCase();
    var rows = (calendars && calendars.value) || [];
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].name || '').trim().toLowerCase() === target) return rows[i];
    }
    return null;
  }

  function utcDate(value) {
    if (!value || !value.dateTime) return null;
    var raw = String(value.dateTime);
    if (!/[zZ]$|[+-]\d\d:\d\d$/.test(raw)) raw += 'Z';
    var date = new Date(raw);
    return isNaN(date.getTime()) ? null : date;
  }

  function eventLocation(event) {
    var primary = event && event.location;
    if (primary) {
      if (primary.address && primary.address.city) return String(primary.address.city);
      if (primary.displayName) return String(primary.displayName);
    }

    var locations = (event && event.locations) || [];
    for (var i = 0; i < locations.length; i++) {
      if (locations[i].address && locations[i].address.city) return String(locations[i].address.city);
      if (locations[i].displayName) return String(locations[i].displayName);
    }
    return '';
  }

  function currentEvent(events) {
    var now = Date.now();
    var rows = (events && events.value) || [];
    var active = [];

    rows.forEach(function (event) {
      var start = utcDate(event.start);
      var end = utcDate(event.end);
      var locationText = eventLocation(event);
      if (!start || !end || !locationText) return;
      if (start.getTime() <= now && now < end.getTime()) {
        active.push({ event: event, start: start, end: end, locationText: locationText });
      }
    });

    active.sort(function (a, b) { return b.start.getTime() - a.start.getTime(); });
    return active[0] || null;
  }

  function loadFromGraph() {
    return acquireAccessToken().then(function (token) {
      return graphGet('/me/calendars?$select=id,name&$top=100', token).then(function (calendars) {
        var travel = findTravelCalendar(calendars);
        if (!travel) {
          return {
            connected: true,
            active: false,
            calendarName: configuredName(),
            detail: 'No calendar named "' + configuredName() + '" was found.'
          };
        }

        var now = Date.now();
        var start = new Date(now - 36 * 60 * 60 * 1000).toISOString();
        var end = new Date(now + 36 * 60 * 60 * 1000).toISOString();
        var path = '/me/calendars/' + encodeURIComponent(travel.id) + '/calendarView' +
          '?startDateTime=' + encodeURIComponent(start) +
          '&endDateTime=' + encodeURIComponent(end) +
          '&$select=start,end,location,locations,isAllDay,sensitivity' +
          '&$orderby=start/dateTime';

        return graphGet(path, token).then(function (events) {
          var active = currentEvent(events);
          if (!active) {
            return {
              connected: true,
              active: false,
              calendarName: configuredName(),
              detail: 'Travel calendar connected; no active trip.'
            };
          }

          return {
            connected: true,
            active: true,
            calendarName: configuredName(),
            locationText: active.locationText,
            startsAt: active.start.toISOString(),
            endsAt: active.end.toISOString(),
            detail: 'Location read from the signed-in user’s dedicated Travel calendar.'
          };
        });
      });
    });
  }

  function getCurrentLocation(options) {
    options = options || {};
    if (demoMode()) return Promise.resolve(demoResult());

    if (!options.force && memoryCache && Date.now() - memoryCache.checkedAt < CACHE_MS) {
      return Promise.resolve(memoryCache.result);
    }

    return loadFromGraph().then(function (result) {
      memoryCache = { checkedAt: Date.now(), result: result };
      return result;
    }).catch(function (error) {
      var result = {
        connected: false,
        active: false,
        calendarName: configuredName(),
        detail: error && error.message ? error.message : 'Travel calendar unavailable.'
      };
      memoryCache = { checkedAt: Date.now(), result: result };
      return result;
    });
  }

  root.SVPortalTravelCalendar = {
    getCurrentLocation: getCurrentLocation,
    clearCache: function () { memoryCache = null; }
  };
})(typeof self !== 'undefined' ? self : this);
