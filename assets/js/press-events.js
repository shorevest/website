(function () {
  var eventVisibility = window.ShoreVestEventVisibility;
  if (!eventVisibility) return;

  var EVENTS = [
    {
      startDate: '2026-09-08',
      endDate: '2026-09-09',
      timeZone: 'Asia/Shanghai',
      displayDate: '8–9 Sep 2026',
      type: 'Summit',
      title: 'APAC Family Office Investment Summit',
      location: 'Shanghai',
      description: 'An Asia-Pacific investment summit for family offices and institutional investors.',
      ctaLabel: 'View →',
      href: 'https://apacfamilysummit.com/',
      ariaLabel: 'View APAC Family Office Investment Summit event page',
      isClickable: true
    },
    {
      startDate: '2026-09-24',
      endDate: '2026-09-25',
      timeZone: 'Asia/Hong_Kong',
      displayDate: '24–25 Sep 2026',
      type: 'Investor Event',
      title: 'ShoreVest Annual General Meeting 2026',
      location: 'Guangzhou',
      description: 'ShoreVest’s annual meeting for investors and invited guests.',
      ctaLabel: 'INVITE ONLY',
      isClickable: false
    },
    {
      startDate: '2026-09-28',
      endDate: '2026-10-01',
      timeZone: 'Asia/Singapore',
      displayDate: '28 Sep–1 Oct 2026',
      type: 'Conference',
      title: 'SuperReturn Asia 2026',
      location: 'Singapore',
      description: 'ShoreVest will be represented by Benjamin Fanger and Kelvin Chan.',
      ctaLabel: 'View →',
      href: 'https://informaconnect.com/superreturnasia/',
      ariaLabel: 'View SuperReturn Asia 2026 event page',
      isClickable: true
    },
    {
      startDate: '2026-10-15',
      endDate: '2026-10-16',
      timeZone: 'Asia/Hong_Kong',
      displayDate: '15–16 Oct 2026',
      type: 'Forum',
      title: 'World Family Office Forum | Asia 2026',
      location: 'Hong Kong',
      description: 'ShoreVest will be represented by Kelvin Chan.',
      ctaLabel: 'View →',
      href: 'https://asia.worldfamilyofficeforum.com/',
      ariaLabel: 'View World Family Office Forum Asia 2026 event page',
      isClickable: true
    },
    {
      startDate: '2026-10-15',
      endDate: '2026-10-15',
      timeZone: 'Asia/Hong_Kong',
      displayDate: '15 Oct 2026',
      type: 'Summit',
      title: 'Caproasia Family Office Summit Hong Kong 2026',
      location: 'Hong Kong',
      description: 'A regional summit for family-office principals, investment professionals and wealth-management leaders.',
      ctaLabel: 'View →',
      href: 'https://my.caproasia.com/the-2026-family-office-summit/',
      ariaLabel: 'View Caproasia Family Office Summit Hong Kong 2026 event page',
      isClickable: true
    },
    {
      startDate: '2026-10-26',
      endDate: '2026-10-29',
      timeZone: 'Asia/Riyadh',
      displayDate: '26–29 Oct 2026',
      type: 'Conference',
      title: 'FII 10th Edition 2026',
      location: 'Riyadh',
      description: 'The tenth edition of the Future Investment Initiative’s global investment conference.',
      ctaLabel: 'View →',
      href: 'https://fii-institute.org/conference/fii-10th-edition/',
      ariaLabel: 'View FII 10th Edition 2026 event page',
      isClickable: true
    },
    {
      startDate: '2026-11-05',
      endDate: '2026-11-05',
      timeZone: 'Asia/Singapore',
      displayDate: '5 Nov 2026',
      type: 'Summit',
      title: 'Caproasia Family Office Summit Singapore 2026',
      location: 'Singapore',
      description: 'A regional summit for family-office principals, investment professionals and wealth-management leaders.',
      ctaLabel: 'View →',
      href: 'https://my.caproasia.com/the-2026-family-office-summit/',
      ariaLabel: 'View Caproasia Family Office Summit Singapore 2026 event page',
      isClickable: true
    },
    {
      startDate: '2026-11-10',
      endDate: '2026-11-11',
      timeZone: 'Europe/London',
      displayDate: '10–11 Nov 2026',
      type: 'Summit',
      title: 'Alea Global Family Office Summit 2026',
      location: 'London',
      description: 'A global summit for family-office principals, investors and advisers.',
      isClickable: false
    },
    {
      startDate: '2026-06-24',
      endDate: '2026-06-25',
      timeZone: 'Asia/Singapore',
      displayDate: '24–25 Jun 2026',
      type: 'Panel',
      title: 'PDI APAC Forum',
      location: 'Singapore',
      description: 'Benjamin Fanger joined a panel on Asian distressed debt and special situations.',
      ctaLabel: 'View →',
      href: 'https://www.peievents.com/en/event/pdi-apac-forum/',
      ariaLabel: 'View PDI APAC Forum event page',
      isClickable: true,
      imageSrc: 'assets/img/media-hero-fii-priority.svg',
      imageAlt: 'Audience at a ShoreVest event panel'
    },
    {
      startDate: '2026-06-15',
      endDate: '2026-06-17',
      timeZone: 'Europe/Amsterdam',
      displayDate: '15–17 Jun 2026',
      type: 'Conference',
      title: 'SuperReturn Emerging Markets',
      location: 'Amsterdam',
      description: 'Benjamin Fanger participated as a speaker.',
      ctaLabel: 'View →',
      href: 'https://informaconnect.com/superreturn-emerging-markets/speakers/benjamin-fanger/',
      ariaLabel: 'View Benjamin Fanger’s SuperReturn speaker profile',
      isClickable: true,
      imageSrc: 'assets/img/media-hero-fii-priority.svg',
      imageAlt: 'Conference audience listening to a ShoreVest panel'
    },
    {
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      timeZone: 'Asia/Hong_Kong',
      displayDate: '10 Jun 2026',
      type: 'Conference',
      title: 'Bloomberg Invest Hong Kong',
      location: 'Hong Kong',
      description: 'ShoreVest participated in Bloomberg’s investment conference in Hong Kong.',
      ctaLabel: 'View →',
      href: 'https://events.bloomberglive.com/event/InvestHK_2026/summary?RefId=blive_tile',
      ariaLabel: 'View Bloomberg Invest Hong Kong event page',
      isClickable: true
    }
  ];

  function createTextElement(tagName, className, text) {
    var element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function renderEvent(event) {
    var row = document.createElement('article');
    row.className = 'pr-event-row';
    if (event.status === eventVisibility.STATUS.CONCLUDED) row.classList.add('pr-event-row--past');
    if (event.imageSrc) row.classList.add('pr-event-row--with-media');
    row.setAttribute('role', 'row');
    row.setAttribute('data-start-date', event.startDate);
    row.setAttribute('data-end-date', event.endDate);
    row.setAttribute('data-time-zone', event.timeZone);

    var date = createTextElement('time', 'pr-event-date', event.displayDate);
    date.setAttribute('datetime', event.startDate);
    row.appendChild(date);
    row.appendChild(createTextElement('span', 'pr-event-type', event.type));

    var title = document.createElement('span');
    title.className = 'pr-event-title';
    var statusLabel = event.status === eventVisibility.STATUS.CONCLUDED ? 'Concluded' : 'Upcoming';
    title.appendChild(createTextElement('span', 'pr-event-status', statusLabel));
    title.appendChild(createTextElement('span', '', event.title));
    title.appendChild(createTextElement('small', '', event.description));
    row.appendChild(title);

    row.appendChild(createTextElement('span', 'pr-event-location', event.location));

    if (event.imageSrc) {
      var media = document.createElement('figure');
      media.className = 'pr-event-media';
      var img = document.createElement('img');
      img.src = event.imageSrc;
      img.alt = event.imageAlt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      media.appendChild(img);
      row.appendChild(media);
    }

    if (event.isClickable) {
      var link = createTextElement('a', 'pr-event-link', event.ctaLabel);
      link.href = event.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (event.ariaLabel) link.setAttribute('aria-label', event.ariaLabel);
      row.appendChild(link);
    } else if (event.ctaLabel) {
      row.appendChild(createTextElement('span', 'pr-event-link pr-event-link--plain', event.ctaLabel));
    }

    return row;
  }

  // How many upcoming events to show before the "Show more" toggle takes over.
  var INITIAL_UPCOMING_VISIBLE = 3;

  function buildDivider() {
    var divider = document.createElement('div');
    divider.className = 'pr-events__divider';
    divider.setAttribute('role', 'separator');
    divider.setAttribute('aria-label', 'Past events');
    divider.appendChild(createTextElement('span', 'pr-events__divider-label', 'Past events'));
    divider.appendChild(createTextElement('span', 'pr-events__divider-note',
      'Concluded appearances remain listed for ' + eventVisibility.DISPLAY_DAYS_AFTER_END + ' days'));
    return divider;
  }

  function applyEventFilter(now) {
    var table = document.querySelector('.pr-events__table');
    var emptyEl = document.getElementById('pr-events-empty');
    if (!table || !emptyEl) return;

    var visibleEvents = eventVisibility.sortVisibleEvents(EVENTS, now || new Date());
    table.querySelectorAll('.pr-event-row, .pr-events__divider, .pr-events__more').forEach(function (row) { row.remove(); });

    var upcoming = visibleEvents.filter(function (event) { return event.status !== eventVisibility.STATUS.CONCLUDED; });
    var past = visibleEvents.filter(function (event) { return event.status === eventVisibility.STATUS.CONCLUDED; });

    var collapsedRows = [];
    upcoming.forEach(function (event, index) {
      var row = renderEvent(event);
      if (index >= INITIAL_UPCOMING_VISIBLE) {
        row.hidden = true;
        collapsedRows.push(row);
      }
      table.insertBefore(row, emptyEl);
    });

    if (collapsedRows.length) {
      var wrap = document.createElement('div');
      wrap.className = 'pr-events__more';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pr-events__more-btn';
      btn.setAttribute('aria-expanded', 'false');
      var moreLabel = 'Show ' + collapsedRows.length + ' more';
      btn.textContent = moreLabel;
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        collapsedRows.forEach(function (row) { row.hidden = expanded; });
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.textContent = expanded ? moreLabel : 'Show fewer';
      });
      wrap.appendChild(btn);
      table.insertBefore(wrap, emptyEl);
    }

    if (past.length) {
      table.insertBefore(buildDivider(), emptyEl);
      past.forEach(function (event) { table.insertBefore(renderEvent(event), emptyEl); });
    }

    emptyEl.hidden = visibleEvents.length > 0;
  }

  window.__svMediaEvents = EVENTS;
  window.__svApplyEventFilter = applyEventFilter;

  if (document.readyState !== 'loading') applyEventFilter();
  else document.addEventListener('DOMContentLoaded', function () { applyEventFilter(); });
}());
