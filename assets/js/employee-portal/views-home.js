/* ==========================================================================
   ShoreVest One — Home, preview shells, and Tools hub
   Home is the calm personal workbench: Needs you, Today, Waiting elsewhere,
   and nothing else. Card actions are lightweight local preview only —
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
     Not persisted: reloading resets the preview, which is intended. */
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

    page.appendChild(el('div', { class: 'ops-pagehead home-pagehead' }, [
      el('p', { class: 'ops-label', text: 'Home' }),
      el('h1', { class: 'ops-h1', text: greeting() + ', ' + firstName(user) }),
      el('p', { class: 'ops-lede', text: 'Your decisions, actions and blocked items in one place.' }),
      el('p', { class: 'home-doctrine', text: 'Salesforce remains the official commercial record. ShoreVest One controls review, approvals and next actions.' })
    ]));

    if (!persona) {
      page.appendChild(U.stateScreen('empty', 'No Home configured',
        'This role has no Home view yet. Open Tools for the preserved workflow utilities.',
        [el('a', { class: 'btn', href: '#/tools', text: 'Go to Tools' })]));
      container.appendChild(page);
      return;
    }

    var home = persona.home;
    var decide = home.needsYou || [];
    var doItems = home.today || [];
    var waiting = home.waiting || [];
    var first = decide[0] || doItems[0] || waiting[0];

    page.appendChild(el('section', { class: 'home-command', 'aria-label': 'Today summary' }, [
      el('div', { class: 'home-command__main' }, [
        el('p', { class: 'home-command__count', text: 'Today: ' + decide.length + ' decisions · ' + doItems.length + ' actions · ' + waiting.length + ' waiting · 1 warning' }),
        el('p', { class: 'home-command__start', html: '<strong>Start here:</strong> ' + esc(first ? first.explanation : 'Nothing needs you right now.') }),
        el('button', { type: 'button', class: 'btn btn--primary', text: 'Start first item', onclick: function () { if (first) openItemDrawer(first); } })
      ]),
      el('aside', { class: 'home-warning', role: 'status' }, [
        el('p', { class: 'home-warning__title', text: 'Warning' }),
        el('p', { class: 'home-warning__text', text: home.warning || 'Suggested work is not official until accepted.' }),
        el('button', { type: 'button', class: 'btn btn--sm btn--quiet', text: 'Review warnings', onclick: function () { openWarning(home.warning, persona.name); } })
      ])
    ]));

    page.appendChild(el('div', { class: 'home-workgrid' }, [
      renderHomeSection('Decide', 'Requires your judgement before work can move.', decide, true),
      renderHomeSection('Do', 'Ready for you to complete.', doItems, false),
      renderHomeSection('Waiting', 'No action until someone else responds.', waiting, false)
    ]));

    page.appendChild(renderRecent(home.recent || []));
    container.appendChild(page);
  };

  function renderHomeSection(title, subtitle, items, highlightFirst) {
    var section = el('section', { class: 'home-section', 'aria-label': title });
    section.appendChild(el('div', { class: 'home-section__head' }, [
      el('div', {}, [el('h2', { class: 'home-section__title', text: title }), el('p', { class: 'home-section__sub', text: subtitle })]),
      el('span', { class: 'home-section__count', title: 'Queue count', text: items && items.length ? String(items.length) : '' })
    ]));
    if (!items || !items.length) {
      section.appendChild(el('div', { class: 'home-empty' }, [el('p', { class: 'home-empty__title', text: 'Nothing here right now.' })]));
      return section;
    }
    var cards = el('div', { class: 'home-cards' });
    items.forEach(function (item, idx) { cards.appendChild(renderWorkCard(item, highlightFirst && idx === 0)); });
    section.appendChild(cards);
    return section;
  }

  function renderWorkCard(item, recommended) {
    var node = el('article', { class: 'home-card' + (recommended ? ' home-card--recommended' : ''), tabindex: '0', role: 'button' });
    node.addEventListener('click', function () { openItemDrawer(item); });
    node.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openItemDrawer(item); } });
    if (recommended) node.appendChild(el('span', { class: 'home-card__flag', text: 'Recommended first' }));
    node.appendChild(el('h3', { class: 'home-card__title', text: item.title }));
    node.appendChild(el('p', { class: 'home-card__explain', text: item.explanation }));
    node.appendChild(el('div', { class: 'home-card__meta', html: '<span>Status: ' + U.statusHtml(item.status || 'Ready') + '</span><span><strong>Next step:</strong> ' + esc(item.next || 'Open the item.') + '</span>' }));
    node.appendChild(el('div', { class: 'home-card__actions' }, [
      el('button', { type: 'button', class: 'btn btn--sm btn--primary', text: item.cta || 'Open item', onclick: function (ev) { ev.stopPropagation(); openItemDrawer(item); } })
    ]));
    node.appendChild(el('button', { type: 'button', class: 'home-card__why', text: 'Why am I seeing this?', onclick: function (ev) { ev.stopPropagation(); openWhy(item); } }));
    return node;
  }

  function renderRecent(items) {
    var section = el('section', { class: 'home-recent', 'aria-label': 'Recent Work' });
    section.appendChild(el('h2', { class: 'home-section__title', text: 'Recent Work' }));
    var list = el('div', { class: 'home-recent__list' });
    (items || []).slice(0, 3).forEach(function (item) {
      list.appendChild(el('button', { type: 'button', class: 'home-recent__row', onclick: function () { openItemDrawer({ title: item.title, explanation: item.note, status: 'Complete', next: 'No action needed.', owner: 'ShoreVest One', source: 'Activity history', rule: 'Recent work is shown for context', why: item.note, ignored: 'Nothing happens; this is informational.', systems: 'ShoreVest One activity log', history: [item.note] }); } }, [
        el('strong', { text: item.title }), el('span', { text: item.note })
      ]));
    });
    section.appendChild(list);
    return section;
  }

  function openWhy(item) {
    var body = el('div', { class: 'home-drawer-copy' }, [
      detailRow('Source', item.source),
      detailRow('Rule', item.rule),
      detailRow('Owner', item.owner),
      detailRow('Why it matters', item.why),
      detailRow('What happens if ignored', item.ignored)
    ]);
    U.drawer('Why am I seeing this?', body);
  }

  function openItemDrawer(item) {
    var allowed = actionList(item.section === 'Waiting' ? ['Wait', 'Open My Work item'] : [item.cta || 'Open item', 'Open My Work item', 'Mark for review']);
    var history = el('ul', { class: 'home-history' });
    (item.history || []).forEach(function (h) { history.appendChild(el('li', { text: h })); });
    var body = el('div', { class: 'home-drawer-copy' }, [
      detailRow('What this is', item.explanation),
      detailRow('Current state', item.status || 'Ready'),
      detailRow('Why it appeared', item.why),
      detailRow('Source systems', item.systems || item.source),
      detailRow('Owner', item.owner),
      detailRow('Next action', item.next),
      detailNode('Allowed actions', allowed),
      detailNode('Activity history', history),
      el('div', { class: 'home-drawer-actions' }, [
        el('a', { class: 'btn btn--primary', href: item.href || '#/my-work', text: 'Open My Work item' }),
        el('button', { type: 'button', class: 'btn btn--quiet', text: 'Copy link', onclick: function () { U.toast('Link copied for preview.'); } })
      ])
    ]);
    U.drawer(item.title, body);
  }

  function openWarning(text, owner) {
    var body = el('div', { class: 'home-drawer-copy' }, [
      detailRow('Source', 'ShoreVest One controls + MergePoint inputs'),
      detailRow('Rule', 'Suggested work and stale rankings require human review before they affect official records.'),
      detailRow('Owner', owner),
      detailRow('Why it matters', text || 'Suggested work is not official until accepted.'),
      detailRow('What happens if ignored', 'Suggested items stay held and official Salesforce records remain unchanged.')
    ]);
    U.drawer('Review warnings', body);
  }

  function detailRow(label, value) {
    return el('div', { class: 'home-detail-row' }, [el('strong', { text: label }), el('span', { text: value || '—' })]);
  }
  function detailNode(label, node) {
    return el('div', { class: 'home-detail-row home-detail-row--stack' }, [el('strong', { text: label }), node]);
  }
  function actionList(items) {
    var ul = el('ul', { class: 'home-history' });
    items.forEach(function (item) { ul.appendChild(el('li', { text: item })); });
    return ul;
  }

  /* Clear a container and hand it back — used to re-render Home in place. */
  function replace(container) { container.innerHTML = ''; return container; }

  /* ── Preview shells for future-facing navigation ────────────────────────── */

  SVOps.views.preview = function (container, user, params) {
    var key = params && params[0];
    var info = key && P.preview(key);
    var page = el('div', { class: 'ops-content ops-content--narrow' });

    if (!info) {
      page.appendChild(el('div', { class: 'ops-pagehead' }, [
        el('p', { class: 'ops-label', text: 'ShoreVest One' }),
        el('h1', { class: 'ops-h1', text: 'Coming soon' }),
        el('p', { class: 'ops-lede', text: 'This area is not part of the current preview scope.' })
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
      '<span class="st st--review">Preview — not yet connected</span></div>'));
    var ul = el('ul', { class: 'home-preview__list' });
    info.points.forEach(function (pt) { ul.appendChild(el('li', { text: pt })); });
    panel.appendChild(ul);
    page.appendChild(panel);

    page.appendChild(U.notice('info',
      '<strong>Internal preview</strong> This is a preview of where the ' + esc(info.label) +
      ' workflow will live. It performs no external actions until connected and approved.'));

    page.appendChild(el('a', { class: 'btn btn--quiet', href: '#/home', text: 'Back to Home' }));
    container.appendChild(page);
  };

  /* ── Tools hub — the preserved workflow utilities ────────────────────── */

  SVOps.views.tools = function (container, user) {
    var page = el('div', { class: 'ops-content' });
    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'Tools' }),
      el('h1', { class: 'ops-h1', text: 'Operational tools' }),
      el('p', { class: 'ops-lede', text: 'The existing list-processing and rules prototype. Upload a list, confirm how it was interpreted, and run a controlled process. The system may stop unnecessarily, but it must never continue incorrectly.' })
    ]));

    var modules = [
      { n: '1', name: 'Process a List', desc: 'Upload Excel, CSV, or a Salesforce report and generate a controlled output.', hash: '#/process', cap: 'submitFiles' },
      { n: '2', name: 'Weekly Reporting', desc: 'Generate the Weekly Outreach and Coverage Snapshot from approved source data.', hash: '#/weekly', cap: 'submitFiles' },
      { n: '3', name: 'Salesforce Data Quality', desc: 'Run contact, account, opportunity, ownership, next-step, and stale-record checks.', hash: '#/dataquality', cap: 'submitFiles' },
      { n: '4', name: 'Legacy Outreach Preparation', desc: 'Legacy prototype for list processing, exclusions and coverage assignment.', hash: '#/process', cap: 'submitFiles' },
      { n: '5', name: 'Review Exceptions', desc: 'Resolve ambiguous, invalid, duplicate, blocked, or unmatched records.', hash: '#/exceptions', cap: 'reviewExceptions' },
      { n: '6', name: 'Previous Runs', desc: 'Prior batches, outputs, exceptions, approvals, errors, and audit history.', hash: '#/runs', cap: null },
      { n: '7', name: 'Administration', desc: 'Templates, owners, mappings, rules, blocked domains, exclusion lists, and roles.', hash: '#/admin', cap: 'administer' },
      { n: '8', name: 'Monitoring', desc: 'Processing health, stuck batches, reconciliation failures, and alerts.', hash: '#/monitoring', cap: 'viewMonitoring' }
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
          'Start by processing a list. In preview mode you can use the sample files described in the documentation.',
          [el('a', { class: 'btn btn--primary', href: '#/process', text: 'Process a List' })])
      ]));
    }

    container.appendChild(page);
  };

})(typeof self !== 'undefined' ? self : this);

