/* ==========================================================================
   ShoreVest One — Cross-Border Asset Tracing workspace

   A browser-local, synthetic Phase 1 prototype covering case intake, subject
   mapping, source logging, findings, scoring, review and report preview.
   No files are uploaded and no external research or action occurs.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var A = root.SVAssetTracing;
  var el = U.el, esc = U.esc;
  var originalWorkspace = SVOps.views.workspace;

  function rerender() { root.dispatchEvent(new CustomEvent('svops:render')); }
  function actor(user) { return (user && user.name) || 'ShoreVest Demo'; }
  function splitCsv(value) {
    return String(value || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function selectedOptions(select) {
    return Array.prototype.slice.call(select.options).filter(function (o) { return o.selected; }).map(function (o) { return o.value; });
  }
  function selectNode(options, value, attrs) {
    var s = el('select', attrs || {});
    options.forEach(function (x) {
      var o = typeof x === 'string' ? { value: x, label: x } : x;
      var n = el('option', { value: o.value, text: o.label });
      if (String(o.value) === String(value)) n.selected = true;
      s.appendChild(n);
    });
    return s;
  }
  function field(label, input, hint) {
    var f = el('div', { class: 'fld' }, [el('label', { text: label }), input]);
    if (hint) f.appendChild(el('p', { class: 'hint', text: hint }));
    return f;
  }
  function btn(label, cls, fn) {
    return el('button', { type: 'button', class: 'btn ' + (cls || ''), text: label, onclick: fn });
  }
  function safeDate(value) { return value ? U.fmtDate(value) : '—'; }
  function scoreClass(score) { return score == null ? 'at-score--none' : 'at-score--' + score; }
  function scoreBadge(score) {
    return '<span class="at-score ' + scoreClass(score) + '"><strong>' + (score == null ? '—' : esc(score)) + '</strong><span>' + esc(A.scoreLabel(score)) + '</span></span>';
  }
  function statusClass(status) {
    var map = {
      'Draft': 'neutral', 'Intake review': 'warn', 'Research': 'neutral', 'Review': 'warn',
      'Approved': 'ok', 'Escalated': 'ok', 'On hold': 'warn', 'Closed': 'neutral'
    };
    return map[status] || 'neutral';
  }
  function statusBadge(status) { return '<span class="st st--' + statusClass(status) + '">' + esc(status) + '</span>'; }
  function confidenceBadge(confidence) {
    var cls = confidence === 'Confirmed' || confidence === 'Corroborated' ? 'ok' :
      confidence === 'Contradicted' || confidence === 'Not matched' ? 'fail' : 'warn';
    return '<span class="st st--' + cls + '">' + esc(confidence) + '</span>';
  }
  function pageHead(kicker, title, lede, actions) {
    var head = el('div', { class: 'ops-pagehead at-pagehead' });
    var copy = el('div', { class: 'at-pagehead__copy' }, [
      el('p', { class: 'ops-label', text: kicker }),
      el('h1', { class: 'ops-h1', text: title }),
      el('p', { class: 'ops-lede', text: lede })
    ]);
    head.appendChild(copy);
    if (actions && actions.length) head.appendChild(el('div', { class: 'ops-actions at-pagehead__actions' }, actions));
    return head;
  }
  function panel(title, meta, children, cls) {
    var node = el('section', { class: 'ops-panel ' + (cls || '') });
    node.appendChild(el('div', { class: 'ops-panel__head' }, [
      el('h2', { class: 'ops-panel__title', text: title }),
      meta ? el('span', { class: 'ops-meta', text: meta }) : null
    ]));
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }
  function stat(label, value, sub) {
    return el('div', { class: 'ops-stat at-stat' }, [
      el('p', { class: 'ops-stat__k', text: label }),
      el('p', { class: 'ops-stat__v', text: String(value) }),
      sub ? el('p', { class: 'at-stat__sub', text: sub }) : null
    ]);
  }

  function dashboard(container, user) {
    var page = el('div', { class: 'ops-content at-workspace' });
    page.appendChild(pageHead('Recovery & enforcement', 'Cross-Border Asset Tracing',
      'Preliminary, evidence-backed screening to decide which personal-guarantor matters justify deeper external work.', [
        btn('New case', 'btn--primary', function () { openNewCase(user); }),
        btn('Reset demo', 'btn--quiet', function () {
          if (!root.confirm || root.confirm('Reset the synthetic asset-tracing demonstration?')) {
            A.reset(); U.toast('Synthetic asset-tracing demo reset.'); rerender();
          }
        })
      ]));

    page.appendChild(U.notice('info', '<strong>Synthetic demonstration only.</strong> Do not enter real names, identifiers, addresses or upload confidential reports here. This prototype stores structured demo data in this browser only and performs no external searches.'));

    var cases = A.listCases();
    var active = cases.filter(function (c) { return ['Approved', 'Closed'].indexOf(c.status) === -1; });
    var review = cases.filter(function (c) { return c.status === 'Review' || c.status === 'Intake review'; });
    var sources = cases.reduce(function (n, c) { return n + c.sources.length; }, 0);
    var strong = cases.filter(function (c) { return c.score === 3; }).length;
    page.appendChild(el('div', { class: 'ops-stats at-stats' }, [
      stat('Active cases', active.length, 'Synthetic case queue'),
      stat('Needs review', review.length, 'Second-person review'),
      stat('Sources logged', sources, 'Metadata only'),
      stat('Strong leads', strong, 'Score 3')
    ]));

    var filterState = SVOps.state.assetTracingFilters || (SVOps.state.assetTracingFilters = { q: '', status: 'All' });
    var q = el('input', { type: 'search', value: filterState.q, placeholder: 'Search project, subject or owner' });
    var status = selectNode([{ value: 'All', label: 'All statuses' }].concat(A.caseStatuses.map(function (x) { return { value: x, label: x }; })), filterState.status);
    function apply() { filterState.q = q.value; filterState.status = status.value; rerender(); }
    q.addEventListener('input', apply); status.addEventListener('change', apply);

    var filtered = cases.filter(function (c) {
      var hay = [c.projectName, c.owner, c.reviewer, c.exposure].concat(c.subjects.map(function (s) { return s.name; })).join(' ').toLowerCase();
      return (!filterState.q || hay.indexOf(filterState.q.toLowerCase()) !== -1) &&
        (filterState.status === 'All' || c.status === filterState.status);
    });

    var casePanel = panel('Case queue', filtered.length + ' shown', [
      el('div', { class: 'filters at-filters' }, [field('Search', q), field('Status', status)]),
      U.table([
        { key: 'projectName', label: 'Case', html: function (c) {
          return '<strong>' + esc(c.projectName) + '</strong><span class="at-cell-sub">' + esc(c.exposure) + '</span>';
        } },
        { key: 'subjects', label: 'Primary subject', html: function (c) {
          return c.subjects.length ? esc(c.subjects[0].name) + '<span class="at-cell-sub">' + esc(c.subjects[0].kind) + '</span>' : '<span class="at-muted">Not added</span>';
        } },
        { key: 'status', label: 'Status', html: function (c) { return statusBadge(c.status); } },
        { key: 'score', label: 'Lead score', html: function (c) { return scoreBadge(c.score); } },
        { key: 'owner', label: 'Owner', html: function (c) { return esc(c.owner) + '<span class="at-cell-sub">Reviewer: ' + esc(c.reviewer) + '</span>'; } },
        { key: 'updatedAt', label: 'Updated', html: function (c) { return esc(U.fmtDate(c.updatedAt)); } }
      ], filtered, {
        emptyText: 'No cases match this filter.',
        onRowClick: function (c) { location.hash = '#/workspace/asset-tracing/' + encodeURIComponent(c.id) + '/overview'; }
      })
    ], 'at-case-panel');
    page.appendChild(casePanel);

    page.appendChild(panel('What this first build covers', null, [
      el('div', { class: 'at-capability-grid' }, [
        capability('1', 'Intake', 'Case question, owner, reviewer and deadline.'),
        capability('2', 'Subjects', 'Aliases, jurisdictions and identity confidence.'),
        capability('3', 'Evidence', 'Source log with jurisdiction, reference and result.'),
        capability('4', 'Findings', 'Fact, inference, ownership link and confidence.'),
        capability('5', 'Review', '0–3 score, rationale and approval state.'),
        capability('6', 'Report', 'Structured preliminary output preview.')
      ])
    ]));
    container.appendChild(page);
  }

  function capability(num, title, copy) {
    return el('div', { class: 'at-capability' }, [
      el('span', { class: 'at-capability__num', text: num }),
      el('div', {}, [el('h3', { text: title }), el('p', { text: copy })])
    ]);
  }

  function openNewCase(user) {
    var projectName = el('input', { type: 'text', placeholder: 'e.g. Project Snow Leopard' });
    var exposure = el('input', { type: 'text', placeholder: 'Synthetic opportunity or exposure' });
    var question = el('textarea', { placeholder: 'What decision should this screening support?' });
    var owner = el('input', { type: 'text', value: actor(user) });
    var reviewer = el('input', { type: 'text', placeholder: 'Second-person reviewer' });
    var deadline = el('input', { type: 'date' });
    var body = el('div', {}, [
      U.notice('info', '<strong>Demonstration rule:</strong> use fictional names and generic facts only.'),
      el('div', { class: 'ops-grid ops-grid--2' }, [field('Project name', projectName), field('Exposure / opportunity', exposure)]),
      field('Decision question', question),
      el('div', { class: 'ops-grid ops-grid--3' }, [field('Owner', owner), field('Reviewer', reviewer), field('Decision deadline', deadline)])
    ]);
    var drawer = U.drawer('Create asset-tracing case', body);
    body.appendChild(el('div', { class: 'drawer-actions' }, [
      btn('Create case', 'btn--primary', function () {
        try {
          var created = A.createCase({ projectName: projectName.value, exposure: exposure.value, decisionQuestion: question.value, owner: owner.value, reviewer: reviewer.value, deadline: deadline.value }, actor(user));
          drawer.close(); U.toast('Synthetic case created.');
          location.hash = '#/workspace/asset-tracing/' + created.id + '/overview';
        } catch (e) { U.toast(e.message); }
      }),
      btn('Cancel', 'btn--quiet', function () { drawer.close(); })
    ]));
  }

  function caseView(container, user, caseId, tab) {
    var item = A.getCase(caseId);
    if (!item) {
      var missing = el('div', { class: 'ops-content ops-content--narrow' }, [
        pageHead('Asset tracing', 'Case not found', 'The synthetic case may have been reset.'),
        el('a', { class: 'btn btn--quiet', href: '#/workspace/asset-tracing', text: 'Back to case queue' })
      ]);
      container.appendChild(missing); return;
    }

    tab = ['overview', 'sources', 'findings', 'review', 'report'].indexOf(tab) !== -1 ? tab : 'overview';
    var page = el('div', { class: 'ops-content at-workspace at-case' });
    page.appendChild(pageHead('Asset tracing case', item.projectName, item.decisionQuestion, [
      el('a', { class: 'btn btn--quiet', href: '#/workspace/asset-tracing', text: 'Back to cases' }),
      el('span', { class: 'at-head-status', html: statusBadge(item.status) })
    ]));
    page.appendChild(U.notice('info', '<strong>Synthetic case.</strong> The people, companies, sources and findings shown here are fictional. No confidential file contents are stored in this prototype.'));

    page.appendChild(el('div', { class: 'at-casebar' }, [
      detailMetric('Owner', item.owner),
      detailMetric('Reviewer', item.reviewer),
      detailMetric('Deadline', safeDate(item.deadline)),
      detailMetric('Sources', item.sources.length),
      el('div', { class: 'at-casebar__score', html: scoreBadge(item.score) })
    ]));

    page.appendChild(caseTabs(item.id, tab));
    if (tab === 'overview') renderOverview(page, item, user);
    else if (tab === 'sources') renderSources(page, item, user);
    else if (tab === 'findings') renderFindings(page, item, user);
    else if (tab === 'review') renderReview(page, item, user);
    else renderReport(page, item);
    container.appendChild(page);
  }

  function detailMetric(label, value) {
    return el('div', { class: 'at-casebar__item' }, [
      el('span', { class: 'at-casebar__k', text: label }),
      el('span', { class: 'at-casebar__v', text: String(value == null ? '—' : value) })
    ]);
  }

  function caseTabs(caseId, active) {
    var tabs = [
      ['overview', 'Overview'], ['sources', 'Sources'], ['findings', 'Findings'], ['review', 'Review'], ['report', 'Report preview']
    ];
    return el('nav', { class: 'at-tabs', 'aria-label': 'Case sections' }, tabs.map(function (t) {
      return el('a', { class: 'at-tab' + (active === t[0] ? ' is-active' : ''), href: '#/workspace/asset-tracing/' + caseId + '/' + t[0], text: t[1] });
    }));
  }

  function renderOverview(page, item, user) {
    var main = el('div', { class: 'at-layout' });
    var left = el('div', { class: 'at-layout__main' });
    var right = el('aside', { class: 'at-layout__side' });

    left.appendChild(panel('Subjects and related entities', item.subjects.length + ' record' + (item.subjects.length === 1 ? '' : 's'), [
      U.table([
        { key: 'name', label: 'Name', html: function (s) { return '<strong>' + esc(s.name) + '</strong><span class="at-cell-sub">' + esc(s.kind) + '</span>'; } },
        { key: 'aliases', label: 'Aliases', html: function (s) { return s.aliases.length ? esc(s.aliases.join(', ')) : '<span class="at-muted">None logged</span>'; } },
        { key: 'jurisdictions', label: 'Jurisdictions', html: function (s) { return esc(s.jurisdictions.join(', ') || 'Not set'); } },
        { key: 'confidence', label: 'Identity confidence', html: function (s) { return confidenceBadge(s.confidence); } }
      ], item.subjects, { emptyText: 'No subjects added yet.' }),
      el('div', { class: 'ops-actions at-panel-actions' }, [btn('Add subject', 'btn--sm btn--quiet', function () { openAddSubject(item, user); })])
    ]));

    left.appendChild(panel('Research coverage', item.coverage.length ? item.coverage.length + ' jurisdiction' + (item.coverage.length === 1 ? '' : 's') : 'Not planned', [
      U.table([
        { key: 'jurisdiction', label: 'Jurisdiction' },
        { key: 'corporate', label: 'Corporate' },
        { key: 'property', label: 'Property' },
        { key: 'litigation', label: 'Litigation' }
      ], item.coverage, { emptyText: 'No jurisdiction coverage logged yet. Add source activity before relying on a negative conclusion.' })
    ]));

    right.appendChild(panel('Decision being supported', null, [
      el('p', { class: 'at-decision', text: item.decisionQuestion }),
      el('dl', { class: 'facts at-facts' }, [
        el('dt', { text: 'Exposure' }), el('dd', { text: item.exposure }),
        el('dt', { text: 'Access' }), el('dd', { text: item.confidentiality }),
        el('dt', { text: 'Status' }), el('dd', { html: statusBadge(item.status) })
      ])
    ]));

    right.appendChild(panel('Next steps', item.nextSteps.length + ' item' + (item.nextSteps.length === 1 ? '' : 's'), [
      item.nextSteps.length ? el('div', { class: 'at-next-list' }, item.nextSteps.map(function (n) {
        return el('div', { class: 'at-next' }, [
          el('span', { class: 'at-next__state', text: n.status }),
          el('p', { class: 'at-next__action', text: n.action }),
          el('p', { class: 'at-next__owner', text: n.owner })
        ]);
      })) : el('p', { class: 'at-empty-copy', text: 'No next steps recorded.' })
    ]));

    right.appendChild(panel('Current lead assessment', null, [
      el('div', { class: 'at-score-block', html: scoreBadge(item.score) }),
      el('p', { class: 'at-rationale', text: item.scoreRationale || 'Not yet scored. A named reviewer must approve the score and rationale.' }),
      el('a', { class: 'btn btn--sm btn--quiet', href: '#/workspace/asset-tracing/' + item.id + '/review', text: 'Open review' })
    ]));

    main.appendChild(left); main.appendChild(right); page.appendChild(main);
  }

  function openAddSubject(item, user) {
    var name = el('input', { type: 'text', placeholder: 'Fictional subject name' });
    var kind = selectNode(['Personal guarantor', 'Spouse / family', 'Associate', 'Related company', 'Trust / vehicle', 'Counterparty'], 'Personal guarantor');
    var aliases = el('input', { type: 'text', placeholder: 'Comma-separated aliases' });
    var jurisdictions = el('input', { type: 'text', placeholder: 'Comma-separated jurisdictions' });
    var confidence = selectNode(A.confidence, 'Indicative');
    var body = el('div', {}, [
      U.notice('info', '<strong>Use fictional demonstration data only.</strong>'),
      field('Name', name), field('Subject type', kind), field('Aliases', aliases), field('Jurisdictions', jurisdictions), field('Identity confidence', confidence)
    ]);
    var drawer = U.drawer('Add subject', body);
    body.appendChild(el('div', { class: 'drawer-actions' }, [
      btn('Add subject', 'btn--primary', function () {
        try {
          A.addSubject(item.id, { name: name.value, kind: kind.value, aliases: splitCsv(aliases.value), jurisdictions: splitCsv(jurisdictions.value), confidence: confidence.value }, actor(user));
          drawer.close(); U.toast('Synthetic subject added.'); rerender();
        } catch (e) { U.toast(e.message); }
      }), btn('Cancel', 'btn--quiet', function () { drawer.close(); })
    ]));
  }

  function renderSources(page, item, user) {
    page.appendChild(panel('Evidence and source log', item.sources.length + ' source' + (item.sources.length === 1 ? '' : 's'), [
      el('div', { class: 'at-panel-intro' }, [
        el('p', { text: 'Log the source, jurisdiction, exact reference and result. A negative result must say what was searched; it must not be written as proof that no asset exists.' }),
        btn('Log source', 'btn--sm btn--primary', function () { openAddSource(item, user); })
      ]),
      U.table([
        { key: 'name', label: 'Source', html: function (s) { return '<strong>' + esc(s.name) + '</strong><span class="at-cell-sub">' + esc(s.type) + '</span>'; } },
        { key: 'jurisdiction', label: 'Jurisdiction' },
        { key: 'reference', label: 'Reference / page' },
        { key: 'result', label: 'Result / relevance' },
        { key: 'confidence', label: 'Evidence status', html: function (s) { return confidenceBadge(s.confidence); } },
        { key: 'retrievedAt', label: 'Retrieved', html: function (s) { return esc(safeDate(s.retrievedAt)); } }
      ], item.sources, { emptyText: 'No sources logged. Add a source record before drafting a finding.' })
    ], 'at-source-panel'));

    page.appendChild(panel('Source handling controls', null, [
      el('ul', { class: 'at-control-list' }, [
        el('li', { text: 'Original confidential files are not accepted by this public/static prototype.' }),
        el('li', { text: 'Production must preserve the original document, page reference, source type, access restriction and audit history.' }),
        el('li', { text: 'Third-party reports must remain subject to their sharing and licensing restrictions.' }),
        el('li', { text: 'Human-source information requires separate restricted handling and corroboration.' })
      ])
    ]));
  }

  function openAddSource(item, user) {
    var name = el('input', { type: 'text', placeholder: 'e.g. Corporate registry extract' });
    var type = selectNode(A.sourceTypes, 'Primary public record');
    var jurisdiction = el('input', { type: 'text', placeholder: 'Jurisdiction searched' });
    var reference = el('input', { type: 'text', placeholder: 'Registry reference, URL or page range' });
    var result = el('textarea', { placeholder: 'What the source supports, including any limits.' });
    var retrievedAt = el('input', { type: 'date', value: new Date().toISOString().slice(0, 10) });
    var confidence = selectNode(A.confidence, 'Indicative');
    var body = el('div', {}, [
      U.notice('info', '<strong>Metadata only.</strong> This demonstration does not upload or retain file contents.'),
      el('div', { class: 'ops-grid ops-grid--2' }, [field('Source name', name), field('Source type', type), field('Jurisdiction', jurisdiction), field('Retrieved date', retrievedAt)]),
      field('Exact reference / page', reference), field('Result / relevance', result), field('Evidence status', confidence)
    ]);
    var drawer = U.drawer('Log evidence source', body);
    body.appendChild(el('div', { class: 'drawer-actions' }, [
      btn('Log source', 'btn--primary', function () {
        try {
          A.addSource(item.id, { name: name.value, type: type.value, jurisdiction: jurisdiction.value, reference: reference.value, result: result.value, retrievedAt: retrievedAt.value, confidence: confidence.value }, actor(user));
          drawer.close(); U.toast('Synthetic source logged.'); rerender();
        } catch (e) { U.toast(e.message); }
      }), btn('Cancel', 'btn--quiet', function () { drawer.close(); })
    ]));
  }

  function renderFindings(page, item, user) {
    var unsupported = item.findings.filter(function (f) { return !f.sourceIds || !f.sourceIds.length; }).length;
    page.appendChild(panel('Evidence-backed findings', item.findings.length + ' finding' + (item.findings.length === 1 ? '' : 's'), [
      el('div', { class: 'at-panel-intro' }, [
        el('p', { text: 'Keep fact, inference and uncertainty separate. Every approved finding must link to at least one source.' }),
        btn('Add finding', 'btn--sm btn--primary', function () { openAddFinding(item, user); })
      ]),
      unsupported ? U.notice('error', '<strong>' + unsupported + ' unsupported finding' + (unsupported === 1 ? '' : 's') + '.</strong> Add a source before review.') : null,
      U.table([
        { key: 'title', label: 'Finding', html: function (f) { return '<strong>' + esc(f.title) + '</strong><span class="at-cell-sub">' + esc(f.category) + '</span>'; } },
        { key: 'conclusion', label: 'Conclusion' },
        { key: 'ownership', label: 'Link type' },
        { key: 'confidence', label: 'Confidence', html: function (f) { return confidenceBadge(f.confidence); } },
        { key: 'sourceIds', label: 'Sources', html: function (f) { return f.sourceIds.length ? '<strong>' + esc(f.sourceIds.length) + '</strong>' : '<span class="at-danger">Missing</span>'; } },
        { key: 'state', label: 'Review state', html: function (f) { return statusBadge(f.state === 'Reviewed' ? 'Approved' : 'Review'); } }
      ], item.findings, { emptyText: 'No findings yet. Log sources first, then add evidence-backed findings.' })
    ]));

    page.appendChild(panel('Finding language', null, [
      el('div', { class: 'at-language-grid' }, [
        languageRule('Confirmed', '“The corporate filing records…”', 'Direct primary record with sufficient identity match.'),
        languageRule('Indicative', '“A possible address-linked lead was identified…”', 'Plausible but incomplete identity or ownership match.'),
        languageRule('Negative search', '“No result was identified in the searched source…”', 'Never convert scoped absence into “no asset exists”.'),
        languageRule('Contradicted', '“The sources conflict on…”', 'Show the conflict rather than selecting one version silently.')
      ])
    ]));
  }

  function languageRule(title, example, note) {
    return el('div', { class: 'at-language' }, [el('h3', { text: title }), el('p', { class: 'at-language__example', text: example }), el('p', { text: note })]);
  }

  function openAddFinding(item, user) {
    var category = selectNode(['Identity', 'Business interests', 'Property', 'Litigation', 'Lien / charge', 'Transfer', 'Trust / offshore structure', 'Financial institution', 'Other asset lead', 'Source coverage'], 'Business interests');
    var title = el('input', { type: 'text', placeholder: 'Short finding title' });
    var conclusion = el('textarea', { placeholder: 'Evidence-backed statement with uncertainty stated explicitly.' });
    var confidence = selectNode(A.confidence, 'Indicative');
    var ownership = selectNode(A.ownership, 'Unknown');
    var sourceSelect = el('select', { multiple: true, size: Math.min(7, Math.max(3, item.sources.length)) });
    item.sources.forEach(function (s) { sourceSelect.appendChild(el('option', { value: s.id, text: s.name + ' · ' + s.reference })); });
    var body = el('div', {}, [
      item.sources.length ? null : U.notice('error', '<strong>No source available.</strong> Log a source before adding a finding.'),
      el('div', { class: 'ops-grid ops-grid--2' }, [field('Category', category), field('Confidence', confidence), field('Link / ownership type', ownership), field('Finding title', title)]),
      field('Conclusion', conclusion),
      field('Supporting sources', sourceSelect, 'Select one or more source records. Use Command/Ctrl to select multiple.')
    ]);
    var drawer = U.drawer('Add finding', body);
    body.appendChild(el('div', { class: 'drawer-actions' }, [
      btn('Add finding', 'btn--primary' + (item.sources.length ? '' : ' is-disabled'), function () {
        if (!item.sources.length) return;
        try {
          A.addFinding(item.id, { category: category.value, title: title.value, conclusion: conclusion.value, confidence: confidence.value, ownership: ownership.value, sourceIds: selectedOptions(sourceSelect) }, actor(user));
          drawer.close(); U.toast('Synthetic finding added for review.'); rerender();
        } catch (e) { U.toast(e.message); }
      }), btn('Cancel', 'btn--quiet', function () { drawer.close(); })
    ]));
  }

  function renderReview(page, item, user) {
    var status = selectNode(A.caseStatuses, item.status);
    var score = selectNode([{ value: '', label: 'Not scored' }, { value: '0', label: '0 · None identified' }, { value: '1', label: '1 · Limited' }, { value: '2', label: '2 · Meaningful' }, { value: '3', label: '3 · Strong' }], item.score == null ? '' : String(item.score));
    var rationale = el('textarea', { text: item.scoreRationale || '', placeholder: 'Explain the evidence and limitations supporting the score.' });
    var supported = item.findings.filter(function (f) { return f.sourceIds && f.sourceIds.length; }).length;
    var contradictions = item.findings.filter(function (f) { return f.confidence === 'Contradicted'; }).length;
    var checks = [
      { label: 'Named owner and reviewer', pass: !!item.owner && !!item.reviewer },
      { label: 'Every finding linked to a source', pass: supported === item.findings.length && item.findings.length > 0 },
      { label: 'Decision scope and limitations stated', pass: !!item.decisionQuestion },
      { label: 'Score has a written rationale', pass: item.score != null && !!item.scoreRationale },
      { label: 'Contradictions explicitly surfaced', pass: contradictions === 0 || item.findings.some(function (f) { return f.confidence === 'Contradicted'; }) }
    ];

    page.appendChild(el('div', { class: 'at-layout' }, [
      el('div', { class: 'at-layout__main' }, [
        panel('Lead score and case status', null, [
          el('div', { class: 'at-rubric' }, [
            rubric('0', 'None identified', 'No meaningful lead in the searched sources. Not proof of absence.'),
            rubric('1', 'Limited', 'Weak, historical or indirect clues.'),
            rubric('2', 'Meaningful', 'Credible leads needing targeted verification.'),
            rubric('3', 'Strong', 'Confirmed or well-corroborated current asset leads.')
          ]),
          el('div', { class: 'ops-grid ops-grid--2 at-review-fields' }, [field('Case status', status), field('0–3 lead score', score)]),
          field('Reviewer rationale', rationale),
          el('div', { class: 'ops-actions' }, [
            btn('Save review', 'btn--primary', function () {
              try {
                A.updateReview(item.id, { status: status.value, score: score.value, scoreRationale: rationale.value }, actor(user));
                U.toast('Review updated.'); rerender();
              } catch (e) { U.toast(e.message); }
            })
          ])
        ])
      ]),
      el('aside', { class: 'at-layout__side' }, [
        panel('Approval checks', null, [
          el('div', { class: 'at-checks' }, checks.map(function (c) {
            return el('div', { class: 'at-check ' + (c.pass ? 'is-pass' : 'is-open') }, [
              el('span', { class: 'at-check__mark', text: c.pass ? '✓' : '!' }),
              el('span', { text: c.label })
            ]);
          }))
        ]),
        panel('Audit trail', item.audit.length + ' event' + (item.audit.length === 1 ? '' : 's'), [
          el('div', { class: 'at-audit' }, item.audit.slice(0, 8).map(function (a) {
            return el('div', { class: 'at-audit__item' }, [
              el('p', { class: 'at-audit__action', text: a.action }),
              el('p', { class: 'at-audit__meta', text: a.actor + ' · ' + U.fmtDateTime(a.at) }),
              a.detail ? el('p', { class: 'at-audit__detail', text: a.detail }) : null
            ]);
          }))
        ])
      ])
    ]));
  }

  function rubric(score, title, copy) {
    return el('div', { class: 'at-rubric__item' }, [
      el('span', { class: 'at-rubric__score', text: score }),
      el('div', {}, [el('h3', { text: title }), el('p', { text: copy })])
    ]);
  }

  function renderReport(page, item) {
    var subjectNames = item.subjects.map(function (s) { return s.name; }).join(', ') || 'No subjects added';
    var strongest = item.findings.filter(function (f) { return f.confidence === 'Confirmed' || f.confidence === 'Corroborated'; });
    var uncertain = item.findings.filter(function (f) { return ['Indicative', 'Unverified', 'Contradicted'].indexOf(f.confidence) !== -1; });
    var report = el('article', { class: 'at-report' }, [
      el('header', { class: 'at-report__cover' }, [
        el('p', { class: 'at-report__class', text: 'PRIVATE & CONFIDENTIAL · SYNTHETIC DEMONSTRATION' }),
        el('h2', { text: item.projectName }),
        el('p', { class: 'at-report__sub', text: 'Preliminary Cross-Border Asset Screening' }),
        el('dl', { class: 'facts at-report__facts' }, [
          el('dt', { text: 'Subjects' }), el('dd', { text: subjectNames }),
          el('dt', { text: 'Prepared for' }), el('dd', { text: 'ShoreVest demonstration review' }),
          el('dt', { text: 'Status' }), el('dd', { text: item.status }),
          el('dt', { text: 'Lead score' }), el('dd', { text: item.score == null ? 'Not scored' : item.score + ' · ' + A.scoreLabel(item.score) })
        ])
      ]),
      reportSection('Purpose and scope', [item.decisionQuestion, 'This is a browser-local synthetic report preview. It does not contain real investigative material and does not constitute legal advice, valuation or a recovery conclusion.']),
      reportSection('Executive summary', [item.scoreRationale || 'The case has not yet been scored.', strongest.length + ' stronger finding(s) and ' + uncertain.length + ' uncertain or contradictory finding(s) are currently recorded.']),
      reportFindingTable(item.findings),
      reportSection('Potential next steps', item.nextSteps.length ? item.nextSteps.map(function (n) { return n.action + ' (' + n.owner + ')' ; }) : ['No next steps recorded.']),
      reportSection('Methodology and limitations', [
        item.sources.length + ' source record(s) have been logged across the current synthetic scope.',
        'A lack of results is limited to the sources, names, jurisdictions and dates actually searched. It must not be interpreted as proof that no asset exists.',
        'All identity, ownership, legal and recoverability conclusions require human review and, where appropriate, qualified external advice.'
      ])
    ]);
    page.appendChild(panel('Preliminary report preview', 'Not approved for external use', [report, el('div', { class: 'ops-actions at-report-actions' }, [
      btn('Download synthetic JSON', 'btn--quiet', function () { downloadCase(item); }),
      el('p', { class: 'btn-note', text: 'Production will generate a versioned Word/PDF report after approval.' })
    ])], 'at-report-panel'));
  }

  function reportSection(title, paragraphs) {
    return el('section', { class: 'at-report__section' }, [
      el('h3', { text: title })
    ].concat(paragraphs.map(function (p) { return el('p', { text: p }); })));
  }

  function reportFindingTable(findings) {
    var section = el('section', { class: 'at-report__section' }, [el('h3', { text: 'Findings' })]);
    section.appendChild(U.table([
      { key: 'title', label: 'Finding', html: function (f) { return '<strong>' + esc(f.title) + '</strong><span class="at-cell-sub">' + esc(f.category) + '</span>'; } },
      { key: 'conclusion', label: 'Conclusion' },
      { key: 'confidence', label: 'Confidence' },
      { key: 'ownership', label: 'Link type' }
    ], findings, { emptyText: 'No findings recorded.' }));
    return section;
  }

  function downloadCase(item) {
    var blob = new Blob([JSON.stringify({
      notice: 'Synthetic ShoreVest One asset-tracing demonstration. No real investigative material.',
      exportedAtUtc: new Date().toISOString(),
      case: item
    }, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = item.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-synthetic.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  SVOps.views.workspace = function (container, user, params) {
    if (params && params[0] === 'asset-tracing') {
      if (params[1]) caseView(container, user, decodeURIComponent(params[1]), params[2] || 'overview');
      else dashboard(container, user);
      return;
    }
    return originalWorkspace(container, user, params);
  };
})(typeof self !== 'undefined' ? self : this);
