/* ==========================================================================
   ShoreVest One — Application shell and login

   Login is a person-led demonstration profile chooser (not authentication).
   The shell uses the compact ShoreVest mark plus SHOREVEST ONE — never the full
   corporate lockup, which belongs to login and formal surfaces. Navigation and
   Home come from the selected persona. Profile identity sits at the bottom of
   the sidebar; Sign out lives inside the profile menu. Nothing here performs an
   external action.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var R = root.SVPortalRules;
  var I = root.SVPortalIntegrations;
  var P = root.SVPortalPersonas;
  var el = U.el, esc = U.esc;

  var ROOT_ID = 'svops-root';
  /* Full bilingual corporate lockup — login and formal surfaces only. */
  var CORPORATE_LOCKUP = '../assets/brand/sv-lockup-fc-dark.png';
  /* Compact ShoreVest mark — used inside the application shell. */
  var COMPACT_MARK = '../assets/brand/sv-circle-fullcolor.png';

  var DEMO_USERS = P.list.map(function (p) {
    return {
      personaId: p.id, name: p.name, firstName: p.firstName,
      title: p.title, coverage: p.coverage, displayRole: p.displayRole,
      photo: p.photo, initials: p.initials, username: p.username, role: p.role
    };
  });

  var SESSION_KEY = 'svops.session.v2';
  var COLLAPSE_KEY = 'svops.sidebar.collapsed';

  function currentUser() {
    if (SVOps.state.user) return SVOps.state.user;
    if (I.demoMode()) {
      try {
        var raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) { SVOps.state.user = JSON.parse(raw); return SVOps.state.user; }
      } catch (e) { /* ignore */ }
    } else {
      var acct = I.EntraAuth.getAccount();
      if (acct) { SVOps.state.user = acct; return acct; }
    }
    return null;
  }

  function signInDemo(u) {
    SVOps.state.user = u;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch (e) { /* ignore */ }
    I.EntraAuth.signIn(u);
    location.hash = '#/home';
    render();
  }

  function signOut() {
    SVOps.state.user = null;
    closeProfileMenu();
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    I.EntraAuth.signOut();
    render();
  }

  /* ── Avatar (approved photo, else restrained initials — never a face) ───── */
  function avatar(user, cls) {
    if (user.photo) {
      return el('img', { class: 'sv-avatar ' + (cls || ''), src: user.photo, alt: user.name, loading: 'eager' });
    }
    return el('span', { class: 'sv-avatar sv-avatar--initials ' + (cls || ''), 'aria-hidden': 'true', text: user.initials || '' });
  }

  /* ── Navigation model ─────────────────────────────────────────────────── */
  function personaNav(user) {
    var persona = user && user.personaId && P.byId(user.personaId);
    return (persona && persona.nav) || [];
  }

  /* Routes reached only through the Tools hub — they highlight the Tools nav
     item. Outreach is intentionally excluded: it is a first-class sidebar
     destination (#/outreach and its sub-routes) and highlights its own item. */
  var TOOLS_ROUTES = ['tools', 'process', 'weekly', 'dataquality',
    'exceptions', 'runs', 'admin', 'monitoring', 'batch', 'job-openings'];

  var ROUTES = {
    home: 'home', 'my-work': 'myWork', workspace: 'workspace', preview: 'preview',
    tools: 'tools', process: 'process', weekly: 'weekly',
    dataquality: 'dataquality', outreach: 'outreach', 'job-openings': 'jobOpenings', exceptions: 'exceptions',
    runs: 'runs', admin: 'admin', monitoring: 'monitoring', batch: 'batch'
  };

  function parseHash() {
    var h = (location.hash || '#/home').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { view: parts[0] || 'home', params: parts.slice(1) };
  }

  function activeNavKey(route) {
    if (route.view === 'workspace') return 'workspace:' + (route.params[0] || '');
    if (route.view === 'preview') return 'preview:' + (route.params[0] || '');
    if (route.view === 'my-work') return 'my-work';
    if (TOOLS_ROUTES.indexOf(route.view) !== -1) return 'tools';
    return route.view;
  }

  /* Two-letter abbreviation for the collapsed sidebar rail (no icon set exists). */
  function abbr(label) {
    var words = String(label).split(/\s+/).filter(function (w) { return w && w !== '&'; });
    if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function navKeyFor(item) {
    if (item.key === 'tools') return 'tools';
    if (item.hash && item.hash.indexOf('#/workspace/') === 0) return 'workspace:' + item.hash.slice('#/workspace/'.length);
    if (item.hash && item.hash.indexOf('#/preview/') === 0) return 'preview:' + item.hash.slice('#/preview/'.length);
    if (item.hash === '#/my-work') return 'my-work';
    return item.key;
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  function render() {
    var mount = document.getElementById(ROOT_ID);
    if (!mount) return;
    var user = currentUser();
    if (!user) { mount.innerHTML = ''; mount.appendChild(renderGate()); return; }

    var route = parseHash();
    var activeKey = activeNavKey(route);
    var navItem = personaNav(user).filter(function (n) {
      return !n.sep && !n.divider && navKeyFor(n) === activeKey;
    })[0];

    mount.innerHTML = '';
    mount.appendChild(renderShell(user, route.view, route.params, navItem, activeKey));
  }

  function collapsed() {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (e) { return false; }
  }
  function setCollapsed(v) {
    try { localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function renderShell(user, viewId, params, navItem, activeKey) {
    var isCollapsed = collapsed();
    var shell = el('div', { class: 'ops-shell' + (isCollapsed ? ' is-collapsed' : '') + (SVOps.state.menuOpen ? ' menu-open' : '') });

    shell.appendChild(renderSidebar(user, activeKey, isCollapsed));

    var main = el('div', { class: 'ops-main' });
    main.appendChild(renderAppBar(user));   /* mobile */
    main.appendChild(renderTopBar(user));    /* desktop */
    main.appendChild(el('p', { class: 'ops-demo-note', role: 'note',
      text: 'Demonstration — Synthetic data only. No external actions occur.' }));

    var content = el('div', { class: 'ops-main__content' });
    main.appendChild(content);
    routeInto(content, user, viewId, params);

    /* Scrim for the mobile drawer. */
    var scrim = el('div', { class: 'ops-scrim', onclick: function () { SVOps.state.menuOpen = false; render(); } });
    main.appendChild(scrim);

    shell.appendChild(main);
    return shell;
  }

  function renderSidebar(user, activeKey, isCollapsed) {
    var sidebar = el('aside', { class: 'ops-sidebar' + (SVOps.state.menuOpen ? ' is-open' : ''), 'aria-label': 'Primary' });

    /* Compact brand: mark + SHOREVEST ONE, plus the collapse chevron. */
    var brand = el('div', { class: 'ops-sidebar__brand' }, [
      el('span', { class: 'ops-brandmark' }, [
        el('img', { src: COMPACT_MARK, alt: 'ShoreVest', width: '30', height: '30' })
      ]),
      el('span', { class: 'ops-brandword', text: 'SHOREVEST ONE' }),
      el('button', {
        type: 'button', class: 'ops-collapse', 'aria-label': isCollapsed ? 'Expand navigation' : 'Collapse navigation',
        'aria-expanded': isCollapsed ? 'false' : 'true',
        html: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        onclick: function () { setCollapsed(!collapsed()); render(); }
      })
    ]);
    sidebar.appendChild(brand);

    var nav = el('nav', { class: 'ops-nav', 'aria-label': 'Primary navigation' });
    personaNav(user).forEach(function (item) {
      if (item.sep) { nav.appendChild(el('p', { class: 'ops-nav__sep', text: item.sep })); return; }
      if (item.divider) { nav.appendChild(el('hr', { class: 'ops-nav__divider' })); return; }
      var isActive = navKeyFor(item) === activeKey;
      var a = el('a', {
        href: item.hash, class: 'ops-navlink' + (isActive ? ' is-active' : '') + (item.collapsible ? ' ops-navlink--secondary' : ''),
        title: item.label, 'data-abbr': abbr(item.label)
      }, [
        el('span', { class: 'ops-navlink__label', text: item.label })
      ]);
      if (isActive) a.setAttribute('aria-current', 'page');
      a.addEventListener('click', function () { SVOps.state.menuOpen = false; });
      nav.appendChild(a);
    });
    sidebar.appendChild(nav);

    /* Profile identity — clickable, at the bottom. Menu holds Sign out. */
    var profileBtn = el('button', {
      type: 'button', class: 'ops-profile', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
      onclick: function (e) { e.stopPropagation(); toggleProfileMenu(profileBtn, user); }
    }, [
      avatar(user, 'ops-profile__avatar'),
      el('span', { class: 'ops-profile__id' }, [
        el('span', { class: 'ops-profile__name', text: user.name }),
        el('span', { class: 'ops-profile__role', text: user.displayRole })
      ]),
      el('span', { class: 'ops-profile__chev', 'aria-hidden': 'true',
        html: '<svg viewBox="0 0 12 12" width="11" height="11"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' })
    ]);
    sidebar.appendChild(el('div', { class: 'ops-sidebar__foot' }, [profileBtn]));

    return sidebar;
  }

  /* ── Profile menu (Profile, Preferences, Help, Sign out) ─────────────────── */
  var _menuEls = null;
  function closeProfileMenu() {
    if (_menuEls) {
      _menuEls.menu.remove(); _menuEls.scrim.remove();
      document.removeEventListener('keydown', _menuEls.onKey);
      if (_menuEls.anchor) _menuEls.anchor.setAttribute('aria-expanded', 'false');
      _menuEls = null;
    }
  }
  function toggleProfileMenu(anchor, user) {
    if (_menuEls) { closeProfileMenu(); return; }
    var scrim = el('div', { class: 'ops-menu-scrim', onclick: closeProfileMenu });
    var menu = el('div', { class: 'ops-menu', role: 'menu', 'aria-label': 'Profile menu' });
    menu.appendChild(el('div', { class: 'ops-menu__head' }, [
      avatar(user, 'ops-menu__avatar'),
      el('span', { class: 'ops-menu__id' }, [
        el('span', { class: 'ops-menu__name', text: user.name }),
        el('span', { class: 'ops-menu__role', text: user.title + (user.coverage ? ' (' + user.coverage + ')' : '') })
      ])
    ]));
    [
      { label: 'Profile', fn: function () { synthetic('Profile', 'Your profile would open here. This is a demonstration — nothing external occurs.'); } },
      { label: 'Preferences', fn: function () { synthetic('Preferences', 'Preferences would open here. This is a demonstration — nothing external occurs.'); } },
      { label: 'Help', fn: function () { synthetic('Help', 'Help and support would open here. This is a demonstration — nothing external occurs.'); } }
    ].forEach(function (mi) {
      menu.appendChild(el('button', { type: 'button', role: 'menuitem', class: 'ops-menu__item', text: mi.label,
        onclick: function () { closeProfileMenu(); mi.fn(); } }));
    });
    menu.appendChild(el('hr', { class: 'ops-menu__sep' }));
    menu.appendChild(el('button', { type: 'button', role: 'menuitem', class: 'ops-menu__item ops-menu__item--signout', text: 'Sign out',
      onclick: function () { signOut(); } }));

    document.body.appendChild(scrim);
    document.body.appendChild(menu);
    /* Position above the anchor (sidebar bottom) or below (topbar). */
    var r = anchor.getBoundingClientRect();
    var mw = Math.max(menu.offsetWidth, 220);
    var top, left = Math.min(r.left, window.innerWidth - mw - 12);
    if (r.top > window.innerHeight / 2) { top = r.top - menu.offsetHeight - 8; }
    else { top = r.bottom + 8; left = Math.min(r.right - mw, window.innerWidth - mw - 12); }
    menu.style.top = Math.max(12, top) + 'px';
    menu.style.left = Math.max(12, left) + 'px';

    function onKey(e) { if (e.key === 'Escape') closeProfileMenu(); }
    document.addEventListener('keydown', onKey);
    anchor.setAttribute('aria-expanded', 'true');
    _menuEls = { menu: menu, scrim: scrim, onKey: onKey, anchor: anchor };
  }

  function synthetic(title, message) {
    var body = el('div', {});
    body.appendChild(el('p', { class: 'drawer-copy', text: message }));
    body.appendChild(U.notice('info', '<strong>Demonstration</strong> This is a synthetic placeholder. No external action occurs.'));
    U.drawer(title, body);
  }

  /* ── Top bar (desktop) ──────────────────────────────────────────────────── */
  function renderTopBar(user) {
    var bar = el('div', { class: 'ops-topbar' });

    var search = el('button', { type: 'button', class: 'ops-search', 'aria-label': 'Search or ask ShoreVest One',
      onclick: function () { openSearch(); } }, [
      el('span', { class: 'ops-search__icon', 'aria-hidden': 'true',
        html: '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' }),
      el('span', { class: 'ops-search__text', text: 'Search or ask ShoreVest One' })
    ]);
    bar.appendChild(search);

    var right = el('div', { class: 'ops-topbar__right' }, [
      el('button', { type: 'button', class: 'ops-topbtn', text: 'Add', title: 'Add to ShoreVest One',
        onclick: function () { openAdd(); } }),
      el('button', { type: 'button', class: 'ops-topbtn ops-topbtn--quiet', text: 'Help', title: 'Help / Report issue',
        onclick: function () { openHelp(); } }),
      (function () {
        var b = el('button', { type: 'button', class: 'ops-topprofile', 'aria-haspopup': 'menu', 'aria-label': 'Profile menu',
          onclick: function (e) { e.stopPropagation(); toggleProfileMenu(b, user); } }, [avatar(user, 'ops-topprofile__avatar')]);
        return b;
      })()
    ]);
    bar.appendChild(right);
    return bar;
  }

  /* ── Mobile app bar ─────────────────────────────────────────────────────── */
  function renderAppBar(user) {
    var bar = el('div', { class: 'ops-appbar' });
    bar.appendChild(el('span', { class: 'ops-appbar__brand' }, [
      el('img', { src: COMPACT_MARK, alt: 'ShoreVest', width: '26', height: '26' }),
      el('span', { class: 'ops-appbar__word', text: 'SHOREVEST ONE' })
    ]));
    var right = el('div', { class: 'ops-appbar__right' }, [
      (function () {
        var b = el('button', { type: 'button', class: 'ops-topprofile', 'aria-label': 'Profile menu', 'aria-haspopup': 'menu',
          onclick: function (e) { e.stopPropagation(); toggleProfileMenu(b, user); } }, [avatar(user, 'ops-topprofile__avatar')]);
        return b;
      })(),
      el('button', { type: 'button', class: 'ops-menubtn', 'aria-label': 'Open navigation', 'aria-expanded': SVOps.state.menuOpen ? 'true' : 'false',
        html: '<svg viewBox="0 0 18 18" width="20" height="20" aria-hidden="true"><path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
        onclick: function () { SVOps.state.menuOpen = !SVOps.state.menuOpen; render(); } })
    ]);
    bar.appendChild(right);
    return bar;
  }

  function openSearch() {
    var body = el('div', {});
    body.appendChild(el('div', { class: 'fld' }, [
      el('label', { text: 'Search or ask' }),
      el('input', { type: 'search', placeholder: 'e.g. Red Panda Capital, or "what needs me today?"', 'aria-label': 'Search or ask ShoreVest One' })
    ]));
    body.appendChild(U.notice('info', '<strong>Demonstration</strong> Search and Ask are synthetic placeholders in this phase. No query is sent anywhere and no external action occurs.'));
    U.drawer('Search or ask ShoreVest One', body);
  }
  function openAdd() {
    var body = el('div', {});
    body.appendChild(el('p', { class: 'drawer-copy', text: 'Capture a note, meeting, or follow-up into ShoreVest One.' }));
    body.appendChild(el('div', { class: 'fld' }, [
      el('label', { text: 'Add a note' }),
      el('textarea', { placeholder: 'Type a synthetic capture…', 'aria-label': 'Add to ShoreVest One' })
    ]));
    body.appendChild(U.notice('info', '<strong>Demonstration</strong> Capture is a synthetic placeholder. Nothing is stored externally and no external action occurs.'));
    U.drawer('Add to ShoreVest One', body);
  }
  function openHelp() {
    var body = el('div', {});
    body.appendChild(el('p', { class: 'drawer-copy', text: 'Get help using ShoreVest One, or report an issue with this demonstration.' }));
    body.appendChild(U.notice('info', '<strong>Demonstration</strong> Help and issue reporting are synthetic placeholders. No message is sent and no external action occurs.'));
    U.drawer('Help / Report issue', body);
  }

  /* ── Routing into views ─────────────────────────────────────────────────── */
  function routeInto(content, user, viewId, params) {
    var view = SVOps.views[ROUTES[viewId] || 'home'];
    if (!view) return SVOps.views.home(content, user);
    try { view(content, user, params); }
    catch (e) {
      content.appendChild(U.stateScreen('error', 'Something went wrong',
        'This view could not be rendered: ' + e.message));
      if (root.console) root.console.error(e);
    }
  }

  /* ── Login — person-led demonstration profile chooser (not authentication) ── */

  function renderGate() {
    var demo = I.demoMode();
    var wrap = el('div', { class: 'login' });
    var frame = el('div', { class: 'login__frame' });

    /* Left: corporate identity → product name → quiet lines. */
    var left = el('div', { class: 'login__left' }, [
      el('img', { class: 'login__lockup', src: CORPORATE_LOCKUP, alt: 'ShoreVest 新岸资本', width: '300', height: '75' }),
      el('p', { class: 'login__product', text: 'SHOREVEST ONE' }),
      el('p', { class: 'login__tagline', text: 'The operating workspace for ShoreVest teams.' }),
      el('p', { class: 'login__env', text: 'Internal demonstration environment' })
    ]);
    frame.appendChild(left);

    /* Right: heading, instruction, profile chooser, selected summary, action. */
    var right = el('div', { class: 'login__right' });
    right.appendChild(el('h1', { class: 'login__h', text: 'Enter ShoreVest One' }));

    if (!demo) {
      right.appendChild(el('p', { class: 'login__instr', text: 'Production sign-in is configured through Microsoft Entra ID for authorised deployments.' }));
      frame.appendChild(right); wrap.appendChild(frame); return wrap;
    }

    right.appendChild(el('p', { class: 'login__instr', text: 'One demonstration profile with the full workspace — every section and every tool.' }));

    /* A single neutral demonstration profile. No chooser: everyone enters the
       same workspace. Per-role access is applied later, after sign-off. */
    var u = DEMO_USERS[0];

    var summary = el('div', { class: 'login__selected' });
    summary.appendChild(avatar(u, 'login__avatar'));
    summary.appendChild(el('div', { class: 'login__selected-id' }, [
      el('p', { class: 'login__selected-name', text: u.name }),
      el('p', { class: 'login__selected-title', text: u.title }),
      u.coverage ? el('p', { class: 'login__selected-cov', text: '(' + u.coverage + ')' }) : null
    ]));
    right.appendChild(summary);

    var btn = el('button', { class: 'login__submit', type: 'button' }, [
      el('span', { class: 'login__submit-label', text: 'Enter ShoreVest One' }),
      el('span', { class: 'login__submit-spinner', 'aria-hidden': 'true' })
    ]);

    btn.addEventListener('click', function () {
      if (btn.classList.contains('is-loading')) return;
      btn.classList.add('is-loading'); btn.disabled = true;
      setTimeout(function () { signInDemo(u); }, 220);
    });

    right.appendChild(btn);
    right.appendChild(el('p', { class: 'login__notice', text: 'Synthetic data only. No external actions occur.' }));

    frame.appendChild(right);
    wrap.appendChild(frame);
    return wrap;
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */
  function boot() {
    root.addEventListener('svops:render', function () { render(); });
    root.addEventListener('hashchange', function () {
      closeProfileMenu();
      if (parseHash().view === 'process' && SVOps.state.wizardPreset) { SVOps.state.wizard = null; }
      render();
    });
    root.addEventListener('resize', function () { closeProfileMenu(); });
    I.EntraAuth.initialize().catch(function () { /* demo resolves locally */ }).then(function () {
      render();
      applyWizardPreset();
    });
  }

  function applyWizardPreset() {
    if (parseHash().view === 'process' && SVOps.state.wizardPreset) {
      var proc = root.SVPortalStore.getSavedProcess(SVOps.state.wizardPreset);
      SVOps.state.wizardPreset = null;
      if (proc && SVOps.state.wizard) {
        SVOps.state.wizard.savedProcess = proc;
        try {
          var defaults = JSON.parse(proc.defaultSettingsJson);
          SVOps.state.wizard.settings = Object.assign(R.defaultSettings(), defaults);
          R.EXTERNAL_ACTION_KEYS.forEach(function (k) { SVOps.state.wizard.settings[k] = false; });
          SVOps.state.wizard.settings.dryRun = true;
        } catch (e) { /* ignore */ }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

})(typeof self !== 'undefined' ? self : this);
