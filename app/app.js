'use strict';
/* ShoreVest One — application front end. Real client routing; every action
   calls the API (never a connector directly). Only UI preferences use
   localStorage; all workflow state lives on the server. */
(function () {
  var state = { session: null, users: [], role: localStorage.getItem('sv.role') || 'admin' };

  // ── tiny DOM + API helpers ────────────────────────────────────────────────
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] === false || attrs[k] == null) { /* boolean-false / null: omit attribute */ }
      else if (attrs[k] === true) el.setAttribute(k, '');
      else el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x != null) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'x-sv-user': state.role },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); });
  }
  function call(method, path, body) {
    return api(method, path, body).then(function (res) {
      if (res.status >= 400) { throw new Error((res.json && res.json.error && res.json.error.message) || ('HTTP ' + res.status)); }
      return res.json;
    });
  }
  function toast(msg, isErr) {
    var t = h('div', { class: 'toast' + (isErr ? ' err' : '') }, msg);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, isErr ? 5000 : 2600);
  }
  function fail(e) { toast(e.message || String(e), true); }
  function chip(status) {
    var map = { ready: 'ready', held: 'held', 'Needs review': 'needs', blocked: 'blocked', removed: 'muted', Ready: 'ready', Waiting: 'waiting', 'On hold': 'held', Blocked: 'blocked', Suggested: 'suggested', Complete: 'complete', Failed: 'failed', sent: 'sent', failed: 'failed', approved: 'approved', submitted: 'needs', executed: 'complete', partial: 'held', invalidated: 'blocked', accepted: 'ready', draft: 'muted', needs_review: 'needs', changes_requested: 'held',
      // Investment / IC Deck QC
      ok: 'ready', mismatch: 'failed', stale: 'held', missing: 'needs', orphan: 'suggested',
      clean: 'ready', review_advised: 'held', issues_found: 'failed',
      open: 'needs', acknowledged: 'waiting', fixed: 'complete', waived: 'waiting' };
    return h('span', { class: 'chip ' + (map[status] || '') }, String(status));
  }
  var view = document.getElementById('view');
  function setView() { view.innerHTML = ''; for (var i = 0; i < arguments.length; i++) if (arguments[i]) view.appendChild(arguments[i]); }

  // ── navigation ────────────────────────────────────────────────────────────
  var NAV = [
    { group: null, items: [['#/home', 'Home'], ['#/my-work', 'My Work']] },
    { group: 'Workspaces', items: [['#/outreach', 'Outreach'], ['#/relationships', 'Relationships'], ['#/approvals', 'Approvals'], ['#/workspace/meetings', 'Meetings'], ['#/workspace/diligence', 'Diligence & Requests'], ['#/workspace/investor-intel', 'Investor Intelligence']] },
    { group: 'Investment', items: [['#/investment', 'IC Deck QC']] },
    { group: 'System', items: [['#/audit', 'Audit history'], ['#/connectors', 'Connectors']] },
  ];
  function renderNav() {
    var nav = document.getElementById('side-nav');
    nav.innerHTML = '';
    NAV.forEach(function (sec) {
      if (sec.group) nav.appendChild(h('div', { class: 'group' }, sec.group));
      sec.items.forEach(function (it) {
        var active = location.hash.indexOf(it[0]) === 0;
        nav.appendChild(h('a', { href: it[0], class: active ? 'active' : '' }, it[1]));
      });
    });
  }

  // ── boot ──────────────────────────────────────────────────────────────────
  function boot() {
    Promise.all([call('GET', '/session'), call('GET', '/users')]).then(function (r) {
      state.session = r[0]; state.users = r[1].users;
      var banner = document.getElementById('env-banner');
      banner.textContent = r[0].banner;
      if (r[0].externalWritesEnabled) banner.className = 'banner writes-on';
      var sw = document.getElementById('user-switch');
      sw.innerHTML = '';
      state.users.forEach(function (u) {
        var o = h('option', { value: u.role }, u.display_name + ' · ' + u.role);
        if (u.role === state.role) o.selected = true;
        sw.appendChild(o);
      });
      sw.addEventListener('change', function () { state.role = sw.value; localStorage.setItem('sv.role', state.role); call('GET', '/session').then(function (s) { state.session = s; route(); }); });
      route();
    }).catch(fail);
  }
  function can(p) { return state.session && state.session.permissions.indexOf(p) >= 0; }

  // ── router ──────────────────────────────────────────────────────────────
  function route() {
    renderNav();
    var hash = location.hash || '#/home';
    var parts = hash.slice(2).split('/');
    var top = parts[0] || 'home';
    if (top === 'home') return viewHome();
    if (top === 'my-work') return viewMyWork();
    if (top === 'outreach') return parts[1] === 'audience' ? viewAudience(parts[2]) : viewOutreach();
    if (top === 'relationships') return viewRelationships();
    if (top === 'approvals') return parts[1] ? viewApprovalDetail(parts[1]) : viewApprovals();
    if (top === 'audit') return viewAudit();
    if (top === 'connectors') return viewConnectors();
    if (top === 'investment') {
      if (parts[1] === 'deal') return viewDeal(parts[2]);
      if (parts[1] === 'run') return viewQcRun(parts[2]);
      return viewInvestment();
    }
    if (top === 'workspace') return viewWorkspaceShell(parts[1]);
    viewHome();
  }
  window.addEventListener('hashchange', route);

  // ── Home (motherboard) ────────────────────────────────────────────────────
  function viewHome() {
    call('GET', '/workspaces').then(function (r) {
      var cards = r.workspaces.map(function (w) {
        var link = w.maturity === 'shell' ? '#/workspace/' + w.key : (w.key === 'my-work' ? '#/my-work' : w.key === 'investment-qc' ? '#/investment' : '#/' + w.key.replace('investor-intel', 'workspace/investor-intel'));
        return h('div', { class: 'card' },
          h('div', { class: 'between' }, h('strong', {}, w.name), h('span', { class: 'maturity-tag ' + w.maturity }, w.maturity.replace('_', ' '))),
          h('p', { class: 'sub small', style: 'margin:8px 0' }, w.description),
          h('div', { class: 'row small muted' }, h('span', {}, w.records + ' records'), w.dependencies.length ? h('span', {}, '· needs ' + w.dependencies.join(', ')) : null),
          h('div', { class: 'row', style: 'margin-top:10px' }, h('a', { class: 'btn', href: link }, w.maturity === 'shell' ? 'View shell' : 'Open')));
      });
      setView(
        h('h1', {}, 'ShoreVest One'),
        h('p', { class: 'sub' }, 'One internal operating environment. ' + state.session.banner + '. Signed in as ' + (state.session.user ? state.session.user.name + ' (' + state.session.user.role + ')' : 'unknown') + '.'),
        h('div', { class: 'grid' }, cards));
    }).catch(fail);
  }

  // ── My Work ───────────────────────────────────────────────────────────────
  function viewMyWork() {
    call('GET', '/work-items').then(function (r) {
      var rows = r.items.map(function (it) {
        return h('tr', {},
          h('td', {}, chip(it.status)),
          h('td', {}, h('strong', {}, it.title), h('div', { class: 'small muted' }, it.description || '')),
          h('td', {}, it.workspace),
          h('td', { class: 'small' }, it.next_action || ''),
          h('td', {}, it.status !== 'Complete' ? h('button', { onclick: function () { call('POST', '/work-items/' + it.id + '/accept').then(function () { toast('Marked complete'); viewMyWork(); }).catch(fail); } }, 'Complete') : h('span', { class: 'small muted' }, 'done')));
      });
      setView(h('h1', {}, 'My Work'), h('p', { class: 'sub' }, 'What currently depends on you. Shared queue backed by the same records as every workspace.'),
        h('div', { class: 'card' }, r.items.length ? table(['Status', 'Item', 'Workspace', 'Next action', ''], rows) : h('p', { class: 'muted' }, 'Nothing waiting on you right now.')));
    }).catch(fail);
  }

  // ── Outreach home ─────────────────────────────────────────────────────────
  function viewOutreach() {
    Promise.all([call('GET', '/outreach/audiences'), call('GET', '/outreach/reference')]).then(function (r) {
      var audiences = r[0].audiences, ref = r[1];
      var queryInput = h('input', { placeholder: 'e.g. active Denmark pension CIOs', value: 'Denmark contacts' });
      var nameInput = h('input', { placeholder: 'List name (optional)' });
      var searchCard = h('div', { class: 'card' },
        h('h2', {}, '1 · Find people'),
        h('label', {}, 'Natural-language search'), queryInput,
        h('label', {}, 'List name'), nameInput,
        h('div', { class: 'row', style: 'margin-top:10px' },
          h('button', { class: 'primary', onclick: function () {
            call('POST', '/outreach/search', { query: queryInput.value, name: nameInput.value }).then(function (res) {
              if (!res.interpreted) toast(res.message, true);
              location.hash = '#/outreach/audience/' + res.audienceId;
            }).catch(fail);
          } }, 'Search'),
          h('span', { class: 'small muted' }, 'Parsed into structured rules; unsupported queries ask you to adjust.')));

      var pasteInput = h('textarea', { placeholder: 'Paste one codename per line (e.g. Red Fox)' });
      var importCard = h('div', { class: 'card' }, h('h2', {}, 'Or paste names'),
        pasteInput,
        h('button', { style: 'margin-top:8px', onclick: function () {
          var names = pasteInput.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
          call('POST', '/outreach/import', { names: names, name: 'Imported list' }).then(function (res) {
            toast('Matched ' + res.matched + ' of ' + res.requested);
            location.hash = '#/outreach/audience/' + res.audienceId;
          }).catch(fail);
        } }, 'Import & review'));

      var listRows = audiences.map(function (a) {
        return h('tr', {}, h('td', {}, h('a', { href: '#/outreach/audience/' + a.id }, a.name)),
          h('td', {}, a.memberCount + ' people'), h('td', {}, a.readyCount + ' ready'), h('td', { class: 'small muted' }, a.source_query || '—'));
      });
      var savedRows = ref.savedSearches.map(function (s) { return h('li', {}, s.name + ' ', h('span', { class: 'small muted' }, '— ' + s.query_text)); });

      setView(h('h1', {}, 'Outreach'), h('p', { class: 'sub' }, 'Find people, resolve problems, prepare messages, get approval, then request controlled execution.'),
        h('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr' }, searchCard, importCard),
        h('div', { class: 'card' }, h('h2', {}, 'Recent lists'), audiences.length ? table(['List', 'Size', 'Ready', 'Query'], listRows) : h('p', { class: 'muted' }, 'No lists yet.')),
        h('div', { class: 'card' }, h('h2', {}, 'Saved searches'), savedRows.length ? h('ul', {}, savedRows) : h('p', { class: 'muted' }, 'None saved.')));
    }).catch(fail);
  }

  // ── Audience (review + prepare + package) ─────────────────────────────────
  function viewAudience(id) {
    Promise.all([call('GET', '/outreach/audiences/' + id), call('GET', '/outreach/reference')]).then(function (r) {
      var data = r[0], ref = r[1], s = data.summary;
      var stepbar = h('div', { class: 'stepbar' }, ['Find people', 'Review', 'Prepare', 'Approve', 'Execute'].map(function (t, i) { return h('span', { class: 'step' + (i < 2 ? ' done' : '') }, (i + 1) + ' · ' + t); }));
      var stats = h('div', { class: 'grid' },
        stat(s.total, 'people found'), stat(s.ready, 'ready'), stat(s.needReview, 'need review'), stat(s.cannotBeUsed, 'cannot be used'));

      // Actions row
      var actions = h('div', { class: 'row', style: 'margin:6px 0 14px' },
        h('button', { onclick: function () { call('POST', '/outreach/audiences/' + id + '/save-search', { name: data.audience.name }).then(function () { toast('Search saved'); }).catch(fail); } }, 'Save search'),
        h('button', { onclick: function () { call('POST', '/outreach/audiences/' + id + '/export').then(function (res) { downloadCsv(res.filename, res.csv); toast(res.rows + ' eligible rows exported'); }).catch(fail); } }, 'Export CSV (eligible only)'),
        h('button', { onclick: function () { call('POST', '/outreach/audiences/' + id + '/assign', { kind: 'review' }).then(function () { toast('Assigned for review — see My Work'); }).catch(fail); } }, 'Assign for review'),
        h('button', { onclick: function () { call('POST', '/outreach/audiences/' + id + '/assign', { kind: 'research' }).then(function () { toast('Assigned research'); }).catch(fail); } }, 'Assign research'));

      var memberRows = data.members.map(function (m) {
        var p = m.person || {};
        var btns = [];
        if (m.status === 'held') btns.push(actBtn('Mark ready', function () { patchMember(id, m.id, 'ready'); }));
        if (m.status === 'ready') btns.push(actBtn('Hold', function () { patchMember(id, m.id, 'hold', 'manual hold'); }));
        if (m.status !== 'removed' && m.status !== 'blocked') btns.push(actBtn('Remove', function () { patchMember(id, m.id, 'remove'); }));
        return h('tr', {},
          h('td', {}, chip(m.status)),
          h('td', {}, h('strong', {}, p.codename || '—'), h('div', { class: 'small muted' }, p.institutionName || '', p.country ? ' · ' + p.country : '')),
          h('td', { class: 'small' }, m.issue_code ? h('div', {}, h('span', { class: 'chip' }, m.issue_code.replace(/_/g, ' ')), h('div', { class: 'muted', style: 'margin-top:3px' }, m.issue_reason || '')) : h('span', { class: 'muted' }, '—')),
          h('td', { class: 'small' }, m.next_action || ''),
          h('td', {}, h('div', { class: 'drawer-actions' }, btns)));
      });

      // Prepare messages card
      var senderSel = select(ref.senders.map(function (u) { return [u.id, u.display_name]; }));
      var subjIn = h('input', { value: 'Introduction from ShoreVest' });
      var bodyIn = h('textarea', {}, 'Hello,\n\nWe would value the chance to introduce ShoreVest.\n\nBest regards');
      var prepare = h('div', { class: 'card' }, h('h2', {}, '3 · Prepare messages'),
        h('p', { class: 'small muted' }, 'Creates a persisted message group over the ready recipients, with sender + managed signature version.'),
        h('label', {}, 'Sender'), senderSel, h('label', {}, 'Subject'), subjIn, h('label', {}, 'Body'), bodyIn,
        h('button', { class: 'primary', style: 'margin-top:10px', disabled: !can('edit_draft'), onclick: function () {
          call('POST', '/outreach/audiences/' + id + '/drafts', { senderId: senderSel.value, subject: subjIn.value, body: bodyIn.value, name: 'Draft group' })
            .then(function () { toast('Draft group created'); viewAudience(id); }).catch(fail);
        } }, 'Prepare messages'));

      setView(h('div', { class: 'between' }, h('h1', {}, data.audience.name), h('a', { class: 'btn', href: '#/outreach' }, '← All lists')),
        stepbar, h('div', { class: 'card' }, stats, actions),
        prepare,
        draftGroupsSection(id, ref),
        h('div', { class: 'card' }, h('h2', {}, '2 · Review people'), table(['Status', 'Person', 'Issue', 'Next action', ''], memberRows)));
    }).catch(fail);
  }

  function patchMember(audienceId, memberId, action, reason) {
    call('PATCH', '/outreach/audiences/' + audienceId + '/members/' + memberId, { action: action, reason: reason })
      .then(function () { viewAudience(audienceId); }).catch(fail);
  }

  function draftGroupsSection(audienceId, ref) {
    var wrap = h('div', { class: 'card' }, h('h2', {}, '4 · Draft groups & approval package'), h('div', { class: 'small muted' }, 'Loading…'));
    call('GET', '/outreach/audiences/' + audienceId).then(function () {
      // We need draft groups; fetch via a dedicated call embedded in audience? Use messages? Instead fetch groups through reference-less endpoint:
    });
    // Fetch draft groups + packages through the audit-free endpoints we have:
    Promise.all([fetchDraftGroups(audienceId), fetchPackages(audienceId)]).then(function (res) {
      var groups = res[0], packages = res[1];
      wrap.innerHTML = '';
      wrap.appendChild(h('h2', {}, '4 · Draft groups & approval package'));
      if (!groups.length) wrap.appendChild(h('p', { class: 'muted' }, 'No draft groups yet — prepare messages above.'));
      groups.forEach(function (g) {
        var subj = h('input', { value: g.subject || '' });
        var body = h('textarea', {}, g.body || '');
        wrap.appendChild(h('div', { class: 'card', style: 'background:#fbf8f2' },
          h('div', { class: 'between' }, h('strong', {}, g.name), chip(g.status)),
          h('label', {}, 'Subject'), subj, h('label', {}, 'Body'), body,
          h('div', { class: 'row', style: 'margin-top:8px' },
            h('button', { onclick: function () { call('PATCH', '/outreach/draft-groups/' + g.id, { subject: subj.value, body: body.value }).then(function () { toast('Draft edited (re-opens if it was accepted; invalidates approval)'); viewAudience(audienceId); }).catch(fail); } }, 'Save edit'),
            g.status === 'draft' ? h('button', { onclick: function () { markGroup(audienceId, g.id, 'needs_review'); } }, 'Send to review') : null,
            g.status === 'needs_review' ? h('button', { class: 'primary', onclick: function () { markGroup(audienceId, g.id, 'accepted'); } }, 'Mark accepted') : null,
            g.status === 'needs_review' ? h('button', { onclick: function () { markGroup(audienceId, g.id, 'changes_requested'); } }, 'Request changes') : null,
            g.status === 'changes_requested' ? h('button', { onclick: function () { markGroup(audienceId, g.id, 'needs_review'); } }, 'Back to review') : null)));
      });

      // Package builder
      var policySel = select(ref.deliveryPolicies.map(function (p) { return [p.id, p.name + (p.approved ? '' : ' (not approved)')]; }));
      var senderSel = select(ref.senders.map(function (u) { return [u.id, u.display_name]; }));
      wrap.appendChild(h('div', { class: 'row', style: 'margin-top:8px' },
        h('div', { style: 'flex:1' }, h('label', {}, 'Package sender'), senderSel),
        h('div', { style: 'flex:1' }, h('label', {}, 'Delivery policy'), policySel)));
      wrap.appendChild(h('button', { style: 'margin-top:10px', disabled: !can('edit_audience'), onclick: function () {
        call('POST', '/outreach/audiences/' + audienceId + '/packages', { senderId: senderSel.value, deliveryPolicyId: policySel.value }).then(function () { toast('Package created'); viewAudience(audienceId); }).catch(fail);
      } }, 'Create approval package'));

      packages.forEach(function (pkg) {
        wrap.appendChild(packageCard(audienceId, pkg));
      });
    }).catch(fail);
    return wrap;
  }

  function packageCard(audienceId, pkg) {
    var actions = [];
    if (pkg.status === 'draft') actions.push(h('button', { class: 'primary', disabled: !can('submit_approval'), onclick: function () { call('POST', '/outreach/packages/' + pkg.id + '/submit').then(function () { toast('Submitted for approval'); viewAudience(audienceId); }).catch(fail); } }, 'Submit for approval'));
    if (pkg.status === 'submitted') actions.push(h('a', { class: 'btn', href: '#/approvals/' + pkg.id }, 'Open in Approvals →'));
    if (pkg.status === 'approved' || pkg.status === 'partial' || pkg.status === 'failed') actions.push(h('button', { class: 'primary', disabled: !can('request_execution'), onclick: function () { requestExec(audienceId, pkg.id); } }, pkg.status === 'approved' ? 'Request execution' : 'Repair & re-run'));
    if (pkg.status === 'executed') actions.push(h('a', { class: 'btn', href: '#/approvals/' + pkg.id }, 'View results →'));
    return h('div', { class: 'card', style: 'background:#fbf8f2' },
      h('div', { class: 'between' }, h('strong', {}, pkg.name), chip(pkg.status)),
      pkg.version_hash ? h('div', { class: 'small muted' }, 'Frozen version ', h('code', { class: 'mono' }, pkg.version_hash)) : h('div', { class: 'small muted' }, 'Not yet submitted'),
      h('div', { class: 'row', style: 'margin-top:8px' }, actions));
  }
  function requestExec(audienceId, pkgId) {
    var key = 'exec-' + pkgId + '-' + Date.now();
    var path = '/outreach/packages/' + pkgId;
    call('GET', '/approvals/' + pkgId).then(function (r) {
      var endpoint = ['partial', 'failed'].indexOf(r.package.status) >= 0 ? path + '/repair' : path + '/request-execution';
      return call('POST', endpoint, { idempotencyKey: key });
    }).then(function (res) {
      var rr = res.result || {};
      if (rr.failed > 0 || rr.held > 0) toast('Executed with partial results — ' + rr.sent + ' sent, ' + rr.failed + ' failed, ' + rr.held + ' held. Failed rows held for repair.', true);
      else toast('Executed — ' + rr.sent + ' sent.');
      viewAudience(audienceId);
    }).catch(fail);
  }
  function markGroup(audienceId, gid, status) {
    call('POST', '/outreach/draft-groups/' + gid + '/mark', { status: status }).then(function () { viewAudience(audienceId); }).catch(fail);
  }

  // Draft groups / packages are read via dedicated list endpoints (added to API).
  function fetchDraftGroups(audienceId) { return call('GET', '/outreach/audiences/' + audienceId + '/draft-groups').then(function (r) { return r.draftGroups; }); }
  function fetchPackages(audienceId) { return call('GET', '/outreach/audiences/' + audienceId + '/packages').then(function (r) { return r.packages; }); }

  // ── Approvals ─────────────────────────────────────────────────────────────
  function viewApprovals() {
    call('GET', '/approvals').then(function (r) {
      var rows = r.queue.map(function (pkg) {
        return h('tr', {}, h('td', {}, h('a', { href: '#/approvals/' + pkg.id }, pkg.name)), h('td', {}, chip(pkg.status)),
          h('td', {}, (pkg.frozen ? pkg.frozen.recipients.length : 0) + ' recipients'), h('td', { class: 'small muted' }, pkg.version_hash || ''));
      });
      setView(h('h1', {}, 'Approvals'), h('p', { class: 'sub' }, 'Shared approval queue. Approval and execution are separate steps.'),
        h('div', { class: 'card' }, r.queue.length ? table(['Package', 'Status', 'Recipients', 'Version'], rows) : h('p', { class: 'muted' }, 'No packages awaiting approval.')));
    }).catch(fail);
  }
  function viewApprovalDetail(id) {
    call('GET', '/approvals/' + id).then(function (r) {
      var pkg = r.package, f = pkg.frozen;
      var body = [h('div', { class: 'between' }, h('h1', {}, pkg.name), chip(pkg.status)),
        h('p', { class: 'sub' }, 'Frozen version ' + (pkg.version_hash || '—'))];
      if (f) {
        body.push(h('div', { class: 'card' }, h('h2', {}, 'Frozen recipients (' + f.recipients.length + ')'),
          table(['Person', 'Email', 'Status'], f.recipients.slice(0, 60).map(function (rc) { return h('tr', {}, h('td', {}, rc.codename), h('td', { class: 'small' }, rc.email || h('span', { class: 'muted' }, 'none')), h('td', {}, chip(rc.memberStatus))); }))));
        body.push(h('div', { class: 'card' }, h('h2', {}, 'Draft groups'), f.draftGroups.map(function (g) { return h('div', {}, h('strong', {}, g.name), ' — ', chip(g.status), h('div', { class: 'small muted' }, g.subject)); })));
      }
      if (pkg.status === 'submitted') {
        body.push(h('div', { class: 'card' }, h('h2', {}, 'Decision'),
          h('div', { class: 'row' },
            h('button', { class: 'primary', disabled: !can('approve_package'), onclick: function () { call('POST', '/approvals/' + id + '/decide', { decision: 'approved', reason: 'approved in preview' }).then(function () { toast('Approved'); viewApprovalDetail(id); }).catch(fail); } }, 'Approve'),
            h('button', { disabled: !can('approve_package'), onclick: function () { call('POST', '/approvals/' + id + '/decide', { decision: 'returned', reason: 'returned in preview' }).then(function () { toast('Returned'); viewApprovalDetail(id); }).catch(fail); } }, 'Return'))));
      }
      if (['approved', 'partial', 'failed'].indexOf(pkg.status) >= 0) {
        body.push(h('div', { class: 'card' }, h('h2', {}, 'Execution'),
          h('p', { class: 'small muted' }, 'Separate, guarded step. In MOCK mode this runs through the mock mail + Salesforce connectors.'),
          h('button', { class: 'primary', disabled: !can('request_execution'), onclick: function () {
            var key = 'exec-' + id + '-' + Date.now();
            var endpoint = ['partial', 'failed'].indexOf(pkg.status) >= 0 ? '/outreach/packages/' + id + '/repair' : '/outreach/packages/' + id + '/request-execution';
            call('POST', endpoint, { idempotencyKey: key }).then(function (res) { var rr = res.result || {}; toast('Executed — ' + rr.sent + ' sent, ' + rr.failed + ' failed, ' + rr.held + ' held.', rr.failed > 0); viewApprovalDetail(id); }).catch(fail);
          } }, pkg.status === 'approved' ? 'Request execution' : 'Repair failed rows')));
      }
      // Sent & responses
      body.push(sentAndResponses(id));
      setView.apply(null, body);
    }).catch(fail);
  }
  function sentAndResponses(pkgId) {
    var wrap = h('div', { class: 'card' }, h('h2', {}, 'Sent & responses'), h('div', { class: 'small muted' }, 'Loading…'));
    Promise.all([call('GET', '/outreach/messages?packageId=' + pkgId), call('GET', '/outreach/responses')]).then(function (r) {
      wrap.innerHTML = '';
      wrap.appendChild(h('h2', {}, 'Sent & responses'));
      var msgs = r[0].messages;
      if (!msgs.length) { wrap.appendChild(h('p', { class: 'muted' }, 'Nothing sent yet.')); return; }
      wrap.appendChild(table(['Recipient', 'Status', 'Detail'], msgs.map(function (m) { return h('tr', {}, h('td', {}, m.codename), h('td', {}, chip(m.status)), h('td', { class: 'small muted' }, m.error_detail || m.external_id || '')); })));
      var resp = r[1].responses;
      if (resp.length) { wrap.appendChild(h('h2', {}, 'Replies')); wrap.appendChild(table(['From', 'Type', 'Message'], resp.map(function (x) { return h('tr', {}, h('td', {}, x.codename), h('td', {}, chip(x.classification || x.kind)), h('td', { class: 'small' }, x.snippet)); }))); }
    }).catch(fail);
    return wrap;
  }

  // ── Relationships ─────────────────────────────────────────────────────────
  function viewRelationships() {
    call('GET', '/relationships').then(function (r) {
      setView(h('h1', {}, 'Relationships'), h('p', { class: 'sub' }, 'Durable relationship records — the same people that appear in Outreach.'),
        h('div', { class: 'card' }, table(['Person', 'Institution', 'Stage', 'Health', 'Contact status'],
          r.relationships.map(function (x) { return h('tr', {}, h('td', {}, x.codename || '—'), h('td', {}, x.institutionName || ''), h('td', {}, chip(x.stage)), h('td', {}, x.health), h('td', {}, x.personStatus)); }))));
    }).catch(fail);
  }

  // ── Audit ─────────────────────────────────────────────────────────────────
  function viewAudit() {
    call('GET', '/audit-events?limit=250').then(function (r) {
      setView(h('h1', {}, 'Audit history'), h('p', { class: 'sub' }, 'Every material action is recorded. ' + r.events.length + ' recent events.'),
        h('div', { class: 'card' }, table(['When', 'Actor', 'Action', 'Object', 'From → To'],
          r.events.map(function (e) { return h('tr', {}, h('td', { class: 'small muted' }, (e.created_at || '').replace('T', ' ').slice(0, 19)), h('td', { class: 'small' }, e.actor_id || 'system'), h('td', {}, h('code', { class: 'mono' }, e.action)), h('td', { class: 'small' }, e.object_type), h('td', { class: 'small muted' }, (e.previous_state || '∅') + ' → ' + (e.new_state || '∅'))); }))));
    }).catch(fail);
  }

  // ── Connectors ────────────────────────────────────────────────────────────
  function viewConnectors() {
    call('GET', '/connectors').then(function (r) {
      setView(h('h1', {}, 'Connectors'), h('p', { class: 'sub' }, 'Environment: ' + r.mode + '. Swapping a mock for a real connector implements the same interface — no UI change.'),
        h('div', { class: 'card' }, table(['Connector', 'Health', 'Detail'], r.connectors.map(function (c) { return h('tr', {}, h('td', {}, c.name), h('td', {}, chip(c.ok ? 'Complete' : 'Blocked')), h('td', { class: 'small muted' }, c.detail)); }))));
    }).catch(fail);
  }

  // ── Workspace shells ──────────────────────────────────────────────────────
  function viewWorkspaceShell(key) {
    call('GET', '/workspaces').then(function (r) {
      var w = r.workspaces.filter(function (x) { return x.key === key; })[0] || { name: key, description: '', dependencies: [], records: 0, maturity: 'shell' };
      setView(h('h1', {}, w.name), h('div', { class: 'card' },
        h('div', { class: 'between' }, h('strong', {}, 'Production-shaped shell'), h('span', { class: 'maturity-tag ' + w.maturity }, w.maturity)),
        h('p', { class: 'sub', style: 'margin-top:10px' }, w.description),
        h('p', {}, h('strong', {}, w.records + ' '), 'related records already in the shared database.'),
        w.dependencies.length ? h('p', { class: 'notice' }, 'Not connected yet. Depends on: ' + w.dependencies.join(', ') + '. The data model and API boundary exist; connecting is an integration task, not a redesign.') : null));
    }).catch(fail);
  }

  // ── Investment Toolbox — IC Deck QC ─────────────────────────────────────────
  var SEV_RANK = { mismatch: 0, stale: 1, missing: 2, orphan: 3, ok: 4 };
  var SEV_LABEL = { ok: 'OK', mismatch: 'Mismatch', stale: 'Stale', missing: 'Missing', orphan: 'Unsourced' };
  var RUN_LABEL = { clean: 'Clean', review_advised: 'Review advised', issues_found: 'Issues found' };

  function fmtValue(num, text, unit, format) {
    if (text != null && text !== '') return text;
    if (num == null) return '—';
    var noSpace = unit === '%' || unit === 'x';
    return String(num) + (unit ? (noSpace ? '' : ' ') + unit : '');
  }
  function fmtDelta(f) {
    if (f.delta_num == null) return '';
    var d = f.delta_num;
    var sign = d > 0 ? '+' : (d < 0 ? '−' : '');
    return sign + Math.abs(d) + (f.unit && f.unit !== '%' && f.unit !== 'x' ? ' ' + f.unit : (f.unit || ''));
  }

  // Deal list.
  function viewInvestment() {
    call('GET', '/investment/deals').then(function (r) {
      var rows = r.deals.map(function (d) {
        var lr = d.lastRun;
        var summary = lr ? (lr.status === 'clean'
          ? h('span', { class: 'small muted' }, 'All ' + lr.counts.ok + ' figures tie out')
          : h('span', { class: 'small' }, [lr.counts.mismatch ? (lr.counts.mismatch + ' mismatch ') : '', lr.counts.stale ? (lr.counts.stale + ' stale ') : '', lr.counts.missing ? (lr.counts.missing + ' missing ') : '', lr.counts.orphan ? (lr.counts.orphan + ' unsourced') : ''].join('').trim()))
          : h('span', { class: 'small muted' }, 'Not run yet');
        return h('tr', {},
          h('td', {}, h('a', { href: '#/investment/deal/' + d.id }, h('strong', {}, d.code)), h('div', { class: 'small muted' }, d.name)),
          h('td', { class: 'small' }, d.asset_type + (d.jurisdiction ? ' · ' + d.jurisdiction : '')),
          h('td', { class: 'small muted' }, d.ic_date || '—'),
          h('td', {}, d.currentDeck ? ('deck v' + d.currentDeck.version) : '—', d.currentModel ? h('span', { class: 'small muted' }, ' vs model v' + d.currentModel.version) : null),
          h('td', {}, lr ? chip(lr.status) : chip('open')),
          h('td', {}, summary),
          h('td', {}, h('a', { class: 'btn', href: '#/investment/deal/' + d.id }, 'Open')));
      });
      setView(
        h('h1', {}, 'IC Deck QC'),
        h('p', { class: 'sub' }, 'Reconcile every figure in a deal deck against its Excel model before Investment Committee. Catches mis-transcribed numbers, values carried over from an old model, dropped figures, and numbers with no model source.'),
        h('div', { class: 'card' }, table(['Deal', 'Asset', 'IC date', 'Checking', 'Status', 'Last result', ''], rows)),
        legend());
    }).catch(fail);
  }

  function legend() {
    return h('div', { class: 'card small muted' },
      h('strong', {}, 'How figures are classified: '),
      h('span', {}, [
        chip('mismatch'), ' deck differs from the current model  ',
        chip('stale'), ' deck matches an older model version  ',
        chip('missing'), ' model has it, deck omits it  ',
        chip('orphan'), ' number in the deck with no model source  ',
        chip('ok'), ' ties out within tolerance']));
  }

  // Deal detail — pick versions and run QC.
  function viewDeal(id) {
    call('GET', '/investment/deals/' + id).then(function (r) {
      var deal = r.deal;
      var deckSel = select(r.decks.map(function (d) { return [d.id, 'Deck v' + d.version + ' · ' + d.label]; }));
      var modelSel = select(r.models.map(function (m) { return [m.id, 'Model v' + m.version + ' · ' + m.label]; }));
      var curDeck = r.decks.filter(function (d) { return d.is_current; })[0] || r.decks[0];
      var curModel = r.models.filter(function (m) { return m.is_current; })[0] || r.models[0];
      if (curDeck) deckSel.value = curDeck.id;
      if (curModel) modelSel.value = curModel.id;

      var runBtn = h('button', { class: 'primary', disabled: !can('edit_audience') || !curDeck || !curModel, onclick: function () {
        call('POST', '/investment/deals/' + id + '/qc-runs', { deckId: deckSel.value, modelId: modelSel.value })
          .then(function (res) { toast('QC run complete'); location.hash = '#/investment/run/' + res.run.id; }).catch(fail);
      } }, 'Run QC');

      var runsRows = r.runs.map(function (run) {
        return h('tr', {},
          h('td', { class: 'small muted' }, (run.created_at || '').replace('T', ' ').slice(0, 16)),
          h('td', {}, chip(run.status)),
          h('td', { class: 'small' }, run.counts.mismatch + run.counts.stale + ' errors · ' + (run.counts.missing + run.counts.orphan) + ' warnings · ' + run.counts.ok + ' ok'),
          h('td', {}, h('a', { class: 'btn', href: '#/investment/run/' + run.id }, 'View')));
      });

      setView(
        h('div', { class: 'row between' }, h('h1', {}, deal.code + ' · ' + deal.name), h('a', { class: 'btn ghost small', href: '#/investment' }, '← All deals')),
        h('p', { class: 'sub' }, deal.asset_type + (deal.jurisdiction ? ' · ' + deal.jurisdiction : '') + ' · IC ' + (deal.ic_date || 'TBD') + ' · ' + deal.stage),
        h('div', { class: 'card' }, h('h2', {}, 'Run a check'),
          h('p', { class: 'small muted' }, 'Compares the deck’s figures against the model’s authoritative values.'),
          h('div', { class: 'row', style: 'gap:10px;align-items:flex-end;flex-wrap:wrap' },
            h('label', { class: 'small' }, 'Deck', deckSel),
            h('span', { class: 'muted', style: 'padding-bottom:6px' }, 'vs'),
            h('label', { class: 'small' }, 'Model', modelSel),
            runBtn)),
        h('div', { class: 'card' }, h('h2', {}, 'Model versions'),
          table(['Version', 'Label', 'Source', 'Current'], r.models.map(function (m) { return h('tr', {}, h('td', {}, 'v' + m.version), h('td', { class: 'small' }, m.label), h('td', { class: 'small muted mono' }, m.source_ref || '—'), h('td', {}, m.is_current ? chip('ok') : h('span', { class: 'small muted' }, '—'))); }))),
        h('div', { class: 'card' }, h('h2', {}, 'Deck versions'),
          table(['Version', 'Label', 'Source', 'Current'], r.decks.map(function (d) { return h('tr', {}, h('td', {}, 'v' + d.version), h('td', { class: 'small' }, d.label), h('td', { class: 'small muted mono' }, d.source_ref || '—'), h('td', {}, d.is_current ? chip('ok') : h('span', { class: 'small muted' }, '—'))); }))),
        r.runs.length ? h('div', { class: 'card' }, h('h2', {}, 'Run history'), table(['When', 'Status', 'Result', ''], runsRows)) : null);
    }).catch(fail);
  }

  // QC run detail — the findings and their resolution.
  function viewQcRun(id) {
    call('GET', '/investment/qc-runs/' + id).then(function (r) {
      var run = r.run; var c = run.counts;
      var findings = r.findings.slice().sort(function (a, b) {
        var ra = SEV_RANK[a.severity], rb = SEV_RANK[b.severity];
        if (ra !== rb) return ra - rb;
        return (a.slide || 0) - (b.slide || 0);
      });

      var rows = findings.map(function (f) {
        var canResolve = can('resolve_held_record') && f.severity !== 'ok';
        var actions = [];
        if (canResolve && f.resolution === 'open') {
          actions.push(actBtn('Acknowledge', function () { resolveFinding(id, f.id, 'acknowledged'); }));
          actions.push(actBtn('Fixed', function () { resolveFinding(id, f.id, 'fixed'); }));
          actions.push(actBtn('Waive', function () { resolveFinding(id, f.id, 'waived'); }));
        } else if (f.resolution !== 'open') {
          actions.push(chip(f.resolution));
        }
        var note = f.severity === 'stale' && f.matched_version != null ? h('div', { class: 'small muted' }, 'matches model v' + f.matched_version) : null;
        return h('tr', {},
          h('td', {}, chip(f.severity)),
          h('td', {}, h('strong', {}, f.label), note),
          h('td', { class: 'small muted' }, f.slide ? ('Slide ' + f.slide) : '—'),
          h('td', { class: 'mono' }, fmtValue(f.model_num, f.model_text, f.unit, f.format)),
          h('td', { class: 'mono' + (f.severity === 'mismatch' || f.severity === 'stale' ? ' bad' : '') }, fmtValue(f.deck_num, f.deck_text, f.unit, f.format)),
          h('td', { class: 'small muted mono' }, fmtDelta(f)),
          h('td', {}, actions));
      });

      var assignBtn = h('button', { disabled: !can('edit_audience'), onclick: function () {
        call('POST', '/investment/qc-runs/' + id + '/assign', {}).then(function () { toast('Assigned for review — see My Work'); }).catch(fail);
      } }, 'Assign for review');
      var exportBtn = h('button', { class: 'ghost', onclick: function () { exportRun(r); } }, 'Export QC report (CSV)');

      setView(
        h('div', { class: 'row between' }, h('h1', {}, 'QC · ' + (r.deal ? r.deal.code : '')), h('a', { class: 'btn ghost small', href: r.deal ? ('#/investment/deal/' + r.deal.id) : '#/investment' }, '← Deal')),
        h('p', { class: 'sub' }, 'Deck v' + (r.deck ? r.deck.version : '?') + ' checked against model v' + (r.model ? r.model.version : '?') + ' · ' + (run.created_at || '').replace('T', ' ').slice(0, 16)),
        h('div', { class: 'row', style: 'gap:10px;align-items:center;flex-wrap:wrap' }, chip(run.status), h('strong', {}, RUN_LABEL[run.status] || run.status)),
        h('div', { class: 'row', style: 'gap:12px;flex-wrap:wrap;margin:12px 0' },
          stat(c.mismatch, 'mismatch'), stat(c.stale, 'stale'), stat(c.missing, 'missing'), stat(c.orphan, 'unsourced'), stat(c.ok, 'tie out')),
        h('div', { class: 'row', style: 'gap:8px;margin-bottom:12px' }, assignBtn, exportBtn),
        h('div', { class: 'card' }, table(['', 'Figure', 'Location', 'Model', 'In deck', 'Δ', 'Resolution'], rows)),
        legend());
    }).catch(fail);
  }

  function resolveFinding(runId, findingId, resolution) {
    call('POST', '/investment/findings/' + findingId + '/resolve', { resolution: resolution }).then(function () { toast('Marked ' + resolution); viewQcRun(runId); }).catch(fail);
  }

  function exportRun(r) {
    var head = ['deal', 'severity', 'metric', 'label', 'slide', 'model_value', 'deck_value', 'delta', 'matched_model_version', 'resolution'];
    var lines = [head.join(',')];
    r.findings.forEach(function (f) {
      var row = [r.deal ? r.deal.code : '', f.severity, f.metric_key, '"' + String(f.label).replace(/"/g, '""') + '"', f.slide || '', (f.model_num != null ? f.model_num : (f.model_text || '')), (f.deck_num != null ? f.deck_num : (f.deck_text || '')), (f.delta_num != null ? f.delta_num : ''), (f.matched_version != null ? f.matched_version : ''), f.resolution];
      lines.push(row.join(','));
    });
    downloadCsv('qc-' + (r.deal ? r.deal.code : 'run') + '.csv', lines.join('\n'));
  }

  // ── small builders ────────────────────────────────────────────────────────
  function table(headers, rows) { return h('table', {}, h('thead', {}, h('tr', {}, headers.map(function (x) { return h('th', {}, x); }))), h('tbody', {}, rows)); }
  function stat(n, l) { return h('div', { class: 'card stat' }, h('span', { class: 'n' }, String(n)), h('span', { class: 'l' }, l)); }
  function actBtn(label, fn) { return h('button', { class: 'ghost small', onclick: fn }, label); }
  function select(pairs) { var s = h('select', {}); pairs.forEach(function (p) { s.appendChild(h('option', { value: p[0] }, p[1])); }); return s; }
  function downloadCsv(name, csv) { var a = h('a', { href: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv), download: name }); document.body.appendChild(a); a.click(); a.remove(); }

  boot();
})();
