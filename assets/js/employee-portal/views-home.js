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
      el('p', { class: 'ops-lede', text: 'Decisions, accountable actions, controlled execution and exceptions over the official Salesforce record.' })
    ]));

    if (!persona) {
      page.appendChild(U.stateScreen('empty', 'No Home configured',
        'This role has no Home view. Use Tools to reach the operational prototype.',
        [el('a', { class: 'btn', href: '#/tools', text: 'Go to Tools' })]));
      container.appendChild(page);
      return;
    }

    var home = persona.home;
    page.appendChild(el('p', { class: 'home-doctrine', text: 'Salesforce is the official commercial record. ShoreVest One shows evidence, exceptions and controlled actions.' }));
    var resolved = SVOps.state.homeResolved[persona.id] || (SVOps.state.homeResolved[persona.id] = {});

    /* ── Needs you ─────────────────────────────────────────────────────── */
    var open = home.needsYou.filter(function (c) { return !resolved[c.id]; });

    var needs = el('section', { class: 'home-section', 'aria-labelledby': 'home-needs' });
    needs.appendChild(el('div', { class: 'home-section__head' }, [
      el('h2', { class: 'home-section__title', id: 'home-needs', text: 'Needs your decision' }),
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
    lists.appendChild(renderList('Needs your action', home.today, function (item) {
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

    var recentWarnings = el('div', { class: 'home-lists' });
    recentWarnings.appendChild(renderList('Recent work', [
      { title: 'Frozen approval package created', note: 'Version retained; no execution' },
      { title: 'Relationship review updated', note: 'Source and owner retained' },
      { title: 'Search recipe saved', note: 'No drafting started automatically' }
    ], function (item) { return el('div', { class: 'home-list__item' }, [el('span', { class: 'home-list__body' }, [el('span', { class: 'home-list__name', text: item.title }), el('span', { class: 'home-list__note', text: item.note })])]); }, 'No recent work.'));
    var warningText = persona.id === 'ben' ? 'Stage 3/4 LPs without action plans and stale subjective priority fields need owner review.' : persona.id === 'nico' ? '3 records have no current contact. Held rows require owner review before drafting.' : persona.id === 'celestra' ? '7 suggested tasks are not official tasks yet. MergePoint ranking relies on stale manual input.' : persona.id === 'emily' ? 'Subjective priority field stale for 18 LPs. Action-category ownership incomplete.' : 'MergePoint ranking relies on stale manual input. AI suggestions are not official tasks until accepted.';
    recentWarnings.appendChild(renderList('System warnings', [{ title: 'Operating warning', note: warningText }], function (item) { return el('div', { class: 'home-list__item' }, [el('span', { class: 'home-list__body' }, [el('span', { class: 'home-list__name', text: item.title }), el('span', { class: 'home-list__note home-list__note--attention', text: item.note })])]); }, 'No warnings.'));
    page.appendChild(recentWarnings);

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

    node.appendChild(el('div', { class: 'ops-panel__head' }, [el('h3', { class: 'home-card__title', text: card.title }), el('span', { class: 'st st--review', text: card.recLabel || 'Suggested' })]));

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
          'Start by processing a list. In demonstration mode you can use the sample files described in the documentation.',
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
  var maturity = ['Idea','Designed','Simulated','Connected','Validated','Validated'];
  var heldReasons = ['ownership review','data quality','possible duplicate','institution concentration','active relationship conflict','insufficient evidence','missing current contact','departed contact','research required'];
  var senders = {
    'John Jones': { email: 'john@shorevest.com', sig: 'John Jones\nDirector of Client Solutions, Ex-Asia\nShoreVest' },
    'Kelvin Chan': { email: 'kelvin@shorevest.com', sig: 'Kelvin Chan\nDirector of Client Solutions, Asia\nShoreVest' },
    'Nico Jacques': { email: 'nico@shorevest.com', sig: 'Nico Jacques\nShoreVest' }
  };
  function persona(user){ return P.byId(user.personaId) || {}; }
  function page(label,title,lede){ var p=el('div',{class:'ops-content'}); p.appendChild(el('div',{class:'ops-pagehead'},[el('p',{class:'ops-label',text:label}),el('h1',{class:'ops-h1',text:title}),el('p',{class:'ops-lede',text:lede})])); return p; }
  function pill(t){ return el('span',{class:'st st--review',text:t}); }
  function doctrine(){ return U.notice('info','<strong>Operating doctrine</strong> Salesforce remains the official commercial record. ShoreVest One controls workflow over Salesforce, Outlook, SharePoint, Power Automate and AI signals. MergePoint supports ingestion, notes, enrichment and secondary checks, but is not authoritative for operating lists. No automatic Opportunity creation, stage movement, ownership change, duplicate merge or official task occurs.'); }
  function card(name,desc,state,href){ return el(href?'a':'div',{class:'ops-module',href:href||null},[el('span',{class:'ops-module__num',text:state||'Simulated'}),el('p',{class:'ops-module__name',text:name}),el('p',{class:'ops-module__desc',text:desc})]); }
  function actions(back){ return el('div',{class:'ops-actions'},[el('a',{class:'btn btn--quiet',href:back||'#/home',text:'Back'}),el('button',{class:'btn btn--quiet',type:'button',text:'Save & exit',onclick:function(){ localStorage.setItem('svops.demo.lastSaved',new Date().toISOString()); U.toast('Demo state saved in this browser only.'); }}),el('button',{class:'btn btn--quiet',type:'button',text:'Start over',onclick:function(){ SVOps.state.outreach={step:'overview',version:0}; location.hash='#/outreach'; root.dispatchEvent(new Event('svops:render')); }}),el('button',{class:'btn btn--quiet',type:'button',text:'Undo',onclick:function(){ history.back(); }})]); }
  function defaultSender(user, rows){ var p=persona(user); if(p.id==='nico' && (!rows || rows.some(function(r){return r.region==='Operator permitted';}))) return 'Nico Jacques'; return p.region==='Asia'?'Kelvin Chan':'John Jones'; }
  function syntheticRows(){ var names=['Anna Larsen','Mikkel Holm','Freja Nielsen','Jonas Berg','Sarah Chen','Markus Vogel','Claire Dubois','Tom Eriksen','Mei Tan','Luca Rossi','Emma Wright','Peter Novak','Sofia Lind','Daniel Cho','Eva Schmidt','Oscar Meyer','Mina Park','Henrik Dahl']; return names.map(function(n,i){ var inst=i<6?'ATP':['Nordic Pension','GreenVale Capital','Harbour Ridge','EastGate Assurance','Meridian Insurance'][i%5]; var blocked=i===8||i===13; var held=i>=2&&i<6; return {name:n,institution:inst,region:i%3===0?'Asia':'Ex-Asia',evidence:'Salesforce activity + SharePoint note, refreshed '+(i+1)+' days ago', state:blocked?'Blocked':held?'Held':'Included', reason:blocked?(i===8?'opt-outs':'active diligence'):held?'institution concentration':(i===10?'ownership review':''), owner:i%3===0?'Kelvin Chan':i%4===0?'Celestra Gallagher':'John Jones', next:blocked?'Cannot override normally':held?'Owner decision before drafting':'Eligible for review'}; }); }
  function saveRows(rows){ SVOps.state.outreach.rows=rows; localStorage.setItem('svops.demo.outreachRows',JSON.stringify(rows)); }
  function rows(){ if(SVOps.state.outreach.rows) return SVOps.state.outreach.rows; try{return JSON.parse(localStorage.getItem('svops.demo.outreachRows'))||syntheticRows();}catch(e){return syntheticRows();} }

  SVOps.views.myWork=function(c,user){ var p=persona(user), pg=page('My Work','Atomic work queue','One action, one owner, due date, source, why it matters, status and a clear next step.'); pg.appendChild(el('div',{class:'ops-filterbar'},['Needs me','Waiting on others','Suggested','Held','Overdue','Completed'].map(function(f,i){return el('button',{class:'btn btn--quiet'+(i===0?' is-active':''),text:f,onclick:function(){U.toast(f+' filter applied in demo.');}})}))); var rows=(p.home.needsYou||[]).map(function(x,i){return{action:(x.actions&&x.actions[0]&&x.actions[0].label)||'Review',owner:user.name,due:i?'2026-07-14':'Today',source:'Salesforce + SharePoint + ShoreVest One rule',why:x.recommendation,status:i%2?'Held':'Suggested',cta:x.title};}).concat((p.home.waiting||[]).map(function(x){return{action:'Wait / follow up',owner:user.name,due:'This week',source:'Owner queue',why:x.note,status:'Held',cta:x.title};})); pg.appendChild(U.table([{key:'action',label:'One action',html:function(r){return esc(r.action)}},{key:'owner',label:'Owner',html:function(r){return esc(r.owner)}},{key:'due',label:'Due',html:function(r){return esc(r.due)}},{key:'source',label:'Source',html:function(r){return esc(r.source)}},{key:'why',label:'Why it matters',html:function(r){return esc(r.why)}},{key:'status',label:'Status',html:function(r){return U.statusHtml(r.status)}},{key:'cta',label:'CTA',html:function(r){return esc(r.cta)}}],rows)); pg.appendChild(doctrine()); c.appendChild(pg); };
  SVOps.views.relationships=function(c){ var pg=page('Relationships','Relationship control layer','Salesforce remains the account record. This view shows stage, evidence, conflicts, barriers and accountable next review.'); var rel=[{account:'NorthBridge Pension',owner:'John Jones',stage:'Stage 4',priority:'High',last:'Meeting 18 days ago',signal:'High automated rank',conflict:'Stage 4, no active action plan',barrier:'Investment committee timing',plan:'Missing',review:'2026-07-17'},{account:'ATP',owner:'John Jones',stage:'Stage 2',priority:'Low',last:'Email 64 days ago',signal:'High automated rank',conflict:'High automated rank, low owner priority',barrier:'Institution concentration',plan:'Held for review',review:'2026-07-15'},{account:'EastGate Assurance',owner:'Kelvin Chan',stage:'Stage 3',priority:'Stale',last:'Meeting last week',signal:'Recent engagement',conflict:'Recent meeting, no outcome logged',barrier:'Mandate unclear',plan:'Update needed',review:'2026-07-12'},{account:'Meridian Insurance',owner:'Celestra Gallagher',stage:'Stage 1',priority:'Medium',last:'No current contact',signal:'Weak',conflict:'Priority stale',barrier:'Missing current contact',plan:'Research required',review:'2026-07-19'}]; pg.appendChild(U.table([{key:'account',label:'Account',html:function(r){return esc(r.account)}},{key:'owner',label:'Coverage owner',html:function(r){return esc(r.owner)}},{key:'stage',label:'Salesforce stage',html:function(r){return esc(r.stage)}},{key:'priority',label:'Regional priority',html:function(r){return esc(r.priority)}},{key:'last',label:'Last meaningful contact',html:function(r){return esc(r.last)}},{key:'signal',label:'Automated signal',html:function(r){return esc(r.signal)}},{key:'conflict',label:'Signal conflict',html:function(r){return esc(r.conflict)}},{key:'barrier',label:'Strategic barrier',html:function(r){return esc(r.barrier)}},{key:'plan',label:'Action plan status',html:function(r){return esc(r.plan)}},{key:'review',label:'Next review',html:function(r){return esc(r.review)}}],rel,{onRowClick:function(r){U.drawer(r.account,el('div',{},[el('p',{text:'Relationship state: '+r.stage+' · '+r.plan}),el('p',{text:'Evidence summary: '+r.last+'; '+r.signal+'.'}),el('p',{text:'Owner judgement: '+r.priority+' regional priority.'}),el('p',{text:'Automated challenge signal: '+r.conflict+'.'}),el('p',{text:'Stale inputs / strategic barrier: '+r.barrier+'.'}),el('p',{text:'Action items: assign owner decision; waiting condition: human review; review date '+r.review+'.'}),actions('#/relationships')]));}})); pg.appendChild(doctrine()); c.appendChild(pg); };
SVOps.views.meetings=function(c){ var pg=page('Meetings','Meeting workspace','Concise cumulative briefs, meeting-specific preparation and post-meeting action extraction suggestions.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--2'},[card('Upcoming meeting list','GreenVale, EastGate and Meridian meetings with missing briefing warnings.','Simulated'),card('Validation and brief status','Address/link validation, relationship brief status and concise meeting-specific brief.','Designed'),card('Post-meeting update needed','Action suggestions from notes; human acceptance required before task creation.','Simulated')])); c.appendChild(pg); };
  SVOps.views.diligence=function(c){ var pg=page('Diligence & Requests','Diligence and requests','DDQs, data requests, answer bank, governed facts, materials, review/approval state and evidence chain.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('DDQs and data requests','Approved master exists; legal review pending; evidence outdated where marked.','Simulated'),card('Answer bank and governed facts','Governed facts with source, freshness and review state.','Designed'),card('Materials','Recipient version needed; data-room access ready; derivative materials controlled.','Connected')])); c.appendChild(pg); };
  SVOps.views.investorIntelligence=function(c){ var pg=page('Investor Intelligence','Investor Intelligence','Live weekly digest workstream plus market, intermediary and institution context.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('Weekly investor digest','Live/Production workstream.','Validated'),card('Intermediary assessment','Person / firm, claimed region/relationships, tested institutions, evidence, proposal, retainer, success fee, recommendation and next step.','Designed'),card('Regional coverage gaps','Coverage gaps and local decision-maker context.','Simulated'),card('Market intelligence','Source, owner and freshness visible.','Connected')])); c.appendChild(pg); };
  SVOps.views.reporting=function(c){ var pg=page('Reporting','Reporting','Weekly Outreach & Coverage Snapshot and live reporting exceptions.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('Weekly Outreach & Coverage Snapshot','Live weekly digest workstream with stage movement and activity summary.','Validated'),card('Stale records and missing next steps','Data-quality exceptions with owner and source.','Connected'),card('No automatic stage movement','Reports show exceptions; they do not write Salesforce by themselves.','Simulated')])); c.appendChild(pg); };
  SVOps.views.approvals=function(c,user){ var pg=page('Approvals','Shared approval queue','One cross-workflow queue for outreach, diligence, materials and reporting packages. No duplicate workflow-specific approvals.'); pg.appendChild(U.table([{key:'item',label:'Item',html:function(r){return esc(r.item)}},{key:'state',label:'State',html:function(r){return U.statusHtml(r.state)}},{key:'owner',label:'Owner',html:function(r){return esc(r.owner)}},{key:'permission',label:'Permission',html:function(r){return esc(r.permission)}}],[{item:'ATP outreach frozen package',state:'Suggested',owner:defaultSender(user),permission:persona(user).permissions&&persona(user).permissions.canApproveSender?'Can approve sender review':'Can prepare / cannot approve'},{item:'GreenVale DDQ commercial disclosure',state:'Held',owner:'John Jones',permission:'Shared queue'},{item:'Weekly Outreach Snapshot',state:'Approved',owner:'Celestra Gallagher',permission:'Production reporting workstream'}])); c.appendChild(pg); };
  SVOps.views.firm=function(c){ var pg=page('Firm','Firm configuration','Team, process configuration, templates and Technology & Vendors / AI control register.'); pg.appendChild(U.table(['vendor','purpose','source systems','data types accessed','hosting/data residency','model provider','subprocessors','retention/deletion','audit logging','responsible owner','evidence status'].map(function(k){return{key:k,label:k,html:function(r){return esc(r[k]);}}}),[{vendor:'MergePoint',purpose:'Ingestion, notes, enrichment and secondary checks','source systems':'Outlook, SharePoint, Salesforce exports','data types accessed':'Synthetic demo contact/activity fields','hosting/data residency':'Vendor assertion required','model provider':'Configured per control register','subprocessors':'Vendor assertion','retention/deletion':'Internal policy','audit logging':'Proposed control','responsible owner':'Celestra Gallagher','evidence status':'vendor assertion'}])); c.appendChild(pg); };

  SVOps.views.outreach=function(c,user,params){ var sub=params&&params[0]; if(sub==='find') return outreachFind(c,user); if(sub==='draft') return draft(c,user); if(sub==='sent') return sent(c); var pg=page('Outreach','Outreach overview','Finding people is not the same as deciding to contact them. Build an audience, review Included / Held / Blocked, then choose what to do next.'); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('Find or add people','Search ShoreVest records, upload/paste names, saved searches or recent lists.','Simulated','#/outreach/find'),card('Draft messages','Only after Prepare messages. Shows exact recipients, sender and managed signature.','Simulated','#/outreach/draft'),card('Sent & responses','Synthetic sent/response tracking. Nothing is sent in demo mode.','Designed','#/outreach/sent')])); pg.appendChild(doctrine()); c.appendChild(pg); };
  function outreachFind(c,user){ var pg=page('Outreach / Find or add people','Find or add people','Four entry routes: search ShoreVest records, upload or paste names, saved searches and recent lists.'); var input=el('textarea',{class:'ops-input',rows:'3',text:'all people in Denmark we haven’t contacted in 2 months'}); pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Search ShoreVest records'}),input,el('p',{class:'ops-meta',text:'Examples: “everyone at ATP” · “find Sarah Chen” · “European pension contacts with no next action”'}),el('div',{class:'ops-grid ops-grid--2'},[card('Search type','filtered group; can also be one person / one institution / pipeline gap','Suggested'),card('Location meaning','person location / institution HQ / either','Suggested'),card('Not contacted meaning','outbound email only / any activity / by me / by anyone at ShoreVest','Suggested'),card('Time period','2 months','Suggested')]),el('p',{class:'ops-meta',text:'Hard exclusions: opt-outs, hard bounces, restricted contacts, recent declines, scheduled meetings, active diligence, pending outreach batch.'}),el('button',{class:'btn btn--primary',text:'Run search',onclick:function(){var r=syntheticRows(); saveRows(r); location.hash='#/outreach/find/results';}})])); pg.appendChild(el('div',{class:'ops-grid ops-grid--3'},[card('Upload or paste names','Preserves original source row and simulates Salesforce matching.','Simulated','#/outreach/find/upload'),card('Saved searches','Denmark pensions; Europe no next action; Asia family offices.','Designed'),card('Recent lists','Last ATP review and Nordic pension scan.','Designed')])); if(location.hash.indexOf('results')>-1) renderResults(pg,user); if(location.hash.indexOf('upload')>-1) renderUpload(pg); pg.appendChild(actions('#/outreach')); c.appendChild(pg); }
  function renderUpload(pg){ pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Upload / paste matching'}),U.table([{key:'row',label:'Original source row',html:function(r){return esc(r.row)}},{key:'match',label:'Salesforce matching result',html:function(r){return esc(r.match)}}],[{row:'1, Sarah Chen, ATP',match:'Links to existing Contact'},{row:'2, Daniel Cho, Nordic Pension',match:'Creates Contact under existing Account'},{row:'3, Freja Unknown, New Nordic Fund',match:'Proposes new Account + Contact'},{row:'4, A. Larsen, ATP',match:'Needs duplicate review'}]),U.notice('warn','No Fund III Opportunities are created automatically.') ])); }
  function renderResults(pg,user){ var r=rows(); ['Included','Held','Blocked'].forEach(function(state){ pg.appendChild(el('div',{class:'ops-panel'},[el('div',{class:'ops-panel__head'},[el('h2',{class:'ops-panel__title',text:state}),pill(state==='Held'?'Structured reasons: '+heldReasons.join(', '):state)]), U.table([{key:'name',label:'Person',html:function(x){return esc(x.name)}},{key:'institution',label:'Institution',html:function(x){return esc(x.institution)}},{key:'reason',label:'Reason',html:function(x){return esc(x.reason||'Included by recipe')}},{key:'owner',label:'Owner',html:function(x){return esc(x.owner)}},{key:'next',label:'Next action',html:function(x){return esc(x.next)}}], r.filter(function(x){return x.state===state;}))])); }); pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'What do you want to do with these people?'}),el('div',{class:'ops-actions'},['Review people','Save search','Export list','Assign for review'].map(function(t){return el('button',{class:'btn btn--quiet',text:t,onclick:function(){U.toast(t+' recorded as demo action.')}})}).concat([el('a',{class:'btn btn--primary',href:'#/outreach/draft',text:'Prepare messages'})]))])); }
  function draft(c,user){ var r=rows().filter(function(x){return x.state==='Included';}), sender=defaultSender(user,r); var pg=page('Outreach / Draft messages','Draft review','Drafting begins only after Prepare messages. Managed signatures are separate from editable body.'); pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Draft package'}),el('p',{text:'Exact recipients: '+r.map(function(x){return x.name+' ('+x.institution+')';}).join('; ')}),el('p',{text:'Treatment group: European pension contacts · Objective: measured reconnection / coverage update'}),el('label',{text:'Named sender'}), (function(){var s=el('select',{class:'ops-input'}); Object.keys(senders).forEach(function(n){s.appendChild(el('option',{value:n,text:n,selected:n===sender}));}); s.onchange=function(){location.hash='#/outreach/draft'; U.toast('Sender changed; managed signature updated. Approval version invalidated.'); SVOps.state.outreach.approval=null;}; return s;}()),el('p',{text:'Sender permission state: '+(persona(user).permissions.canApproveSender?'Sender review permitted':'Preparation only; named human approval required')}),el('h3',{text:'Subject'}),el('p',{text:'ShoreVest introduction and coverage update'}),el('h3',{text:'Body'}),el('textarea',{class:'ops-input',rows:'6',text:'Hello — I am writing with a brief ShoreVest update based on our current coverage review. If useful, we can share a concise overview and coordinate through the appropriate ShoreVest relationship owner.'}),el('h3',{text:'Managed preset signature'}),el('pre',{class:'ops-pre',text:senders[sender].sig}),el('p',{class:'ops-meta',text:'Evidence/source note: Salesforce activity, SharePoint notes and synthetic search recipe. Full recipient list shown above.'}),el('div',{class:'ops-actions'},[el('button',{class:'btn btn--quiet',text:'Needs changes',onclick:function(){U.toast('Returned to preparation.')}}),el('a',{class:'btn btn--primary',href:'#/outreach/draft/approval',text:'Looks right'})]) ])); pg.appendChild(delivery()); if(location.hash.indexOf('approval')>-1) approval(pg,user,sender,r); pg.appendChild(actions('#/outreach/find/results')); c.appendChild(pg); }
  function delivery(){ return el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Delivery policy frozen into approval package'}),el('p',{text:'Automated Power Automate queue: reply-to john@shorevest.com; IROutreach@shorevest.com · BCC shorevest@mergepointai.onmicrosoft.com'}),el('p',{text:'Manual personalised send: reply-to sender mailbox · BCC none, only if approved for that mode'}),el('p',{class:'ops-meta',text:'Users cannot type reply-to or BCC manually.'})]); }
  function approval(pg,user,sender,r){ pg.appendChild(el('div',{class:'ops-panel'},[el('h2',{class:'ops-panel__title',text:'Frozen approval package'}),el('p',{text:'Recipients: '+r.length+' exact included recipients. Held and blocked exclusions remain excluded.'}),el('p',{text:'Sender: '+sender+' · Copy, signature, delivery controls, timing and source/audience recipe frozen. Salesforce changes proposed: Contact activity note only after approved execution; no automatic Opportunity creation.'}),el('p',{text:'Maturity state: Simulated'}),el('button',{class:'btn btn--primary',text:'Submit approval request',onclick:function(){SVOps.state.outreach.approval={version:++SVOps.state.outreach.version,approved:false}; U.toast('Approval requested. Frozen version created. Nothing executed.');}}),el('p',{class:'ops-meta',text:SVOps.state.outreach.approval?'Approval requested. Frozen version created. Nothing executed. Material changes invalidate this version.':''})])); }
  function sent(c){ var pg=page('Outreach / Sent & responses','Sent & responses','Synthetic status only. States used consistently: Suggested, Held, Blocked, Approved, Executed and Failed.'); pg.appendChild(U.table([{key:'batch',label:'Batch',html:function(r){return esc(r.batch)}},{key:'state',label:'State',html:function(r){return esc(r.state)}},{key:'next',label:'Next action',html:function(r){return esc(r.next)}}],[{batch:'ATP Denmark pension review',state:'Approved',next:'Awaiting simulated execution control'},{batch:'Nordic reconnect',state:'Failed',next:'Repair missing evidence before retry'}])); c.appendChild(pg); }
})(typeof self !== 'undefined' ? self : this);