/* Canonical ShoreVest One operating-model shells and Outreach workflow. */
(function (root) {
  'use strict';
  var SVOps = root.SVOps, U = SVOps.ui, P = root.SVPortalPersonas;
  var el = U.el, esc = U.esc, frag = U.frag;
  SVOps.state.outreach = SVOps.state.outreach || { step: 'overview', approval: null, version: 0 };
  var maturity = ['Idea','Designed','Preview','Connected','Validated','Validated'];
  var heldReasons = ['ownership review','data quality','possible duplicate','institution concentration','active relationship conflict','insufficient evidence','missing current contact','departed contact','research required'];
  var senders = {
    'John Jones': { email: 'john@shorevest.com', sig: 'John Jones\nDirector of Client Solutions, Ex-Asia\nShoreVest' },
    'Kelvin Chan': { email: 'kelvin@shorevest.com', sig: 'Kelvin Chan\nDirector of Client Solutions, Asia\nShoreVest' },
    'Nico Jacques': { email: 'nico@shorevest.com', sig: 'Nico Jacques\nShoreVest' }
  };
  function persona(user){ return P.byId(user.personaId) || {}; }
  function page(label,title,lede){ var p=el('div',{class:'ops-content'}); p.appendChild(el('div',{class:'ops-pagehead'},[el('p',{class:'ops-label',text:label}),el('h1',{class:'ops-h1',text:title}),el('p',{class:'ops-lede',text:lede})])); return p; }
  function pill(t){ return el('span',{class:'st st--review',text:t}); }
  function doctrine(){ return U.notice('info','<strong>How work is controlled</strong> Salesforce remains the official commercial record. ShoreVest One helps you review, prepare and control work across Salesforce, Outlook, SharePoint and approved AI-supported workflows. Suggestions do not become official actions until a human accepts them.'); }
  function card(name,desc,state,href){ return el(href?'a':'div',{class:'ops-module',href:href||null},[el('span',{class:'ops-module__num',text:state||'Preview'}),el('p',{class:'ops-module__name',text:name}),el('p',{class:'ops-module__desc',text:desc})]); }
  function actions(back){ return el('div',{class:'ops-actions'},[el('a',{class:'btn btn--quiet',href:back||'#/home',text:'Back'}),el('button',{class:'btn btn--quiet',type:'button',text:'Save & exit',onclick:function(){ localStorage.setItem('svops.demo.lastSaved',new Date().toISOString()); U.toast('Preview state saved in this browser only.'); }}),el('button',{class:'btn btn--quiet',type:'button',text:'Start over',onclick:function(){ SVOps.state.outreach={step:'overview',version:0}; location.hash='#/outreach'; root.dispatchEvent(new Event('svops:render')); }}),el('button',{class:'btn btn--quiet',type:'button',text:'Undo',onclick:function(){ history.back(); }})]); }
  function defaultSender(user, rows){ var p=persona(user); if(p.id==='nico' && (!rows || rows.some(function(r){return r.region==='Operator permitted';}))) return 'Nico Jacques'; return p.region==='Asia'?'Kelvin Chan':'John Jones'; }
  function mockedRows(){ var names=['Anna Larsen','Mikkel Holm','Freja Nielsen','Jonas Berg','Sarah Chen','Markus Vogel','Claire Dubois','Tom Eriksen','Mei Tan','Luca Rossi','Emma Wright','Peter Novak','Sofia Lind','Daniel Cho','Eva Schmidt','Oscar Meyer','Mina Park','Henrik Dahl']; return names.map(function(n,i){ var inst=i<6?'ATP':['Nordic Pension','GreenVale Capital','Harbour Ridge','EastGate Assurance','Meridian Insurance'][i%5]; var blocked=i===8||i===13; var held=i>=2&&i<6; return {name:n,institution:inst,region:i%3===0?'Asia':'Ex-Asia',evidence:'Salesforce activity + SharePoint note, refreshed '+(i+1)+' days ago', state:blocked?'Blocked':held?'On hold':'Included', reason:blocked?(i===8?'opt-outs':'active diligence'):held?'institution concentration':(i===10?'ownership review':''), owner:i%3===0?'Kelvin Chan':i%4===0?'Celestra Gallagher':'John Jones', next:blocked?'Cannot override normally':held?'Owner decision before drafting':'Eligible for review'}; }); }
  function saveRows(rows){ SVOps.state.outreach.rows=rows; localStorage.setItem('svops.demo.outreachRows',JSON.stringify(rows)); }
  function rows(){ if(SVOps.state.outreach.rows) return SVOps.state.outreach.rows; try{return JSON.parse(localStorage.getItem('svops.demo.outreachRows'))||mockedRows();}catch(e){return mockedRows();} }

  function primaryAction(item, fallback) {
    var label = item && item.actions && item.actions[0] && item.actions[0].label || fallback || 'Review';
    if (/send|approve/i.test(label)) return 'Review';
    if (/prepare|draft/i.test(label)) return 'Prepare';
    if (/confirm/i.test(label)) return 'Confirm';
    if (/fix|wrong|change/i.test(label)) return 'Fix';
    if (/wait|hold/i.test(label)) return 'Wait';
    return 'Review';
  }

  SVOps.views.myWork=function(c,user){
    var pg=page('My Work','My Work','Start with the first item. Each item has one owner and one next step.');
    var baseOwner = (user.name || 'Celestra Gallagher');
    var items=[
      {group:'Do now',action:'Review',title:'Review MergePoint contact proposals',reason:'12 proposed contacts need review before they can be written to Salesforce.',status:'On hold',next:'Confirm owner and account match.',owner:'Celestra',due:'Today',source:'Salesforce + MergePoint',button:'Start review',blocker:'Owner and account match not confirmed.',history:['MergePoint proposals imported.','Salesforce writeback held until review.']},
      {group:'Do now',action:'Prepare',title:'Data-room access package',reason:'Meridian request is ready, but eligibility and approval version must be frozen.',status:'Ready',next:'Prepare the access package with the approved recipient version.',owner:baseOwner,due:'Today',source:'Diligence & Requests',button:'Open',blocker:'None.'},
      {group:'Do now',action:'Review',title:'GreenVale diligence answer',reason:'One commercial disclosure decision is required before the response moves forward.',status:'Needs review',next:'Use approved aggregated information instead of named recovery examples.',owner:baseOwner,due:'This week',source:'SharePoint + Salesforce',button:'Open',blocker:'Commercial disclosure choice.'},
      {group:'Waiting on others',action:'Wait',title:'Ownership confirmation',reason:'Waiting on John before this record can move forward.',status:'Waiting',next:'No action until John confirms.',owner:'John',due:'This week',source:'Owner queue',button:'Open item',blocker:'John'},
      {group:'Waiting on others',action:'Wait',title:'Salesforce field list',reason:'Waiting on Celestra to confirm which fields are safe for preview.',status:'Waiting',next:'No action until Celestra confirms the field list.',owner:'Celestra',due:'This week',source:'Salesforce admin queue',button:'Open item',blocker:'Celestra'},
      {group:'Waiting on others',action:'Wait',title:'AI control register evidence',reason:'Waiting on vendors for updated control evidence.',status:'Waiting',next:'No action until the vendor evidence arrives.',owner:'Vendor',due:'This week',source:'Vendor controls',button:'Open item',blocker:'Vendor'},
      {group:'Suggestions to review',action:'Review',title:'Automated task cleanup',reason:'7 old MergePoint-created tasks may be duplicate or low-value.',status:'Suggested',next:'Review suggestions before anything is changed or removed.',owner:baseOwner,due:'Later',source:'MergePoint + Salesforce',button:'Open',blocker:'Human acceptance required.'},
      {group:'Done',action:'Done',title:'Weekly outreach snapshot',reason:'Snapshot package has been reviewed for this cycle.',status:'Ready',next:'Nothing else needed right now.',owner:baseOwner,due:'Done',source:'Reporting',button:'Open',blocker:'None.'}
    ];
    function count(group){return items.filter(function(i){return i.group===group;}).length;}
    pg.appendChild(el('div',{class:'work-summary'},[
      summary('Do now',count('Do now')),summary('Waiting',count('Waiting on others')),summary('Suggestions',count('Suggestions to review')),summary('Overdue',0)
    ]));
    pg.appendChild(startFirst(items[0]));
    pg.appendChild(el('div',{class:'ops-filterbar work-tabs'},['Do now','Waiting','Suggestions','On hold','Done'].map(function(f,i){return el('button',{class:'btn btn--quiet'+(i===0?' is-active':''),text:f,onclick:function(){U.toast(f+' cards shown below.');}})})));
    [['Do now','Do now'],['Waiting on others','Waiting on others'],['Suggestions to review','Suggestions to review'],['Done','Done']].forEach(function(pair){
      pg.appendChild(workSection(pair[0],items.filter(function(i){return i.group===pair[1];})));
    });
    pg.appendChild(el('details',{class:'work-doctrine'},[el('summary',{text:'Operating doctrine'}),el('p',{text:'Salesforce stays the official record. ShoreVest One helps review, approve and track work before anything is written back.'})]));
    c.appendChild(pg);

    function summary(label,num){return el('div',{class:'work-summary__item'},[el('span',{text:label}),el('strong',{text:String(num)})]);}
    function startFirst(item){return el('article',{class:'work-start-card',tabindex:'0',onclick:function(){openWork(item);}},[el('p',{class:'ops-label',text:'Start first'}),el('h2',{text:item.title}),el('p',{text:'Reason: '+item.reason}),el('p',{html:'<strong>Status:</strong> '+esc(item.status)}),el('p',{html:'<strong>Next step:</strong> '+esc(item.next)}),el('div',{class:'home-card__actions'},[el('button',{type:'button',class:'btn btn--primary',text:item.button,onclick:function(ev){ev.stopPropagation();openWork(item);}}),el('button',{type:'button',class:'btn btn--quiet',text:'Why am I seeing this?',onclick:function(ev){ev.stopPropagation();openWork(item);}})])]);}
    function workSection(title,list){var section=el('section',{class:'work-section'});section.appendChild(el('div',{class:'home-section__head'},[el('h2',{class:'home-section__title',text:title}),el('span',{class:'home-section__count',text:String(list.length)})]));var cards=el('div',{class:'work-cards'});list.forEach(function(item){cards.appendChild(workCard(item));});section.appendChild(cards);return section;}
    function workCard(item){return el('article',{class:'work-card',tabindex:'0',onclick:function(){openWork(item);},onkeydown:function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openWork(item);}}},[el('div',{class:'work-card__title'},[U.actionChip(item.action),el('h3',{text:item.title})]),el('p',{class:'work-card__reason',text:item.reason}),el('p',{html:'<strong>Status:</strong> '+esc(item.status)}),el('p',{html:'<strong>Next step:</strong> '+esc(item.next)}),el('p',{class:'work-card__meta',text:'Owner: '+item.owner+' · Due: '+item.due+' · Source: '+item.source}),el('button',{type:'button',class:'btn btn--sm btn--primary',text:item.button||'Open',onclick:function(ev){ev.stopPropagation();openWork(item);}})]);}
    function openWork(item){var history=item.history||['Created from preview signals.','Added to My Work queue.'];U.drawer(item.title,el('div',{},[drawerSection('What this is',item.title),drawerSection('Why it appeared',item.reason),drawerSection('Source',item.source),drawerSection('Owner',item.owner),drawerSection('Next step',item.next),drawerSection('Allowed actions',(item.button||'Open')+', hold, assign owner, mark done'),drawerSection('History',history.join(' · ')),drawerSection('Who/what is blocking it',item.blocker||'None')]));}
    function drawerSection(label,text){return el('section',{},[el('h4',{text:label}),el('p',{class:'drawer-copy',text:text})]);}
  };

  SVOps.views.relationships=function(c){
    var pg=page('Relationships','Relationships','Use this to see account reality: Salesforce stage, owner judgement, system signals, blockers and the next review date.');
    pg.appendChild(el('div',{class:'ops-next-action'},[el('strong',{text:'Primary next action: '}),el('span',{text:'Open any row marked Needs review or Blocked and confirm the next step with the coverage owner.'})]));
    var rel=[{account:'NorthBridge Pension',owner:'John Jones',stage:'Stage 4',signal:'High engagement: meeting 18 days ago',attention:'Salesforce stage is advanced but no active action plan is logged.',blocker:'Investment committee timing',next:'John to confirm plan and next outreach owner.',status:'Needs review',review:'2026-07-17'},{account:'ATP',owner:'John Jones',stage:'Stage 2',signal:'System sees high relevance from recent research and SharePoint notes.',attention:'Owner priority is low, so the system view may be incomplete.',blocker:'Institution concentration',next:'John to accept hold reason or raise priority.',status:'On hold',review:'2026-07-15'},{account:'EastGate Assurance',owner:'Kelvin Chan',stage:'Stage 3',signal:'Recent meeting found in Outlook.',attention:'Meeting outcome is not logged in Salesforce.',blocker:'Mandate unclear',next:'Kelvin to confirm outcome and next step.',status:'Blocked',review:'2026-07-12'},{account:'Meridian Insurance',owner:'Celestra Gallagher',stage:'Stage 1',signal:'Low recent activity.',attention:'Current contact may be missing or out of date.',blocker:'Missing current contact',next:'Celestra to find owner or mark research required.',status:'Waiting',review:'2026-07-19'}];
    pg.appendChild(U.table([{key:'account',label:'Account',html:function(r){return esc(r.account)}},{key:'owner',label:'Owner',html:function(r){return esc(r.owner)}},{key:'stage',label:'Salesforce stage',html:function(r){return esc(r.stage)}},{key:'signal',label:'System signal',html:function(r){return esc(r.signal)}},{key:'attention',label:'What needs attention',html:function(r){return esc(r.attention)}},{key:'blocker',label:'Current blocker',html:function(r){return esc(r.blocker)}},{key:'next',label:'Next step',html:function(r){return esc(r.next)}},{key:'status',label:'Status',html:function(r){return U.statusHtml(r.status)}},{key:'review',label:'Next review',html:function(r){return esc(r.review)}}],rel,{onRowClick:function(r){U.drawer(r.account,el('div',{},[el('p',{text:'Owner: '+r.owner}),el('p',{text:'Salesforce stage: '+r.stage}),el('p',{text:'System signal: '+r.signal}),el('p',{text:'What may be wrong or incomplete: '+r.attention}),el('p',{text:'Current blocker: '+r.blocker}),el('p',{text:'Next step: '+r.next}),el('p',{text:'Next review: '+r.review}),actions('#/relationships')]));}}));
    pg.appendChild(doctrine()); c.appendChild(pg);
  };
