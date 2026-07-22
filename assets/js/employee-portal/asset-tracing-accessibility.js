/* ========================================================================== 
   ShoreVest One — Asset Tracing accessibility hardening

   Applies progressive accessibility attributes after the synthetic workspace is
   rendered. The portal replaces routed content and mounts drawers directly under
   document.body, so the hardening is idempotent and observes both surfaces.

   This file changes presentation semantics only. It does not read files, call a
   network service, transmit data or alter the Asset Tracing case model.
   ========================================================================== */
(function (root) {
  'use strict';

  var sequence = 0;

  function nextId(prefix) {
    sequence += 1;
    return (prefix || 'sv-at') + '-' + sequence;
  }

  function setFieldLabel(field) {
    var label = field.querySelector('label');
    var control = field.querySelector('input, select, textarea');
    if (!label || !control) return;

    if (!control.id) control.id = nextId('sv-at-field');
    label.setAttribute('for', control.id);

    var hint = field.querySelector('.hint');
    if (hint) {
      if (!hint.id) hint.id = nextId('sv-at-hint');
      var described = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (described.indexOf(hint.id) === -1) described.push(hint.id);
      control.setAttribute('aria-describedby', described.join(' '));
    }

    if (control.tagName === 'SELECT' && control.multiple && !control.getAttribute('aria-label')) {
      control.setAttribute('aria-label', label.textContent.trim());
    }
  }

  function harden(scope) {
    var node = scope && scope.querySelectorAll ? scope : root.document;
    if (!node) return;

    /* Asset Tracing fields live either in the routed workspace or in a body-level
       drawer created by the shared UI primitive. */
    Array.prototype.forEach.call(node.querySelectorAll('.at-workspace .fld, .drawer .fld'), setFieldLabel);

    Array.prototype.forEach.call(node.querySelectorAll('.at-tabs .at-tab'), function (tab) {
      if (tab.classList.contains('is-active')) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });

    Array.prototype.forEach.call(node.querySelectorAll('.at-workspace table.tbl th'), function (th) {
      th.setAttribute('scope', 'col');
    });

    Array.prototype.forEach.call(node.querySelectorAll('.at-workspace .rowlink'), function (row) {
      if (!row.getAttribute('aria-label')) {
        var first = row.querySelector('td');
        var label = first ? first.textContent.replace(/\s+/g, ' ').trim() : 'Open case';
        row.setAttribute('aria-label', label);
      }
    });

    Array.prototype.forEach.call(node.querySelectorAll('.at-workspace button.is-disabled'), function (button) {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
    });

    Array.prototype.forEach.call(node.querySelectorAll('.at-check__mark'), function (mark) {
      mark.setAttribute('aria-hidden', 'true');
    });

    Array.prototype.forEach.call(node.querySelectorAll('.at-report'), function (report) {
      if (!report.getAttribute('aria-label')) report.setAttribute('aria-label', 'Preliminary asset screening report preview');
    });
  }

  function observe() {
    var body = root.document && root.document.body;
    if (!body || !root.MutationObserver) {
      harden(root.document);
      return;
    }

    harden(root.document);
    var observer = new root.MutationObserver(function () { harden(root.document); });
    observer.observe(body, { childList: true, subtree: true });
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', observe);
    else observe();
    root.addEventListener('svops:render', function () { harden(root.document); });
  }

  root.SVAssetTracingAccessibility = { harden: harden };
})(typeof self !== 'undefined' ? self : this);
