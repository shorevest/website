/* ==========================================================================
   ShoreVest Operations — Application shell
   Authentication gate (Microsoft Entra ID via MSAL in production; a clearly
   labelled demonstration identity chooser in demo mode), primary navigation
   with role-based visibility, hash router, and the Dashboard.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var R = root.SVPortalRules;
  var S = root.SVPortalStore;
  var I = root.SVPortalIntegrations;
  var el = U.el, esc = U.esc;
  function frag(html) { return U.frag(html); }

  var ROOT_ID = 'svops-root';
  /* Dark-on-light lockup — the shell and login now sit on light surfaces. */
  var LOGO = '../assets/brand/sv-lockup-fc-dark.png';

  /* Demonstration identities — synthetic, one per role. No real credentials. */
  var DEMO_USERS = [
    { name: 'A. Employee', username: 'employee@shorevest.example', role: R.ROLES.EMPLOYEE },
    { name: 'B. IR Operations', username: 'ir.ops@shorevest.example', role: R.ROLES.IR_OPERATIONS },
    { name: 'C. Relationship Manager', username: 'rm@shorevest.example', role: R.ROLES.RELATIONSHIP_MANAGER },
    { name: 'D. Execution Approver', username: 'approver@shorevest.example', role: R.ROLES.EXECUTION_APPROVER },
    { name: 'E. Administrator', username: 'admin@shorevest.example', role: R.ROLES.ADMINISTRATOR },
    { name: 'F. Auditor', username: 'auditor@shorevest.example', role: R.ROLES.AUDITOR }
  ];

  var SESSION_KEY = 'svops.session.v1';

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
    location.hash = '#/dashboard';
    render();
  }

  function signOut() {
    SVOps.state.user = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    I.EntraAuth.signOut();
    render();
  }

  /* ── Navigation model (role-gated) ─────────────────────────────────────── */

  var NAV = [
    { id: 'dashboard', label: 'Dashboard', hash: '#/dashboard', cap: null },
    { id: 'process', label: 'Process a List', hash: '#/process', cap: 'submitFiles' },
    { id: 'weekly', label: 'Weekly Reporting', hash: '#/weekly', cap: 'submitFiles' },
    { id: 'dataquality', label: 'Salesforce Data Quality', hash: '#/dataquality', cap: 'submitFiles' },
    { id: 'outreach', label: 'Outreach Preparation', hash: '#/outreach', cap: 'submitFiles' },
    { id: 'exceptions', label: 'Review Exceptions', hash: '#/exceptions', cap: 'reviewExceptions' },
    { id: 'runs', label: 'Previous Runs', hash: '#/runs', cap: null },
    { sep: 'Administration' },
    { id: 'admin', label: 'Administration', hash: '#/admin', cap: 'administer' },
    { id: 'monitoring', label: 'Monitoring', hash: '#/monitoring', cap: 'viewMonitoring' }
  ];

  function visibleNav(user) {
    return NAV.filter(function (item) {
      if (item.sep) return true;
      return !item.cap || R.can(user.role, item.cap);
    });
  }

  /* ── Router ────────────────────────────────────────────────────────────── */

  var ROUTES = {
    dashboard: 'dashboard', process: 'process', weekly: 'weekly',
    dataquality: 'dataquality', outreach: 'outreach', exceptions: 'exceptions',
    runs: 'runs', admin: 'admin', monitoring: 'monitoring', batch: 'batch'
  };

  function parseHash() {
    var h = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { view: parts[0] || 'dashboard', params: parts.slice(1) };
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  function render() {
    var mount = document.getElementById(ROOT_ID);
    if (!mount) return;
    var user = currentUser();
    if (!user) { mount.innerHTML = ''; mount.appendChild(renderGate()); return; }

    var route = parseHash();
    var viewId = route.view;

    /* Access control at the route level (fail closed). */
    var navItem = NAV.filter(function (n) { return n.id === viewId; })[0];

    mount.innerHTML = '';
    mount.appendChild(renderShell(user, viewId, route.params, navItem));
  }

  function renderShell(user, viewId, params, navItem) {
    var shell = el('div', { class: 'ops-shell' });

    /* Sidebar */
    var sidebar = el('aside', { class: 'ops-sidebar' + (SVOps.state.menuOpen ? ' is-open' : '') });
    sidebar.appendChild(el('div', { class: 'ops-sidebar__brand' }, [
      el('img', { src: LOGO, alt: 'ShoreVest', width: '148', height: '36' }),
      el('p', { class: 'ops-sidebar__title', html: '<span class="rule"></span>ShoreVest One' }),
      el('p', { class: 'ops-sidebar__env', text: I.demoMode() ? 'Demonstration environment' : 'Production' })
    ]));

    var nav = el('nav', { class: 'ops-nav', 'aria-label': 'Primary' });
    visibleNav(user).forEach(function (item) {
      if (item.sep) { nav.appendChild(el('p', { class: 'ops-nav__sep', text: item.sep })); return; }
      var a = el('a', { href: item.hash, text: item.label, class: item.id === viewId ? 'is-active' : '' });
      a.addEventListener('click', function () { SVOps.state.menuOpen = false; });
      nav.appendChild(a);
    });
    sidebar.appendChild(nav);

    sidebar.appendChild(el('div', { class: 'ops-sidebar__foot' }, [
      el('span', { html: '<strong>' + esc(user.name) + '</strong><span class="role">' + esc(user.role) + '</span>' }),
      el('button', { type: 'button', text: 'Sign out', onclick: signOut })
    ]));
    shell.appendChild(sidebar);

    /* Main */
    var main = el('div', { class: 'ops-main' });

    var burger = el('button', { class: 'ops-burger', type: 'button', html: '☰ Menu', onclick: function () {
      SVOps.state.menuOpen = !SVOps.state.menuOpen; render();
    } });
    var topbar = el('div', { class: 'ops-topbar' }, [
      el('div', { style: 'display:flex;align-items:center;gap:14px' }, [
        burger,
        el('span', { class: 'ops-topbar__crumb', html: 'ShoreVest One / <strong>' + esc(navItem ? navItem.label : titleFor(viewId)) + '</strong>' })
      ]),
      el('div', { class: 'ops-topbar__right' }, [
        el('span', { text: S.RULES_VERSION + ' · ' + S.TEMPLATE_VERSION }),
        el('span', { html: I.demoMode() ? U.statusHtml('Demo', 'st--warn') : U.statusHtml('Live', 'st--ok') })
      ])
    ]);
    main.appendChild(topbar);

    if (I.demoMode()) {
      main.appendChild(el('div', { class: 'ops-demo-banner', html:
        '<strong>Demonstration</strong> Synthetic data, stored only in this browser. No external actions occur.' }));
    }

    var content = el('div', { style: 'flex:1' });
    main.appendChild(content);
    routeInto(content, user, viewId, params);
    shell.appendChild(main);
    return shell;
  }

  function titleFor(viewId) {
    var n = NAV.filter(function (x) { return x.id === viewId; })[0];
    return n ? n.label : 'Dashboard';
  }

  function routeInto(content, user, viewId, params) {
    var view = SVOps.views[ROUTES[viewId] || 'dashboard'];
    if (viewId === 'dashboard' || !view) return SVOps.views.dashboard(content, user);
    try {
      view(content, user, params);
    } catch (e) {
      content.appendChild(U.stateScreen('error', 'Something went wrong',
        'This view could not be rendered: ' + e.message));
      if (root.console) root.console.error(e);
    }
  }

  /* ── Dashboard ─────────────────────────────────────────────────────────── */

  SVOps.views.dashboard = function (container, user) {
    var page = el('div', { class: 'ops-content' });
    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'Dashboard' }),
      el('h1', { class: 'ops-h1', text: 'Welcome, ' + user.name }),
      el('p', { class: 'ops-lede', text: 'One controlled entry point for routine processing. Upload a list, confirm how the system interpreted it, and run a controlled process. The system may stop unnecessarily, but it must never continue incorrectly.' })
    ]));

    /* Personal / operational metrics */
    var batches = S.getBatches();
    var mine = R.can(user.role, 'viewAllBatches') ? batches : batches.filter(function (b) { return b.submittedBy === user.name; });
    var awaitingReview = mine.reduce(function (n, b) { return n + b.reviewRows; }, 0);
    var awaitingApproval = mine.filter(function (b) { return b.status === R.BATCH_STATUS.AWAITING_APPROVAL; }).length;
    var failed = mine.filter(function (b) { return b.status === 'Failed' || b.status === 'Failed Reconciliation'; }).length;

    var stats = el('div', { class: 'ops-stats', style: 'margin-bottom:22px' });
    [['Your batches', mine.length], ['Rows awaiting review', awaitingReview],
     ['Awaiting approval', awaitingApproval], ['Failed', failed]].forEach(function (p) {
      stats.appendChild(el('div', { class: 'ops-stat' }, [
        el('p', { class: 'ops-stat__k', text: p[0] }),
        el('p', { class: 'ops-stat__v', text: U.fmtInt(p[1]) })
      ]));
    });
    page.appendChild(stats);

    /* Module grid */
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

    /* Recent batches */
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

  /* ── Sign-in gate ──────────────────────────────────────────────────────── */

  function renderGate() {
    var demo = I.demoMode();
    var gate = el('div', { class: 'gate' });
    var card = el('main', { class: 'gate__card' });

    /* Restrained brand — mark, wordmark, product name. No explanatory copy. */
    card.appendChild(el('div', { class: 'gate__brand' }, [
      el('img', { src: LOGO, alt: 'ShoreVest', width: '172', height: '42' }),
      el('p', { class: 'gate__product', html: '<span class="rule"></span>ShoreVest One' })
    ]));

    var form = el('div', { class: 'gate__form' });

    if (demo) {
      var err = el('p', { class: 'gate__error', role: 'alert', hidden: true });
      function hideErr() { err.hidden = true; err.textContent = ''; }
      function showErr(m) { err.textContent = m; err.hidden = false; }

      var sel = el('select', { class: 'gate__select', id: 'gate-role', 'aria-label': 'Select access role' });
      sel.appendChild(el('option', { value: '', text: 'Select access role' }));
      DEMO_USERS.forEach(function (u, i) { sel.appendChild(el('option', { value: String(i), text: u.role })); });
      sel.addEventListener('change', hideErr);

      var enter = el('button', { class: 'gate__submit', type: 'button' }, [
        el('span', { class: 'gate__submit-label', text: 'Enter ShoreVest One' }),
        el('span', { class: 'gate__submit-spinner', 'aria-hidden': 'true' })
      ]);
      enter.addEventListener('click', function () {
        if (enter.classList.contains('is-loading')) return;
        if (sel.value === '') { showErr('Select a role to continue.'); sel.focus(); return; }
        hideErr();
        enter.classList.add('is-loading');
        enter.disabled = true; sel.disabled = true;
        var u = DEMO_USERS[Number(sel.value)];
        /* Brief settle so the loading state is perceptible before the shell mounts. */
        setTimeout(function () { signInDemo(u); }, 240);
      });

      form.appendChild(sel);
      form.appendChild(err);
      form.appendChild(enter);
    } else {
      var msBtn = el('button', { class: 'gate__ms', type: 'button' });
      msBtn.appendChild(frag('<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="1" y="1" width="7.6" height="7.6" fill="#F35325"/><rect x="9.4" y="1" width="7.6" height="7.6" fill="#81BC06"/><rect x="1" y="9.4" width="7.6" height="7.6" fill="#05A6F0"/><rect x="9.4" y="9.4" width="7.6" height="7.6" fill="#FFBA08"/></svg>'));
      msBtn.appendChild(el('span', { class: 'gate__ms-label', text: 'Sign in' }));
      msBtn.appendChild(el('span', { class: 'gate__submit-spinner', 'aria-hidden': 'true' }));
      msBtn.addEventListener('click', function () {
        if (msBtn.classList.contains('is-loading')) return;
        msBtn.classList.add('is-loading'); msBtn.disabled = true;
        I.EntraAuth.signIn().catch(function (e) {
          msBtn.classList.remove('is-loading'); msBtn.disabled = false; U.toast(e.message);
        });
      });
      form.appendChild(msBtn);
    }
    card.appendChild(form);

    card.appendChild(el('p', { class: 'gate__note', text: 'Authorised access only.' }));
    if (demo) card.appendChild(el('p', { class: 'gate__preview', text: 'Preview — sign-in simulated.' }));

    gate.appendChild(card);
    return gate;
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */

  function boot() {
    /* Handle the wizard preset from module launchers. */
    root.addEventListener('svops:render', function () { render(); });
    root.addEventListener('hashchange', function () {
      /* Apply a pending saved-process preset when entering the wizard. */
      if (parseHash().view === 'process' && SVOps.state.wizardPreset) {
        SVOps.state.wizard = null; /* reset */
      }
      render();
    });
    I.EntraAuth.initialize().catch(function () { /* demo mode resolves locally */ }).then(function () {
      /* Apply preset if navigating straight into process. */
      render();
      applyWizardPreset();
    });
  }

  function applyWizardPreset() {
    if (parseHash().view === 'process' && SVOps.state.wizardPreset) {
      var proc = S.getSavedProcess(SVOps.state.wizardPreset);
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
  } else {
    boot();
  }

})(typeof self !== 'undefined' ? self : this);