SVOps.views.meetings=function(c){ var pg=page('Meetings','Meeting workspace','Concise cumulative briefs, meeting-specific preparation and post-meeting action extraction suggestions.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--2'},[card('Upcoming meeting list','GreenVale, EastGate and Meridian meetings with missing briefing warnings.','Preview'),card('Validation and brief status','Address/link validation, relationship brief status and concise meeting-specific brief.','Designed'),card('Post-meeting update needed','Action suggestions from notes; human acceptance required before task creation.','Preview')])); c.appendChild(pg); };
  SVOps.views.diligence=function(c){ var pg=page('Diligence & Requests','Diligence and requests','DDQs, data requests, answer bank, governed facts, materials, review/approval state and evidence chain.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('DDQs and data requests','Approved master exists; legal review pending; evidence outdated where marked.','Preview'),card('Answer bank and governed facts','Governed facts with source, freshness and review state.','Designed'),card('Materials','Recipient version needed; data-room access ready; derivative materials controlled.','Connected')])); c.appendChild(pg); };
  SVOps.views.investorIntelligence=function(c){ var pg=page('Investor Intelligence','Investor Intelligence','Live weekly digest workstream plus market, intermediary and institution context.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('Weekly investor digest','Live/Production workstream.','Validated'),card('Intermediary assessment','Person / firm, claimed region/relationships, tested institutions, evidence, proposal, retainer, success fee, recommendation and next step.','Designed'),card('Regional coverage gaps','Coverage gaps and local decision-maker context.','Preview'),card('Market intelligence','Source, owner and freshness visible.','Connected')])); c.appendChild(pg); };
  SVOps.views.reporting=function(c){ var pg=page('Reporting','Reporting','Weekly Outreach & Coverage Snapshot and live reporting exceptions.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('Weekly Outreach & Coverage Snapshot','Live weekly digest workstream with stage movement and activity summary.','Validated'),card('Stale records and missing next steps','Data-quality exceptions with owner and source.','Connected'),card('No automatic stage movement','Reports show exceptions; they do not write Salesforce by themselves.','Preview')])); c.appendChild(pg); };
  SVOps.views.approvals=function(c,user){ var pg=page('Approvals','Shared approval queue','One cross-workflow queue for outreach, diligence, materials and reporting packages. No duplicate workflow-specific approvals.'); pg.appendChild(U.table([{key:'item',label:'Item',html:function(r){return esc(r.item)}},{key:'state',label:'State',html:function(r){return U.statusHtml(r.state)}},{key:'owner',label:'Owner',html:function(r){return esc(r.owner)}},{key:'permission',label:'Permission',html:function(r){return esc(r.permission)}}],[{item:'ATP outreach frozen package',state:'Suggested',owner:defaultSender(user),permission:persona(user).permissions&&persona(user).permissions.canApproveSender?'Can approve sender review':'Can prepare / cannot approve'},{item:'GreenVale DDQ commercial disclosure',state:'On hold',owner:'John Jones',permission:'Shared queue'},{item:'Weekly Outreach Snapshot',state:'Complete',owner:'Celestra Gallagher',permission:'Production reporting workstream'}])); c.appendChild(pg); };
  var firmSections=[
    {title:'Team and access',desc:'Manage users, roles, permissions and workspace access.',href:'#/firm/team'},
    {title:'Templates and signatures',desc:'Manage approved templates, signatures and translated variants.',href:'#/firm/templates'},
    {title:'Workflow rules',desc:'Manage approvals, routing, restrictions and task rules.',href:'#/firm/workflow'},
    {title:'Systems and vendors',desc:'See official systems, connected vendors and operating status.',href:'#/firm/systems'},
    {title:'AI and controls',desc:'Review permitted AI use, evidence gaps and control requirements.',href:'#/firm/ai'},
    {title:'Audit log',desc:'See recent changes to templates, permissions, rules and overrides.',href:'#/firm/audit'}
  ];
  function firmCard(item){ return el('article',{class:'firm-card'},[el('h2',{class:'firm-card__title',text:item.title}),el('p',{class:'firm-card__desc',text:item.desc}),el('a',{class:'btn btn--quiet btn--sm',href:item.href,text:'Open'})]); }
  function systemCard(name,purpose,status){ return el('article',{class:'firm-record-card'},[el('p',{class:'firm-record-card__name',text:name}),el('p',{class:'firm-record-card__purpose',text:purpose}),el('p',{class:'firm-record-card__status',html:'Status: '+U.statusHtml(status,'st--ok')} )]); }
  SVOps.views.firm=function(c,user,params){
    var sub=params&&params[0];
    if(sub==='systems') return firmSystems(c);
    if(sub==='vendors'&&params[1]==='mergepoint') return firmMergePoint(c);
    if(sub) return firmPlaceholder(c,sub);
    var pg=page('Firm','Firm configuration','Manage team access, approved templates, workflow rules, connected systems and operating controls.');
    pg.appendChild(el('div',{class:'firm-overview-grid'},firmSections.map(firmCard)));
    pg.appendChild(U.notice('info','Salesforce remains the official commercial record. ShoreVest One applies workflow, review and control layers across connected systems.'));
    c.appendChild(pg);
  };
  function firmSystems(c){
    var pg=page('Firm / Systems and vendors','Systems and vendors','Official systems of record and connected vendors used in ShoreVest One.');
    pg.appendChild(el('section',{class:'firm-section'},[el('div',{class:'ops-panel__head'},[el('h2',{class:'ops-panel__title',text:'Official systems'})]),el('div',{class:'firm-record-grid'},[
      systemCard('Salesforce','Official commercial record','Official'),
      systemCard('Outlook','Official mail system','Official'),
      systemCard('SharePoint','Document storage','Official'),
      systemCard('Power Automate','Workflow orchestration','Official')
    ])]));
    pg.appendChild(el('section',{class:'firm-section'},[el('div',{class:'ops-panel__head'},[el('h2',{class:'ops-panel__title',text:'Connected vendors'})]),el('div',{class:'firm-vendor-grid'},[
      el('article',{class:'firm-vendor-card'},[
        el('div',{class:'firm-vendor-card__head'},[el('h3',{text:'MergePoint'}),el('span',{html:U.statusHtml('Connected with review controls','st--warn')})]),
        el('p',{text:'Ingestion, notes, enrichment and secondary checks'}),
        el('dl',{class:'firm-detail-list'},[el('dt',{text:'Key risk'}),el('dd',{text:'Governance evidence incomplete'}),el('dt',{text:'Current rule'}),el('dd',{text:'Not authoritative for ownership, official tasks, opportunity creation or stage movement'})]),
        el('a',{class:'btn btn--primary btn--sm',href:'#/firm/vendors/mergepoint',text:'Open vendor record'})
      ])
    ])]));
    pg.appendChild(el('a',{class:'btn btn--quiet',href:'#/firm',text:'Back to Firm'}));
    c.appendChild(pg);
  }
  function detailBlock(title,body){return el('section',{class:'firm-detail-block'},[el('h2',{class:'ops-panel__title',text:title}),Array.isArray(body)?el('ul',{class:'firm-clean-list'},body.map(function(x){return el('li',{text:x});})):el('p',{text:body})]);}
  function firmMergePoint(c){
    var pg=page('Firm / Systems and vendors / MergePoint','MergePoint','Connected with review controls. Used for ingestion, notes, enrichment and secondary checks.');
    pg.appendChild(el('div',{class:'firm-detail-layout'},[
      detailBlock('Status','Connected with review controls'),
      detailBlock('Purpose','Ingestion, notes, enrichment and secondary checks'),
      detailBlock('Data touched',['Outlook mail metadata and reviewed message content','SharePoint notes and supporting documents','Salesforce exports used for matching and comparison','Mocked contact and activity fields in this preview']),
      detailBlock('What is confirmed',['MergePoint suggestions do not update Salesforce by themselves.','Human review is required before proposed contacts, tasks or rankings become official work.','ShoreVest One keeps Salesforce as the commercial system of record.']),
      detailBlock('What is missing',['Hosting confirmation missing','Subprocessor list not yet recorded','Retention terms not yet recorded','Complete audit logging evidence not yet recorded']),
      detailBlock('Current ShoreVest rule','MergePoint is not authoritative for ownership, official tasks, opportunity creation or stage movement.'),
      detailBlock('Owner','Celestra Gallagher'),
      detailBlock('Last review','2026-07-10'),
      detailBlock('Open issues',['Review required for hosting evidence.','Review required for subprocessors.','Review required for retention and deletion terms.','Internal policy exists for human approval before Salesforce changes.'])
    ]));
    pg.appendChild(el('div',{class:'ops-actions'},[el('a',{class:'btn btn--quiet',href:'#/firm/systems',text:'Back to Systems and vendors'}),el('a',{class:'btn btn--quiet',href:'#/firm',text:'Back to Firm'})]));
    c.appendChild(pg);
  }
  function firmPlaceholder(c,sub){
    var match=firmSections.filter(function(x){return x.href==='#/firm/'+sub;})[0];
    var pg=page('Firm',match?match.title:'Firm section',match?match.desc:'This Firm configuration section is not part of the current preview scope.');
    pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Preview section'}),el('p',{text:'This area will use the same card-first administrative layout. No external system changes happen from this preview.'}),el('a',{class:'btn btn--quiet',href:'#/firm',text:'Back to Firm'})]));
    c.appendChild(pg);
  }

  SVOps.views.outreach=function(c,user,params){ var sub=params&&params[0]; if(sub==='find') return outreachFind(c,user); if(sub==='draft') return draft(c,user); if(sub==='sent') return sent(c); var pg=page('Outreach','Outreach overview','Finding people is not the same as deciding to contact them. Build an audience, review Included / On hold / Blocked, then choose what to do next.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('Find or add people','Search ShoreVest records, upload/paste names, saved searches or recent lists.','Preview','#/outreach/find'),card('Draft messages','Only after Prepare messages. Shows exact recipients, sender and managed signature.','Preview','#/outreach/draft'),card('Sent & responses','Preview status only. Nothing is sent from this screen.','Designed','#/outreach/sent')])); pg.appendChild(doctrine()); c.appendChild(pg); };
  function outreachFind(c,user){ var pg=page('Outreach / Find or add people','Find or add people','Four entry routes: search ShoreVest records, upload or paste names, saved searches and recent lists.'); var input=el('textarea',{class:'ops-input',rows:'3',text:'all people in Denmark we haven’t contacted in 2 months'}); pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Search ShoreVest records'}),input,el('p',{class:'ops-meta',text:'Examples: “everyone at ATP” · “find Sarah Chen” · “European pension contacts with no next action”'}),el('div',{class:'ops-grid ops-grid--2'},[card('Search type','filtered group; can also be one person / one institution / pipeline gap','Suggested'),card('Location meaning','person location / institution HQ / either','Suggested'),card('Not contacted meaning','outbound email only / any activity / by me / by anyone at ShoreVest','Suggested'),card('Time period','2 months','Suggested')]),el('p',{class:'ops-meta',text:'Hard exclusions: opt-outs, hard bounces, restricted contacts, recent declines, scheduled meetings, active diligence, pending outreach batch.'}),el('button',{class:'btn btn--primary',text:'Run search',onclick:function(){var r=mockedRows(); saveRows(r); location.hash='#/outreach/find/results';}})])); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('Upload or paste names','Preserves original source row and previews Salesforce matching.','Preview','#/outreach/find/upload'),card('Saved searches','Denmark pensions; Europe no next action; Asia family offices.','Designed'),card('Recent lists','Last ATP review and Nordic pension scan.','Designed')])); if(location.hash.indexOf('results')>-1) renderResults(pg,user); if(location.hash.indexOf('upload')>-1) renderUpload(pg); pg.appendChild(actions('#/outreach')); c.appendChild(pg); }
  function renderUpload(pg){ pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Upload / paste matching'}),U.table([{key:'row',label:'Original source row',html:function(r){return esc(r.row)}},{key:'match',label:'Salesforce matching result',html:function(r){return esc(r.match)}}],[{row:'1, Sarah Chen, ATP',match:'Links to existing Contact'},{row:'2, Daniel Cho, Nordic Pension',match:'Creates Contact under existing Account'},{row:'3, Freja Unknown, New Nordic Fund',match:'Proposes new Account + Contact'},{row:'4, A. Larsen, ATP',match:'Needs duplicate review'}]),U.notice('warn','No Fund III Opportunities are created automatically.') ])); }
  function renderResults(pg,user){ var r=rows(); ['Included','On hold','Blocked'].forEach(function(state){ pg.appendChild(el('div',{class:'ops-panel'},[el('div',{class:'ops-panel__head'},[el('h2',{class:'ops-panel__title',text:state}),pill(state==='On hold'?'Structured reasons: '+heldReasons.join(', '):state)]), U.table([{key:'name',label:'Person',html:function(x){return esc(x.name)}},{key:'institution',label:'Institution',html:function(x){return esc(x.institution)}},{key:'reason',label:'Reason',html:function(x){return esc(x.reason||'Included by recipe')}},{key:'owner',label:'Owner',html:function(x){return esc(x.owner)}},{key:'next',label:'Next action',html:function(x){return esc(x.next)}}], r.filter(function(x){return x.state===state;}))])); }); pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'What do you want to do with these people?'}),el('div',{class:'ops-actions'},['Review people','Save search','Export list','Assign for review'].map(function(t){return el('button',{class:'btn btn--quiet',text:t,onclick:function(){U.toast(t+' recorded as preview action.')}})}).concat([el('a',{class:'btn btn--primary',href:'#/outreach/draft',text:'Prepare messages'})]))])); }
  function draft(c,user){ var r=rows().filter(function(x){return x.state==='Included';}), sender=defaultSender(user,r); var pg=page('Outreach / Draft messages','Draft review','Drafting begins only after Prepare messages. Managed signatures are separate from editable body.'); pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Draft package'}),el('p',{text:'Exact recipients: '+r.map(function(x){return x.name+' ('+x.institution+')';}).join('; ')}),el('p',{text:'Treatment group: European pension contacts · Objective: measured reconnection / coverage update'}),el('label',{text:'Named sender'}), (function(){var s=el('select',{class:'ops-input'}); Object.keys(senders).forEach(function(n){s.appendChild(el('option',{value:n,text:n,selected:n===sender}));}); s.onchange=function(){location.hash='#/outreach/draft'; U.toast('Sender changed; managed signature updated. Approval version invalidated.'); SVOps.state.outreach.approval=null;}; return s;}()),el('p',{text:'Sender permission state: '+(persona(user).permissions.canApproveSender?'Sender review permitted':'Preparation only; named human approval required')}),el('h3',{text:'Subject'}),el('p',{text:'ShoreVest introduction and coverage update'}),el('h3',{text:'Body'}),el('textarea',{class:'ops-input',rows:'6',text:'Hello — I am writing with a brief ShoreVest update based on our current coverage review. If useful, we can share a concise overview and coordinate through the appropriate ShoreVest relationship owner.'}),el('h3',{text:'Managed preset signature'}),el('pre',{class:'ops-pre',text:senders[sender].sig}),el('p',{class:'ops-meta',text:'Evidence/source note: Salesforce activity, SharePoint notes and mocked search recipe. Full recipient list shown above.'}),el('div',{class:'ops-actions'},[el('button',{class:'btn btn--quiet',text:'Needs changes',onclick:function(){U.toast('Returned to preparation.')}}),el('a',{class:'btn btn--primary',href:'#/outreach/draft/approval',text:'Looks right'})]) ])); pg.appendChild(delivery()); if(location.hash.indexOf('approval')>-1) approval(pg,user,sender,r); pg.appendChild(actions('#/outreach/find/results')); c.appendChild(pg); }
  function delivery(){ return el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Delivery policy frozen into approval package'}),el('p',{text:'Automated Power Automate queue: reply-to john@shorevest.com; IROutreach@shorevest.com · BCC shorevest@mergepointai.onmicrosoft.com'}),el('p',{text:'Manual personalised send: reply-to sender mailbox · BCC none, only if approved for that mode'}),el('p',{class:'ops-meta',text:'Users cannot type reply-to or BCC manually.'})]); }
  function approval(pg,user,sender,r){ pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Frozen approval package'}),el('p',{text:'Recipients: '+r.length+' exact included recipients. On hold and blocked exclusions remain excluded.'}),el('p',{text:'Sender: '+sender+' · Copy, signature, delivery controls, timing and source/audience recipe frozen. Salesforce changes proposed: Contact activity note only after approved execution; no automatic Opportunity creation.'}),el('p',{text:'Maturity state: Internal Preview'}),el('button',{class:'btn btn--primary',text:'Submit approval request',onclick:function(){SVOps.state.outreach.approval={version:++SVOps.state.outreach.version,approved:false}; U.toast('Approval requested. Frozen version created. Nothing executed.');}}),el('p',{class:'ops-meta',text:SVOps.state.outreach.approval?'Approval requested. Frozen version created. Nothing executed. Material changes invalidate this version.':''})])); }
  function sent(c){ var pg=page('Outreach / Sent & responses','Sent & responses','Preview status only. Every item shows who owns the next step and what is waiting.'); pg.appendChild(U.table([{key:'batch',label:'Batch',html:function(r){return esc(r.batch)}},{key:'state',label:'State',html:function(r){return esc(r.state)}},{key:'next',label:'Next action',html:function(r){return esc(r.next)}}],[{batch:'ATP Denmark pension review',state:'Complete',next:'Awaiting execution control'},{batch:'Nordic reconnect',state:'Blocked',next:'Repair missing evidence before retry'}])); c.appendChild(pg); }
})(typeof self !== 'undefined' ? self : this);
