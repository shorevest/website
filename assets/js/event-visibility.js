(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShoreVestEventVisibility = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var DISPLAY_DAYS_AFTER_END = 30;
  var STATUS = {
    UPCOMING: 'UPCOMING',
    IN_PROGRESS: 'IN PROGRESS',
    CONCLUDED: 'CONCLUDED',
    HIDDEN: 'HIDDEN'
  };

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function getLocalDateParts(date, timeZone) {
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    var local = {};
    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].type !== 'literal') local[parts[i].type] = parts[i].value;
    }
    return {
      year: Number(local.year),
      month: Number(local.month),
      day: Number(local.day),
      iso: local.year + '-' + local.month + '-' + local.day
    };
  }

  function addCalendarDays(isoDate, days) {
    var fields = isoDate.split('-').map(Number);
    var date = new Date(Date.UTC(fields[0], fields[1] - 1, fields[2]));
    date.setUTCDate(date.getUTCDate() + days);
    return date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate());
  }

  function getEventStatus(event, now) {
    var currentDate = getLocalDateParts(now || new Date(), event.timeZone).iso;
    var hiddenFromDate = addCalendarDays(event.endDate, DISPLAY_DAYS_AFTER_END + 1);

    if (currentDate < event.startDate) return STATUS.UPCOMING;
    if (currentDate <= event.endDate) return STATUS.IN_PROGRESS;
    if (currentDate < hiddenFromDate) return STATUS.CONCLUDED;
    return STATUS.HIDDEN;
  }

  function getVisibleThroughDate(event) {
    return addCalendarDays(event.endDate, DISPLAY_DAYS_AFTER_END);
  }

  function isVisibleEvent(event, now) {
    return getEventStatus(event, now) !== STATUS.HIDDEN;
  }

  function sortVisibleEvents(events, now) {
    return events
      .map(function (event) {
        return Object.assign({}, event, { status: getEventStatus(event, now) });
      })
      .filter(function (event) { return event.status !== STATUS.HIDDEN; })
      .sort(function (a, b) {
        var rank = {};
        rank[STATUS.IN_PROGRESS] = 0;
        rank[STATUS.UPCOMING] = 1;
        rank[STATUS.CONCLUDED] = 2;
        var rankDiff = rank[a.status] - rank[b.status];
        if (rankDiff) return rankDiff;
        if (a.status === STATUS.CONCLUDED) return b.endDate.localeCompare(a.endDate);
        return a.startDate.localeCompare(b.startDate);
      });
  }

  return {
    DISPLAY_DAYS_AFTER_END: DISPLAY_DAYS_AFTER_END,
    STATUS: STATUS,
    addCalendarDays: addCalendarDays,
    getLocalDateParts: getLocalDateParts,
    getEventStatus: getEventStatus,
    getVisibleThroughDate: getVisibleThroughDate,
    isVisibleEvent: isVisibleEvent,
    sortVisibleEvents: sortVisibleEvents
  };
}));
