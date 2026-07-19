/* ==========================================================================
   ShoreVest One — Home, My Work, workspaces, preview shells, and Tools hub

   For John and Kelvin, Home is a calm commercial workbench that absorbs
   complexity: one Focus Now decision, a short Today list, one Under Control
   reassurance line, and an optional quiet Around ShoreVest note. Celestra keeps
   her coordination Home. My Work answers "what currently depends on me?".

   Every action here is lightweight local demonstration only. Opening a review
   prepares and explains; it never sends, invites, publishes, writes to a
   system, or changes a calendar. Nothing external occurs.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var R = root.SVPortalRules;
  var S = root.SVPortalStore;
  var P = root.SVPortalPersonas;
  var el = U.el, esc = U.esc, frag = U.frag;

  /* Per-session record of resolved / actioned cards; not persisted. */
  SVOps.state.homeResolved = SVOps.state.homeResolved || {};

  /* ── Home customisation (persisted, non-critical arrangement only) ──────── */
  var CUSTOM_KEY = 'svops.home.custom.v1';
  function loadCustom() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveCustom(all) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
  }
  function customFor(id) {
    var all = loadCustom();
    var c = all[id] || {};
    return {
      showAround: c.showAround !== false,
      compact: c.compact === true,
      order: (c.order && c.order.length === 2) ? c.order : ['today', 'underControl']
    };
  }
  function setCustom(id, patch) {
    var all = loadCustom();
    all[id] = Object.assign(customFor(id), patch);
    saveCustom(all);
  }
  function clearCustom(id) {
    var all = loadCustom();
    delete all[id];
    saveCustom(all);
  }

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
    /* Browser-local date, clearly labelled synthetic. Never 2025. */
    var d = new Date();
    if (d.getFullYear() < 2026) d = new Date(2026, d.getMonth(), d.getDate());
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ── Home router ────────────────────────────────────────────────────────── */

  SVOps.views.home = function (container, user) {
    var persona = personaFor(user);
    if (persona && persona.homeSchema === 'combined') return renderCombinedHome(container, user, persona);
    if (persona && persona.homeSchema === 'commercial') return renderCommercialHome(container, user, persona);
    return renderCoordinationHome(container, user, persona);
  };

  /* ── Combined Home (single demonstration profile — "the motherboard") ─────
     One Home that composes everything: every Focus Now decision, the
     coordination Needs You cards, a merged Today, the Under Control line,
     Waiting elsewhere, and the quiet Around ShoreVest notes. Reuses the same
     card and list renderers as the per-role Homes it is built from. */

  function renderCombinedHome(container, user, persona) {
    var home = persona.home;
    var page = el('div', { class: 'ops-content home home--commercial' });
    var rerender = function () { rerenderHome(container, user); };
    var resolved = SVOps.state.homeResolved[persona.id] || (SVOps.state.homeResolved[persona.id] = {});

    page.appendChild(el('div', { class: 'home-head' }, [
      el('h1', { class: 'ops-h1', text: greeting() + '.' }),
      el('p', { class: 'home-head__purpose', text: 'What should I pay attention to right now?' }),
      el('p', { class: 'home-head__situation', text: home.situational || '' })
    ]));

    page.appendChild(el('div', { class: 'home-defaultbar' }, [
      el('span', { class: 'home-defaultbar__label', text: 'ShoreVest One — full demonstration workspace' }),
      el('span', { class: 'home-synthdate', text: synthDate() + ' · synthetic' })
    ]));

    /* Focus Now — every commercial decision, one card each. */
    var focusList = [].concat(home.focus || []);
    if (focusList.length) {
      var focusSec = el('section', { class: 'home-focus', 'aria-labelledby': 'home-focus-h' });
      focusSec.appendChild(el('h2', { class: 'home-sectionlabel', id: 'home-focus-h', text: 'Focus Now' }));
      focusList.forEach(function (f) {
        focusSec.appendChild(renderFocusCard(persona, f, resolved, rerender));
      });
      page.appendChild(focusSec);
    }

    /* Needs you — coordination cards. */
    if (home.needsYou && home.needsYou.length) {
      var open = home.needsYou.filter(function (c) { return !resolved[c.id]; });
      var needs = el('section', { class: 'home-section', 'aria-labelledby': 'home-needs' });
      needs.appendChild(el('div', { class: 'home-section__head' }, [
        el('h2', { class: 'home-section__title', id: 'home-needs', text: 'Needs you' }),
        el('span', { class: 'home-section__count', text: open.length ? String(open.length) : '' })
      ]));
      var cards = el('div', { class: 'home-cards' });
      home.needsYou.forEach(function (card) {
        cards.appendChild(renderCoordCard(persona, card, resolved, rerender));
      });
      needs.appendChild(cards);
      page.appendChild(needs);
    }

    /* Today + Under Control. */
    var secondary = el('div', { class: 'home-secondary' });
    secondary.appendChild(renderToday(home, 6));
    secondary.appendChild(renderUnderControl(home));
    page.appendChild(secondary);

    /* Waiting elsewhere. */
    if (home.waiting && home.waiting.length) {
      var lists = el('div', { class: 'home-lists' });
      lists.appendChild(coordList('Waiting elsewhere', home.waiting, function (item) {
        return el('div', { class: 'home-list__item' }, [
          el('span', { class: 'home-list__body' }, [
            el('span', { class: 'home-list__name', text: item.title }),
            el('span', { class: 'home-list__note home-list__note--waiting', text: item.note })
          ])
        ]);
      }, 'Nothing is waiting on others.'));
      page.appendChild(lists);
    }

    /* Around ShoreVest. */
    if (home.around && home.around.length) {
      page.appendChild(renderAround(home));
    }

    container.appendChild(page);
  }

  /* ── Commercial Home (John & Kelvin) ────────────────────────────────────── */

  function renderCommercialHome(container, user, persona) {
    var home = persona.home;
    var custom = customFor(persona.id);
    var page = el('div', { class: 'ops-content home home--commercial' + (custom.compact ? ' home--compact' : '') });

    /* Header: greeting, discreet purpose, one situational sentence. */
    page.appendChild(el('div', { class: 'home-head' }, [
      el('h1', { class: 'ops-h1', text: greeting() + ', ' + persona.firstName + '.' }),
      el('p', { class: 'home-head__purpose', text: 'What should I pay attention to right now?' }),
      el('p', { class: 'home-head__situation', text: home.situational || 'One decision needs you right now.' })
    ]));

    /* Default indicator + Customise Home. */
    var bar = el('div', { class: 'home-defaultbar' }, [
      el('span', { class: 'home-defaultbar__label', text: 'ShoreVest default — Recommended for your role' }),
      el('button', { type: 'button', class: 'home-customise', text: 'Customise Home',
        onclick: function () { openCustomise(persona, function () { rerenderHome(container, user); }); } })
    ]);
    bar.appendChild(el('span', { class: 'home-synthdate', text: synthDate() + ' · synthetic' }));
    page.appendChild(bar);

    /* Focus Now — exactly one expanded priority. */
    var focusSec = el('section', { class: 'home-focus', 'aria-labelledby': 'home-focus-h' });
    focusSec.appendChild(el('h2', { class: 'home-sectionlabel', id: 'home-focus-h', text: 'Focus Now' }));
    var resolved = SVOps.state.homeResolved[persona.id] || (SVOps.state.homeResolved[persona.id] = {});
    focusSec.appendChild(renderFocusCard(persona, home.focus, resolved, function () { rerenderHome(container, user); }));
    page.appendChild(focusSec);

    /* Secondary sections in the user's chosen order. */
    var secondary = el('div', { class: 'home-secondary' });
    custom.order.forEach(function (key) {
      if (key === 'today') secondary.appendChild(renderToday(home));
      else if (key === 'underControl') secondary.appendChild(renderUnderControl(home));
    });
    page.appendChild(secondary);

    /* Around ShoreVest — optional and quiet. */
    if (custom.showAround && home.around && home.around.length) {
      page.appendChild(renderAround(home));
    }

    container.appendChild(page);
  }

  function rerenderHome(container, user) {
    container.innerHTML = '';
    SVOps.views.home(container, user);
  }

  /* Focus Now card. */
  function renderFocusCard(persona, focus, resolved, rerender) {
    var done = resolved[focus.id];
    var card = el('article', { class: 'focus-card' + (done ? ' is-actioned' : '') });

    if (done) {
      card.appendChild(el('div', { class: 'focus-card__done' }, [
        el('div', {}, [
          el('p', { class: 'focus-card__done-title', text: focus.title }),
          el('p', { class: 'focus-card__done-note', text: done.note })
        ]),
        el('button', { type: 'button', class: 'home-card__undo', text: 'Undo',
          onclick: function () { delete resolved[focus.id]; rerender(); } })
      ]));
      return card;
    }

    card.appendChild(el('p', { class: 'focus-card__eyebrow', text: focus.institution }));
    card.appendChild(el('h3', { class: 'focus-card__title', text: focus.title }));

    var ctx = el('div', { class: 'focus-card__context' });
    (focus.context || []).forEach(function (line) { ctx.appendChild(el('p', { text: line })); });
    card.appendChild(ctx);

    /* Exact commercial decision + due + why. */
    var meta = el('div', { class: 'focus-card__meta' });
    meta.appendChild(field('The decision', focus.decision));
    meta.appendChild(field('Due', focus.due));
    card.appendChild(meta);

    if (focus.requiredAttendee) {
      card.appendChild(el('p', { class: 'focus-card__required', text: focus.requiredAttendee }));
    }

    card.appendChild(el('details', { class: 'focus-disc' }, [
      el('summary', { text: 'Why this needs you' }),
      el('p', { class: 'focus-disc__body', text: focus.whyYou })
    ]));

    /* Recommendation + reasoning. */
    card.appendChild(el('div', { class: 'focus-card__rec' }, [
      el('span', { class: 'focus-card__rec-label', text: focus.recLabel || 'ShoreVest One recommends' }),
      el('p', { class: 'focus-card__rec-text', text: focus.recommendation }),
      el('p', { class: 'focus-card__rec-why', text: focus.reasoning })
    ]));

    /* Evidence-quality summary (scoped wording, never false-green). */
    card.appendChild(el('p', { class: 'focus-card__evidence', text: focus.evidenceLine }));

    /* Primary action + safe-correction control. */
    var actions = el('div', { class: 'focus-card__actions' });
    actions.appendChild(el('button', {
      type: 'button', class: 'btn btn--primary',
      text: focus.primary,
      onclick: function () { openReview(persona, focus, resolved, rerender); }
    }));
    actions.appendChild(el('button', {
      type: 'button', class: 'btn btn--quiet focus-card__wrong',
      text: 'Something wrong?',
      onclick: function () { openCorrections(focus, resolved, rerender); }
    }));
    card.appendChild(actions);

    card.appendChild(el('p', { class: 'focus-card__confirmnote', text: 'No message or invitation will be sent until you confirm the exact package.' }));

    /* Progressive disclosures. */
    var disc = el('div', { class: 'focus-card__disclosures' });
    disc.appendChild(discBtn('Why am I seeing this?', function () { openWhy(persona, focus); }));
    disc.appendChild(discBtn('Evidence and sources', function () { openEvidence(focus); }));
    disc.appendChild(discBtn('What will happen if I confirm?', function () { openWhatHappens(focus); }));
    card.appendChild(disc);

    return card;
  }

  function field(label, value) {
    return el('div', { class: 'focus-field' }, [
      el('span', { class: 'focus-field__k', text: label }),
      el('span', { class: 'focus-field__v', text: value })
    ]);
  }
  function discBtn(label, onclick) {
    return el('button', { type: 'button', class: 'focus-disclose', text: label, onclick: onclick });
  }

  /* Opening the review — prepares and explains, performs no external action. */
  function openReview(persona, focus, resolved, rerender) {
    var body = el('div', {});
    body.appendChild(U.notice('info',
      '<strong>Preview only</strong> No message or invitation will be sent until you confirm the exact package. Opening this review changes nothing outside this browser.'));
    body.appendChild(el('section', {}, [
      el('h4', { text: 'Recommended plan' }),
      el('p', { class: 'drawer-copy', text: focus.recommendation }),
      el('p', { class: 'drawer-copy', text: focus.reasoning })
    ]));
    if (focus.requiredAttendee) {
      body.appendChild(el('section', {}, [
        el('h4', { text: 'Required attendance' }),
        el('p', { class: 'drawer-copy', text: focus.requiredAttendee })
      ]));
    }
    body.appendChild(el('section', {}, [
      el('h4', { text: 'What happens only after you confirm' }),
      el('p', { class: 'drawer-copy', text: focus.afterConfirm }),
      el('p', { class: 'drawer-copy', text: focus.owner })
    ]));

    var confirm = el('button', { type: 'button', class: 'btn btn--primary', text: 'Confirm plan',
      onclick: function () {
        resolved[focus.id] = { note: 'Plan confirmed in this demonstration. No message or invitation was sent.' };
        U.toast('Prepared in this demonstration — nothing was sent.');
        d.close();
        rerender();
      } });
    var wrap = el('div', { class: 'drawer-actions' }, [
      confirm,
      el('button', { type: 'button', class: 'btn btn--quiet', text: 'Close', onclick: function () { d.close(); } })
    ]);
    body.appendChild(wrap);

    var d = U.drawer(focus.primary, body);
  }

  var CORRECTIONS = [
    { label: 'Change', done: 'Marked for change' },
    { label: 'Need review', done: 'Sent for review' },
    { label: 'Not enough information', done: 'Flagged: not enough information' },
    { label: 'This is not mine', done: 'Flagged: not mine' },
    { label: 'The information is wrong', done: 'Flagged: information is wrong' },
    { label: 'Someone else should decide', done: 'Flagged for reassignment' },
    { label: 'Need help', done: 'Help requested' }
  ];

  function openCorrections(focus, resolved, rerender) {
    var body = el('div', {});
    body.appendChild(el('p', { class: 'drawer-copy', text: 'Choose the closest correction. Each is recorded in this demonstration only — nothing external happens.' }));
    var list = el('div', { class: 'corrections' });
    CORRECTIONS.forEach(function (c) {
      list.appendChild(el('button', { type: 'button', class: 'corrections__item', text: c.label,
        onclick: function () {
          resolved[focus.id] = { note: c.done + '.' };
          U.toast(focus.institution + ' — ' + c.done);
          d.close();
          rerender();
        } }));
    });
    body.appendChild(list);
    var d = U.drawer('Something wrong?', body);
  }

  function openWhy(persona, focus) {
    var body = el('div', {});
    body.appendChild(el('section', {}, [
      el('h4', { text: 'Why this needs you' }),
      el('p', { class: 'drawer-copy', text: focus.whyYou })
    ]));
    body.appendChild(el('section', {}, [
      el('h4', { text: 'Applicable policy' }),
      el('p', { class: 'drawer-copy', text: focus.policy })
    ]));
    body.appendChild(U.notice('info', '<strong>Demonstration</strong> This explanation is synthetic. No live systems are consulted.'));
    U.drawer('Why am I seeing this?', body);
  }

  var STATE_LABEL = {
    'system-verified': 'System-verified',
    'human-confirmed': 'Human-confirmed',
    'inferred': 'Inferred',
    'conflicting': 'Conflicting',
    'stale': 'Stale',
    'unavailable': 'Not yet available'
  };

  function openEvidence(focus) {
    var body = el('div', {});
    body.appendChild(el('p', { class: 'drawer-copy', text: focus.evidenceLine }));
    var list = el('ul', { class: 'evidence-list' });
    (focus.evidence || []).forEach(function (e) {
      list.appendChild(el('li', { class: 'evidence-item' }, [
        el('span', { class: 'evidence-item__state evidence-item__state--' + e.state, text: STATE_LABEL[e.state] || e.state }),
        el('span', { class: 'evidence-item__body' }, [
          el('span', { class: 'evidence-item__label', text: e.label }),
          el('span', { class: 'evidence-item__detail', text: e.detail })
        ])
      ]));
    });
    body.appendChild(list);
    body.appendChild(U.notice('info', '<strong>Demonstration</strong> Sources are synthetic. Checked at ' + esc(focus.verifiedAt) + '.'));
    U.drawer('Evidence and sources', body);
  }

  function openWhatHappens(focus) {
    var body = el('div', {});
    body.appendChild(U.notice('info', '<strong>Nothing happens now.</strong> No message or invitation will be sent until you confirm the exact package.'));
    body.appendChild(el('section', {}, [
      el('h4', { text: 'If you confirm' }),
      el('p', { class: 'drawer-copy', text: focus.afterConfirm })
    ]));
    body.appendChild(el('section', {}, [
      el('h4', { text: 'Who owns the next step' }),
      el('p', { class: 'drawer-copy', text: focus.owner })
    ]));
    U.drawer('What will happen if I confirm?', body);
  }

  /* Today — remaining schedule only; never repeats Focus Now. */
  function renderToday(home, limit) {
    var sec = el('section', { class: 'home-panel', 'aria-labelledby': 'home-today-h' });
    sec.appendChild(el('h2', { class: 'home-panel__title', id: 'home-today-h', text: 'Today' }));
    var items = el('div', { class: 'today-list' });
    (home.today || []).slice(0, limit || 3).forEach(function (it) {
      items.appendChild(el('div', { class: 'today-item' }, [
        el('span', { class: 'today-item__time', text: it.time + (it.zone ? ' ' + it.zone : '') }),
        el('span', { class: 'today-item__body' }, [
          el('span', { class: 'today-item__name', text: it.title }),
          el('span', { class: 'today-item__state today-item__state--' + (it.state || 'calm'), text: it.note })
        ])
      ]));
    });
    sec.appendChild(items);
    return sec;
  }

  /* Under Control — one reassurance line by default. */
  function renderUnderControl(home) {
    var sec = el('section', { class: 'home-panel home-panel--calm', 'aria-labelledby': 'home-uc-h' });
    sec.appendChild(el('h2', { class: 'home-panel__title', id: 'home-uc-h', text: 'Under Control' }));
    sec.appendChild(el('p', { class: 'home-uc__line', text: home.underControl }));
    return sec;
  }

  /* Around ShoreVest — quiet, no pressure actions. */
  function renderAround(home) {
    var sec = el('section', { class: 'home-around', 'aria-labelledby': 'home-around-h' });
    sec.appendChild(el('h2', { class: 'home-sectionlabel home-sectionlabel--quiet', id: 'home-around-h', text: 'Around ShoreVest' }));
    (home.around || []).slice(0, 2).forEach(function (a) {
      var row = el('p', { class: 'home-around__item' }, [
        el('span', { text: a.title + ' ' }),
        a.link ? el('a', { class: 'home-around__link', href: a.link, text: a.note || 'Details' }) : el('span', { class: 'home-around__note', text: a.note || '' })
      ]);
      sec.appendChild(row);
    });
    return sec;
  }

  /* Customise Home drawer — non-critical arrangement only. */
  function openCustomise(persona, rerender) {
    var custom = customFor(persona.id);
    var body = el('div', {});
    body.appendChild(el('p', { class: 'drawer-copy', text: 'Adjust the calm parts of your Home. Focus Now, safety warnings and overdue external commitments are always shown.' }));

    var showAround = U.toggleRow('cust-around', 'Show Around ShoreVest', 'The quiet firm note at the bottom of Home', custom.showAround, {
      onchange: function (e) { setCustom(persona.id, { showAround: e.target.value === 'yes' }); }
    });
    var compact = U.toggleRow('cust-compact', 'Compact secondary sections', 'Tighter spacing for Today and Under Control', custom.compact, {
      onchange: function (e) { setCustom(persona.id, { compact: e.target.value === 'yes' }); }
    });
    body.appendChild(showAround);
    body.appendChild(compact);

    var orderLabel = custom.order[0] === 'today' ? 'Today, then Under Control' : 'Under Control, then Today';
    var reorder = el('div', { class: 'fld' }, [
      el('label', { text: 'Secondary order' }),
      (function () {
        var sel = el('select', {});
        [{ v: 'today', l: 'Today, then Under Control' }, { v: 'underControl', l: 'Under Control, then Today' }].forEach(function (o) {
          var opt = el('option', { value: o.v, text: o.l });
          if (custom.order[0] === o.v) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', function () {
          setCustom(persona.id, { order: sel.value === 'today' ? ['today', 'underControl'] : ['underControl', 'today'] });
        });
        return sel;
      })()
    ]);
    void orderLabel;
    body.appendChild(reorder);

    body.appendChild(el('div', { class: 'drawer-actions' }, [
      el('button', { type: 'button', class: 'btn btn--primary', text: 'Done', onclick: function () { d.close(); rerender(); } }),
      el('button', { type: 'button', class: 'btn btn--quiet', text: 'Restore ShoreVest default',
        onclick: function () { clearCustom(persona.id); d.close(); rerender(); U.toast('Home restored to the ShoreVest default.'); } })
    ]));
    var d = U.drawer('Customise Home', body);
  }

  /* ── Coordination Home (Celestra — preserved) ───────────────────────────── */

  function renderCoordinationHome(container, user, persona) {
    var page = el('div', { class: 'ops-content home' });
    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'Home' }),
      el('h1', { class: 'ops-h1', text: greeting() + ', ' + (persona ? persona.firstName : 'there') + '.' }),
      el('p', { class: 'ops-lede', text: 'What needs you now, what is happening today, and what is waiting elsewhere.' })
    ]));

    if (!persona) {
      page.appendChild(U.stateScreen('empty', 'No Home configured',
        'This profile has no Home view. Use Tools to reach the operational prototype.',
        [el('a', { class: 'btn', href: '#/tools', text: 'Go to Tools' })]));
      container.appendChild(page);
      return;
    }

    var home = persona.home;
    var resolved = SVOps.state.homeResolved[persona.id] || (SVOps.state.homeResolved[persona.id] = {});
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
        cards.appendChild(renderCoordCard(persona, card, resolved, function () {
          container.innerHTML = ''; renderCoordinationHome(container, user, persona);
        }));
      });
      needs.appendChild(cards);
    }
    page.appendChild(needs);

    var lists = el('div', { class: 'home-lists' });
    lists.appendChild(coordList('Today', home.today, function (item) {
      return el('div', { class: 'home-list__item' }, [
        el('span', { class: 'home-list__time', text: item.time || '' }),
        el('span', { class: 'home-list__body' }, [
          el('span', { class: 'home-list__name', text: item.title }),
          el('span', { class: 'home-list__note home-list__note--' + (item.tone || 'calm'), text: item.note })
        ])
      ]);
    }, 'No meetings or deadlines today.'));
    lists.appendChild(coordList('Waiting elsewhere', home.waiting, function (item) {
      return el('div', { class: 'home-list__item' }, [
        el('span', { class: 'home-list__body' }, [
          el('span', { class: 'home-list__name', text: item.title }),
          el('span', { class: 'home-list__note home-list__note--waiting', text: item.note })
        ])
      ]);
    }, 'Nothing is waiting on others.'));
    page.appendChild(lists);

    container.appendChild(page);
  }

  function coordList(title, items, rowFn, emptyText) {
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

  function renderCoordCard(persona, card, resolved, rerender) {
    var state = resolved[card.id];
    var node = el('article', { class: 'home-card' + (state ? ' is-resolved' : '') });
    if (state) {
      node.appendChild(el('div', { class: 'home-card__resolved' }, [
        el('div', {}, [
          el('p', { class: 'home-card__resolved-title', text: card.title }),
          el('p', { class: 'home-card__resolved-note', text: state.done + '.' })
        ]),
        el('button', { class: 'home-card__undo', type: 'button', text: 'Undo',
          onclick: function () { delete resolved[card.id]; rerender(); } })
      ]));
      return node;
    }
    node.appendChild(el('h3', { class: 'home-card__title', text: card.title }));
    var ctx = el('div', { class: 'home-card__context' });
    (card.context || []).forEach(function (line) { ctx.appendChild(el('p', { text: line })); });
    node.appendChild(ctx);
    node.appendChild(el('div', { class: 'home-card__rec' }, [
      el('span', { class: 'home-card__rec-label', text: card.recLabel || 'Current state' }),
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
      node.appendChild(el('button', { type: 'button', class: 'home-card__why', text: 'Why am I seeing this?',
        onclick: function () {
          var body = el('div', {});
          body.appendChild(el('section', {}, [el('h4', { text: 'Why this is here' }), el('p', { class: 'drawer-copy', text: card.detail })]));
          body.appendChild(U.notice('info', '<strong>Demonstration</strong> This explanation is synthetic. No live systems are consulted.'));
          U.drawer(card.title, body);
        } }));
    }
    return node;
  }

  /* ── My Work (John & Kelvin) ────────────────────────────────────────────── */

  SVOps.views.myWork = function (container, user) {
    var persona = personaFor(user);
    var page = el('div', { class: 'ops-content mywork' });
    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'My Work' }),
      el('h1', { class: 'ops-h1', text: 'What currently depends on me' }),
      el('p', { class: 'ops-lede', text: 'Needs me is yours to action now. Waiting sits with someone else. Later is deliberately deferred.' })
    ]));

    var mw = persona && persona.myWork;
    if (!mw) {
      page.appendChild(U.notice('info', '<strong>Demonstration</strong> My Work is configured for the Client Solutions profiles in this demonstration.'));
      container.appendChild(page);
      return;
    }

    /* Needs me */
    var needs = el('section', { class: 'mywork-view' });
    needs.appendChild(el('div', { class: 'mywork-view__head' }, [
      el('h2', { class: 'mywork-view__title', text: 'Needs me' }),
      el('p', { class: 'mywork-view__sub', text: 'Ready for you to action now.' })
    ]));
    mw.needsMe.forEach(function (it) {
      needs.appendChild(el('div', { class: 'mywork-item' }, [
        el('p', { class: 'mywork-item__title', text: it.title }),
        el('p', { class: 'mywork-item__note', text: it.note }),
        el('p', { class: 'mywork-item__meta', text: 'Due: ' + it.due })
      ]));
    });
    page.appendChild(needs);

    /* Waiting */
    var waiting = el('section', { class: 'mywork-view' });
    waiting.appendChild(el('div', { class: 'mywork-view__head' }, [
      el('h2', { class: 'mywork-view__title', text: 'Waiting' }),
      el('p', { class: 'mywork-view__sub', text: 'With someone else. Shown so nothing rests by accident.' })
    ]));
    mw.waiting.forEach(function (it) {
      waiting.appendChild(el('div', { class: 'mywork-item' }, [
        el('p', { class: 'mywork-item__title', text: it.title }),
        el('dl', { class: 'mywork-wait' }, [
          el('dt', { text: 'Next action with' }), el('dd', { text: it.who }),
          el('dt', { text: 'Expected' }), el('dd', { text: it.when }),
          el('dt', { text: 'Follow up' }), el('dd', { text: it.followUp }),
          el('dt', { text: 'Accountability' }), el('dd', { text: it.accountable })
        ])
      ]));
    });
    page.appendChild(waiting);

    /* Later */
    var later = el('section', { class: 'mywork-view' });
    later.appendChild(el('div', { class: 'mywork-view__head' }, [
      el('h2', { class: 'mywork-view__title', text: 'Later' }),
      el('p', { class: 'mywork-view__sub', text: 'Deliberately deferred. Nothing is due.' })
    ]));
    mw.later.forEach(function (it) {
      later.appendChild(el('div', { class: 'mywork-item' }, [
        el('p', { class: 'mywork-item__title', text: it.title }),
        el('p', { class: 'mywork-item__note', text: it.note })
      ]));
    });
    page.appendChild(later);

    container.appendChild(page);
  };

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
    page.appendChild(el('div', { class: 'workspace-note' }, [
      el('p', { text: 'Demonstration capability — workflow not yet connected.' })
    ]));
    page.appendChild(el('a', { class: 'btn btn--quiet', href: '#/home', text: 'Back to Home' }));
    container.appendChild(page);
  };

  /* ── Preview shells (Celestra's coordination navigation) ────────────────── */

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
