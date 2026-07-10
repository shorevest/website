/* ==========================================================================
   ShoreVest Operations — UI primitives
   Small DOM helpers shared by every view, plus the global view registry
   (window.SVOps) that the view files populate and app.js routes into.
   No business logic lives here.
   ========================================================================== */
(function (root) {
  'use strict';

  var R = root.SVPortalRules;

  /* Global namespace: views register themselves here; app.js routes. */
  var SVOps = root.SVOps = root.SVOps || { views: {}, state: {} };

  /* ── DOM helpers ───────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) node.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function frag(html) {
    var t = document.createElement('template');
    t.innerHTML = html;
    return t.content;
  }

  /* ── Formatting ────────────────────────────────────────────────────────── */

  function fmtInt(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US');
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 16) + ' UTC';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d) ? String(iso) : d.toISOString().slice(0, 10);
  }

  /* ── Status indicator (dot + label — never colour alone) ──────────────── */

  var STATUS_CLASS = {};
  if (R) {
    STATUS_CLASS[R.CLASSIFICATION.READY] = 'st--ready';
    STATUS_CLASS[R.CLASSIFICATION.REVIEW_REQUIRED] = 'st--review';
    STATUS_CLASS[R.CLASSIFICATION.DUPLICATE] = 'st--duplicate';
    STATUS_CLASS[R.CLASSIFICATION.BLOCKED] = 'st--blocked';
    STATUS_CLASS[R.CLASSIFICATION.INVALID] = 'st--invalid';
    STATUS_CLASS[R.CLASSIFICATION.SYSTEM_ERROR] = 'st--system';
  }
  var BATCH_STATUS_CLASS = {
    'Complete': 'st--ready',
    'Failed': 'st--blocked',
    'Failed Reconciliation': 'st--blocked',
    'Review Required': 'st--review',
    'Awaiting Approval': 'st--review',
    'Executing Approved Actions': 'st--review'
  };

  var CONTROLLED_STATUSES = ['Ready', 'Needs review', 'Waiting', 'On hold', 'Blocked', 'Suggested', 'Complete'];
  var CONTROLLED_ACTIONS = ['Review', 'Prepare', 'Send', 'Confirm', 'Fix', 'Wait'];
  var CONTROLLED_STATUS_CLASS = {
    'Ready': 'st--ready',
    'Needs review': 'st--review',
    'Waiting': 'st--neutral',
    'On hold': 'st--review',
    'Blocked': 'st--blocked',
    'Suggested': 'st--review',
    'Complete': 'st--ready'
  };

  function statusHtml(label, cls) {
    var c = cls || CONTROLLED_STATUS_CLASS[label] || STATUS_CLASS[label] || BATCH_STATUS_CLASS[label] || 'st--neutral';
    return '<span class="st ' + c + '">' + esc(label) + '</span>';
  }

  function actionChip(label) {
    var safe = CONTROLLED_ACTIONS.indexOf(label) === -1 ? 'Review' : label;
    return '<span class="action-chip action-chip--' + safe.toLowerCase() + '">' + esc(safe) + '</span>';
  }

  /* ── Table builder ─────────────────────────────────────────────────────── */

  /**
   * columns: [{ key, label, num, html(row) → string, text(row) → string }]
   * opts: { emptyText, onRowClick(row), rowAttrs(row) }
   */
  function table(columns, rows, opts) {
    var o = opts || {};
    var wrap = el('div', { class: 'tblwrap' });
    if (!rows || !rows.length) {
      wrap.appendChild(el('div', { class: 'tbl-empty', text: o.emptyText || 'No records.' }));
      return wrap;
    }
    var thead = '<thead><tr>' + columns.map(function (c) {
      return '<th' + (c.num ? ' class="num"' : '') + '>' + esc(c.label) + '</th>';
    }).join('') + '</tr></thead>';
    var t = el('table', { class: 'tbl', html: thead });
    var tbody = el('tbody');
    rows.forEach(function (row) {
      var tr = el('tr', o.onRowClick ? { class: 'rowlink', tabindex: '0', role: 'button' } : null);
      columns.forEach(function (c) {
        var td = document.createElement('td');
        if (c.num) td.className = 'num';
        if (c.html) td.innerHTML = c.html(row);
        else td.textContent = c.text ? c.text(row) : (row[c.key] == null ? '—' : String(row[c.key]));
        tr.appendChild(td);
      });
      if (o.onRowClick) {
        tr.addEventListener('click', function () { o.onRowClick(row); });
        tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onRowClick(row); } });
      }
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    wrap.appendChild(t);
    return wrap;
  }

  /* ── Notices, toasts, drawers ──────────────────────────────────────────── */

  function notice(kind, html) {
    return el('div', { class: 'notice notice--' + kind, role: kind === 'error' ? 'alert' : 'status', html: html });
  }

  var toastTimer = null;
  function toast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var t = el('div', { class: 'toast', role: 'status', text: message });
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 4200);
  }

  function drawer(title, bodyNode, opts) {
    var o = opts || {};
    var scrim = el('div', { class: 'drawer-scrim' });
    var d = el('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    function close() { scrim.remove(); d.remove(); document.removeEventListener('keydown', onKey); if (o.onClose) o.onClose(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    d.appendChild(el('button', { class: 'drawer__close', 'aria-label': 'Close', text: '×', onclick: close }));
    d.appendChild(el('h3', { text: title }));
    d.appendChild(bodyNode);
    document.body.appendChild(scrim);
    document.body.appendChild(d);
    return { close: close, node: d };
  }

  /* ── State screens ─────────────────────────────────────────────────────── */

  function stateScreen(kind, title, message, actions) {
    var glyphs = { loading: '', denied: '!', error: '×', empty: '·', expired: '⏻' };
    var s = el('div', { class: 'state' + (kind === 'denied' ? ' state--denied' : '') });
    if (kind === 'loading') s.appendChild(el('div', { class: 'spinner', 'aria-hidden': 'true' }));
    else s.appendChild(el('div', { class: 'glyph', 'aria-hidden': 'true', text: glyphs[kind] || '·' }));
    s.appendChild(el('h2', { text: title }));
    s.appendChild(el('p', { text: message }));
    (actions || []).forEach(function (a) { s.appendChild(a); });
    return s;
  }

  function permissionDenied(capability) {
    return stateScreen('denied', 'Access restricted',
      'Your role does not include the "' + capability + '" permission. ' +
      'If you believe you need this access, contact an administrator.');
  }

  /* ── Form field helpers ────────────────────────────────────────────────── */

  function fieldSelect(id, label, options, value, opts) {
    var o = opts || {};
    var sel = el('select', { id: id });
    (o.placeholder != null ? [{ value: '', label: o.placeholder }] : []).concat(options).forEach(function (opt) {
      var ov = typeof opt === 'string' ? { value: opt, label: opt } : opt;
      var node = el('option', { value: ov.value, text: ov.label });
      if (String(ov.value) === String(value)) node.selected = true;
      sel.appendChild(node);
    });
    if (o.onchange) sel.addEventListener('change', o.onchange);
    var f = el('div', { class: 'fld' }, [el('label', { for: id, text: label }), sel]);
    if (o.hint) f.appendChild(el('p', { class: 'hint', text: o.hint }));
    f.input = sel;
    return f;
  }

  function fieldText(id, label, value, opts) {
    var o = opts || {};
    var input = el('input', { type: o.type || 'text', id: id, value: value == null ? '' : value, placeholder: o.placeholder || '' });
    var f = el('div', { class: 'fld' }, [el('label', { for: id, text: label }), input]);
    if (o.hint) f.appendChild(el('p', { class: 'hint', text: o.hint }));
    f.input = input;
    return f;
  }

  /** Yes/No controlled toggle rendered as an explicit select — deliberate,
      auditable choices rather than a one-tap switch. */
  function toggleRow(id, label, sub, value, opts) {
    var o = opts || {};
    var sel = el('select', { id: id, 'aria-label': label });
    [{ v: 'no', l: 'No' }, { v: 'yes', l: 'Yes' }].forEach(function (x) {
      var node = el('option', { value: x.v, text: x.l });
      if ((value === true && x.v === 'yes') || (value !== true && x.v === 'no')) node.selected = true;
      sel.appendChild(node);
    });
    if (o.disabled) sel.disabled = true;
    if (o.onchange) sel.addEventListener('change', o.onchange);
    var row = el('div', { class: 'tgl' + (o.consequential ? ' tgl--consequential' : '') }, [
      el('div', { class: 'tgl__text', html: esc(label) + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') }),
      sel
    ]);
    row.input = sel;
    return row;
  }

  function yesNo(v) {
    return v === true
      ? '<span class="yes">Yes</span>'
      : '<span class="no">No</span>';
  }

  SVOps.ui = {
    esc: esc, el: el, frag: frag,
    fmtInt: fmtInt, fmtDate: fmtDate, fmtDateTime: fmtDateTime,
    statusHtml: statusHtml, actionChip: actionChip,
    controlledStatuses: CONTROLLED_STATUSES, controlledActions: CONTROLLED_ACTIONS,
    table: table,
    notice: notice, toast: toast, drawer: drawer,
    stateScreen: stateScreen, permissionDenied: permissionDenied,
    fieldSelect: fieldSelect, fieldText: fieldText, toggleRow: toggleRow,
    yesNo: yesNo
  };
})(typeof self !== 'undefined' ? self : this);
