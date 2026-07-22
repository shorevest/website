/* ==========================================================================
   ShoreVest One — Asset Tracing report lineage and print view

   Enhances the synthetic report preview with finding-to-source lineage, a full
   source register and a browser print action. No external action or confidential
   data handling is introduced.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var A = root.SVAssetTracing;
  if (!SVOps || !A || !SVOps.views || !SVOps.views.workspace) return;

  var U = SVOps.ui;
  var el = U.el;
  var esc = U.esc;
  var priorWorkspace = SVOps.views.workspace;

  function panel(title, meta, children, cls) {
    var node = el('section', { class: 'ops-panel ' + (cls || '') });
    node.appendChild(el('div', { class: 'ops-panel__head' }, [
      el('h2', { class: 'ops-panel__title', text: title }),
      meta ? el('span', { class: 'ops-meta', text: meta }) : null
    ]));
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function sourceIndex(item) {
    var byId = {};
    (item.sources || []).forEach(function (source, index) {
      byId[source.id] = { source: source, label: 'S' + (index + 1) };
    });
    return byId;
  }

  function lineageList(item) {
    var index = sourceIndex(item);
    var list = el('div', { class: 'at-lineage-list' });
    (item.findings || []).forEach(function (finding) {
      var refs = (finding.sourceIds || []).map(function (id) { return index[id]; }).filter(Boolean);
      var citations = refs.length ? refs.map(function (entry) {
        return el('li', {}, [
          el('strong', { text: '[' + entry.label + '] ' }),
          el('span', { text: entry.source.name + ' · ' + entry.source.reference })
        ]);
      }) : [el('li', { class: 'at-lineage-missing', text: 'No supporting source linked.' })];
      list.appendChild(el('section', { class: 'at-lineage-item' }, [
        el('h3', { text: finding.title }),
        el('p', { text: finding.conclusion }),
        el('ul', { class: 'at-lineage-citations' }, citations)
      ]));
    });
    if (!(item.findings || []).length) list.appendChild(el('p', { class: 'at-empty-copy', text: 'No findings recorded.' }));
    return list;
  }

  function sourceRegister(item) {
    var index = sourceIndex(item);
    return U.table([
      { key: 'id', label: 'Ref.', html: function (source) { return '<strong>[' + esc(index[source.id].label) + ']</strong>'; } },
      { key: 'name', label: 'Source', html: function (source) { return '<strong>' + esc(source.name) + '</strong><span class="at-cell-sub">' + esc(source.type) + '</span>'; } },
      { key: 'jurisdiction', label: 'Jurisdiction' },
      { key: 'reference', label: 'Exact reference / page' },
      { key: 'result', label: 'What it supports' },
      { key: 'retrievedAt', label: 'Retrieved', html: function (source) { return esc(U.fmtDate(source.retrievedAt)); } }
    ], item.sources || [], { emptyText: 'No source records logged.' });
  }

  function approvalNotice(item) {
    if (!A.approvalChecks) return null;
    var open = A.approvalChecks(item.id, { score: item.score, scoreRationale: item.scoreRationale }).filter(function (c) { return !c.pass; });
    if (!open.length) return U.notice('info', '<strong>Approval-ready synthetic report.</strong> All evidence and second-person review checks currently pass.');
    return U.notice('error', '<strong>Working draft.</strong> ' + open.length + ' approval requirement' + (open.length === 1 ? '' : 's') + ' remain open.');
  }

  function enhanceReport(page, item) {
    var reportPanel = page.querySelector('.at-report-panel');
    if (!reportPanel) return;

    var actions = reportPanel.querySelector('.at-report-actions');
    if (actions) {
      actions.insertBefore(el('button', {
        type: 'button', class: 'btn btn--quiet', text: 'Print synthetic draft',
        onclick: function () { if (root.print) root.print(); }
      }), actions.firstChild);
    }

    var notice = approvalNotice(item);
    if (notice) reportPanel.insertBefore(notice, reportPanel.querySelector('.at-report'));

    page.appendChild(panel('Finding-to-source lineage', (item.findings || []).length + ' finding' + ((item.findings || []).length === 1 ? '' : 's'), [
      el('p', { class: 'at-panel-copy', text: 'Each finding below resolves to the source record and exact reference captured in this synthetic case.' }),
      lineageList(item)
    ], 'at-lineage-panel'));

    page.appendChild(panel('Source register', (item.sources || []).length + ' source' + ((item.sources || []).length === 1 ? '' : 's'), [
      sourceRegister(item)
    ], 'at-source-register-panel'));
  }

  SVOps.views.workspace = function (container, user, params) {
    priorWorkspace(container, user, params);
    if (!params || params[0] !== 'asset-tracing' || !params[1] || params[2] !== 'report') return;
    var item = A.getCase(decodeURIComponent(params[1]));
    var page = container.querySelector('.at-case');
    if (item && page) enhanceReport(page, item);
  };
})(typeof self !== 'undefined' ? self : this);
