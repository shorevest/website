/* ==========================================================================
   ShoreVest Operations — Application shell
   Authentication gate (Microsoft Entra ID via MSAL in production; a clearly
   labelled role preview chooser in preview mode), primary navigation
   with role-based visibility, hash router, and the Dashboard.
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

  /* Role preview identities. Each carries a persona id (Home and navigation)
     and a shared underlying capability role for the preserved Tools area. */
  var DEMO_USERS = P.list.map(function (p) {
    return {
      personaId: p.id, name: p.name, firstName: p.firstName,
      title: p.title, coverage: p.coverage, displayRole: p.displayRole,
      photo: p.photo, initials: p.initials, username: p.username, role: p.role
    };
  });

  var SESSION_KEY = 'svops.session.v2';
  var COLLAPSE_KEY = 'svops.sidebar.collapsed';

  var ACTION_REGISTRY = {
    routes: { home: '#/home', myWork: '#/my-work', relationships: '#/relationships', relationshipDetail: '#/relationships', outreachOverview: '#/outreach', findPeople: '#/outreach/find', reviewAudience: '#/outreach/review', chooseAudienceAction: '#/outreach/review', draftMessages: '#/outreach/draft', deliveryControls: '#/outreach/package', reviewPackage: '#/outreach/package', sentResponses: '#/outreach/sent', meetings: '#/meetings', diligenceRequests: '#/diligence', investorIntelligence: '#/investor-intelligence', reporting: '#/reporting', approvals: '#/approvals', firm: '#/firm', firmSystemsVendors: '#/firm/systems', firmVendorDetail: '#/firm/vendors/mergepoint', tools: '#/tools' },
    actions: ['openDrawer','closeDrawer','startWorkflow','saveAudience','saveSearch','exportCsv','assignReview','createResearchTasks','markLooksRight','markNeedsChanges','submitApproval','invalidateApproval','resetPreviewData']
  };
  SVOps.actionRegistry = ACTION_REGISTRY;

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
      return el('img', { class: 'sv-avatar ' + (cls || ''), src: user.photo, alt: user.name, loading: 'lazy' });
    }
    return el('span', { class: 'sv-avatar sv-avatar--initials ' + (cls || ''), 'aria-hidden': 'true', text: user.initials || '' });
  }

  /* ── Navigation model ─────────────────────────────────────────────────── */
  function personaNav(user) {
    var persona = user && user.personaId && P.byId(user.personaId);
    return (persona && persona.nav) || [];
  }

  /* Legacy Tools routes — reached via the Tools hub, and kept highlighted
     under Tools while the user is inside one of them. */
  var TOOLS_ROUTES = ['tools', 'process', 'weekly', 'dataquality',
    'exceptions', 'runs', 'admin', 'monitoring', 'batch'];

  var ROUTES = {
    home: 'home', preview: 'preview', tools: 'tools',
    'my-work': 'myWork', relationships: 'relationships', outreach: 'outreach', meetings: 'meetings',
    diligence: 'diligence', 'investor-intelligence': 'investorIntelligence', reporting: 'reporting',
    approvals: 'approvals', firm: 'firm',
    process: 'process', weekly: 'weekly', dataquality: 'dataquality', exceptions: 'exceptions',
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
    if (route.view === 'outreach' && route.params[0]) return 'outreach-' + route.params[0];
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

  function roleSwitcher(user) {
    var wrap = el('label', { class: 'ops-role-switch' }, [el('span', { text: 'Role preview:' })]);
    var sel = el('select', { 'aria-label': 'Role preview selector' });
    DEMO_USERS.forEach(function (u) { sel.appendChild(el('option', { value: u.personaId, text: (u.name || u.displayRole || '').split(' ')[0], selected: u.personaId === user.personaId })); });
    sel.onchange = function () {
      var next = DEMO_USERS.filter(function (u) { return u.personaId === sel.value; })[0];
      if (next) { if (parseHash().view !== 'home') U.toast('This item is not assigned to this role. Showing role Home instead.'); signInDemo(next); }
    };
    wrap.appendChild(sel);
    return wrap;
  }

  function badge(count) {
    if (!count) return null;
    var cls = count >= 5 ? ' ops-badge--red' : count >= 2 ? ' ops-badge--amber' : ' ops-badge--neutral';
    return el('span', { class: 'ops-badge' + cls, text: String(count) });
  }

  function renderShell(user, viewId, params, navItem, activeKey) {
    var shell = el('div', { class: 'ops-shell' });

    /* Sidebar */
    var sidebar = el('aside', { class: 'ops-sidebar' + (SVOps.state.menuOpen ? ' is-open' : '') });
    sidebar.appendChild(el('div', { class: 'ops-sidebar__brand' }, [
      el('img', { src: LOGO, alt: 'ShoreVest', width: '148', height: '36' }),
      el('p', { class: 'ops-sidebar__title', html: '<span class="rule"></span>ShoreVest One' }),
      el('p', { class: 'ops-sidebar__env', text: I.demoMode() ? 'Internal Preview' : 'Connected' })
    ]));

    var nav = el('nav', { class: 'ops-nav', 'aria-label': 'Primary navigation' });
    personaNav(user).forEach(function (item) {
      if (item.sep) { nav.appendChild(el('p', { class: 'ops-nav__sep', text: item.sep })); return; }
      var itemKey = navKeyFor(item);
      var isActive = itemKey === activeKey || (item.key === 'outreach' && activeKey.indexOf('outreach') === 0);
      var row = el('div', { class: 'ops-nav__row' + (isActive ? ' is-active' : '') });
      var a = el('a', { href: item.hash, class: isActive ? 'is-active' : '' }, [el('span', { text: item.label })]);
      var b = badge(item.count); if (b) a.appendChild(b);
      if (isActive && !item.children) a.setAttribute('aria-current', 'page');
      a.addEventListener('click', function () { SVOps.state.menuOpen = false; });
      row.appendChild(a);
      if (item.children) {
        SVOps.state.outreachOpen = SVOps.state.outreachOpen !== false || activeKey.indexOf('outreach') === 0;
        row.appendChild(el('button', { type: 'button', class: 'ops-nav__chev', text: SVOps.state.outreachOpen ? '▾' : '▸', 'aria-label': 'Expand Outreach submenu', onclick: function (ev) { ev.preventDefault(); SVOps.state.outreachOpen = !SVOps.state.outreachOpen; render(); } }));
      }
      nav.appendChild(row);
      if (item.children && (SVOps.state.outreachOpen || activeKey.indexOf('outreach') === 0)) {
        var sub = el('div', { class: 'ops-nav__sub' });
        item.children.forEach(function (child) {
          var childActive = navKeyFor(child) === activeKey;
          var ca = el('a', { href: child.hash, text: child.label, class: childActive ? 'is-active' : '' });
          if (childActive) ca.setAttribute('aria-current', 'page');
          sub.appendChild(ca);
        });
        nav.appendChild(sub);
      }
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

      ]),
      el('input', { class: 'ops-global-search', type: 'search', placeholder: 'Search people, firms, opportunities, requests, reports or tools', onkeydown: function (ev) { if (ev.key === 'Enter') runGlobalSearch(ev.target.value); } }),
      el('div', { class: 'ops-topbar__right' }, [
        el('span', { class: 'ops-env-compact', text: (I.demoMode() ? 'Internal Preview · Mock data' : 'Production · Connected data') + ' · R-2026.07' }),
        roleSwitcher(user)
      ])
    ]);
    main.appendChild(topbar);


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

  function runGlobalSearch(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return U.toast('Type a search term first.');
    var pages = [
      ['Home','Page','Open Home',ACTION_REGISTRY.routes.home], ['My Work','Page','Open My Work',ACTION_REGISTRY.routes.myWork], ['Relationships','Page','Open Relationships',ACTION_REGISTRY.routes.relationships], ['Outreach audience review','Audience','Review current audience',ACTION_REGISTRY.routes.reviewAudience], ['ATP audience','Audience','Review ATP audience',ACTION_REGISTRY.routes.reviewAudience], ['Approvals','Approval packages','Open approval queue',ACTION_REGISTRY.routes.approvals], ['MergePoint','Vendor','Open vendor record',ACTION_REGISTRY.routes.firmVendorDetail], ['Tools','Page','Open Tools',ACTION_REGISTRY.routes.tools], ['NorthBridge Pension','Relationship','Open relationship drawer',ACTION_REGISTRY.routes.relationships], ['Sarah Chen at ATP','Person','Open audience row',ACTION_REGISTRY.routes.reviewAudience]
    ];
    var results = pages.filter(function (r) { return r.join(' ').toLowerCase().indexOf(q) > -1; });
    var body = el('div', { class: 'search-results' });
    if (!results.length) body.appendChild(el('p', { text: 'No results found in preview data.' }));
    results.forEach(function (r) {
      body.appendChild(el('button', { type: 'button', class: 'search-result', onclick: function () { location.hash = r[3]; document.querySelector('.drawer-scrim') && document.querySelector('.drawer-scrim').click(); } }, [el('strong', { text: r[0] }), el('span', { text: r[1] + ' · ' + r[2] })]));
    });
    U.drawer('Search results for “' + q + '”', body);
  }

  function environmentBar(user) {
    return el('div', { class: 'ops-demo-banner ops-envbar' }, [
      el('span', { html: '<strong>Environment:</strong> ' + (I.demoMode() ? 'Internal Preview' : 'Production') }),
      el('span', { html: '<strong>Data:</strong> ' + (I.demoMode() ? 'Mock' : 'Connected') }),
      el('span', { html: '<strong>External actions:</strong> ' + (I.demoMode() ? 'Off' : 'On') }),
      el('span', { html: '<strong>Role:</strong> ' + esc(user.displayRole || user.role) })
    ]);
  }

  var TITLES = {
    home: 'Home', preview: 'ShoreVest One', tools: 'Tools',
    myWork: 'My Work', relationships: 'Relationships', outreach: 'Outreach', meetings: 'Meetings',
    diligence: 'Diligence & Requests', investorIntelligence: 'Investor Intelligence', reporting: 'Reporting', approvals: 'Approvals', firm: 'Firm',
    process: 'Process a List', weekly: 'Weekly Reporting',
    dataquality: 'Salesforce Data Quality',
    exceptions: 'Review Exceptions', runs: 'Previous Runs',
    admin: 'Administration', monitoring: 'Monitoring', batch: 'Batch'
  };
  function titleFor(viewId) { return TITLES[viewId] || 'Home'; }

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

    right.appendChild(el('p', { class: 'login__instr', text: 'Choose a demonstration profile to continue.' }));

    var sel = el('select', { class: 'login__select', id: 'login-profile', 'aria-label': 'Choose a demonstration profile' });
    sel.appendChild(el('option', { value: '', text: 'Choose a profile' }));
    DEMO_USERS.forEach(function (u, i) {
      sel.appendChild(el('option', { value: String(i), text: u.name }));
    });
    right.appendChild(el('div', { class: 'login__field' }, [sel]));

      var sel = el('select', { class: 'gate__select', id: 'gate-role', 'aria-label': 'Select role preview' });
      sel.appendChild(el('option', { value: '', text: 'Select a person' }));
      DEMO_USERS.forEach(function (u, i) {
        sel.appendChild(el('option', { value: String(i), text: u.displayRole }));
      });
      sel.addEventListener('change', hideErr);

    var btn = el('button', { class: 'login__submit', type: 'button', disabled: true }, [
      el('span', { class: 'login__submit-label', text: 'Continue' }),
      el('span', { class: 'login__submit-spinner', 'aria-hidden': 'true' })
    ]);

    function renderSummary(u) {
      summary.innerHTML = '';
      if (!u) { summary.hidden = true; return; }
      summary.hidden = false;
      summary.appendChild(avatar(u, 'login__avatar'));
      summary.appendChild(el('div', { class: 'login__selected-id' }, [
        el('p', { class: 'login__selected-name', text: u.name }),
        el('p', { class: 'login__selected-title', text: u.title }),
        u.coverage ? el('p', { class: 'login__selected-cov', text: '(' + u.coverage + ')' }) : null
      ]));
    }

    card.appendChild(el('p', { class: 'gate__note', text: 'Authorised access only.' }));
    if (demo) card.appendChild(el('p', { class: 'gate__preview', text: 'Internal Preview — role permissions and home state.' }));

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
