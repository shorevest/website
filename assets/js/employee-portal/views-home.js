/* ==========================================================================
   ShoreVest One — Home, My Work, workspaces, preview shells, and Tools hub

   Home and My Work are two views of ONE shared queue (SVPortalPersonas.workItems).

   Home is short and selective: where attention is needed across ShoreVest One —
   Start here, Decide, Do, Waiting, Warnings, and Recent work. It shows a handful
   of summary lines, each linking back to the same underlying item. It does not
   carry the operational detail.

   My Work is the full cross-workspace execution queue for the motherboard,
   grouped by state — Do now, Waiting, Suggestions, On hold, Done. Each item has
   one action, one owner, one reason, one status and one next step.

   Because both surfaces read the same items, actioning an item in My Work also
   clears it from Home. Every action here is lightweight local demonstration
   only: nothing is sent, published, or written to any external system.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var R = root.SVPortalRules;
  var S = root.SVPortalStore;
  var P = root.SVPortalPersonas;
  var el = U.el, esc = U.esc, frag = U.frag;

  /* Per-session record of resolved items; not persisted. Shared by Home and My
     Work so completing an item in one surface clears it from the other. */
  function resolvedMap() {
    return SVOps.state.workResolved || (SVOps.state.workResolved = {});
  }
  function isResolved(id) { return !!resolvedMap()[id]; }
  function resolve(id, note) { resolvedMap()[id] = { note: note || 'Handled in this demonstration.' }; }
  function unresolve(id) { delete resolvedMap()[id]; }

  function personaFor(user) {
    return (user && user.personaId && P.byId(user.personaId)) || null;
  }
  function greeting() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }
  function synthDate() {
    /* Browser-local date, clearly labelled synthetic. Never before 2026. */
    var d = new Date();
    if (d.getFullYear() < 2026) d = new Date(2026, d.getMonth(), d.getDate());
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function rerender(container, user) {
    container.innerHTML = '';
    if (container.getAttribute('data-view') === 'my-work') SVOps.views.myWork(container, user);
    else SVOps.views.home(container, user);
  }

  /* ── Home — the selective company-wide overview ──────────────────────────
     Answers "what needs my attention across ShoreVest One?" in a handful of
     lines. Each line links to the same item My Work carries in full. */

  SVOps.views.home = function (container, user) {
    container.setAttribute('data-view', 'home');
    var page = el('div', { class: 'ops-content home home--overview' });

    page.appendChild(el('div', { class: 'home-head' }, [
      el('h1', { class: 'ops-h1', text: greeting() + '.' }),
      el('p', { class: 'home-head__purpose', text: 'What needs my attention across ShoreVest One?' }),
      el('p', { class: 'home-head__situation', text: P.situational })
    ]));

    page.appendChild(el('div', { class: 'home-defaultbar' }, [
      el('span', { class: 'home-defaultbar__label', text: 'ShoreVest One — company-wide overview' }),
      el('span', { class: 'home-synthdate', text: synthDate() + ' · synthetic' })
    ]));

    /* Start here — recommended first thing to open, then workflows to continue. */
    var start = el('section', { class: 'home-start', 'aria-labelledby': 'home-start-h' });
    start.appendChild(el('h2', { class: 'home-sectionlabel', id: 'home-start-h', text: 'Start here' }));
    var startList = el('div', { class: 'home-start__list' });
    (P.startHere || []).forEach(function (s) {
      startList.appendChild(el('a', { class: 'home-start__item', href: s.hash }, [
        el('span', { class: 'home-start__label', text: s.label }),
        el('span', { class: 'home-start__sub', text: s.sub || '' })
      ]));
    });
    start.appendChild(startList);
    page.appendChild(start);

    /* Attention sections — Decide / Do / Waiting / Warnings. Selective: only
       items flagged for Home appear, and resolved items drop out. */
    var attention = el('div', { class: 'home-attention' });
    var totalOpen = 0;
    (P.homeSections || []).forEach(function (sec) {
      var items = P.homeItems(sec.key).filter(function (it) { return !isResolved(it.id); });
      if (!items.length) return;
      totalOpen += items.length;
      attention.appendChild(homeSection(sec, items));
    });

    if (totalOpen) {
      page.appendChild(attention);
    } else {
      page.appendChild(el('div', { class: 'home-empty' }, [
        el('p', { class: 'home-empty__title', text: 'Nothing needs your attention right now.' }),
        el('p', { class: 'home-empty__sub', text: 'New decisions, warnings and waiting items will appear here. Your full queue is in My Work.' })
      ]));
    }

    /* Recent work — quiet, already-done items for awareness. */
    var recent = P.homeItems('recent');
    if (recent.length) {
      var recentSec = el('section', { class: 'home-recent', 'aria-labelledby': 'home-recent-h' });
      recentSec.appendChild(el('h2', { class: 'home-sectionlabel home-sectionlabel--quiet', id: 'home-recent-h', text: 'Recent work' }));
      var rList = el('div', { class: 'home-summary home-summary--quiet' });
      recent.forEach(function (it) { rList.appendChild(homeLine(it, true)); });
      recentSec.appendChild(rList);
      page.appendChild(recentSec);
    }

    /* One link into the full queue, so Home never tries to be My Work. */
    page.appendChild(el('div', { class: 'home-tomywork' }, [
      el('a', { class: 'home-tomywork__link', href: '#/my-work', text: 'Open My Work — the full queue →' })
    ]));

    container.appendChild(page);
  };

  function homeSection(sec, items) {
    var node = el('section', { class: 'home-section', 'aria-label': sec.title });
    node.appendChild(el('div', { class: 'home-section__head' }, [
      el('h2', { class: 'home-section__title', text: sec.title }),
      el('span', { class: 'home-section__count', text: String(items.length) })
    ]));
    var list = el('div', { class: 'home-summary' });
    items.forEach(function (it) { list.appendChild(homeLine(it, false)); });
    node.appendChild(list);
    return node;
  }

  /* A single Home summary line — the short statement plus a quiet source, the
     whole row linking back to the underlying item's home. */
  function homeLine(item, quiet) {
    var meta = quiet ? item.workspace : (item.owner + ' · ' + item.workspace);
    return el('a', { class: 'home-summary__item' + (quiet ? ' is-quiet' : ''), href: item.link }, [
      el('span', { class: 'home-summary__text', text: item.home.summary }),
      el('span', { class: 'home-summary__meta', text: meta })
    ]);
  }

  /* ── My Work — the full cross-workspace execution queue ──────────────────── */

  SVOps.views.myWork = function (container, user) {
    container.setAttribute('data-view', 'my-work');
    var page = el('div', { class: 'ops-content mywork' });

    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'My Work' }),
      el('h1', { class: 'ops-h1', text: "What I'm responsible for completing" }),
      el('p', { class: 'ops-lede', text: 'The full cross-workspace queue. One action, one owner, one next step for each item. Home is only a summary of what needs attention.' })
    ]));

    (P.myWorkBuckets || []).forEach(function (bucket) {
      var items = P.bucketItems(bucket.key);
      if (!items.length) return;
      page.appendChild(myWorkBucket(bucket, items, container, user));
    });

    container.appendChild(page);
  };

  function myWorkBucket(bucket, items, container, user) {
    var open = items.filter(function (it) { return !isResolved(it.id); });
    var sec = el('section', { class: 'mywork-view' });
    sec.appendChild(el('div', { class: 'mywork-view__head' }, [
      el('div', { class: 'mywork-view__heading' }, [
        el('h2', { class: 'mywork-view__title', text: bucket.title }),
        el('span', { class: 'mywork-view__count', text: bucket.key === 'done' ? '' : String(open.length) })
      ]),
      el('p', { class: 'mywork-view__sub', text: bucket.sub })
    ]));
    items.forEach(function (it) { sec.appendChild(myWorkCard(bucket, it, container, user)); });
    return sec;
  }

  function chip(label, value, variant) {
    return el('span', { class: 'mywork-chip' + (variant ? ' mywork-chip--' + variant : '') }, [
      el('span', { class: 'mywork-chip__k', text: label }),
      el('span', { class: 'mywork-chip__v', text: value })
    ]);
  }

  function myWorkCard(bucket, item, container, user) {
    var done = bucket.key === 'done';
    var resolved = !done && isResolved(item.id);

    if (resolved) {
      return el('div', { class: 'mywork-item mywork-item--resolved' }, [
        el('div', { class: 'mywork-item__resolved' }, [
          el('div', {}, [
            el('p', { class: 'mywork-item__title', text: item.action }),
            el('p', { class: 'mywork-item__note', text: resolvedMap()[item.id].note })
          ]),
          el('button', { type: 'button', class: 'home-card__undo', text: 'Undo',
            onclick: function () { unresolve(item.id); rerender(container, user); } })
        ])
      ]);
    }

    var card = el('div', { class: 'mywork-item' + (done ? ' mywork-item--done' : '') });
    card.appendChild(el('p', { class: 'mywork-item__title', text: item.action }));

    var chips = el('div', { class: 'mywork-chips' });
    chips.appendChild(chip('Owner', item.owner, 'owner'));
    chips.appendChild(chip('Workspace', item.workspace));
    if (item.waitingOn) chips.appendChild(chip('Waiting on', item.waitingOn, 'waiting'));
    if (item.due) chips.appendChild(chip('Due', item.due, done ? '' : 'due'));
    card.appendChild(chips);

    card.appendChild(el('p', { class: 'mywork-item__note', text: item.reason }));
    card.appendChild(el('p', { class: 'mywork-item__status', text: item.status }));
    if (!done) card.appendChild(el('p', { class: 'mywork-item__next' }, [
      el('span', { class: 'mywork-item__next-k', text: 'Next: ' }),
      el('span', { text: item.nextStep })
    ]));

    card.appendChild(myWorkActions(bucket, item, container, user));
    return card;
  }

  /* Per-bucket actions. "Open" leads to the item's workflow or, for decisions,
     an explanatory drawer. A quiet local action resolves the item (clearing it
     from Home too). Nothing external happens. */
  function myWorkActions(bucket, item, container, user) {
    var actions = el('div', { class: 'mywork-item__actions' });

    if (item.detail) {
      actions.appendChild(el('button', { type: 'button', class: 'btn btn--sm btn--primary', text: 'Open decision',
        onclick: function () { openDecision(item, container, user); } }));
    } else {
      actions.appendChild(el('a', { class: 'btn btn--sm btn--primary', href: item.link, text: 'Open' }));
    }

    if (bucket.key === 'do-now') {
      actions.appendChild(resolveBtn('Mark handled', item, 'Handled in this demonstration — nothing was sent.', container, user));
    } else if (bucket.key === 'suggestion') {
      actions.appendChild(resolveBtn('Accept', item, 'Accepted — this would move into Do now.', container, user));
      actions.appendChild(resolveBtn('Dismiss', item, 'Dismissed suggestion.', container, user));
    } else if (bucket.key === 'waiting') {
      actions.appendChild(el('button', { type: 'button', class: 'btn btn--sm btn--quiet', text: 'Nudge',
        onclick: function () { U.toast(item.action + ' — reminder recorded in this demonstration.'); } }));
    } else if (bucket.key === 'on-hold') {
      actions.appendChild(resolveBtn('Resume', item, 'Resumed — this would move back into Do now.', container, user));
    }

    return actions;
  }

  function resolveBtn(label, item, note, container, user) {
    return el('button', { type: 'button', class: 'btn btn--sm btn--quiet', text: label,
      onclick: function () { resolve(item.id, note); U.toast(item.action + ' — ' + note); rerender(container, user); } });
  }

  var STATE_LABEL = {
    'system-verified': 'System-verified',
    'human-confirmed': 'Human-confirmed',
    'inferred': 'Inferred',
    'conflicting': 'Conflicting',
    'stale': 'Stale',
    'unavailable': 'Not yet available'
  };

  /* Decision drawer — the operational detail behind a Do-now decision. */
  function openDecision(item, container, user) {
    var d = item.detail;
    var body = el('div', {});
    body.appendChild(U.notice('info',
      '<strong>Preview only</strong> Nothing is sent, invited, or written to any system. Opening this changes nothing outside this browser.'));

    if (d.context && d.context.length) {
      var ctx = el('section', {}, [el('h4', { text: 'Situation' })]);
      d.context.forEach(function (line) { ctx.appendChild(el('p', { class: 'drawer-copy', text: line })); });
      body.appendChild(ctx);
    }
    body.appendChild(el('section', {}, [
      el('h4', { text: 'Recommended' }),
      el('p', { class: 'drawer-copy', text: d.recommendation }),
      el('p', { class: 'drawer-copy', text: d.reasoning })
    ]));
    if (d.evidence && d.evidence.length) {
      var list = el('ul', { class: 'evidence-list' });
      d.evidence.forEach(function (e) {
        list.appendChild(el('li', { class: 'evidence-item' }, [
          el('span', { class: 'evidence-item__state evidence-item__state--' + e.state, text: STATE_LABEL[e.state] || e.state }),
          el('span', { class: 'evidence-item__body' }, [
            el('span', { class: 'evidence-item__label', text: e.label }),
            el('span', { class: 'evidence-item__detail', text: e.detail })
          ])
        ]));
      });
      body.appendChild(el('section', {}, [el('h4', { text: 'Evidence' })]));
      body.appendChild(list);
    }
    if (d.policy) {
      body.appendChild(el('section', {}, [
        el('h4', { text: 'Applicable policy' }),
        el('p', { class: 'drawer-copy', text: d.policy })
      ]));
    }

    var drawer = U.drawer(item.action, body);
    body.appendChild(el('div', { class: 'drawer-actions' }, [
      el('button', { type: 'button', class: 'btn btn--primary', text: 'Mark handled',
        onclick: function () {
          resolve(item.id, 'Handled in this demonstration — nothing was sent.');
          U.toast(item.action + ' — handled in this demonstration.');
          drawer.close();
          rerender(container, user);
        } }),
      el('button', { type: 'button', class: 'btn btn--quiet', text: 'Close', onclick: function () { drawer.close(); } })
    ]));
  }

  /* ── Workspace placeholders (Relationships … Firm) ──────────────────────── */

  SVOps.views.workspace = function (container, user, params) {
    var key = params && params[0];
    var info = key && P.workspace(key);
    var page = el('div', { class: 'ops-content ops-content--narrow workspace' });
    if (!info) {
      page.appendChild(el('div', { class: 'ops-pagehead' }, [
        el('h1', { class: 'ops-h1', text: 'Workspace' }),
        el('p', { class: 'ops-lede', text: 'This workspace is not part of the current demonstration.' })
      ]));
      page.appendChild(el('a', { class: 'btn btn--quiet', href: '#/home', text: 'Back to Home' }));
      container.appendChild(page);
      return;
    }
    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'Workspace' }),
      el('h1', { class: 'ops-h1', text: info.title }),
      el('p', { class: 'ops-lede', text: info.lede })
    ]));

    /* Items in the shared queue that originate in this workspace, so a workspace
       landing page shows what currently needs attention here. */
    var mine = (P.workItems || []).filter(function (it) { return it.workspace === info.label && !isResolved(it.id); });
    if (mine.length) {
      var attn = el('section', { class: 'mywork-view', style: 'margin-top:18px' });
      attn.appendChild(el('div', { class: 'mywork-view__head' }, [
        el('div', { class: 'mywork-view__heading' }, [
          el('h2', { class: 'mywork-view__title', text: 'Needs attention here' }),
          el('span', { class: 'mywork-view__count', text: String(mine.length) })
        ]),
        el('p', { class: 'mywork-view__sub', text: 'Open items from the shared queue, shown here and in My Work.' })
      ]));
      mine.forEach(function (it) {
        attn.appendChild(el('div', { class: 'mywork-item' }, [
          el('p', { class: 'mywork-item__title', text: it.action }),
          el('div', { class: 'mywork-chips' }, [
            chip('Owner', it.owner, 'owner'),
            chip('Status', it.status)
          ]),
          el('p', { class: 'mywork-item__next' }, [
            el('span', { class: 'mywork-item__next-k', text: 'Next: ' }),
            el('span', { text: it.nextStep })
          ]),
          el('div', { class: 'mywork-item__actions' }, [
            el('a', { class: 'btn btn--sm btn--quiet', href: '#/my-work', text: 'Open in My Work' })
          ])
        ]));
      });
      page.appendChild(attn);
    }

    page.appendChild(el('div', { class: 'workspace-note' }, [
      el('p', { text: 'Demonstration capability — workflow not yet connected. This workspace shows where its tools and detail will live.' })
    ]));
    page.appendChild(el('a', { class: 'btn btn--quiet', href: '#/home', text: 'Back to Home' }));
    container.appendChild(page);
  };

  /* ── Preview shells (coordination navigation) ───────────────────────────── */

  SVOps.views.preview = function (container, user, params) {
    var key = params && params[0];
    var info = key && P.preview(key);
    var page = el('div', { class: 'ops-content ops-content--narrow' });
    if (!info) {
      page.appendChild(el('div', { class: 'ops-pagehead' }, [
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
      { n: '08', name: 'Monitoring', desc: 'Processing health, stuck batches, reconciliation failures, and alerts.', hash: '#/monitoring', cap: 'viewMonitoring' },
      { n: '09', name: 'HR Job Openings', desc: 'Create structured local drafts for new Careers roles before publication.', hash: '#/job-openings', cap: 'administer' },
      { n: '10', name: 'Website Media Library', desc: 'Add, remove, and suitability-check public-site media before publication.', hash: '#/media-library', cap: 'administer' }
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
