/* ========================================================================== 
   ShoreVest One - guided Home override

   Makes the first screen understandable without prior knowledge of the portal.
   My Work remains the complete queue; this Home view explains what the product
   is, gives one obvious starting point, and translates internal queue states
   into plain language.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var P = root.SVPortalPersonas;
  if (!SVOps || !SVOps.ui || !P) return;

  var U = SVOps.ui;
  var el = U.el;

  function greeting() {
    var hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function isResolved(id) {
    return !!(SVOps.state.workResolved && SVOps.state.workResolved[id]);
  }

  function openItems(section) {
    return P.homeItems(section).filter(function (item) {
      return !isResolved(item.id);
    });
  }

  function plural(count, one, many) {
    return count === 1 ? one : many;
  }

  function actionCard(title, description, href, label, primary) {
    return el('a', {
      class: 'guided-action' + (primary ? ' guided-action--primary' : ''),
      href: href
    }, [
      el('span', { class: 'guided-action__title', text: title }),
      el('span', { class: 'guided-action__description', text: description }),
      el('span', { class: 'guided-action__link', text: label + ' →' })
    ]);
  }

  function attentionGroup(config, items) {
    var section = el('section', {
      class: 'guided-attention__group',
      'aria-labelledby': 'guided-' + config.key
    });

    section.appendChild(el('div', { class: 'guided-attention__head' }, [
      el('div', {}, [
        el('h3', {
          class: 'guided-attention__title',
          id: 'guided-' + config.key,
          text: config.title
        }),
        el('p', { class: 'guided-attention__help', text: config.help })
      ]),
      el('span', {
        class: 'guided-attention__count',
        text: String(items.length),
        'aria-label': items.length + ' ' + plural(items.length, 'item', 'items')
      })
    ]));

    if (!items.length) {
      section.appendChild(el('p', {
        class: 'guided-attention__empty',
        text: config.empty
      }));
      return section;
    }

    var list = el('div', { class: 'guided-attention__list' });
    items.forEach(function (item) {
      list.appendChild(el('a', {
        class: 'guided-attention__item',
        href: item.link
      }, [
        el('span', { class: 'guided-attention__item-text', text: item.home.summary }),
        el('span', {
          class: 'guided-attention__item-meta',
          text: item.workspace + ' · ' + item.owner
        })
      ]));
    });
    section.appendChild(list);
    return section;
  }

  function glossaryItem(term, description) {
    return el('div', { class: 'guided-glossary__item' }, [
      el('dt', { text: term }),
      el('dd', { text: description })
    ]);
  }

  SVOps.views.home = function (container) {
    container.setAttribute('data-view', 'home');

    var groups = [
      {
        key: 'decide',
        title: 'Decisions needed',
        help: 'Choose an option before the work can continue.',
        empty: 'No decisions are waiting.'
      },
      {
        key: 'do',
        title: 'Ready to do',
        help: 'These items can be completed now.',
        empty: 'Nothing is ready for action.'
      },
      {
        key: 'waiting',
        title: 'Waiting on others',
        help: 'No action is needed unless the follow-up date arrives.',
        empty: 'Nothing is waiting on someone else.'
      },
      {
        key: 'warnings',
        title: 'Problems to fix',
        help: 'These items may block work or rely on unreliable information.',
        empty: 'No problems are currently flagged.'
      }
    ];

    var groupedItems = {};
    var totalOpen = 0;
    groups.forEach(function (group) {
      groupedItems[group.key] = openItems(group.key);
      totalOpen += groupedItems[group.key].length;
    });

    var recommended = (P.startHere || [])[0] || null;
    var page = el('div', { class: 'ops-content home guided-home' });

    page.appendChild(el('section', { class: 'guided-intro', 'aria-labelledby': 'guided-home-title' }, [
      el('div', { class: 'guided-intro__copy' }, [
        el('p', { class: 'ops-label', text: greeting() }),
        el('h1', { class: 'ops-h1 guided-intro__title', id: 'guided-home-title', text: 'Welcome to ShoreVest One' }),
        el('p', {
          class: 'guided-intro__lede',
          text: 'ShoreVest One is the internal place to see work that needs attention and open the right workspace. When you are unsure where to start, open My Work.'
        })
      ]),
      el('div', { class: 'guided-intro__status' }, [
        el('strong', {
          class: 'guided-intro__number',
          text: String(totalOpen)
        }),
        el('span', {
          class: 'guided-intro__status-copy',
          text: plural(totalOpen, 'item needs attention', 'items need attention')
        }),
        el('a', { class: 'btn btn--primary guided-intro__button', href: '#/my-work', text: 'Open My Work' })
      ])
    ]));

    page.appendChild(el('p', {
      class: 'guided-demo-note',
      text: 'Demo data only. Nothing shown here is live, sent or published.'
    }));

    var start = el('section', { class: 'guided-start', 'aria-labelledby': 'guided-start-title' });
    start.appendChild(el('div', { class: 'guided-sectionhead' }, [
      el('div', {}, [
        el('h2', { class: 'guided-sectionhead__title', id: 'guided-start-title', text: 'Choose what you need to do' }),
        el('p', { class: 'guided-sectionhead__sub', text: 'The three most common starting points are below. Everything else is in the left menu.' })
      ])
    ]));

    var actions = el('div', { class: 'guided-actions' });
    actions.appendChild(actionCard(
      'See everything assigned to me',
      'Use My Work for the complete queue, including tasks, decisions, waiting items and suggestions.',
      '#/my-work',
      'Open My Work',
      true
    ));
    actions.appendChild(actionCard(
      'Continue outreach',
      'Find people, review proposed contacts, prepare messages and assemble approval packages.',
      '#/outreach',
      'Open Outreach',
      false
    ));
    actions.appendChild(actionCard(
      'Find a specialist tool',
      'Open the full catalogue for list processing, reporting, data quality, administration and other tools.',
      '#/tools',
      'Browse Tools',
      false
    ));
    start.appendChild(actions);

    if (recommended) {
      start.appendChild(el('div', { class: 'guided-recommended' }, [
        el('div', {}, [
          el('span', { class: 'guided-recommended__label', text: 'Recommended next' }),
          el('strong', { class: 'guided-recommended__title', text: recommended.label }),
          el('span', { class: 'guided-recommended__sub', text: recommended.sub || '' })
        ]),
        el('a', { class: 'btn btn--quiet', href: recommended.hash, text: 'Open' })
      ]));
    }
    page.appendChild(start);

    var attention = el('section', { class: 'guided-attention', 'aria-labelledby': 'guided-attention-title' });
    attention.appendChild(el('div', { class: 'guided-sectionhead guided-sectionhead--split' }, [
      el('div', {}, [
        el('h2', { class: 'guided-sectionhead__title', id: 'guided-attention-title', text: 'What needs attention now' }),
        el('p', { class: 'guided-sectionhead__sub', text: 'This is a short summary. My Work contains the full detail and next step for every item.' })
      ]),
      el('a', { class: 'guided-sectionhead__link', href: '#/my-work', text: 'View the full queue →' })
    ]));

    var attentionGrid = el('div', { class: 'guided-attention__grid' });
    groups.forEach(function (group) {
      attentionGrid.appendChild(attentionGroup(group, groupedItems[group.key]));
    });
    attention.appendChild(attentionGrid);
    page.appendChild(attention);

    var help = el('section', { class: 'guided-help', 'aria-labelledby': 'guided-help-title' });
    help.appendChild(el('div', { class: 'guided-sectionhead' }, [
      el('div', {}, [
        el('h2', { class: 'guided-sectionhead__title', id: 'guided-help-title', text: 'How ShoreVest One is organized' }),
        el('p', { class: 'guided-sectionhead__sub', text: 'Use these definitions when deciding where to go.' })
      ])
    ]));
    help.appendChild(el('dl', { class: 'guided-glossary' }, [
      glossaryItem('Home', 'A short overview of the few items that need attention across the system.'),
      glossaryItem('My Work', 'The complete queue of work assigned to you, with the owner, status and next step.'),
      glossaryItem('Workspaces', 'The main areas where relationship, outreach, meeting, diligence and firm work is managed.'),
      glossaryItem('Tools', 'Specialist utilities for processing files, reports, data quality and administration.')
    ]));
    page.appendChild(help);

    var recent = P.homeItems('recent');
    if (recent.length) {
      var recentSection = el('section', { class: 'guided-recent', 'aria-labelledby': 'guided-recent-title' });
      recentSection.appendChild(el('div', { class: 'guided-sectionhead' }, [
        el('div', {}, [
          el('h2', { class: 'guided-sectionhead__title', id: 'guided-recent-title', text: 'Recently completed' }),
          el('p', { class: 'guided-sectionhead__sub', text: 'For awareness only. No action is needed.' })
        ])
      ]));
      var recentList = el('div', { class: 'guided-recent__list' });
      recent.forEach(function (item) {
        recentList.appendChild(el('a', { class: 'guided-recent__item', href: item.link }, [
          el('span', { text: item.home.summary }),
          el('span', { class: 'guided-recent__meta', text: item.workspace })
        ]));
      });
      recentSection.appendChild(recentList);
      page.appendChild(recentSection);
    }

    container.appendChild(page);
  };
})(typeof self !== 'undefined' ? self : this);
