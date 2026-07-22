/* ========================================================================== 
   ShoreVest One — stable synthetic Travel calendar result

   The demo calendar derives dates from Date.now(). Without a session cache, each
   Home render receives a slightly different end time and treats it as a changed
   trip, creating a continuous rerender loop. Cache the first synthetic result for
   the session. Production calendar behaviour is unchanged.
   ========================================================================== */
(function (root) {
  'use strict';

  var ENV = root.SHOREVEST_PORTAL_ENV || { mode: 'demo' };
  var adapter = root.SVPortalTravelCalendar;
  if (!adapter || typeof adapter.getCurrentLocation !== 'function' || ENV.mode === 'production') return;

  var originalGet = adapter.getCurrentLocation;
  var originalClear = adapter.clearCache;
  var cachedResult = null;
  var pendingResult = null;

  adapter.getCurrentLocation = function (options) {
    options = options || {};
    if (options.force) {
      cachedResult = null;
      pendingResult = null;
    }
    if (cachedResult) return Promise.resolve(cachedResult);
    if (pendingResult) return pendingResult;

    pendingResult = Promise.resolve(originalGet.call(adapter, options)).then(function (result) {
      cachedResult = result;
      pendingResult = null;
      return result;
    }, function (error) {
      pendingResult = null;
      throw error;
    });
    return pendingResult;
  };

  adapter.clearCache = function () {
    cachedResult = null;
    pendingResult = null;
    if (typeof originalClear === 'function') return originalClear.call(adapter);
  };

  root.SVPortalTravelCalendarDemoStability = {
    clear: function () { adapter.clearCache(); }
  };
})(typeof self !== 'undefined' ? self : this);
