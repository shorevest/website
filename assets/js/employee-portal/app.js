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
  var P = root.SVPortalPersonas;
  var el = U.el, esc = U.esc;
  function frag(html) { return U.frag(html); }

  var ROOT_ID = 'svops-root';
  /* Dark-on-light lockup — the shell and login now sit on light surfaces. */
  var LOGO = '../assets/brand/sv-lockup-fc-dark.png';

  /* Demonstration identities — three named ShoreVest people, one per role
     profile. Each carries a persona id (its Home and navigation) and a shared
     underlying capability role that keeps the legacy Tools prototype working.
     Everything external in the demonstration is synthetic. */
  var DEMO_USERS = P.list.map(function (p) {
    return { personaId: p.id, name: p.name, displayRole: p.displayRole,
      username: p.username, role: p.role };
  });

  var SESSION_KEY = 'svops.session.v2';

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
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    I.EntraAuth.signOut();
    render();
  }

  /* ── Navigation model ──────────────────────────────────────────────────
     The permanent navigation comes from the selected persona. It ends on
     Tools, which holds the preserved operational prototype. */

  function personaNav(user) {
    var persona = user && user.personaId && P.byId(user.personaId);
    return (persona && persona.nav) || [];
  }

  /* Legacy Tools routes — reached via the Tools hub, and kept highlighted
     under Tools while the user is inside one of them. */
  var TOOLS_ROUTES = ['tools', 'process', 'weekly', 'dataquality', 'outreach',
    'exceptions', 'runs', 'admin', 'monitoring', 'batch'];

  /* ── Router ────────────────────────────────────────────────────────────── */

  var ROUTES = {
    home: 'home', preview: 'preview', tools: 'tools',
    process: 'process', weekly: 'weekly',
    dataquality: 'dataquality', outreach: 'outreach', exceptions: 'exceptions',
    runs: 'runs', admin: 'admin', monitoring: 'monitoring', batch: 'batch'
  };

  function parseHash() {
    var h = (location.hash || '#/home').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { view: parts[0] || 'home', params: parts.slice(1) };
  }

  /* Which persona nav item should read as active for the current route. */
  function activeNavKey(route) {
    if (route.view === 'preview') return 'preview:' + (route.params[0] || '');
    if (TOOLS_ROUTES.indexOf(route.view) !== -1) return 'tools';
    return route.view;
  }

  function navKeyFor(item) {
    if (item.key === 'tools') return 'tools';
    if (item.hash && item.hash.indexOf('#/preview/') === 0) {
      return 'preview:' + item.hash.slice('#/preview/'.length);
    }
    return item.key;
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  function render() {
    var mount = document.getElementById(ROOT_ID);
    if (!mount) return;
    var user = currentUser();
    if (!user) { mount.innerHTML = ''; mount.appendChild(renderGate()); return; }

    var route = parseHash();
    var viewId = route.view;

    /* Which persona nav item labels this route (for crumb + active state). */
    var activeKey = activeNavKey(route);
    var navItem = personaNav(user).filter(function (n) {
      return !n.sep && navKeyFor(n) === activeKey;
    })[0];

    mount.innerHTML = '';
    mount.appendChild(renderShell(user, viewId, route.params, navItem, activeKey));
  }

  function renderShell(user, viewId, params, navItem, activeKey) {
    var shell = el('div', { class: 'ops-shell' });

    /* Sidebar */
    var sidebar = el('aside', { class: 'ops-sidebar' + (SVOps.state.menuOpen ? ' is-open' : '') });
    sidebar.appendChild(el('div', { class: 'ops-sidebar__brand' }, [
      el('img', { src: LOGO, alt: 'ShoreVest', width: '148', height: '36' }),
      el('p', { class: 'ops-sidebar__title', html: '<span class="rule"></span>ShoreVest One' }),
      el('p', { class: 'ops-sidebar__env', text: I.demoMode() ? 'Demonstration environment' : 'Production' })
    ]));

    var nav = el('nav', { class: 'ops-nav', 'aria-label': 'Primary' });
    personaNav(user).forEach(function (item) {
      if (item.sep) { nav.appendChild(el('p', { class: 'ops-nav__sep', text: item.sep })); return; }
      var isActive = navKeyFor(item) === activeKey;
      var a = el('a', { href: item.hash, text: item.label, class: isActive ? 'is-active' : '' });
      if (isActive) a.setAttribute('aria-current', 'page');
      a.addEventListener('click', function () { SVOps.state.menuOpen = false; });
      nav.appendChild(a);
    });
    sidebar.appendChild(nav);

    sidebar.appendChild(el('div', { class: 'ops-sidebar__foot' }, [
      el('span', { html: '<strong>' + esc(user.name) + '</strong><span class="role">' + esc(user.displayRole || user.role) + '</span>' }),
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

  var TITLES = {
    home: 'Home', preview: 'ShoreVest One', tools: 'Tools',
    process: 'Process a List', weekly: 'Weekly Reporting',
    dataquality: 'Salesforce Data Quality', outreach: 'Outreach Preparation',
    exceptions: 'Review Exceptions', runs: 'Previous Runs',
    admin: 'Administration', monitoring: 'Monitoring', batch: 'Batch'
  };
  function titleFor(viewId) { return TITLES[viewId] || 'Home'; }

  function routeInto(content, user, viewId, params) {
    var view = SVOps.views[ROUTES[viewId] || 'home'];
    if (!view) return SVOps.views.home(content, user);
    try {
      view(content, user, params);
    } catch (e) {
      content.appendChild(U.stateScreen('error', 'Something went wrong',
        'This view could not be rendered: ' + e.message));
      if (root.console) root.console.error(e);
    }
  }

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

      var sel = el('select', { class: 'gate__select', id: 'gate-role', 'aria-label': 'Select demonstration profile' });
      sel.appendChild(el('option', { value: '', text: 'Select a person' }));
      DEMO_USERS.forEach(function (u, i) {
        sel.appendChild(el('option', { value: String(i), text: u.name + ' — ' + u.displayRole }));
      });
      sel.addEventListener('change', hideErr);

      var enter = el('button', { class: 'gate__submit', type: 'button' }, [
        el('span', { class: 'gate__submit-label', text: 'Enter ShoreVest One' }),
        el('span', { class: 'gate__submit-spinner', 'aria-hidden': 'true' })
      ]);
      enter.addEventListener('click', function () {
        if (enter.classList.contains('is-loading')) return;
        if (sel.value === '') { showErr('Select a person to continue.'); sel.focus(); return; }
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
