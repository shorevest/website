/* ==========================================================================
   ShoreVest One — Home, preview shells, and Tools hub
   Home is the calm personal workbench: Needs you, Today, Waiting elsewhere,
   and nothing else. Card actions are lightweight local demonstration only —
   no emails, no external systems, no background processing. Resolving a card
   moves it out of "Needs you" with a brief confirmation and an undo.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var R = root.SVPortalRules;
  var S = root.SVPortalStore;
  var P = root.SVPortalPersonas;
  var el = U.el, esc = U.esc, frag = U.frag;

  /* Per-session, in-memory record of resolved cards, keyed by persona + card.
     Not persisted: reloading resets the demonstration, which is intended. */
  SVOps.state.homeResolved = SVOps.state.homeResolved || {};

  function personaFor(user) {
    return (user && user.personaId && P.byId(user.personaId)) || null;
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function firstName(user) {
    return String(user.name || '').split(' ')[0] || user.name;
  }

  /* ── Home ───────────────────────────────────────────────────────────────── */

  SVOps.views.home = function (container, user) {
    var persona = personaFor(user);
    var page = el('div', { class: 'ops-content home' });

    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'Home' }),
      el('h1', { class: 'ops-h1', text: greeting() + ', ' + firstName(user) }),
      el('p', { class: 'ops-lede', text: 'What needs you now, what is happening today, and what is waiting elsewhere.' })
    ]));

    if (!persona) {
      page.appendChild(U.stateScreen('empty', 'No Home configured',
        'This role has no Home view. Use Tools to reach the operational prototype.',
        [el('a', { class: 'btn', href: '#/tools', text: 'Go to Tools' })]));
      container.appendChild(page);
      return;
    }

    var home = persona.home;
    var resolved = SVOps.state.homeResolved[persona.id] || (SVOps.state.homeResolved[persona.id] = {});

    /* ── Needs you ─────────────────────────────────────────────────────── */
    var open = home.needsYou.filter(function (c) { return !resolved[c.id]; });

    var needs = el('section', { class: 'home-section', 'aria-labelledby': 'home-needs' });
    needs.appendChild(el('div', { class: 'home-section__head' }, [
      el('h2', { class: 'home-section__title', id: 'home-needs', text: 'Needs you' }),
      el('span', { class: 'home-section__count', text: open.length ? String(open.length) : '' })
    ]));

    if (!open.length) {
      needs.appendChild(el('div', { class: 'home-empty' }, [
        el('p', { class: 'home-empty__title', text: 'Nothing needs you right now.' }),
        el('p', { class: 'home-empty__sub', text: 'Anything new will appear here. Today and Waiting elsewhere are below.' })
      ]));
    } else {
      var cards = el('div', { class: 'home-cards' });
      home.needsYou.forEach(function (card) {
        cards.appendChild(renderCard(persona, card, resolved, function () {
          SVOps.views.home(replace(container), user);
        }));
      });
      needs.appendChild(cards);
    }
    page.appendChild(needs);

    /* ── Today + Waiting elsewhere ─────────────────────────────────────── */
    var lists = el('div', { class: 'home-lists' });
    lists.appendChild(renderList('Today', home.today, function (item) {
      return el('div', { class: 'home-list__item' }, [
        el('span', { class: 'home-list__time', text: item.time || '' }),
        el('span', { class: 'home-list__body' }, [
          el('span', { class: 'home-list__name', text: item.title }),
          el('span', { class: 'home-list__note home-list__note--' + (item.tone || 'calm'), text: item.note })
        ])
      ]);
    }, 'No meetings or deadlines today.'));

    lists.appendChild(renderList('Waiting elsewhere', home.waiting, function (item) {
      return el('div', { class: 'home-list__item' }, [
        el('span', { class: 'home-list__body' }, [
          el('span', { class: 'home-list__name', text: item.title }),
          el('span', { class: 'home-list__note home-list__note--waiting', text: item.note })
        ])
      ]);
    }, 'Nothing is waiting on others.'));
    page.appendChild(lists);

    container.appendChild(page);
  };

  /* Clear a container and hand it back — used to re-render Home in place. */
  function replace(container) { container.innerHTML = ''; return container; }

  function renderList(title, items, rowFn, emptyText) {
    var panel = el('section', { class: 'home-list', 'aria-label': title });
    panel.appendChild(el('h2', { class: 'home-list__title', text: title }));
    if (!items || !items.length) {
      panel.appendChild(el('p', { class: 'home-list__empty', text: emptyText }));
      return panel;
    }
    var body = el('div', { class: 'home-list__items' });
    items.slice(0, 3).forEach(function (item) { body.appendChild(rowFn(item)); });
    panel.appendChild(body);
    return panel;
  }

  /* ── One decision card ──────────────────────────────────────────────────── */

  function renderCard(persona, card, resolved, rerender) {
    var state = resolved[card.id];
    var node = el('article', {
      class: 'home-card' + (card.tone === 'urgent' ? ' home-card--urgent' : '') + (state ? ' is-resolved' : '')
    });

    if (state) {
      /* Resolved: brief confirmation with undo. */
      node.appendChild(el('div', { class: 'home-card__resolved' }, [
        el('div', {}, [
          el('p', { class: 'home-card__resolved-title', text: card.title }),
          el('p', { class: 'home-card__resolved-note', text: state.done + '.' })
        ]),
        el('button', {
          class: 'home-card__undo', type: 'button', text: 'Undo',
          onclick: function () { delete resolved[card.id]; rerender(); }
        })
      ]));
      return node;
    }

    node.appendChild(el('h3', { class: 'home-card__title', text: card.title }));

    var ctx = el('div', { class: 'home-card__context' });
    (card.context || []).forEach(function (line) { ctx.appendChild(el('p', { text: line })); });
    node.appendChild(ctx);

    node.appendChild(el('div', { class: 'home-card__rec' }, [
      el('span', { class: 'home-card__rec-label', text: card.recLabel || 'ShoreVest One suggests' }),
      el('p', { class: 'home-card__rec-text', text: card.recommendation })
    ]));

    var actions = el('div', { class: 'home-card__actions' });
    (card.actions || []).slice(0, 3).forEach(function (action) {
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn btn--sm' + (action.intent === 'primary' ? ' btn--primary' : ' btn--quiet'),
        text: action.label,
        onclick: function () {
          resolved[card.id] = { action: action.label, done: action.done || (action.label + ' recorded') };
          U.toast(card.title + ' — ' + (action.done || action.label));
          rerender();
        }
      }));
    });
    node.appendChild(actions);

    if (card.detail) {
      node.appendChild(el('button', {
        type: 'button', class: 'home-card__why', text: 'Why am I seeing this?',
        onclick: function () { openDetail(card); }
      }));
    }

    return node;
  }

  function openDetail(card) {
    var body = el('div', {});
    body.appendChild(el('section', {}, [
      el('h4', { text: 'Context' }),
      (function () {
        var wrap = el('div', { class: 'drawer-copy' });
        (card.context || []).forEach(function (line) { wrap.appendChild(el('p', { text: line })); });
        return wrap;
      })()
    ]));
    body.appendChild(el('section', {}, [
      el('h4', { text: card.recLabel || 'ShoreVest One suggests' }),
      el('p', { class: 'drawer-copy', text: card.recommendation })
    ]));
    body.appendChild(el('section', {}, [
      el('h4', { text: 'Why this is here' }),
      el('p', { class: 'drawer-copy', text: card.detail })
    ]));
    body.appendChild(U.notice('info',
      '<strong>Demonstration</strong> This explanation is synthetic. No live systems are consulted.'));
    U.drawer(card.title, body);
  }

  /* ── Preview shells for future-facing navigation ────────────────────────── */

  SVOps.views.preview = function (container, user, params) {
    var key = params && params[0];
    var info = key && P.preview(key);
    var page = el('div', { class: 'ops-content ops-content--narrow' });

    if (!info) {
      page.appendChild(el('div', { class: 'ops-pagehead' }, [
        el('p', { class: 'ops-label', text: 'ShoreVest One' }),
        el('h1', { class: 'ops-h1', text: 'Coming soon' }),
        el('p', { class: 'ops-lede', text: 'This area is not part of the current demonstration.' })
      ]));
      page.appendChild(el('a', { class: 'btn', href: '#/home', text: 'Back to Home' }));
      container.appendChild(page);
      return;
    }

    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: info.label }),
      el('h1', { class: 'ops-h1', text: info.title }),
      el('p', { class: 'ops-lede', text: info.lede })
    ]));

    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">What will live here</h2>' +
      '<span class="st st--review">Demonstration — not yet built</span></div>'));
    var ul = el('ul', { class: 'home-preview__list' });
    info.points.forEach(function (pt) { ul.appendChild(el('li', { text: pt })); });
    panel.appendChild(ul);
    page.appendChild(panel);

    page.appendChild(U.notice('info',
      '<strong>Demonstration content</strong> This is a preview of where the ' + esc(info.label) +
      ' workflow will live. It performs no real actions and connects to no external systems.'));

    page.appendChild(el('a', { class: 'btn btn--quiet', href: '#/home', text: 'Back to Home' }));
    container.appendChild(page);
  };

  /* ── Tools hub — the preserved operational prototype ────────────────────── */

  SVOps.views.tools = function (container, user) {
    var page = el('div', { class: 'ops-content' });
    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'Tools' }),
      el('h1', { class: 'ops-h1', text: 'Operational tools' }),
      el('p', { class: 'ops-lede', text: 'The existing list-processing and rules prototype. Upload a list, confirm how it was interpreted, and run a controlled process. The system may stop unnecessarily, but it must never continue incorrectly.' })
    ]));

    var modules = [
      { n: '01', name: 'Process a List', desc: 'Upload Excel, CSV, or a Salesforce report and generate a controlled output.', hash: '#/process', cap: 'submitFiles' },
      { n: '02', name: 'Weekly Reporting', desc: 'Generate the Weekly Outreach and Coverage Snapshot from approved source data.', hash: '#/weekly', cap: 'submitFiles' },
      { n: '03', name: 'Salesforce Data Quality', desc: 'Run contact, account, opportunity, ownership, next-step, and stale-record checks.', hash: '#/dataquality', cap: 'submitFiles' },
      { n: '04', name: 'Outreach Preparation', desc: 'Identify existing contacts, exclude prior outreach, assign coverage, prepare draft-ready outputs.', hash: '#/outreach', cap: 'submitFiles' },
      { n: '05', name: 'Review Exceptions', desc: 'Resolve ambiguous, invalid, duplicate, blocked, or unmatched records.', hash: '#/exceptions', cap: 'reviewExceptions' },
      { n: '06', name: 'Previous Runs', desc: 'Prior batches, outputs, exceptions, approvals, errors, and audit history.', hash: '#/runs', cap: null },
      { n: '07', name: 'Administration', desc: 'Templates, owners, mappings, rules, blocked domains, exclusion lists, and roles.', hash: '#/admin', cap: 'administer' },
      { n: '08', name: 'Monitoring', desc: 'Processing health, stuck batches, reconciliation failures, and alerts.', hash: '#/monitoring', cap: 'viewMonitoring' }
    ].filter(function (m) { return !m.cap || R.can(user.role, m.cap); });

    var grid = el('div', { class: 'ops-grid ops-grid--3' });
    modules.forEach(function (m) {
      grid.appendChild(el('a', { class: 'ops-module', href: m.hash }, [
        el('span', { class: 'ops-module__num', text: m.n }),
        el('p', { class: 'ops-module__name', text: m.name }),
        el('p', { class: 'ops-module__desc', text: m.desc })
      ]));
    });
    page.appendChild(grid);

    /* Recent batches — operational, kept as-is (no scores, no metric row). */
    var batches = S.getBatches();
    var mine = R.can(user.role, 'viewAllBatches') ? batches : batches.filter(function (b) { return b.submittedBy === user.name; });
    if (mine.length) {
      var recent = el('div', { class: 'ops-panel', style: 'margin-top:22px' });
      recent.appendChild(frag('<div class="ops-panel__head"><h2 class="ops-panel__title">Recent batches</h2>' +
        '<a href="#/runs" class="ops-meta">View all →</a></div>'));
      recent.appendChild(U.table([
        { key: 'originalFilename', label: 'File', html: function (b) { return esc(b.originalFilename); } },
        { key: 'savedProcessName', label: 'Process', html: function (b) { return esc(b.savedProcessName); } },
        { key: 'status', label: 'Status', html: function (b) { return U.statusHtml(b.status); } },
        { key: 'totalRows', label: 'Rows', num: true, html: function (b) { return U.fmtInt(b.totalRows); } },
        { key: 'submittedAt', label: 'Submitted', html: function (b) { return esc(U.fmtDateTime(b.submittedAt)); } }
      ], mine.slice(0, 6), { onRowClick: function (b) { location.hash = '#/batch/' + b.batchId; } }));
      page.appendChild(recent);
    } else {
      page.appendChild(el('div', { class: 'ops-panel', style: 'margin-top:22px' }, [
        U.stateScreen('empty', 'No batches yet',
          'Start by processing a list. In demonstration mode you can use the sample files described in the documentation.',
          [el('a', { class: 'btn btn--primary', href: '#/process', text: 'Process a List' })])
      ]));
    }

    container.appendChild(page);
  };

})(typeof self !== 'undefined' ? self : this);
