/* ==========================================================================
   ShoreVest One — Cross-Border Asset Tracing Phase 1B interface

   Adds explicit research-planning, next-step, finding-review and approval-gate
   controls to the synthetic workspace. No confidential file contents, uploads,
   web research or external actions are implemented.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var A = root.SVAssetTracing;
  if (!SVOps || !A || !SVOps.views || !SVOps.views.workspace) return;

  var U = SVOps.ui;
  var el = U.el;
  var priorWorkspace = SVOps.views.workspace;

  function actor(user) { return (user && user.name) || 'ShoreVest Demo'; }
  function rerender() { root.dispatchEvent(new CustomEvent('svops:render')); }
  function field(label, input, hint) {
    var f = el('div', { class: 'fld' }, [el('label', { text: label }), input]);
    if (hint) f.appendChild(el('p', { class: 'hint', text: hint }));
    return f;
  }
  function input(type, placeholder, value) {
    return el('input', { type: type || 'text', placeholder: placeholder || '', value: value || '' });
  }
  function select(options, value) {
    var node = el('select');
    options.forEach(function (x) {
      var o = el('option', { value: x, text: x });
      if (x === value) o.selected = true;
      node.appendChild(o);
    });
    return node;
  }
  function button(label, cls, handler, disabled) {
    var b = el('button', { type: 'button', class: 'btn ' + (cls || ''), text: label, onclick: handler });
    if (disabled) b.disabled = true;
    return b;
  }
  function panel(title, copy, children) {
    var p = el('section', { class: 'ops-panel at-phase1b-panel' });
    p.appendChild(el('div', { class: 'ops-panel__head' }, [el('h2', { class: 'ops-panel__title', text: title })]));
    if (copy) p.appendChild(el('p', { class: 'at-panel-copy', text: copy }));
    (children || []).forEach(function (child) { if (child) p.appendChild(child); });
    return p;
  }

  function addCoverageDrawer(item, user) {
    var jurisdiction = input('text', 'e.g. United Kingdom');
    var corporate = input('text', 'e.g. Name search completed');
    var property = input('text', 'e.g. Blocked — verified address needed');
    var litigation = input('text', 'e.g. Index not searched');
    var body = el('div', {}, [
      U.notice('info', '<strong>Coverage log only.</strong> Record what was actually searched and what remains unavailable. Do not treat “not found” as proof of absence.'),
      field('Jurisdiction', jurisdiction),
      field('Corporate records', corporate),
      field('Property records', property),
      field('Litigation records', litigation)
    ]);
    var drawer = U.drawer('Add or update research coverage', body);
    body.appendChild(el('div', { class: 'drawer-actions' }, [
      button('Save coverage', 'btn--primary', function () {
        try {
          A.addCoverage(item.id, { jurisdiction: jurisdiction.value, corporate: corporate.value, property: property.value, litigation: litigation.value }, actor(user));
          drawer.close(); U.toast('Synthetic research coverage updated.'); rerender();
        } catch (e) { U.toast(e.message); }
      }),
      button('Cancel', 'btn--quiet', function () { drawer.close(); })
    ]));
  }

  function addNextStepDrawer(item, user) {
    var action = el('textarea', { placeholder: 'Specific next action, including the evidence gap it addresses.' });
    var owner = input('text', 'Named owner', actor(user));
    var status = select(['Proposed', 'In progress', 'Waiting', 'Complete'], 'Proposed');
    var body = el('div', {}, [
      field('Next action', action),
      el('div', { class: 'ops-grid ops-grid--2' }, [field('Owner', owner), field('Status', status)])
    ]);
    var drawer = U.drawer('Add next step', body);
    body.appendChild(el('div', { class: 'drawer-actions' }, [
      button('Add next step', 'btn--primary', function () {
        try {
          A.addNextStep(item.id, { action: action.value, owner: owner.value, status: status.value }, actor(user));
          drawer.close(); U.toast('Synthetic next step added.'); rerender();
        } catch (e) { U.toast(e.message); }
      }),
      button('Cancel', 'btn--quiet', function () { drawer.close(); })
    ]));
  }

  function enhanceOverview(page, item, user) {
    page.appendChild(panel('Research planning controls', 'Keep the jurisdiction plan and action plan explicit. These controls write only to browser-local synthetic data.', [
      el('div', { class: 'at-phase1b-actions' }, [
        button('Add research coverage', 'btn--sm btn--quiet', function () { addCoverageDrawer(item, user); }),
        button('Add next step', 'btn--sm btn--quiet', function () { addNextStepDrawer(item, user); })
      ])
    ]));
  }

  function enhanceFindings(page, item, user) {
    if (!item.findings.length) return;
    var list = el('div', { class: 'at-finding-review-list' });
    item.findings.forEach(function (finding) {
      var sourced = finding.sourceIds && finding.sourceIds.length;
      list.appendChild(el('div', { class: 'at-finding-review' }, [
        el('div', { class: 'at-finding-review__copy' }, [
          el('p', { class: 'at-finding-review__title', text: finding.title }),
          el('p', { class: 'at-finding-review__meta', text: finding.state + ' · ' + (sourced ? sourced + ' source link' + (sourced === 1 ? '' : 's') : 'no supporting source') })
        ]),
        el('div', { class: 'ops-actions' }, [
          button('Mark reviewed', 'btn--sm btn--quiet', function () {
            try { A.setFindingReview(item.id, finding.id, 'Reviewed', actor(user)); U.toast('Finding marked reviewed.'); rerender(); }
            catch (e) { U.toast(e.message); }
          }, !sourced || finding.state === 'Reviewed'),
          button('Return to review', 'btn--sm btn--quiet', function () {
            try { A.setFindingReview(item.id, finding.id, 'Needs review', actor(user)); U.toast('Finding returned to review.'); rerender(); }
            catch (e) { U.toast(e.message); }
          }, finding.state !== 'Reviewed')
        ])
      ]));
    });
    page.appendChild(panel('Second-person finding review', 'Approval requires every finding to carry a source and be marked Reviewed by the case team.', [list]));
  }

  function enhanceReview(page, item, user) {
    var checks = A.approvalChecks(item.id, { score: item.score, scoreRationale: item.scoreRationale });
    var open = checks.filter(function (c) { return !c.pass; });
    var list = el('div', { class: 'at-approval-gate' }, checks.map(function (c) {
      return el('div', { class: 'at-approval-gate__item ' + (c.pass ? 'is-pass' : 'is-open') }, [
        el('span', { class: 'at-approval-gate__mark', text: c.pass ? '✓' : '!' }),
        el('span', { text: c.label })
      ]);
    }));
    page.appendChild(panel('Hard approval gate', open.length ? open.length + ' requirement' + (open.length === 1 ? '' : 's') + ' still open.' : 'All approval requirements pass.', [
      list,
      el('div', { class: 'ops-actions at-phase1b-actions' }, [
        button('Approve case', 'btn--primary', function () {
          try {
            A.updateReview(item.id, { status: 'Approved', score: item.score, scoreRationale: item.scoreRationale }, actor(user));
            U.toast('Synthetic case approved.'); rerender();
          } catch (e) { U.toast(e.message); }
        }, open.length > 0)
      ]),
      el('p', { class: 'btn-note', text: 'The model also enforces this gate. Changing the status dropdown to Approved cannot bypass it.' })
    ]));
  }

  SVOps.views.workspace = function (container, user, params) {
    priorWorkspace(container, user, params);
    if (!params || params[0] !== 'asset-tracing' || !params[1]) return;
    var item = A.getCase(decodeURIComponent(params[1]));
    if (!item) return;
    var page = container.querySelector('.at-case');
    if (!page) return;
    var tab = params[2] || 'overview';
    if (tab === 'overview') enhanceOverview(page, item, user);
    else if (tab === 'findings') enhanceFindings(page, item, user);
    else if (tab === 'review') enhanceReview(page, item, user);
  };
})(typeof self !== 'undefined' ? self : this);
