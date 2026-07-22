/* ==========================================================================
   ShoreVest One — Cross-Border Asset Tracing Phase 1B model controls

   Adds research-coverage, next-step and finding-review actions to the existing
   browser-local synthetic model. It also hardens approval so a case cannot be
   marked Approved unless the second-person evidence checks pass.

   DATA RULE: this remains a synthetic demonstration. No file upload, network
   request, external research or confidential-data handling is implemented.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var install = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = install;
  install(root);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'svops.assetTracing.demo.v1';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function isoNow() { return new Date().toISOString(); }
  function makeId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }
  function required(value, label) {
    var v = String(value == null ? '' : value).trim();
    if (!v) throw new Error(label + ' is required.');
    return v;
  }
  function normaliseName(value) { return String(value || '').trim().toLowerCase(); }

  function approvalChecksForCase(item, proposed) {
    var p = proposed || {};
    var score = p.score === '' || p.score == null ? item.score : Number(p.score);
    var rationale = p.scoreRationale == null ? item.scoreRationale : String(p.scoreRationale).trim();
    var findings = item.findings || [];
    var sources = item.sources || [];
    var allSourced = findings.length > 0 && findings.every(function (f) {
      return Array.isArray(f.sourceIds) && f.sourceIds.length > 0;
    });
    var allReviewed = findings.length > 0 && findings.every(function (f) { return f.state === 'Reviewed'; });
    var separateReviewer = !!item.owner && !!item.reviewer && normaliseName(item.owner) !== normaliseName(item.reviewer);

    return [
      { key: 'owner-reviewer', label: 'Owner and reviewer are named and different people', pass: separateReviewer },
      { key: 'source-log', label: 'At least one evidence source is logged', pass: sources.length > 0 },
      { key: 'findings', label: 'At least one finding is recorded', pass: findings.length > 0 },
      { key: 'citations', label: 'Every finding links to at least one source', pass: allSourced },
      { key: 'review-state', label: 'Every finding has been second-person reviewed', pass: allReviewed },
      { key: 'score', label: 'A 0–3 score is selected', pass: score === 0 || score === 1 || score === 2 || score === 3 },
      { key: 'rationale', label: 'The score has a written evidence and limitations rationale', pass: !!rationale },
      { key: 'scope', label: 'The decision question and screening scope are stated', pass: !!String(item.decisionQuestion || '').trim() }
    ];
  }

  function readState(root) {
    if (!root.localStorage) throw new Error('Browser-local demonstration storage is unavailable.');
    var raw = root.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('Asset-tracing demonstration state is unavailable. Reset the demo and try again.');
    var state = JSON.parse(raw);
    if (!state || !Array.isArray(state.cases)) throw new Error('Asset-tracing demonstration state is invalid.');
    return state;
  }

  function writeState(root, state) {
    root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function mutateCase(root, caseId, actor, action, detail, updater) {
    var state = readState(root);
    var item = state.cases.filter(function (c) { return c.id === caseId; })[0];
    if (!item) throw new Error('Case not found.');
    updater(item);
    item.updatedAt = isoNow();
    item.audit = item.audit || [];
    item.audit.unshift({ id: makeId('audit'), at: isoNow(), actor: actor || 'ShoreVest Demo', action: action, detail: detail || '' });
    writeState(root, state);
    return clone(item);
  }

  function install(root) {
    var A = root && root.SVAssetTracing;
    if (!A || A.phase1bInstalled) return A || null;

    var originalUpdateReview = A.updateReview;

    A.approvalChecksForCase = approvalChecksForCase;
    A.approvalChecks = function (caseId, proposed) {
      var item = A.getCase(caseId);
      if (!item) throw new Error('Case not found.');
      return approvalChecksForCase(item, proposed);
    };

    A.addCoverage = function (caseId, payload, actor) {
      return mutateCase(root, caseId, actor, 'Research coverage updated', payload.jurisdiction, function (item) {
        var jurisdiction = required(payload.jurisdiction, 'Jurisdiction');
        var existing = (item.coverage || []).filter(function (x) { return normaliseName(x.jurisdiction) === normaliseName(jurisdiction); })[0];
        var next = {
          jurisdiction: jurisdiction,
          corporate: required(payload.corporate, 'Corporate coverage'),
          property: required(payload.property, 'Property coverage'),
          litigation: required(payload.litigation, 'Litigation coverage')
        };
        item.coverage = item.coverage || [];
        if (existing) Object.assign(existing, next);
        else item.coverage.push(next);
      });
    };

    A.addNextStep = function (caseId, payload, actor) {
      return mutateCase(root, caseId, actor, 'Next step added', payload.action, function (item) {
        item.nextSteps = item.nextSteps || [];
        item.nextSteps.push({
          id: makeId('next'),
          action: required(payload.action, 'Next step'),
          owner: required(payload.owner, 'Next-step owner'),
          status: payload.status || 'Proposed'
        });
      });
    };

    A.setFindingReview = function (caseId, findingId, state, actor) {
      if (state !== 'Reviewed' && state !== 'Needs review') throw new Error('Invalid finding review state.');
      return mutateCase(root, caseId, actor, 'Finding review updated', state, function (item) {
        var finding = (item.findings || []).filter(function (f) { return f.id === findingId; })[0];
        if (!finding) throw new Error('Finding not found.');
        if (!finding.sourceIds || !finding.sourceIds.length) throw new Error('A finding cannot be reviewed without a supporting source.');
        finding.state = state;
      });
    };

    A.updateReview = function (caseId, payload, actor) {
      if (payload && payload.status === 'Approved') {
        var item = A.getCase(caseId);
        if (!item) throw new Error('Case not found.');
        var open = approvalChecksForCase(item, payload).filter(function (c) { return !c.pass; });
        if (open.length) throw new Error('Approval blocked: ' + open.map(function (c) { return c.label; }).join('; ') + '.');
      }
      return originalUpdateReview(caseId, payload, actor);
    };

    A.phase1bInstalled = true;
    return A;
  }

  install.approvalChecksForCase = approvalChecksForCase;
  return install;
});
