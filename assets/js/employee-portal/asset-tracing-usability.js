/* ========================================================================== 
   ShoreVest One — Asset Tracing usability guidance

   Adds a simple, progressive path through each synthetic case and improves the
   new-case drawer. This layer changes presentation and interaction guidance
   only. It does not change case data, call a network service or handle files.
   ========================================================================== */
(function (root) {
  'use strict';

  var scheduled = false;

  function text(node) { return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }

  function route() {
    var parts = String(root.location && root.location.hash || '').replace(/^#\/?/, '').split('/');
    if (parts[0] !== 'workspace' || parts[1] !== 'asset-tracing') return null;
    return {
      caseId: parts[2] ? decodeURIComponent(parts[2]) : '',
      tab: parts[3] || 'overview'
    };
  }

  function stateFor(item) {
    var findings = item.findings || [];
    var sources = item.sources || [];
    var subjects = item.subjects || [];
    var allSourced = findings.length > 0 && findings.every(function (finding) {
      return finding.sourceIds && finding.sourceIds.length;
    });
    var allReviewed = findings.length > 0 && findings.every(function (finding) {
      return finding.state === 'Reviewed';
    });
    var checks = root.SVAssetTracing.approvalChecksForCase ?
      root.SVAssetTracing.approvalChecksForCase(item, {}) : [];
    var approvalReady = checks.length > 0 && checks.every(function (check) { return check.pass; });

    return {
      subjects: subjects,
      sources: sources,
      findings: findings,
      allSourced: allSourced,
      allReviewed: allReviewed,
      checks: checks,
      approvalReady: approvalReady,
      stages: {
        overview: subjects.length > 0,
        sources: sources.length > 0,
        findings: allSourced,
        review: approvalReady,
        report: item.status === 'Approved'
      }
    };
  }

  function nextAction(item, state) {
    if (!state.subjects.length) return {
      tab: 'overview', title: 'Add the first subject',
      copy: 'Start with the guarantor, related person or company that the screening is about.'
    };
    if (!state.sources.length) return {
      tab: 'sources', title: 'Log the first evidence source',
      copy: 'Record what was searched, where it was searched and the exact reference or page.'
    };
    if (!state.findings.length) return {
      tab: 'findings', title: 'Turn the evidence into a finding',
      copy: 'Write one clear conclusion and link it to the source that supports it.'
    };
    if (!state.allSourced) return {
      tab: 'findings', title: 'Link every finding to evidence',
      copy: 'A finding cannot move forward until at least one supporting source is attached.'
    };
    if (!state.allReviewed) return {
      tab: 'findings', title: 'Finish the second-person review',
      copy: 'The reviewer should check each finding and mark it reviewed or send it back.'
    };
    if (item.score == null || !String(item.scoreRationale || '').trim()) return {
      tab: 'review', title: 'Set the lead score and rationale',
      copy: 'Choose a 0–3 score and explain both the evidence and its limitations.'
    };
    if (!state.approvalReady) return {
      tab: 'review', title: 'Clear the remaining approval checks',
      copy: 'The review screen shows exactly what still prevents approval.'
    };
    if (item.status !== 'Approved') return {
      tab: 'review', title: 'Approve the case when ready',
      copy: 'Confirm the checks, then change the case status to Approved.'
    };
    return {
      tab: 'report', title: 'Review the final report',
      copy: 'The case is approved. Read the report and confirm the source references before use.'
    };
  }

  function enhanceTabs(item, currentTab, state) {
    var tabs = root.document.querySelector('.at-case .at-tabs');
    if (!tabs) return;
    var order = ['overview', 'sources', 'findings', 'review', 'report'];
    Array.prototype.forEach.call(tabs.querySelectorAll('.at-tab'), function (tab) {
      var href = tab.getAttribute('href') || '';
      var key = order.filter(function (name) { return href.slice(-(name.length + 1)) === '/' + name; })[0];
      if (!key) return;
      var step = order.indexOf(key) + 1;
      tab.setAttribute('data-step', String(step));
      tab.classList.toggle('is-complete', !!state.stages[key]);
      var status = state.stages[key] ? 'complete' : 'not complete';
      var current = key === currentTab ? ', current section' : '';
      tab.setAttribute('aria-label', step + ' of 5, ' + text(tab) + ', ' + status + current);
    });

    if (tabs.nextElementSibling && tabs.nextElementSibling.classList.contains('at-guidance')) return;
    var action = nextAction(item, state);
    var guidance = root.document.createElement('section');
    guidance.className = 'at-guidance';
    guidance.setAttribute('aria-label', 'Recommended next action');

    var copy = root.document.createElement('div');
    copy.className = 'at-guidance__copy';
    copy.innerHTML = '<p class="at-guidance__kicker">Recommended next step</p>' +
      '<h2>' + escapeHtml(action.title) + '</h2>' +
      '<p>' + escapeHtml(action.copy) + '</p>';
    guidance.appendChild(copy);

    if (currentTab === action.tab) {
      var here = root.document.createElement('span');
      here.className = 'at-guidance__here';
      here.textContent = 'You are in the right section. Complete it below.';
      guidance.appendChild(here);
    } else {
      var link = root.document.createElement('a');
      link.className = 'btn btn--primary at-guidance__action';
      link.href = '#/workspace/asset-tracing/' + encodeURIComponent(item.id) + '/' + action.tab;
      link.textContent = 'Go to ' + (action.tab === 'report' ? 'report' : action.tab);
      guidance.appendChild(link);
    }
    tabs.insertAdjacentElement('afterend', guidance);
  }

  function enhanceQueue() {
    var panel = root.document.querySelector('.at-case-panel');
    if (!panel) return;
    if (!panel.querySelector('.at-queue-help')) {
      var help = root.document.createElement('p');
      help.className = 'at-queue-help';
      help.textContent = 'Choose any case row to continue. The case page will show the one next action to take.';
      var head = panel.querySelector('.ops-panel__head');
      if (head) head.insertAdjacentElement('afterend', help);
    }
    Array.prototype.forEach.call(panel.querySelectorAll('tbody tr.rowlink'), function (row) {
      var first = row.querySelector('td');
      if (!first || first.querySelector('.at-row-action')) return;
      var action = root.document.createElement('span');
      action.className = 'at-row-action';
      action.textContent = 'Open case →';
      first.appendChild(action);
    });
  }

  function ensureHint(field, copy) {
    if (!field || field.querySelector('.at-usability-hint')) return;
    var hint = root.document.createElement('p');
    hint.className = 'hint at-usability-hint';
    hint.textContent = copy;
    field.appendChild(hint);
  }

  function enhanceNewCaseDrawer() {
    Array.prototype.forEach.call(root.document.querySelectorAll('.drawer'), function (drawer) {
      var title = text(drawer.querySelector('h1, h2, h3, .drawer__title'));
      if (title !== 'Create asset-tracing case' || drawer.getAttribute('data-at-usable') === 'true') return;
      drawer.setAttribute('data-at-usable', 'true');

      var fields = Array.prototype.slice.call(drawer.querySelectorAll('.fld'));
      var primary = Array.prototype.slice.call(drawer.querySelectorAll('button')).filter(function (button) {
        return text(button) === 'Create case';
      })[0];
      var actions = drawer.querySelector('.drawer-actions');
      var status = root.document.createElement('p');
      status.className = 'at-form-status';
      status.setAttribute('aria-live', 'polite');
      if (actions) actions.insertAdjacentElement('beforebegin', status);

      var hints = {
        'Project name': 'Use a short fictional project name.',
        'Exposure / opportunity': 'Describe the credit or NPL matter in one line.',
        'Decision question': 'State the decision this screening needs to support.',
        'Owner': 'The person doing the research.',
        'Reviewer': 'A different person who checks the evidence.',
        'Decision deadline': 'Optional.'
      };

      var requiredControls = [];
      fields.forEach(function (field) {
        var label = field.querySelector('label');
        var control = field.querySelector('input, select, textarea');
        var labelText = text(label);
        if (!label || !control) return;
        if (hints[labelText]) ensureHint(field, hints[labelText]);
        if (labelText !== 'Decision deadline') {
          control.required = true;
          control.setAttribute('aria-required', 'true');
          requiredControls.push({ control: control, label: labelText });
          if (!label.querySelector('.at-required')) {
            var required = root.document.createElement('span');
            required.className = 'at-required';
            required.textContent = 'Required';
            label.appendChild(required);
          }
        }
      });

      function update() {
        var missing = requiredControls.filter(function (item) { return !String(item.control.value || '').trim(); });
        var owner = requiredControls.filter(function (item) { return item.label === 'Owner'; })[0];
        var reviewer = requiredControls.filter(function (item) { return item.label === 'Reviewer'; })[0];
        var samePerson = owner && reviewer && owner.control.value.trim() && reviewer.control.value.trim() &&
          owner.control.value.trim().toLowerCase() === reviewer.control.value.trim().toLowerCase();
        var ready = !missing.length && !samePerson;
        if (primary) {
          primary.disabled = !ready;
          primary.setAttribute('aria-disabled', ready ? 'false' : 'true');
        }
        if (samePerson) status.textContent = 'Choose a reviewer who is different from the owner.';
        else if (missing.length) status.textContent = 'Complete ' + missing.length + ' required field' + (missing.length === 1 ? '' : 's') + ' to create the case.';
        else status.textContent = 'Ready to create.';
        status.classList.toggle('is-ready', ready);
      }

      requiredControls.forEach(function (item) {
        item.control.addEventListener('input', update);
        item.control.addEventListener('change', update);
      });
      update();

      var first = requiredControls[0] && requiredControls[0].control;
      if (first && root.document.activeElement === root.document.body) first.focus();
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function enhance() {
    scheduled = false;
    if (!root.document || !root.SVAssetTracing) return;
    var current = route();
    if (current && current.caseId) {
      var item = root.SVAssetTracing.getCase(current.caseId);
      if (item) enhanceTabs(item, current.tab, stateFor(item));
    } else if (current) enhanceQueue();
    enhanceNewCaseDrawer();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    if (root.requestAnimationFrame) root.requestAnimationFrame(enhance);
    else root.setTimeout(enhance, 0);
  }

  function start() {
    enhance();
    if (root.MutationObserver && root.document.body) {
      new root.MutationObserver(schedule).observe(root.document.body, { childList: true, subtree: true });
    }
    root.addEventListener('svops:render', schedule);
    root.addEventListener('hashchange', schedule);
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  root.SVAssetTracingUsability = { enhance: enhance, stateFor: stateFor, nextAction: nextAction };
})(typeof self !== 'undefined' ? self : this);
