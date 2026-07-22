/* ==========================================================================
   ShoreVest One — Cross-Border Asset Tracing demonstration model

   This module contains the case schema, synthetic fixtures and browser-local
   demonstration store for the preliminary asset-screening workspace.

   DATA RULE: every person, company, address, matter and source below is
   fictional. The module does not upload files, call external services or hold
   real investigative material. Production data belongs only in the separately
   hosted, permissioned ShoreVest One environment.
   ========================================================================== */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'svops.assetTracing.demo.v1';
  var VERSION = 1;

  var CASE_STATUSES = [
    'Draft', 'Intake review', 'Research', 'Review', 'Approved', 'Escalated', 'On hold', 'Closed'
  ];
  var CONFIDENCE = [
    'Confirmed', 'Corroborated', 'Indicative', 'Unverified', 'Contradicted', 'Not matched'
  ];
  var OWNERSHIP = [
    'Direct', 'Corporate vehicle', 'Beneficial interest', 'Family / associate link',
    'Possible proxy / nominee', 'Address only', 'Unknown'
  ];
  var SOURCE_TYPES = [
    'Internal case material', 'Primary public record', 'Secondary public source',
    'Licensed / proprietary', 'Human-source note', 'Analyst working note'
  ];
  var SCORE_LABELS = {
    0: 'None identified',
    1: 'Limited',
    2: 'Meaningful',
    3: 'Strong'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isoNow() {
    return new Date().toISOString();
  }

  function makeId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function audit(action, actor, detail) {
    return { id: makeId('audit'), at: isoNow(), actor: actor || 'ShoreVest Demo', action: action, detail: detail || '' };
  }

  var FIXTURES = [
    {
      id: 'case-lanternfish',
      projectName: 'Project Lanternfish',
      exposure: 'Synthetic secured credit opportunity',
      decisionQuestion: 'Do the current cross-border leads justify a focused external asset search?',
      owner: 'Alex Morgan',
      reviewer: 'Jordan Lee',
      deadline: '2026-08-07',
      confidentiality: 'Restricted case team',
      status: 'Review',
      score: 2,
      scoreRationale: 'A current corporate interest and one property-linked address are supported, but beneficial ownership and encumbrances remain unresolved.',
      createdAt: '2026-07-16T08:00:00.000Z',
      updatedAt: '2026-07-22T09:30:00.000Z',
      subjects: [
        { id: 'sub-lf-1', name: 'Taylor Chen', kind: 'Personal guarantor', aliases: ['Chen Taylor'], jurisdictions: ['Hong Kong', 'Canada'], confidence: 'Corroborated' },
        { id: 'sub-lf-2', name: 'Quokka Harbour Developments', kind: 'Related company', aliases: [], jurisdictions: ['Hong Kong'], confidence: 'Confirmed' }
      ],
      sources: [
        { id: 'src-lf-1', name: 'Corporate registry extract', type: 'Primary public record', jurisdiction: 'Hong Kong', reference: 'Synthetic registry reference · pages 2–5', result: 'Director and shareholder history recorded.', retrievedAt: '2026-07-18', confidence: 'Confirmed' },
        { id: 'src-lf-2', name: 'Property address search note', type: 'Analyst working note', jurisdiction: 'Canada', reference: 'Synthetic search log · item 4', result: 'One address-linked lead requires title verification.', retrievedAt: '2026-07-20', confidence: 'Indicative' },
        { id: 'src-lf-3', name: 'Public litigation index', type: 'Primary public record', jurisdiction: 'Hong Kong', reference: 'Synthetic court index · entry 19', result: 'Related-company proceeding identified; underlying pleadings not yet reviewed.', retrievedAt: '2026-07-21', confidence: 'Corroborated' }
      ],
      findings: [
        { id: 'f-lf-1', category: 'Business interests', title: 'Current related-company interest', conclusion: 'Taylor Chen is linked to a current role in Quokka Harbour Developments.', confidence: 'Confirmed', ownership: 'Corporate vehicle', sourceIds: ['src-lf-1'], state: 'Reviewed' },
        { id: 'f-lf-2', category: 'Property', title: 'Address-linked property lead', conclusion: 'A Canadian residential address is linked to the subject, but current ownership has not been confirmed.', confidence: 'Indicative', ownership: 'Address only', sourceIds: ['src-lf-2'], state: 'Needs review' },
        { id: 'f-lf-3', category: 'Litigation', title: 'Related-company proceeding', conclusion: 'A public index records a proceeding involving the related company; asset implications are unknown.', confidence: 'Corroborated', ownership: 'Unknown', sourceIds: ['src-lf-3'], state: 'Reviewed' }
      ],
      nextSteps: [
        { id: 'next-lf-1', action: 'Obtain the complete Canadian title record for the linked address.', owner: 'Alex Morgan', status: 'Proposed' },
        { id: 'next-lf-2', action: 'Review underlying pleadings and any registered charges against the related company.', owner: 'Jordan Lee', status: 'Proposed' }
      ],
      coverage: [
        { jurisdiction: 'Hong Kong', corporate: 'Searched', property: 'Not available', litigation: 'Index searched' },
        { jurisdiction: 'Canada', corporate: 'Not searched', property: 'Address lead only', litigation: 'Not searched' }
      ],
      audit: [audit('Case created', 'Alex Morgan', 'Synthetic demonstration fixture.'), audit('Moved to review', 'Jordan Lee', 'Three findings prepared for second-person review.')]
    },
    {
      id: 'case-pangolin',
      projectName: 'Project Pangolin',
      exposure: 'Synthetic personal-guarantee screening',
      decisionQuestion: 'Is there enough evidence to justify paid records in the United Kingdom?',
      owner: 'Jordan Lee',
      reviewer: 'Sam Patel',
      deadline: '2026-08-14',
      confidentiality: 'Restricted case team',
      status: 'Research',
      score: 1,
      scoreRationale: 'Historical company activity is confirmed, but no current asset lead has been identified within the searched sources.',
      createdAt: '2026-07-19T03:20:00.000Z',
      updatedAt: '2026-07-23T01:10:00.000Z',
      subjects: [
        { id: 'sub-pg-1', name: 'Morgan Liu', kind: 'Personal guarantor', aliases: ['Liu Morgan'], jurisdictions: ['Singapore', 'United Kingdom'], confidence: 'Corroborated' },
        { id: 'sub-pg-2', name: 'Pangolin Industrial Holdings', kind: 'Former business interest', aliases: [], jurisdictions: ['Singapore'], confidence: 'Confirmed' }
      ],
      sources: [
        { id: 'src-pg-1', name: 'Company filing history', type: 'Primary public record', jurisdiction: 'Singapore', reference: 'Synthetic filing bundle · pages 1–8', result: 'Former directorship and company address confirmed.', retrievedAt: '2026-07-20', confidence: 'Confirmed' },
        { id: 'src-pg-2', name: 'United Kingdom company search log', type: 'Analyst working note', jurisdiction: 'United Kingdom', reference: 'Synthetic search log · searches 1–7', result: 'No matching current company record identified within the searched names.', retrievedAt: '2026-07-22', confidence: 'Confirmed' }
      ],
      findings: [
        { id: 'f-pg-1', category: 'Business interests', title: 'Former company role', conclusion: 'Morgan Liu held a former role in Pangolin Industrial Holdings.', confidence: 'Confirmed', ownership: 'Corporate vehicle', sourceIds: ['src-pg-1'], state: 'Reviewed' },
        { id: 'f-pg-2', category: 'Source coverage', title: 'No matching UK company record in scoped search', conclusion: 'No matching current company record was identified using the searched names; this is not evidence that no UK interest exists.', confidence: 'Confirmed', ownership: 'Unknown', sourceIds: ['src-pg-2'], state: 'Reviewed' }
      ],
      nextSteps: [
        { id: 'next-pg-1', action: 'Request a complete date of birth or verified UK address before purchasing additional records.', owner: 'Jordan Lee', status: 'In progress' }
      ],
      coverage: [
        { jurisdiction: 'Singapore', corporate: 'Searched', property: 'Not searched', litigation: 'Not searched' },
        { jurisdiction: 'United Kingdom', corporate: 'Name search completed', property: 'Blocked — address needed', litigation: 'Not searched' }
      ],
      audit: [audit('Case created', 'Jordan Lee', 'Synthetic demonstration fixture.'), audit('Source coverage updated', 'Jordan Lee', 'UK search limitations recorded.')]
    },
    {
      id: 'case-mantaray',
      projectName: 'Project Manta Ray',
      exposure: 'Synthetic NPL pipeline screen',
      decisionQuestion: 'Which jurisdictions should be prioritised for the first research pass?',
      owner: 'Sam Patel',
      reviewer: 'Alex Morgan',
      deadline: '2026-08-21',
      confidentiality: 'Restricted case team',
      status: 'Intake review',
      score: null,
      scoreRationale: '',
      createdAt: '2026-07-22T05:40:00.000Z',
      updatedAt: '2026-07-22T05:40:00.000Z',
      subjects: [
        { id: 'sub-mr-1', name: 'Casey Wong', kind: 'Personal guarantor', aliases: ['Wong Casey'], jurisdictions: ['Hong Kong', 'Australia'], confidence: 'Indicative' },
        { id: 'sub-mr-2', name: 'Manta Ray Property Group', kind: 'Related company', aliases: [], jurisdictions: ['Hong Kong'], confidence: 'Indicative' }
      ],
      sources: [],
      findings: [],
      nextSteps: [
        { id: 'next-mr-1', action: 'Confirm complete identifiers and last known residential address.', owner: 'Sam Patel', status: 'In progress' },
        { id: 'next-mr-2', action: 'Agree initial jurisdiction plan with the case reviewer.', owner: 'Alex Morgan', status: 'Proposed' }
      ],
      coverage: [],
      audit: [audit('Case created', 'Sam Patel', 'Synthetic demonstration fixture.')]
    }
  ];

  function initialState() {
    return { version: VERSION, cases: clone(FIXTURES) };
  }

  function readState() {
    if (!root.localStorage) return initialState();
    try {
      var raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) return initialState();
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.cases)) return initialState();
      return parsed;
    } catch (e) {
      return initialState();
    }
  }

  function writeState(state) {
    if (root.localStorage) {
      try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* browser storage may be unavailable */ }
    }
    return state;
  }

  function updateCase(caseId, actor, action, detail, updater) {
    var state = readState();
    var item = null;
    for (var i = 0; i < state.cases.length; i++) {
      if (state.cases[i].id === caseId) { item = state.cases[i]; break; }
    }
    if (!item) throw new Error('Case not found.');
    updater(item);
    item.updatedAt = isoNow();
    item.audit = item.audit || [];
    item.audit.unshift(audit(action, actor, detail));
    writeState(state);
    return clone(item);
  }

  function required(value, label) {
    var v = String(value == null ? '' : value).trim();
    if (!v) throw new Error(label + ' is required.');
    return v;
  }

  function listCases() {
    return clone(readState().cases).sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
  }

  function getCase(caseId) {
    var cases = readState().cases;
    for (var i = 0; i < cases.length; i++) if (cases[i].id === caseId) return clone(cases[i]);
    return null;
  }

  function createCase(payload, actor) {
    var state = readState();
    var item = {
      id: makeId('case'),
      projectName: required(payload.projectName, 'Project name'),
      exposure: required(payload.exposure, 'Exposure / opportunity'),
      decisionQuestion: required(payload.decisionQuestion, 'Decision question'),
      owner: required(payload.owner, 'Owner'),
      reviewer: required(payload.reviewer, 'Reviewer'),
      deadline: payload.deadline || '',
      confidentiality: 'Restricted case team',
      status: 'Draft',
      score: null,
      scoreRationale: '',
      createdAt: isoNow(),
      updatedAt: isoNow(),
      subjects: [], sources: [], findings: [], nextSteps: [], coverage: [],
      audit: [audit('Case created', actor, 'Created in the browser-local synthetic demonstration.')]
    };
    state.cases.unshift(item);
    writeState(state);
    return clone(item);
  }

  function addSubject(caseId, payload, actor) {
    return updateCase(caseId, actor, 'Subject added', payload.name, function (item) {
      item.subjects.push({
        id: makeId('sub'),
        name: required(payload.name, 'Subject name'),
        kind: required(payload.kind, 'Subject type'),
        aliases: (payload.aliases || []).filter(Boolean),
        jurisdictions: (payload.jurisdictions || []).filter(Boolean),
        confidence: payload.confidence || 'Indicative'
      });
    });
  }

  function addSource(caseId, payload, actor) {
    return updateCase(caseId, actor, 'Source logged', payload.name, function (item) {
      item.sources.push({
        id: makeId('src'),
        name: required(payload.name, 'Source name'),
        type: SOURCE_TYPES.indexOf(payload.type) !== -1 ? payload.type : 'Analyst working note',
        jurisdiction: required(payload.jurisdiction, 'Jurisdiction'),
        reference: required(payload.reference, 'Reference / page'),
        result: required(payload.result, 'Result / relevance'),
        retrievedAt: payload.retrievedAt || isoNow().slice(0, 10),
        confidence: CONFIDENCE.indexOf(payload.confidence) !== -1 ? payload.confidence : 'Indicative'
      });
    });
  }

  function addFinding(caseId, payload, actor) {
    return updateCase(caseId, actor, 'Finding added', payload.title, function (item) {
      item.findings.push({
        id: makeId('f'),
        category: required(payload.category, 'Category'),
        title: required(payload.title, 'Finding title'),
        conclusion: required(payload.conclusion, 'Conclusion'),
        confidence: CONFIDENCE.indexOf(payload.confidence) !== -1 ? payload.confidence : 'Indicative',
        ownership: OWNERSHIP.indexOf(payload.ownership) !== -1 ? payload.ownership : 'Unknown',
        sourceIds: (payload.sourceIds || []).filter(Boolean),
        state: 'Needs review'
      });
    });
  }

  function updateReview(caseId, payload, actor) {
    return updateCase(caseId, actor, 'Review updated', payload.status || '', function (item) {
      if (CASE_STATUSES.indexOf(payload.status) !== -1) item.status = payload.status;
      if (payload.score === '' || payload.score == null) item.score = null;
      else {
        var score = Number(payload.score);
        if (score < 0 || score > 3 || score % 1 !== 0) throw new Error('Score must be 0, 1, 2 or 3.');
        item.score = score;
      }
      item.scoreRationale = String(payload.scoreRationale || '').trim();
      if (item.status === 'Approved' && (item.score == null || !item.scoreRationale)) {
        throw new Error('Approved cases require a score and rationale.');
      }
    });
  }

  function reset() {
    var state = initialState();
    writeState(state);
    return clone(state);
  }

  function scoreLabel(score) {
    return score == null ? 'Not scored' : SCORE_LABELS[score];
  }

  /* Insert the workspace into the existing full-demo navigation without changing
     persona configuration or production role mapping. */
  function registerNavigation() {
    var P = root.SVPortalPersonas;
    if (!P || !P.list || !P.list.length || !P.list[0].nav) return;
    var nav = P.list[0].nav;
    for (var i = 0; i < nav.length; i++) if (nav[i].key === 'asset-tracing') return;
    var insertAt = nav.length;
    for (var j = 0; j < nav.length; j++) {
      if (nav[j].key === 'firm') { insertAt = j; break; }
    }
    nav.splice(insertAt, 0, { key: 'asset-tracing', label: 'Asset Tracing', hash: '#/workspace/asset-tracing' });
  }

  registerNavigation();

  root.SVAssetTracing = {
    version: VERSION,
    caseStatuses: CASE_STATUSES,
    confidence: CONFIDENCE,
    ownership: OWNERSHIP,
    sourceTypes: SOURCE_TYPES,
    scoreLabels: SCORE_LABELS,
    fixtures: clone(FIXTURES),
    listCases: listCases,
    getCase: getCase,
    createCase: createCase,
    addSubject: addSubject,
    addSource: addSource,
    addFinding: addFinding,
    updateReview: updateReview,
    reset: reset,
    scoreLabel: scoreLabel
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.SVAssetTracing;
})(typeof self !== 'undefined' ? self : this);
