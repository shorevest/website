/* ShoreVest One - automatic dashboard location from the user's Travel calendar. */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  if (!SVOps || !SVOps.views || !SVOps.views.home) return;

  var baseHome = SVOps.views.home;
  var LOCATION_NAMES = [
    ['hong-kong', ['hong kong', 'hk']],
    ['guangzhou', ['guangzhou', 'canton']],
    ['shanghai', ['shanghai']],
    ['beijing', ['beijing', 'peking']],
    ['singapore', ['singapore']],
    ['tokyo', ['tokyo']],
    ['seoul', ['seoul']],
    ['sydney', ['sydney']],
    ['melbourne', ['melbourne']],
    ['mumbai', ['mumbai', 'bombay']],
    ['new-york', ['new york', 'nyc']],
    ['san-francisco', ['san francisco', 'sfo', 'bay area', 'silicon valley']],
    ['los-angeles', ['los angeles', 'lax']],
    ['chicago', ['chicago']],
    ['boston', ['boston']],
    ['toronto', ['toronto']],
    ['sao-paulo', ['sao paulo']],
    ['london', ['london']],
    ['paris', ['paris']],
    ['frankfurt', ['frankfurt']],
    ['zurich', ['zurich']],
    ['geneva', ['geneva']],
    ['amsterdam', ['amsterdam']],
    ['luxembourg', ['luxembourg']],
    ['dubai', ['dubai']],
    ['abu-dhabi', ['abu dhabi']],
    ['riyadh', ['riyadh', 'ksa', 'saudi arabia']],
    ['doha', ['doha', 'qatar']],
    ['manama', ['manama', 'bahrain']]
  ];

  function normalize(value) {
    var text = String(value || '').toLowerCase();
    if (text.normalize) text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return text.replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function containsName(haystack, name) {
    var needle = normalize(name);
    if (!needle) return false;
    if (needle.length <= 3) return (' ' + haystack + ' ').indexOf(' ' + needle + ' ') !== -1;
    return haystack.indexOf(needle) !== -1;
  }

  function locationKey(value) {
    var haystack = normalize(value);
    for (var i = 0; i < LOCATION_NAMES.length; i++) {
      for (var j = 0; j < LOCATION_NAMES[i][1].length; j++) {
        if (containsName(haystack, LOCATION_NAMES[i][1][j])) return LOCATION_NAMES[i][0];
      }
    }
    return null;
  }

  function shortDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function rerender(container, user) {
    container.innerHTML = '';
    linkedHome(container, user);
  }

  function applyPreferredLocation() {
    var manual = SVOps.state.dashboardManualLocation;
    var travel = SVOps.state.dashboardTravelLocation;
    if (manual) SVOps.state.dashboardLocation = manual;
    else if (travel) SVOps.state.dashboardLocation = travel;
  }

  function attachManualOverride(page) {
    var select = page.querySelector('.dashboard-widget__select');
    if (!select || select.getAttribute('data-travel-wrapped') === 'true') return;
    select.setAttribute('data-travel-wrapped', 'true');

    var original = select.onchange;
    select.onchange = function (event) {
      SVOps.state.dashboardManualLocation = select.value;
      if (typeof original === 'function') return original.call(select, event);
    };
  }

  function statusCopy() {
    var status = SVOps.state.dashboardTravelStatus;
    if (SVOps.state.dashboardManualLocation) return 'Selected manually for this session';
    if (SVOps.state.dashboardTravelLocation && status) {
      var until = shortDate(status.endsAt);
      return (status.demo ? 'Demo Travel calendar' : 'Travel calendar') + (until ? ' · until ' + until : '');
    }
    if (status && status.connected && !status.active) return 'Default location · no active trip';
    if (status && !status.connected) return 'Default location · Travel calendar unavailable';
    return 'Checking Travel calendar…';
  }

  function addStatus(page, container, user) {
    var firstCard = page.querySelector('.dashboard-widgets .dashboard-widget');
    if (!firstCard || firstCard.querySelector('.dashboard-widget__context')) return;

    var row = document.createElement('div');
    row.className = 'dashboard-widget__context';

    var copy = document.createElement('span');
    copy.className = 'dashboard-widget__context-copy';
    copy.textContent = statusCopy();
    row.appendChild(copy);

    if (SVOps.state.dashboardManualLocation && SVOps.state.dashboardTravelLocation) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'dashboard-widget__calendar-button';
      button.textContent = 'Use Travel calendar';
      button.addEventListener('click', function () {
        SVOps.state.dashboardManualLocation = null;
        SVOps.state.dashboardLocation = SVOps.state.dashboardTravelLocation;
        rerender(container, user);
      });
      row.appendChild(button);
    }

    firstCard.appendChild(row);
  }

  function sync(container, user) {
    var adapter = root.SVPortalTravelCalendar;
    if (!adapter || typeof adapter.getCurrentLocation !== 'function' || SVOps.state.dashboardTravelPending) return;

    SVOps.state.dashboardTravelPending = true;
    adapter.getCurrentLocation().then(function (status) {
      SVOps.state.dashboardTravelPending = false;
      var key = status && status.active ? locationKey(status.locationText) : null;
      var signature = [
        status && status.connected,
        status && status.active,
        status && status.locationText,
        status && status.endsAt,
        key,
        status && status.detail
      ].join('|');

      if (signature === SVOps.state.dashboardTravelSignature) return;
      SVOps.state.dashboardTravelSignature = signature;
      SVOps.state.dashboardTravelStatus = status;
      SVOps.state.dashboardTravelLocation = key;
      if (!SVOps.state.dashboardManualLocation && key) SVOps.state.dashboardLocation = key;
      rerender(container, user);
    }).catch(function (error) {
      SVOps.state.dashboardTravelPending = false;
      var message = error && error.message ? error.message : 'Travel calendar unavailable.';
      var signature = 'error|' + message;
      if (signature === SVOps.state.dashboardTravelSignature) return;
      SVOps.state.dashboardTravelSignature = signature;
      SVOps.state.dashboardTravelStatus = { connected: false, active: false, detail: message };
      SVOps.state.dashboardTravelLocation = null;
      rerender(container, user);
    });
  }

  function linkedHome(container, user) {
    applyPreferredLocation();
    baseHome(container, user);

    var page = container.querySelector('.guided-home');
    if (!page) return;
    attachManualOverride(page);
    addStatus(page, container, user);
    sync(container, user);
  }

  SVOps.views.home = linkedHome;
})(typeof self !== 'undefined' ? self : this);
