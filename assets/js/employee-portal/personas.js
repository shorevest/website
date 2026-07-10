/* ==========================================================================
   ShoreVest One — role (persona) configuration
   A single small configuration layer describing the three demonstration
   people: their identity, permanent navigation, Home information, and the
   restrained previews behind future-facing navigation.

   Everything here is synthetic. External institutions, contacts, and account
   details are entirely fictional. Only the internal ShoreVest names are real,
   used solely to identify the selected demonstration role. No real emails,
   contact data, or confidential information appears.

   The Home page absorbs complexity: each person sees only the work that needs
   them, what is happening today, and what is waiting on someone else. The
   underlying operational prototype (list processing, rules engine, exceptions,
   administration) is preserved under Tools and reached through the shared
   capability role below — the persona's *display* role is separate.
   ========================================================================== */
(function (root) {
  'use strict';

  var R = root.SVPortalRules;

  /* Underlying capability role used only to keep the legacy Tools prototype
     fully accessible for every demonstration persona. This is not the person's
     display role — see `displayRole` on each persona. */
  var TOOLS_ROLE = R ? R.ROLES.ADMINISTRATOR : 'Administrator';

  /* ── Navigation ─────────────────────────────────────────────────────────
     Canonical ShoreVest One navigation. Outreach is the only disclosed
     submenu; Tools remains a top-level area for legacy prototypes and status
     reference, not the product concept. */

  function canonicalNav(counts) {
    counts = counts || {};
    function item(key, label, hash, count, opts) {
      return Object.assign({ key: key, label: label, hash: hash, count: count || 0 }, opts || {});
    }
    return [
      { sep: 'Core' },
      item('home', 'Home', '#/home'),
      item('my-work', 'My Work', '#/my-work', counts.myWork),
      item('relationships', 'Relationships', '#/relationships', counts.relationships),
      { sep: 'Investor Relations' },
      item('outreach', 'Outreach', '#/outreach', counts.outreach, { children: [
        item('outreach-find', 'Find or add people', '#/outreach/find'),
        item('outreach-draft', 'Draft messages', '#/outreach/draft'),
        item('outreach-sent', 'Sent & responses', '#/outreach/sent')
      ] }),
      item('meetings', 'Meetings', '#/meetings', counts.meetings),
      item('diligence', 'Diligence & Requests', '#/diligence', counts.diligence),
      item('investor-intelligence', 'Investor Intelligence', '#/investor-intelligence', counts.intel),
      item('reporting', 'Reporting', '#/reporting', counts.reporting),
      { sep: 'Controls' },
      item('approvals', 'Approvals', '#/approvals', counts.approvals),
      item('firm', 'Firm', '#/firm'),
      item('tools', 'Tools', '#/tools')
    ];
  }

  /* ── Home data ──────────────────────────────────────────────────────────
     Three sections only: Needs you, Today, Waiting elsewhere.
     Cards ask one question, offer one recommendation or state, and show no
     more than three actions. The first action is primary. */

  var JOHN_HOME = {
    needsYou: [
      {
        id: 'john-greenvale-meeting',
        title: 'GreenVale Capital meeting',
        context: ['A senior ShoreVest attendee will join fifteen minutes late.'],
        recLabel: 'ShoreVest One suggests',
        recommendation: 'Begin with allocation timing and hold the senior relationship discussion until the senior attendee joins.',
        actions: [
          { label: 'Use revised plan', intent: 'primary', done: 'Revised plan in place' },
          { label: 'Change', intent: 'secondary', done: 'Marked for change' },
          { label: 'Need review', intent: 'secondary', done: 'Sent for review' }
        ],
        detail: 'The senior attendee’s calendar shows an overlapping internal commitment ending shortly after the scheduled start. The agenda has two parts; only the second needs the senior attendee present.'
      },
      {
        id: 'john-northbridge-outreach',
        title: 'NorthBridge Pension outreach',
        context: ['One email was delivered and no substantive response has been identified after eight business days.'],
        recLabel: 'ShoreVest One suggests',
        recommendation: 'Send one final follow-up.',
        actions: [
          { label: 'Approve', intent: 'primary', done: 'Final follow-up approved' },
          { label: 'Hold', intent: 'secondary', done: 'On hold' },
          { label: 'Context is wrong', intent: 'secondary', done: 'Flagged for correction' }
        ],
        detail: 'The first note was delivered to the primary contact. No reply, meeting acceptance, or forward has been observed. Standard practice allows a single, measured follow-up before the relationship rests.'
      },
      {
        id: 'john-greenvale-diligence',
        title: 'GreenVale Capital diligence request',
        context: ['One commercial disclosure decision is required.'],
        recLabel: 'ShoreVest One suggests',
        recommendation: 'Use approved aggregated information rather than named recovery examples.',
        actions: [
          { label: 'Approve approach', intent: 'primary', done: 'Approach approved' },
          { label: 'Request broader review', intent: 'secondary', done: 'Broader review requested' },
          { label: 'Ask Ben', intent: 'secondary', done: 'Referred to Ben' }
        ],
        detail: 'The request asks for evidence of recovery outcomes. Approved aggregated figures answer the question without disclosing named situations, which keeps the response within the agreed disclosure boundary.'
      }
    ],
    today: [
      { time: '10:30', title: 'GreenVale Capital', note: 'Needs one decision', tone: 'attention' },
      { time: '15:00', title: 'Meridian Insurance', note: 'Ready', tone: 'ready' },
      { time: '17:00', title: 'Internal Investment update', note: 'No preparation required', tone: 'calm' }
    ],
    waiting: [
      { title: 'GreenVale recovery material', note: 'Waiting on Investment' },
      { title: 'Summit Endowment introduction', note: 'Waiting on Ben' },
      { title: 'Meridian follow-up package', note: 'Waiting on Legal' }
    ]
  };

  var KELVIN_HOME = {
    needsYou: [
      {
        id: 'kelvin-eastgate-meeting',
        title: 'EastGate Assurance meeting',
        context: ['Your counterpart has shortened the review to a thirty-minute slot.'],
        recLabel: 'ShoreVest One suggests',
        recommendation: 'Lead with the mandate update and defer the fee discussion to a short follow-up.',
        actions: [
          { label: 'Use revised plan', intent: 'primary', done: 'Revised plan in place' },
          { label: 'Change', intent: 'secondary', done: 'Marked for change' },
          { label: 'Need review', intent: 'secondary', done: 'Sent for review' }
        ],
        detail: 'The meeting was rescheduled to a shorter window. The mandate update is time-sensitive; the fee discussion is not, and reads better with supporting figures that can follow.'
      },
      {
        id: 'kelvin-harbour-reconnect',
        title: 'Harbour Ridge Partners reconnection',
        context: ['A dormant relationship has a new trigger: a senior contact has moved firm.', 'No substantive contact in fourteen months.'],
        recLabel: 'ShoreVest One suggests',
        recommendation: 'Send one reconnection note acknowledging the new role.',
        actions: [
          { label: 'Approve', intent: 'primary', done: 'Reconnection approved' },
          { label: 'Hold', intent: 'secondary', done: 'On hold' },
          { label: 'Context is wrong', intent: 'secondary', done: 'Flagged for correction' }
        ],
        detail: 'The relationship has been quiet for over a year. A senior contact’s move is a natural, low-pressure reason to reconnect without implying an immediate ask.'
      },
      {
        id: 'kelvin-rmb-shareclass',
        title: 'RMB share-class query',
        context: ['One commercial disclosure decision is required on RMB share-class availability.'],
        recLabel: 'ShoreVest One suggests',
        recommendation: 'Use the approved standard wording rather than bespoke terms.',
        actions: [
          { label: 'Approve approach', intent: 'primary', done: 'Approach approved' },
          { label: 'Request broader review', intent: 'secondary', done: 'Broader review requested' },
          { label: 'Ask Ben', intent: 'secondary', done: 'Referred to Ben' }
        ],
        detail: 'The enquiry touches share-class terms that vary by jurisdiction. Approved standard wording answers the question consistently and avoids committing to bespoke terms before they are settled.'
      }
    ],
    today: [
      { time: '09:00', title: 'EastGate Assurance', note: 'Needs one decision', tone: 'attention' },
      { time: '13:30', title: 'Meridian Insurance (Asia)', note: 'Ready', tone: 'ready' },
      { time: '16:00', title: 'Internal Investment update', note: 'No preparation required', tone: 'calm' }
    ],
    waiting: [
      { title: 'Harbour Ridge term summary', note: 'Waiting on Investment' },
      { title: 'EastGate introduction', note: 'Waiting on Legal' },
      { title: 'RMB share-class confirmation', note: 'Waiting on Investment' }
    ]
  };

  var CELESTRA_HOME = {
    needsYou: [
      {
        id: 'celestra-mergepoint-contact-review',
        title: 'MergePoint contact review',
        context: ['12 proposed contacts need review before Salesforce writeback.'],
        recLabel: 'Held',
        recommendation: 'Held for ownership or account match.',
        actions: [
          { label: 'Review proposed records', intent: 'primary', done: 'Proposed records opened' },
          { label: 'Why am I seeing this?', intent: 'secondary', done: 'Explanation opened' }
        ],
        detail: 'MergePoint is useful for notes, enrichment and secondary checks, but it is not an authoritative operating list. Ownership and account matches must be accepted before Salesforce changes.'
      },
      {
        id: 'celestra-task-cleanup',
        title: 'Automated task cleanup',
        context: ['7 old MergePoint-created tasks may be duplicate or low-value.'],
        recLabel: 'Suggested',
        recommendation: 'Suggested cleanup, not automatic deletion.',
        actions: [
          { label: 'Review suggestions', intent: 'primary', done: 'Task cleanup suggestions opened' },
          { label: 'Hold', intent: 'secondary', done: 'Cleanup held' }
        ],
        detail: 'AI suggestions are not official tasks until accepted. ShoreVest One never silently deletes, merges or changes ownership.'
      },
      {
        id: 'celestra-dataroom-package',
        title: 'Data-room access package',
        context: ['Meridian request is ready, but recipient eligibility and approval version must be frozen.'],
        recLabel: 'Current state',
        recommendation: 'Ready to assemble.',
        actions: [
          { label: 'Prepare access package', intent: 'primary', done: 'Access package prepared' },
          { label: 'Need review', intent: 'secondary', done: 'Sent for review' }
        ],
        detail: 'The approved master and recipient-specific derivative are controlled inside Diligence & Requests before any data-room access is prepared.'
      }
    ],
    today: [
      { time: '11:00', title: 'MergePoint review', note: '12 proposed contacts', tone: 'attention' },
      { time: '14:00', title: 'Meridian data-room', note: 'Ready to assemble', tone: 'ready' },
      { time: '16:30', title: 'Suggested task cleanup', note: 'Not official tasks yet', tone: 'calm' }
    ],
    waiting: [
      { title: 'Ownership confirmation', note: 'Waiting on John' },
      { title: 'Asia account match', note: 'Waiting on Kelvin' },
      { title: 'Approval version', note: 'Waiting on Ben' }
    ]
  };


  var NICO_HOME = {
    needsYou: [
      { id: 'nico-denmark-research', title: 'Denmark pension search', context: ['Six ATP contacts found; two can be included, four require institution concentration review.'], recLabel: 'Suggested', recommendation: 'Review evidence and prepare a handoff batch for John before drafting.', actions: [{ label: 'Open Outreach', intent: 'primary', done: 'Outreach opened' }, { label: 'Assign review', intent: 'secondary', done: 'Review assigned' }], detail: 'Nico handles broad lead generation, Salesforce cross-checking, initial research and outreach preparation before John or Kelvin sender review.' },
      { id: 'nico-sf-crosscheck', title: 'Salesforce cross-check', context: ['Three uploaded names match existing Contacts and two need duplicate review.'], recLabel: 'Current state', recommendation: 'Resolve matching before any message preparation. Do not create Opportunities automatically.', actions: [{ label: 'Review matches', intent: 'primary', done: 'Match review opened' }, { label: 'Save for later', intent: 'secondary', done: 'Saved' }], detail: 'AI suggestions and upload matches are not official tasks or CRM changes until accepted by a human.' }
    ],
    today: [
      { time: '09:45', title: 'European pension research', note: 'Evidence needed', tone: 'attention' },
      { time: '12:00', title: 'Salesforce duplicate queue', note: 'Cross-check only', tone: 'ready' },
      { time: '16:00', title: 'John/Kelvin handoff notes', note: 'Prepare context', tone: 'calm' }
    ],
    waiting: [
      { title: 'ATP concentration decision', note: 'Waiting on John' },
      { title: 'Hong Kong family office ownership', note: 'Waiting on Kelvin' },
      { title: 'MergePoint secondary check', note: 'Waiting on Celestra' }
    ]
  };


  var BEN_HOME = {
    needsYou: [
      { id:'ben-stage4-plan', title:'Stage 4 LPs without strategic action plan', context:['Four advanced relationships have no current owner plan.'], recLabel:'Current state', recommendation:'Decide whether to assign owner plans or downgrade priority.', actions:[{label:'Review exceptions',intent:'primary',done:'Exceptions opened'},{label:'Ask owners',intent:'secondary',done:'Owner request recorded'}], detail:'Ben sees strategic gaps, approval items and exceptions where owner judgement is required.' },
      { id:'ben-priority-mismatch', title:'Priority mismatch: owner judgement vs automated signal', context:['Automated signal is high while owner priority is low for two LPs.'], recLabel:'Held', recommendation:'Challenge the stale inputs before changing plan.', actions:[{label:'Open relationship review',intent:'primary',done:'Relationship review opened'}], detail:'Automated ranks are a challenge signal only and cannot override owner judgement silently.' },
      { id:'ben-brief-approval', title:'Upcoming LP meetings missing concise brief', context:['Three meetings in the next seven days lack a current brief.'], recLabel:'Blocked', recommendation:'Ask owners to prepare concise briefs before the meeting window.', actions:[{label:'Assign brief owners',intent:'primary',done:'Brief owners assigned'}], detail:'Briefs are cumulative: permanent relationship brief, meeting-specific brief, then post-meeting update.' }
    ],
    today:[{time:'09:30',title:'Approval decisions',note:'Two frozen packages',tone:'attention'},{time:'13:00',title:'Stage 4 review',note:'Action plans missing',tone:'ready'},{time:'16:00',title:'Weekly coverage review',note:'Exceptions only',tone:'calm'}],
    waiting:[{title:'Europe owner plans',note:'Waiting on John'},{title:'Asia priority update',note:'Waiting on Kelvin'},{title:'DDQ disclosure boundary',note:'Waiting on Legal'}]
  };
  var EMILY_HOME = {
    needsYou: [
      { id:'emily-template', title:'Briefing-note standardisation', context:['Two meeting brief templates diverge from current process.'], recLabel:'Suggested', recommendation:'Approve one standard template and retire the old draft.', actions:[{label:'Review template',intent:'primary',done:'Template review opened'}], detail:'Emily sees process, template, reporting and Salesforce structure fixes.' },
      { id:'emily-fields', title:'Salesforce structure fixes', context:['Subjective priority and action category ownership are unclear.'], recLabel:'Held', recommendation:'Confirm field ownership before migration notes are accepted.', actions:[{label:'Confirm field owners',intent:'primary',done:'Field owner review opened'}], detail:'No silent ownership changes or stage movement happen from ShoreVest One.' },
      { id:'emily-reporting', title:'Weekly reporting configuration', context:['Snapshot is live but three data-quality exceptions need taxonomy.'], recLabel:'Current state', recommendation:'Classify stale-record and missing-next-step exception types.', actions:[{label:'Open reporting config',intent:'primary',done:'Reporting config opened'}], detail:'Reporting is treated as a live workstream with source, owner and freshness visible.' }
    ],
    today:[{time:'10:00',title:'Process configuration',note:'Action category design',tone:'attention'},{time:'14:30',title:'Template library',note:'One standard needed',tone:'ready'}],
    waiting:[{title:'Salesforce field list',note:'Waiting on Celestra'},{title:'AI control register evidence',note:'Waiting on vendors'}]
  };

  /* ── People ─────────────────────────────────────────────────────────────
     `role` carries the shared capability role so the legacy Tools prototype
     keeps working; `displayRole` is what the person actually sees. */

  var PERSONAS = [
    {
      id: 'ben', name: 'Ben Fanger', displayRole: 'Managing Partner',
      username: 'ben.fanger@shorevest.example', role: TOOLS_ROLE, region: 'Firm', defaultSender: 'John Jones',
      nav: canonicalNav({ myWork: 6, relationships: 4, outreach: 0, meetings: 3, diligence: 1, intel: 2, reporting: 2, approvals: 5 }), home: BEN_HOME,
      permissions: { canApproveSender: true, canApproveAsia: true, canApproveExAsia: true, canPrepare: true }
    },
    {
      id: 'john', name: 'John Jones', displayRole: 'Director of Client Solutions, Ex-Asia',
      username: 'john.jones@shorevest.example', role: TOOLS_ROLE, region: 'Ex-Asia', defaultSender: 'John Jones',
      nav: canonicalNav({ myWork: 5, relationships: 8, outreach: 3, meetings: 2, diligence: 1, intel: 2, reporting: 1, approvals: 4 }), home: JOHN_HOME,
      permissions: { canApproveSender: true, canApproveAsia: false, canApproveExAsia: true, canPrepare: true }
    },
    {
      id: 'kelvin', name: 'Kelvin Chan', displayRole: 'Director of Client Solutions, Asia',
      username: 'kelvin.chan@shorevest.example', role: TOOLS_ROLE, region: 'Asia', defaultSender: 'Kelvin Chan',
      nav: canonicalNav({ myWork: 4, relationships: 7, outreach: 2, meetings: 2, diligence: 1, intel: 2, reporting: 1, approvals: 3 }), home: KELVIN_HOME,
      permissions: { canApproveSender: true, canApproveAsia: true, canApproveExAsia: false, canPrepare: true }
    },
    {
      id: 'celestra', name: 'Celestra Gallagher', displayRole: 'Investor Relations Associate / IR Operations',
      username: 'celestra.gallagher@shorevest.example', role: TOOLS_ROLE, region: 'Operations', defaultSender: 'John Jones',
      nav: canonicalNav({ myWork: 6, relationships: 5, outreach: 1, meetings: 3, diligence: 4, intel: 1, reporting: 3, approvals: 5 }), home: CELESTRA_HOME,
      permissions: { canApproveSender: false, canMaintainRecords: true, canCoordinateMergePoint: true }
    },
    {
      id: 'emily', name: 'Emily Oestericher', displayRole: 'Operations / Process Design',
      username: 'emily.oestericher@shorevest.example', role: TOOLS_ROLE, region: 'Operations', defaultSender: 'John Jones',
      nav: canonicalNav({ myWork: 5, relationships: 2, outreach: 0, meetings: 1, diligence: 2, intel: 1, reporting: 4, approvals: 2 }), home: EMILY_HOME,
      permissions: { canApproveSender: false, canMaintainRecords: true, canConfigureProcess: true }
    },
    {
      id: 'nico', name: 'Nico Jacques', displayRole: 'Outreach Owner / Outreach Operator',
      username: 'nico.jacques@shorevest.example', role: TOOLS_ROLE, region: 'Operator', defaultSender: 'Nico Jacques',
      nav: canonicalNav({ myWork: 7, relationships: 4, outreach: 9, meetings: 1, diligence: 0, intel: 2, reporting: 2, approvals: 1 }), home: NICO_HOME,
      permissions: { canApproveSender: false, canPrepare: true, operatorSendPermitted: true }
    }
  ];

  var BY_ID = {};
  PERSONAS.forEach(function (p) { BY_ID[p.id] = p; });

  /* ── Previews behind future-facing navigation ───────────────────────────
     Restrained overviews, clearly marked as demonstration content. No claim of
     real integration or execution. */

  var PREVIEW = {
    outreach: {
      label: 'Outreach',
      title: 'Outreach',
      lede: 'Where you will review and approve outreach to institutions in your coverage, one decision at a time.',
      points: [
        'Suggested outreach, prepared and waiting for your approval.',
        'Prior contact and timing considered before anything is proposed.',
        'Nothing is sent without your explicit approval.'
      ]
    },
    relationships: {
      label: 'Relationships',
      title: 'Relationships',
      lede: 'A calm view of the institutions you own, and what has recently changed.',
      points: [
        'Your coverage, grouped the way you think about it.',
        'Quiet relationships surfaced only when there is a reason to act.',
        'No scores, rankings, or activity counts.'
      ]
    },
    meetings: {
      label: 'Meetings',
      title: 'Meetings',
      lede: 'Your meetings, with the single decision each one needs from you.',
      points: [
        'What is ready, what needs a decision, and what needs nothing.',
        'Preparation gathered for you rather than requested from you.',
        'Follow-ups tracked so they do not rest by accident.'
      ]
    },
    'weekly-review': {
      label: 'Weekly Review',
      title: 'Weekly Review',
      lede: 'A short, once-a-week look at your coverage and the decisions ahead.',
      points: [
        'A brief summary of the week across your relationships.',
        'Decisions expected of you in the coming week.',
        'Anything resting quietly that may deserve attention.'
      ]
    },
    'my-work': {
      label: 'My Work',
      title: 'My Work',
      lede: 'Everything assigned to you, in one calm place, with clear next steps.',
      points: [
        'Assigned coordination and delivery tasks in priority order.',
        'What is ready to action and what is still waiting on others.',
        'Clear indication when nothing needs you.'
      ]
    },
    materials: {
      label: 'Materials & Delivery',
      title: 'Materials & Delivery',
      lede: 'Approved materials and controlled delivery to the right recipients.',
      points: [
        'Approved masters and the recipient-specific versions derived from them.',
        'Delivery only to eligible, approved recipients.',
        'A record of what was sent, to whom, and when.'
      ]
    },
    diligence: {
      label: 'Diligence & Requests',
      title: 'Diligence & Requests',
      lede: 'Diligence questionnaires and requests, coordinated to completion.',
      points: [
        'Questionnaires with approvals tracked section by section.',
        'Data-room access prepared once approvals are confirmed.',
        'Assembly and final checks before anything is delivered.'
      ]
    },
    'meeting-support': {
      label: 'Meeting Support',
      title: 'Meeting Support',
      lede: 'The materials and preparation the meeting team needs, ready in time.',
      points: [
        'Recipient-specific materials prepared from approved masters.',
        'Preparation aligned to each meeting on the calendar.',
        'Clear ownership so nothing is missed before a meeting.'
      ]
    }
  };

  root.SVPortalPersonas = {
    TOOLS_ROLE: TOOLS_ROLE,
    list: PERSONAS,
    byId: function (id) { return BY_ID[id] || null; },
    preview: function (key) { return PREVIEW[key] || null; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.SVPortalPersonas;
  }

})(typeof self !== 'undefined' ? self : this);
