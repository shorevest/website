/* ========================================================================== 
   ShoreVest One - guided My Work override

   Turns the shared queue into a simple execution page: start with one item,
   choose one clear category, read the next action, then open the right place.
   All state changes remain browser-only demonstration behaviour.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var P = root.SVPortalPersonas;
  if (!SVOps || !SVOps.ui || !P) return;

  var U = SVOps.ui;
  var el = U.el;

  var FILTERS = [
    { key: 'do-now', label: 'Do now', help: 'Work you can move forward now.' },
    { key: 'waiting', label: 'Waiting on others', help: 'Nothing to do until the follow-up point.' },
    { key: 'suggestion', label: 'Suggestions to review', help: 'Accept or dismiss before these become work.' },
    { key: 'on-hold', label: 'Paused', help: 'Deliberately stopped for now.' },
    { key: 'done', label: 'Completed', help: 'Recently handled work.' },
    { key: 'all', label: 'All work', help: 'Everything in one list.' }
  ];

  var STATE_LABEL = {
    'system-verified': 'System-verified',
    'human-confirmed': 'Human-confirmed',
    'inferred': 'Inferred',
    'conflicting': 'Conflicting',
    'stale': 'Stale',
    'unavailable': 'Not yet available'
  };

  function resolvedMap() {
    return SVOps.state.workResolved || (SVOps.state.workResolved = {});
  }

  function movedMap() {
    return SVOps.state.workMoved || (SVOps.state.workMoved = {});
  }

  function isResolved(id) {
    return !!resolvedMap()[id];
  }

  function effectiveBucket(item) {
    if (isResolved(item.id)) return 'done';
    return movedMap()[item.id] || item.bucket;
  }

  function transition(item, bucket, note) {
    if (bucket === 'done') {
      resolvedMap()[item.id] = { note: note || 'Handled in this demonstration.' };
      delete movedMap()[item.id];
      return;
    }
    delete resolvedMap()[item.id];
    movedMap()[item.id] = bucket;
  }

  function undo(item) {
    delete resolvedMap()[item.id];
    delete movedMap()[item.id];
  }

  function currentFilter() {
    return SVOps.state.myWorkFilter || 'do-now';
  }

  function setFilter(key) {
    SVOps.state.myWorkFilter = key;
  }

  function itemsFor(key) {
    var items = (P.workItems || []).slice();
    if (key === 'all') {
      return items.sort(function (a, b) {
        return filterIndex(effectiveBucket(a)) - filterIndex(effectiveBucket(b));
      });
    }
    return items.filter(function (item) {
      return effectiveBucket(item) === key;
    });
  }

  function filterIndex(key) {
    for (var i = 0; i < FILTERS.length; i += 1) {
      if (FILTERS[i].key === key) return i;
    }
    return FILTERS.length;
  }

  function filterConfig(key) {
    for (var i = 0; i < FILTERS.length; i += 1) {
      if (FILTERS[i].key === key) return FILTERS[i];
    }
    return FILTERS[0];
  }

  function plural(count, one, many) {
    return count === 1 ? one : many;
  }

  function rerender(container, user) {
    container.innerHTML = '';
    SVOps.views.myWork(container, user);
  }

  function workspaceActionLabel(item) {
    if (item.detail) return 'Review decision';
    var labels = {
      'Outreach': 'Open Outreach',
      'Meetings': 'Open Meetings',
      'Diligence & Requests': 'Open Diligence',
      'Relationships': 'Open Relationships',
      'Investor Intelligence': 'Open Intelligence',
      'Materials & Delivery': 'Open Materials',
      'Compliance': 'Open item',
      'Approvals': 'Open approval',
      'Workflow Rules': 'Open suggestion',
      'Recovery & Enforcement': 'Open item'
    };
    return labels[item.workspace] || 'Open item';
  }

  function statusTone(bucket) {
    if (bucket === 'do-now') return 'action';
    if (bucket === 'waiting') return 'waiting';
    if (bucket === 'suggestion') return 'review';
    if (bucket === 'on-hold') return 'paused';
    return 'done';
  }

  function metaPill(label, value) {
    if (!value) return null;
    return el('span', { class: 'guided-work-pill' }, [
      el('span', { class: 'guided-work-pill__label', text: label }),
      el('span', { class: 'guided-work-pill__value', text: value })
    ]);
  }

  function appendMeta(row, item, bucket) {
    var values = [
      metaPill('Workspace', item.workspace),
      metaPill('Owner', item.owner),
      metaPill('Due', item.due),
      metaPill('Waiting on', bucket === 'waiting' ? item.waitingOn : null)
    ];
    values.forEach(function (node) {
      if (node) row.appendChild(node);
    });
  }

  function openDecision(item, container, user) {
    var detail = item.detail;
    var body = el('div', {});
    body.appendChild(U.notice('info', '<strong>Preview only</strong> Nothing is sent or changed outside this browser.'));

    if (detail.context && detail.context.length) {
      var context = el('section', {}, [el('h4', { text: 'What is happening' })]);
      detail.context.forEach(function (line) {
        context.appendChild(el('p', { class: 'drawer-copy', text: line }));
      });
      body.appendChild(context);
    }

    body.appendChild(el('section', {}, [
      el('h4', { text: 'Recommended action' }),
      el('p', { class: 'drawer-copy', text: detail.recommendation }),
      el('p', { class: 'drawer-copy', text: detail.reasoning })
    ]));

    if (detail.evidence && detail.evidence.length) {
      var evidence = el('ul', { class: 'evidence-list' });
      detail.evidence.forEach(function (entry) {
        evidence.appendChild(el('li', { class: 'evidence-item' }, [
          el('span', {
            class: 'evidence-item__state evidence-item__state--' + entry.state,
            text: STATE_LABEL[entry.state] || entry.state
          }),
          el('span', { class: 'evidence-item__body' }, [
            el('span', { class: 'evidence-item__label', text: entry.label }),
            el('span', { class: 'evidence-item__detail', text: entry.detail })
          ])
        ]));
      });
      body.appendChild(el('section', {}, [el('h4', { text: 'Evidence' })]));
      body.appendChild(evidence);
    }

    if (detail.policy) {
      body.appendChild(el('section', {}, [
        el('h4', { text: 'Rule that applies' }),
        el('p', { class: 'drawer-copy', text: detail.policy })
      ]));
    }

    var drawer = U.drawer(item.action, body);
    body.appendChild(el('div', { class: 'drawer-actions' }, [
      el('button', {
        type: 'button',
        class: 'btn btn--primary',
        text: 'Mark complete',
        onclick: function () {
          transition(item, 'done', 'Completed in this demonstration.');
          U.toast(item.action + ' — marked complete in this demonstration.');
          drawer.close();
          rerender(container, user);
        }
      }),
      el('button', {
        type: 'button',
        class: 'btn btn--quiet',
        text: 'Close',
        onclick: function () { drawer.close(); }
      })
    ]));
  }

  function primaryAction(item, container, user) {
    if (item.detail) {
      return el('button', {
        type: 'button',
        class: 'btn btn--sm btn--primary',
        text: workspaceActionLabel(item),
        onclick: function () { openDecision(item, container, user); }
      });
    }
    return el('a', {
      class: 'btn btn--sm btn--primary',
      href: item.link,
      text: workspaceActionLabel(item)
    });
  }

  function workActions(item, bucket, container, user) {
    var row = el('div', { class: 'guided-work-card__actions' });
    row.appendChild(primaryAction(item, container, user));

    if (bucket === 'do-now') {
      row.appendChild(el('button', {
        type: 'button',
        class: 'btn btn--sm btn--quiet',
        text: 'Mark complete',
        onclick: function () {
          transition(item, 'done', 'Completed in this demonstration.');
          U.toast(item.action + ' — marked complete in this demonstration.');
          rerender(container, user);
        }
      }));
    } else if (bucket === 'waiting') {
      row.appendChild(el('button', {
        type: 'button',
        class: 'btn btn--sm btn--quiet',
        text: 'Record reminder',
        onclick: function () {
          U.toast(item.action + ' — reminder recorded in this demonstration.');
        }
      }));
    } else if (bucket === 'suggestion') {
      row.appendChild(el('button', {
        type: 'button',
        class: 'btn btn--sm btn--quiet',
        text: 'Accept into Do now',
        onclick: function () {
          transition(item, 'do-now');
          setFilter('do-now');
          U.toast(item.action + ' — moved into Do now.');
          rerender(container, user);
        }
      }));
      row.appendChild(el('button', {
        type: 'button',
        class: 'btn btn--sm btn--quiet',
        text: 'Dismiss',
        onclick: function () {
          transition(item, 'done', 'Suggestion dismissed in this demonstration.');
          U.toast(item.action + ' — suggestion dismissed.');
          rerender(container, user);
        }
      }));
    } else if (bucket === 'on-hold') {
      row.appendChild(el('button', {
        type: 'button',
        class: 'btn btn--sm btn--quiet',
        text: 'Move to Do now',
        onclick: function () {
          transition(item, 'do-now');
          setFilter('do-now');
          U.toast(item.action + ' — moved into Do now.');
          rerender(container, user);
        }
      }));
    } else if (bucket === 'done' && (isResolved(item.id) || movedMap()[item.id])) {
      row.appendChild(el('button', {
        type: 'button',
        class: 'btn btn--sm btn--quiet',
        text: 'Undo',
        onclick: function () {
          undo(item);
          U.toast(item.action + ' — restored to its original section.');
          rerender(container, user);
        }
      }));
    }

    return row;
  }

  function workCard(item, container, user) {
    var bucket = effectiveBucket(item);
    var tone = statusTone(bucket);
    var card = el('article', { class: 'guided-work-card guided-work-card--' + tone });

    card.appendChild(el('div', { class: 'guided-work-card__top' }, [
      el('span', { class: 'guided-work-card__state', text: filterConfig(bucket).label }),
      el('span', { class: 'guided-work-card__status', text: isResolved(item.id) ? resolvedMap()[item.id].note : item.status })
    ]));

    card.appendChild(el('h3', { class: 'guided-work-card__title', text: item.action }));

    var meta = el('div', { class: 'guided-work-card__meta' });
    appendMeta(meta, item, bucket);
    card.appendChild(meta);

    if (bucket !== 'done') {
      card.appendChild(el('div', { class: 'guided-work-next' }, [
        el('span', { class: 'guided-work-next__label', text: 'Next action' }),
        el('p', { class: 'guided-work-next__text', text: item.nextStep })
      ]));
    }

    card.appendChild(el('details', { class: 'guided-work-reason' }, [
      el('summary', { text: 'Why this is here' }),
      el('p', { text: item.reason })
    ]));

    card.appendChild(workActions(item, bucket, container, user));
    return card;
  }

  function startCard(item, container, user) {
    if (!item) {
      return el('section', { class: 'guided-work-start guided-work-start--clear' }, [
        el('div', {}, [
          el('span', { class: 'guided-work-start__eyebrow', text: 'Start here' }),
          el('h2', { class: 'guided-work-start__title', text: 'Nothing is ready for action.' }),
          el('p', { class: 'guided-work-start__copy', text: 'Check Waiting on others for follow-ups or review another category.' })
        ]),
        el('button', {
          type: 'button',
          class: 'btn btn--quiet',
          text: 'View waiting items',
          onclick: function () {
            setFilter('waiting');
            rerender(container, user);
          }
        })
      ]);
    }

    return el('section', { class: 'guided-work-start', 'aria-labelledby': 'guided-work-start-title' }, [
      el('div', { class: 'guided-work-start__copyblock' }, [
        el('span', { class: 'guided-work-start__eyebrow', text: 'Start with this' }),
        el('h2', { class: 'guided-work-start__title', id: 'guided-work-start-title', text: item.action }),
        el('p', { class: 'guided-work-start__copy', text: item.nextStep }),
        el('p', { class: 'guided-work-start__meta', text: item.workspace + ' · ' + item.owner + (item.due ? ' · ' + item.due : '') })
      ]),
      el('div', { class: 'guided-work-start__action' }, [primaryAction(item, container, user)])
    ]);
  }

  function filterButton(config, active, count, container, user) {
    return el('button', {
      type: 'button',
      class: 'guided-work-filter' + (active ? ' is-active' : ''),
      'aria-pressed': active ? 'true' : 'false',
      onclick: function () {
        setFilter(config.key);
        rerender(container, user);
      }
    }, [
      el('span', { class: 'guided-work-filter__label', text: config.label }),
      el('span', { class: 'guided-work-filter__count', text: String(count) })
    ]);
  }

  function countFor(key) {
    return itemsFor(key).length;
  }

  SVOps.views.myWork = function (container, user) {
    container.setAttribute('data-view', 'my-work');

    var selected = currentFilter();
    var selectedConfig = filterConfig(selected);
    var selectedItems = itemsFor(selected);
    var doNow = itemsFor('do-now');
    var page = el('div', { class: 'ops-content guided-work' });

    page.appendChild(el('header', { class: 'guided-work-head' }, [
      el('div', {}, [
        el('p', { class: 'ops-label', text: 'My Work' }),
        el('h1', { class: 'ops-h1 guided-work-head__title', text: 'What you need to do' }),
        el('p', {
          class: 'guided-work-head__lede',
          text: 'Start with Do now. Each item shows the exact next action and opens the workspace where the work belongs.'
        })
      ]),
      el('a', { class: 'guided-work-head__home', href: '#/home', text: 'Back to Home' })
    ]));

    page.appendChild(el('p', {
      class: 'guided-work-demo-note',
      text: 'Demo data only. Nothing is sent, approved or published from this page.'
    }));

    page.appendChild(startCard(doNow[0] || null, container, user));

    var nav = el('nav', { class: 'guided-work-filters', 'aria-label': 'My Work categories' });
    FILTERS.forEach(function (config) {
      nav.appendChild(filterButton(config, config.key === selected, countFor(config.key), container, user));
    });
    page.appendChild(nav);

    page.appendChild(el('section', { class: 'guided-work-listhead', 'aria-labelledby': 'guided-work-list-title' }, [
      el('div', {}, [
        el('h2', { class: 'guided-work-listhead__title', id: 'guided-work-list-title', text: selectedConfig.label }),
        el('p', { class: 'guided-work-listhead__help', text: selectedConfig.help })
      ]),
      el('span', {
        class: 'guided-work-listhead__count',
        text: selectedItems.length + ' ' + plural(selectedItems.length, 'item', 'items')
      })
    ]));

    var list = el('div', { class: 'guided-work-list' });
    if (!selectedItems.length) {
      list.appendChild(el('div', { class: 'guided-work-empty' }, [
        el('h3', { text: 'Nothing in this section.' }),
        el('p', { text: selected === 'do-now' ? 'You have no work ready to action.' : 'Choose another category above.' })
      ]));
    } else {
      selectedItems.forEach(function (item) {
        list.appendChild(workCard(item, container, user));
      });
    }
    page.appendChild(list);

    page.appendChild(el('details', { class: 'guided-work-how' }, [
      el('summary', { text: 'How to use this page' }),
      el('ol', {}, [
        el('li', { text: 'Start in Do now.' }),
        el('li', { text: 'Read the Next action box.' }),
        el('li', { text: 'Use the main button to open the correct workspace.' })
      ])
    ]));

    container.appendChild(page);
  };
})(typeof self !== 'undefined' ? self : this);
