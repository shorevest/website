/* ShoreVest One - dashboard overview widgets layered onto the guided Home. */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var P = root.SVPortalPersonas;
  if (!SVOps || !SVOps.ui || !SVOps.views || !SVOps.views.home || !P) return;

  var el = SVOps.ui.el;
  var baseHome = SVOps.views.home;

  /* Global financial centres shown for time-zone and weather context. Only some
     are ShoreVest offices; the UI deliberately calls the full list locations. */
  var LOCATION_GROUPS = [
    {
      label: 'ShoreVest & Greater China',
      locations: [
        { key: 'hong-kong', label: 'Hong Kong', region: 'Greater China', timezone: 'Asia/Hong_Kong', weather: ['31°C', 'Partly cloudy', 'High 33° · Low 28°'] },
        { key: 'guangzhou', label: 'Guangzhou', region: 'Greater China', timezone: 'Asia/Shanghai', weather: ['33°C', 'Cloudy', 'High 35° · Low 27°'] },
        { key: 'shanghai', label: 'Shanghai', region: 'Greater China', timezone: 'Asia/Shanghai', weather: ['32°C', 'Light cloud', 'High 35° · Low 28°'] },
        { key: 'beijing', label: 'Beijing', region: 'Greater China', timezone: 'Asia/Shanghai', weather: ['30°C', 'Clear', 'High 34° · Low 24°'] }
      ]
    },
    {
      label: 'Asia Pacific',
      locations: [
        { key: 'singapore', label: 'Singapore', region: 'Asia Pacific', timezone: 'Asia/Singapore', weather: ['30°C', 'Scattered showers', 'High 32° · Low 26°'] },
        { key: 'tokyo', label: 'Tokyo', region: 'Asia Pacific', timezone: 'Asia/Tokyo', weather: ['30°C', 'Partly cloudy', 'High 33° · Low 25°'] },
        { key: 'seoul', label: 'Seoul', region: 'Asia Pacific', timezone: 'Asia/Seoul', weather: ['29°C', 'Cloudy', 'High 31° · Low 24°'] },
        { key: 'sydney', label: 'Sydney', region: 'Asia Pacific', timezone: 'Australia/Sydney', weather: ['16°C', 'Clear', 'High 18° · Low 10°'] },
        { key: 'melbourne', label: 'Melbourne', region: 'Asia Pacific', timezone: 'Australia/Melbourne', weather: ['14°C', 'Light cloud', 'High 16° · Low 9°'] },
        { key: 'mumbai', label: 'Mumbai', region: 'Asia Pacific', timezone: 'Asia/Kolkata', weather: ['28°C', 'Rain', 'High 30° · Low 25°'] }
      ]
    },
    {
      label: 'Americas',
      locations: [
        { key: 'new-york', label: 'New York', region: 'Americas', timezone: 'America/New_York', weather: ['82°F', 'Partly cloudy', 'High 86° · Low 72°'] },
        { key: 'san-francisco', label: 'San Francisco, California', region: 'Americas', timezone: 'America/Los_Angeles', weather: ['64°F', 'Cloudy', 'High 68° · Low 55°'] },
        { key: 'los-angeles', label: 'Los Angeles, California', region: 'Americas', timezone: 'America/Los_Angeles', weather: ['78°F', 'Clear', 'High 84° · Low 65°'] },
        { key: 'chicago', label: 'Chicago', region: 'Americas', timezone: 'America/Chicago', weather: ['79°F', 'Partly cloudy', 'High 83° · Low 68°'] },
        { key: 'boston', label: 'Boston', region: 'Americas', timezone: 'America/New_York', weather: ['76°F', 'Light cloud', 'High 80° · Low 66°'] },
        { key: 'toronto', label: 'Toronto', region: 'Americas', timezone: 'America/Toronto', weather: ['25°C', 'Partly cloudy', 'High 28° · Low 19°'] },
        { key: 'sao-paulo', label: 'São Paulo', region: 'Americas', timezone: 'America/Sao_Paulo', weather: ['22°C', 'Clear', 'High 25° · Low 14°'] }
      ]
    },
    {
      label: 'Europe',
      locations: [
        { key: 'london', label: 'London', region: 'Europe', timezone: 'Europe/London', weather: ['23°C', 'Light cloud', 'High 25° · Low 16°'] },
        { key: 'paris', label: 'Paris', region: 'Europe', timezone: 'Europe/Paris', weather: ['25°C', 'Clear', 'High 28° · Low 18°'] },
        { key: 'frankfurt', label: 'Frankfurt', region: 'Europe', timezone: 'Europe/Berlin', weather: ['24°C', 'Partly cloudy', 'High 27° · Low 16°'] },
        { key: 'zurich', label: 'Zurich', region: 'Europe', timezone: 'Europe/Zurich', weather: ['23°C', 'Clear', 'High 26° · Low 15°'] },
        { key: 'geneva', label: 'Geneva', region: 'Europe', timezone: 'Europe/Zurich', weather: ['24°C', 'Clear', 'High 27° · Low 16°'] },
        { key: 'amsterdam', label: 'Amsterdam', region: 'Europe', timezone: 'Europe/Amsterdam', weather: ['21°C', 'Cloudy', 'High 23° · Low 15°'] },
        { key: 'luxembourg', label: 'Luxembourg', region: 'Europe', timezone: 'Europe/Luxembourg', weather: ['22°C', 'Light cloud', 'High 25° · Low 15°'] }
      ]
    },
    {
      label: 'Middle East',
      locations: [
        { key: 'dubai', label: 'Dubai', region: 'Middle East', timezone: 'Asia/Dubai', weather: ['39°C', 'Clear', 'High 42° · Low 32°'] },
        { key: 'abu-dhabi', label: 'Abu Dhabi', region: 'Middle East', timezone: 'Asia/Dubai', weather: ['40°C', 'Clear', 'High 43° · Low 33°'] },
        { key: 'riyadh', label: 'Riyadh', region: 'Middle East', timezone: 'Asia/Riyadh', weather: ['41°C', 'Clear', 'High 44° · Low 30°'] },
        { key: 'doha', label: 'Doha', region: 'Middle East', timezone: 'Asia/Qatar', weather: ['40°C', 'Clear', 'High 43° · Low 33°'] },
        { key: 'manama', label: 'Manama', region: 'Middle East', timezone: 'Asia/Bahrain', weather: ['39°C', 'Clear', 'High 42° · Low 34°'] }
      ]
    }
  ];

  var LOCATIONS = [];
  LOCATION_GROUPS.forEach(function (group) {
    group.locations.forEach(function (location) {
      LOCATIONS.push(location);
    });
  });

  function locationByKey(key) {
    for (var i = 0; i < LOCATIONS.length; i++) {
      if (LOCATIONS[i].key === key) return LOCATIONS[i];
    }
    return LOCATIONS[0];
  }

  function detectLocation() {
    var saved = SVOps.state.dashboardLocation || SVOps.state.dashboardOffice;
    if (saved) return locationByKey(saved);

    var timezone = '';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (ignore) {}
    for (var i = 0; i < LOCATIONS.length; i++) {
      if (LOCATIONS[i].timezone === timezone) return LOCATIONS[i];
    }
    return LOCATIONS[0];
  }

  function localTime(location) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: location.timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date());
    } catch (ignore) {
      return '--:--';
    }
  }

  function localDate(location) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: location.timezone,
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }).format(new Date());
    } catch (ignore) {
      return '';
    }
  }

  function openWork() {
    return (P.workItems || []).filter(function (item) {
      return item.bucket !== 'done' && !(SVOps.state.workResolved && SVOps.state.workResolved[item.id]);
    });
  }

  function cardHead(label, extra) {
    return el('div', { class: 'dashboard-widget__head' }, [
      el('span', { class: 'dashboard-widget__eyebrow', text: label }),
      extra || el('span', {})
    ]);
  }

  function locationCard(location, rerender) {
    var select = el('select', {
      class: 'dashboard-widget__select',
      'aria-label': 'Choose office or global financial centre',
      onchange: function () {
        SVOps.state.dashboardLocation = select.value;
        rerender();
      }
    });

    LOCATION_GROUPS.forEach(function (group) {
      var options = el('optgroup', { label: group.label });
      group.locations.forEach(function (item) {
        options.appendChild(el('option', { value: item.key, text: item.label }));
      });
      select.appendChild(options);
    });
    select.value = location.key;

    var time = el('strong', { class: 'dashboard-widget__big', text: localTime(location) });
    var date = el('span', { class: 'dashboard-widget__line', text: localDate(location) });

    if (SVOps.state.dashboardClockTimer) root.clearInterval(SVOps.state.dashboardClockTimer);
    SVOps.state.dashboardClockTimer = root.setInterval(function () {
      time.textContent = localTime(location);
      date.textContent = localDate(location);
    }, 30000);

    return el('section', { class: 'dashboard-widget', 'aria-label': 'Selected location and local time' }, [
      cardHead('Location & time', select),
      time,
      date,
      el('span', { class: 'dashboard-widget__small', text: location.region + ' · ' + location.timezone.replace(/_/g, ' ') })
    ]);
  }

  function weatherCard(location) {
    var temperature = el('strong', { class: 'dashboard-widget__big', text: location.weather[0] });
    var condition = el('span', { class: 'dashboard-widget__line', text: location.weather[1] });
    var range = el('span', { class: 'dashboard-widget__small', text: location.weather[2] });
    var source = el('span', { class: 'dashboard-widget__source', text: 'Sample weather in this demonstration' });

    if (root.SVPortalWeather && typeof root.SVPortalWeather.getCurrent === 'function') {
      source.textContent = 'Updating live weather…';
      Promise.resolve(root.SVPortalWeather.getCurrent(location)).then(function (live) {
        if (!live) throw new Error('No weather returned');
        temperature.textContent = live.temperature || '--';
        condition.textContent = live.condition || 'Weather unavailable';
        range.textContent = 'High ' + (live.high || '--') + ' · Low ' + (live.low || '--');
        source.textContent = live.updatedLabel || 'Live weather';
      }).catch(function () {
        source.textContent = 'Live weather unavailable · showing sample conditions';
      });
    }

    return el('section', { class: 'dashboard-widget', 'aria-label': 'Local weather' }, [
      cardHead('Local weather', el('span', { class: 'dashboard-widget__place', text: location.label })),
      temperature,
      condition,
      range,
      source
    ]);
  }

  function todayCard() {
    var items = openWork();
    var today = items.filter(function (item) {
      return item.due && String(item.due).toLowerCase().indexOf('today') !== -1;
    });
    var decisions = P.homeItems('decide').filter(function (item) {
      return !(SVOps.state.workResolved && SVOps.state.workResolved[item.id]);
    }).length;

    return el('a', { class: 'dashboard-widget dashboard-widget--link', href: '#/my-work', 'aria-label': 'Open work due today' }, [
      cardHead('Today', el('span', { class: 'dashboard-widget__open', text: 'Open queue →' })),
      el('strong', { class: 'dashboard-widget__big', text: String(today.length) }),
      el('span', { class: 'dashboard-widget__line', text: today.length === 1 ? 'item is due today' : 'items are due today' }),
      el('span', { class: 'dashboard-widget__small', text: decisions + (decisions === 1 ? ' decision waiting' : ' decisions waiting') })
    ]);
  }

  function meetingCard() {
    var meeting = P.itemById && P.itemById('redpanda-meeting');
    var title = meeting ? 'Red Panda Capital' : 'No meeting loaded';
    var detail = meeting ? '10:30 ET · attendance needs confirmation' : 'Your next meeting will appear here.';

    return el('a', { class: 'dashboard-widget dashboard-widget--meeting', href: '#/workspace/meetings', 'aria-label': 'Open next meeting' }, [
      cardHead('Next meeting', el('span', { class: 'dashboard-widget__open', text: 'Open →' })),
      el('strong', { class: 'dashboard-widget__meeting-title', text: title }),
      el('span', { class: 'dashboard-widget__line', text: detail })
    ]);
  }

  function patchedHome(container, user) {
    baseHome(container, user);

    var page = container.querySelector('.guided-home');
    if (!page) return;

    var title = page.querySelector('.guided-intro__title');
    var lede = page.querySelector('.guided-intro__lede');
    if (title) title.textContent = 'Your ShoreVest One dashboard';
    if (lede) lede.textContent = 'See what needs you today, what is waiting elsewhere and where to go next.';

    var location = detectLocation();
    var overview = el('div', { class: 'dashboard-widgets', 'aria-label': 'Dashboard overview' }, [
      locationCard(location, function () {
        container.innerHTML = '';
        patchedHome(container, user);
      }),
      weatherCard(location),
      todayCard(),
      meetingCard()
    ]);

    var note = page.querySelector('.guided-demo-note');
    if (note && note.parentNode) note.parentNode.insertBefore(overview, note.nextSibling);
  }

  SVOps.views.home = patchedHome;
})(typeof self !== 'undefined' ? self : this);
