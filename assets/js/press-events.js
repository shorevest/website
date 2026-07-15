(function () {
  var eventVisibility = window.ShoreVestEventVisibility;
  if (!eventVisibility) return;

  // Single source of truth for the events ledgers. The visibility module only
  // decides which ledger an event belongs to: upcoming / in-progress events
  // render in the "Upcoming events" section (soonest first, three visible,
  // the rest behind a toggle); everything concluded renders permanently in
  // the "Previous events" section (newest first).
  //
  // `post` links a past event to its related coverage (a video, article
  // or write-up). When present it becomes the row's primary link; otherwise
  // the row falls back to the event page (`href`).
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
      startDate: '2026-09-18',
      endDate: '2026-09-18',
      timeZone: 'Asia/Hong_Kong',
      displayDate: '18 Sep 2026',
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
      description: 'A leading private capital conference focused on Asia-Pacific markets.',
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
      description: 'A regional forum for family offices and investment professionals.',
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
      description: 'A forum panel on Asian distressed debt and special situations.',
      ctaLabel: 'View →',
      href: 'https://www.peievents.com/en/event/pdi-apac-forum/',
      ariaLabel: 'View PDI APAC Forum event page',
      isClickable: true,
      post: {
        href: 'https://www.linkedin.com/posts/shorevest-partners_pdi-asian-privatecredit-activity-7477857736379031552-1dRs',
        label: 'LinkedIn →',
        ariaLabel: 'View ShoreVest LinkedIn post for PDI APAC Forum'
      }
    },
    {
      startDate: '2026-06-15',
      endDate: '2026-06-17',
      timeZone: 'Europe/Amsterdam',
      displayDate: '15–17 Jun 2026',
      type: 'Conference',
      title: 'SuperReturn Emerging Markets',
      location: 'Amsterdam',
      description: 'An emerging-markets conference covering private capital and credit themes.',
      ctaLabel: 'View →',
      href: 'https://informaconnect.com/superreturn-emerging-markets/',
      ariaLabel: 'View SuperReturn Emerging Markets event page',
      isClickable: true,
      post: {
        href: 'https://www.linkedin.com/posts/shorevest-partners_emergingmarkets-privatecredit-uncorrelated-activity-7473668678174154754-BwaO',
        embedHref: 'https://www.linkedin.com/embed/feed/update/urn:li:share:7473668676995469312?collapsed=1',
        label: 'LinkedIn →',
        ariaLabel: 'View ShoreVest LinkedIn post for SuperReturn Emerging Markets'
      }
    },
    {
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      timeZone: 'Asia/Hong_Kong',
      displayDate: '10 Jun 2026',
      type: 'Conference',
      title: 'Bloomberg Invest Hong Kong',
      location: 'Hong Kong',
      description: 'Bloomberg’s investment conference in Hong Kong.',
      ctaLabel: 'View →',
      href: 'https://events.bloomberglive.com/event/InvestHK_2026/summary?RefId=blive_tile',
      ariaLabel: 'View Bloomberg Invest Hong Kong event page',
      isClickable: true,
      post: {
        href: 'https://www.linkedin.com/posts/shorevest-partners_privatecredit-asiaprivatecredit-chinaprivatecredit-activity-7443141209809862659-14J4',
        label: 'LinkedIn →',
        ariaLabel: 'View ShoreVest LinkedIn post for Bloomberg Invest Hong Kong'
      }
    },
    {
      startDate: '2025-11-06',
      endDate: '2025-11-06',
      timeZone: 'Asia/Riyadh',
      displayDate: '6 Nov 2025',
      type: 'Panel',
      title: 'FII Institute Priority panel on private credit',
      location: 'Riyadh',
      description: 'A panel discussion covering credit-cycle risk and how global investors are assessing China’s market structure.',
      isClickable: true,
      post: {
        href: 'https://www.youtube.com/watch?v=t9BHji_UQlA',
        label: 'Watch →',
        ariaLabel: 'Watch the FII Institute Priority panel on YouTube'
      }
    },
    {
      startDate: '2019-10-30',
      endDate: '2019-10-30',
      timeZone: 'America/Los_Angeles',
      displayDate: '30 Oct 2019',
      type: 'Roundtable',
      title: 'Asia Society Executive Roundtable on China debt markets',
      description: 'A private Executive Roundtable on trade-policy trends affecting China’s debt situation and the non-performing loan market.',
      isClickable: true,
      post: {
        href: 'https://asiasociety.org/northern-california/executive-roundtable-benjamin-fanger-and-howard-chao',
        label: 'View →',
        ariaLabel: 'View the Asia Society roundtable post'
      }
    }
  ];

  // Visible-by-default row counts before the "Show more" toggle takes over.
  var UPCOMING_VISIBLE = 3;
  var PAST_VISIBLE = 3;

  function createTextElement(tagName, className, text) {
    var element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function renderEvent(event, isPast) {
    var row = document.createElement('article');
    row.className = 'pr-event-row';
    if (isPast) row.classList.add('pr-event-row--past');
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
    if (event.status === eventVisibility.STATUS.IN_PROGRESS) {
      title.appendChild(createTextElement('span', 'pr-event-status', 'In progress'));
    }
    title.appendChild(createTextElement('span', '', event.title));
    title.appendChild(createTextElement('small', '', event.description));
    row.appendChild(title);

    row.appendChild(createTextElement('span', 'pr-event-location', event.location || ''));

    var post = isPast ? event.post : null;
    if (post && post.href) {
      var postLink = createTextElement('a', 'pr-event-link pr-event-link--post', post.label || 'View →');
      postLink.href = post.href;
      if (post.embedHref) postLink.setAttribute('data-linkedin-embed', post.embedHref);
      postLink.target = '_blank';
      postLink.rel = 'noopener noreferrer';
      if (post.ariaLabel) postLink.setAttribute('aria-label', post.ariaLabel);
      row.appendChild(postLink);
    } else if (event.isClickable && event.href) {
      var link = createTextElement('a', 'pr-event-link', event.ctaLabel || 'View →');
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

  // Renders a ledger with the first `visibleLimit` rows shown and the rest
  // collapsed behind an accessible "Load more" toggle.
  function renderList(table, events, visibleLimit, isPast) {
    if (!table) return;

    table.querySelectorAll('.pr-event-row, .pr-events__more').forEach(function (node) { node.remove(); });
    var anchor = table.querySelector('.pr-events__empty');

    var collapsedRows = [];
    events.forEach(function (event, index) {
      var row = renderEvent(event, isPast);
      if (index >= visibleLimit) {
        row.hidden = true;
        collapsedRows.push(row);
      }
      table.insertBefore(row, anchor);
    });

    if (collapsedRows.length) {
      var wrap = document.createElement('div');
      wrap.className = 'pr-events__more';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pr-events__more-btn';
      btn.setAttribute('aria-expanded', 'false');
      var collapsedLabel = 'Load more';
      var expandedLabel = 'Show less';
      btn.textContent = collapsedLabel;
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        collapsedRows.forEach(function (row) { row.hidden = expanded; });
        btn.setAttribute('aria-expanded', String(!expanded));
        btn.textContent = expanded ? collapsedLabel : expandedLabel;
      });
      wrap.appendChild(btn);
      table.insertBefore(wrap, anchor);
    }
  }

  function applyEventFilter(now) {
    var upcomingTable = document.querySelector('[data-events-list="upcoming"]');
    var pastTable = document.querySelector('[data-events-list="past"]');
    var emptyEl = document.getElementById('pr-events-empty');
    if (!upcomingTable && !pastTable) return;

    var moment = now || new Date();
    var withStatus = EVENTS.map(function (event) {
      return Object.assign({}, event, { status: eventVisibility.getEventStatus(event, moment) });
    });

    var upcoming = withStatus
      .filter(function (event) {
        return event.status === eventVisibility.STATUS.UPCOMING ||
          event.status === eventVisibility.STATUS.IN_PROGRESS;
      })
      .sort(function (a, b) {
        if (a.status !== b.status) return a.status === eventVisibility.STATUS.IN_PROGRESS ? -1 : 1;
        return a.startDate.localeCompare(b.startDate);
      });

    // Previous events are a permanent record: concluded events stay listed
    // (newest first) instead of retiring after the grace window.
    var past = withStatus
      .filter(function (event) {
        return event.status === eventVisibility.STATUS.CONCLUDED ||
          event.status === eventVisibility.STATUS.HIDDEN;
      })
      .sort(function (a, b) { return b.endDate.localeCompare(a.endDate); });

    renderList(upcomingTable, upcoming, UPCOMING_VISIBLE, false);
    renderList(pastTable, past, PAST_VISIBLE, true);

    if (emptyEl) emptyEl.hidden = upcoming.length > 0;
  }

  window.__svMediaEvents = EVENTS;
  window.__svApplyEventFilter = applyEventFilter;

  if (document.readyState !== 'loading') applyEventFilter();
  else document.addEventListener('DOMContentLoaded', function () { applyEventFilter(); });
}());
