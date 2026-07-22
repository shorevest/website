/* ShoreVest One - dashboard overview widgets layered onto the guided Home. */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var P = root.SVPortalPersonas;
  if (!SVOps || !SVOps.ui || !SVOps.views || !SVOps.views.home || !P) return;

  var el = SVOps.ui.el;
  var baseHome = SVOps.views.home;

  var OFFICES = [
    { key: 'hong-kong', label: 'Hong Kong', timezone: 'Asia/Hong_Kong', weather: ['31°C', 'Partly cloudy', 'High 33° · Low 28°'] },
    { key: 'guangzhou', label: 'Guangzhou', timezone: 'Asia/Shanghai', weather: ['33°C', 'Cloudy', 'High 35° · Low 27°'] },
    { key: 'shanghai', label: 'Shanghai', timezone: 'Asia/Shanghai', weather: ['32°C', 'Light cloud', 'High 35° · Low 28°'] },
    { key: 'beijing', label: 'Beijing', timezone: 'Asia/Shanghai', weather: ['30°C', 'Clear', 'High 34° · Low 24°'] },
    { key: 'new-york', label: 'New York', timezone: 'America/New_York', weather: ['82°F', 'Partly cloudy', 'High 86° · Low 72°'] },
    { key: 'london', label: 'London', timezone: 'Europe/London', weather: ['23°C', 'Light cloud', 'High 25° · Low 16°'] }
  ];

  function officeByKey(key) {
    for (var i = 0; i < OFFICES.length; i++) {
      if (OFFICES[i].key === key) return OFFICES[i];
    }
    return OFFICES[0];
  }

  function detectOffice() {
    if (SVOps.state.dashboardOffice) return officeByKey(SVOps.state.dashboardOffice);
    var timezone = '';
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (ignore) {}
    for (var i = 0; i < OFFICES.length; i++) {
      if (OFFICES[i].timezone === timezone) return OFFICES[i];
    }
    return OFFICES[0];
  }

  function officeTime(office) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: office.timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date());
    } catch (ignore) {
      return '--:--';
    }
  }

  function officeDate(office) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: office.timezone,
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

  function officeCard(office, rerender) {
    var select = el('select', {
      class: 'dashboard-widget__select',
      'aria-label': 'Choose ShoreVest office',
      onchange: function () {
        SVOps.state.dashboardOffice = select.value;
        rerender();
      }
    });
    OFFICES.forEach(function (item) {
      select.appendChild(el('option', { value: item.key, text: item.label }));
    });
    select.value = office.key;

    var time = el('strong', { class: 'dashboard-widget__big', text: officeTime(office) });
    var date = el('span', { class: 'dashboard-widget__line', text: officeDate(office) });

    if (SVOps.state.dashboardClockTimer) root.clearInterval(SVOps.state.dashboardClockTimer);
    SVOps.state.dashboardClockTimer = root.setInterval(function () {
      time.textContent = officeTime(office);
      date.textContent = officeDate(office);
    }, 30000);

    return el('section', { class: 'dashboard-widget', 'aria-label': 'Local office time' }, [
      cardHead('Local office', select),
      time,
      date,
      el('span', { class: 'dashboard-widget__small', text: office.timezone.replace('_', ' ') })
    ]);
  }

  function weatherCard(office) {
    var temperature = el('strong', { class: 'dashboard-widget__big', text: office.weather[0] });
    var condition = el('span', { class: 'dashboard-widget__line', text: office.weather[1] });
    var range = el('span', { class: 'dashboard-widget__small', text: office.weather[2] });
    var source = el('span', { class: 'dashboard-widget__source', text: 'Sample weather in this demonstration' });

    if (root.SVPortalWeather && typeof root.SVPortalWeather.getCurrent === 'function') {
      source.textContent = 'Updating live weather…';
      Promise.resolve(root.SVPortalWeather.getCurrent(office)).then(function (live) {
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
      cardHead('Local weather', el('span', { class: 'dashboard-widget__place', text: office.label })),
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

    var office = detectOffice();
    var overview = el('div', { class: 'dashboard-widgets', 'aria-label': 'Dashboard overview' }, [
      officeCard(office, function () {
        container.innerHTML = '';
        patchedHome(container, user);
      }),
      weatherCard(office),
      todayCard(),
      meetingCard()
    ]);

    var note = page.querySelector('.guided-demo-note');
    if (note && note.parentNode) note.parentNode.insertBefore(overview, note.nextSibling);
  }

  SVOps.views.home = patchedHome;
})(typeof self !== 'undefined' ? self : this);