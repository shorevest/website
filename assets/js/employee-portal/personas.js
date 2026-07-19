/* ==========================================================================
   ShoreVest One — profile (persona) configuration ("the motherboard")

   The demonstration runs on ONE neutral profile ("ShoreVest Demo") with the
   full workspace: every section and every tool is exposed on the left. This is
   deliberate — the demo shows the whole product, and only once it is signed off
   are real people given the narrower set of sections and tools their role
   needs. That per-role split lives in this file, never in the UI.

   Home and My Work are driven by ONE shared queue (WORK_ITEMS). Home is a short,
   selective company-wide summary — where attention is needed — and every Home
   line points back to the same underlying item. My Work is the full
   cross-workspace execution queue, grouped by state. There is no duplicate data:
   completing an item changes both surfaces.

   IMPORTANT DATA RULE. Everything here is synthetic. Every person is a fictional
   animal codename (Red Fox, Snow Leopard, River Otter, …) and every institution
   is fictional (Cedar Ridge Pension, Blue River Endowment, …). No real ShoreVest
   employee name, investor name, contact name, email address, or confidential
   data appears anywhere. The legacy operational prototype is preserved under
   Tools.
   ========================================================================== */
(function (root) {
  'use strict';

  var R = root.SVPortalRules;

  /* Underlying capability role used only to keep the legacy Tools prototype
     fully accessible for every demonstration profile. This is not the person's
     display role — see `title`/`coverage`/`displayRole` on each persona. */
  var TOOLS_ROLE = R ? R.ROLES.ADMINISTRATOR : 'Administrator';

  /* ── Navigation ─────────────────────────────────────────────────────────
     One unified structure for the single demonstration profile. Every section
     and every tool is exposed on the left so the demo shows the whole product.
     When the demo is signed off, real people are given only the sections and
     tools their role needs — the per-role navigation lives here, not in the UI.
     Firm and Tools sit below the Workspaces group; Tools holds the preserved
     operational prototype and is collapsible. */

  var ALL_NAV = [
    { key: 'home', label: 'Home', hash: '#/home' },
    { key: 'my-work', label: 'My Work', hash: '#/my-work' },
    { sep: 'Workspaces' },
    { key: 'relationships', label: 'Relationships', hash: '#/workspace/relationships' },
    { key: 'outreach', label: 'Outreach', hash: '#/outreach' },
    { key: 'meetings', label: 'Meetings', hash: '#/workspace/meetings' },
    { key: 'diligence', label: 'Diligence & Requests', hash: '#/workspace/diligence' },
    { key: 'investor-intelligence', label: 'Investor Intelligence', hash: '#/workspace/investor-intelligence' },
    { key: 'materials', label: 'Materials & Delivery', hash: '#/preview/materials' },
    { key: 'meeting-support', label: 'Meeting Support', hash: '#/preview/meeting-support' },
    { divider: true },
    { key: 'firm', label: 'Firm', hash: '#/workspace/firm' },
    { key: 'tools', label: 'Tools', hash: '#/tools', collapsible: true }
  ];

  /* ── Shared work-item store ─────────────────────────────────────────────
     ONE canonical cross-workspace queue. Home and My Work both read from it, so
     there is never a second set of records. Each item carries a single action,
     a single fictional owner (animal codename), a reason, a current state, a
     next step, its originating workspace, and where "Open" leads.

     `bucket` places the item in My Work:
        do-now | waiting | suggestion | on-hold | done
     `home` (optional) surfaces a short summary line in one Home section:
        decide | do | waiting | warnings | recent
     Home stays selective — most queue items never appear on Home. `detail` (for
     decisions) powers an explanatory drawer without bloating either surface. */

  var WORK_ITEMS = [
    /* ── Do now ─────────────────────────────────────────────────────────── */
    {
      id: 'contacts-review',
      bucket: 'do-now',
      action: 'Review 12 proposed contacts',
      workspace: 'Outreach',
      owner: 'Red Fox',
      reason: 'A ranking source proposed 12 new contacts for the Cedar Ridge Pension outreach list.',
      status: 'Awaiting your decision',
      nextStep: 'Open the contact-review workflow and accept or hold each contact.',
      due: 'Today',
      link: '#/outreach/review',
      home: { section: 'decide', summary: '12 proposed contacts need a decision.' }
    },
    {
      id: 'redpanda-meeting',
      bucket: 'do-now',
      action: 'Confirm Red Panda Capital meeting attendance',
      workspace: 'Meetings',
      owner: 'Golden Eagle',
      reason: 'Red Panda Capital confirmed the 10:30 ET meeting, but the required second ShoreVest attendee is not available until 10:45 ET.',
      status: 'Decision needed before 10:30 ET',
      nextStep: 'Move the start to 10:45 ET, or begin at 10:30 ET with one attendee.',
      due: 'Before 10:30 ET',
      link: '#/workspace/meetings',
      home: { section: 'decide', summary: 'Red Panda Capital meeting attendance needs a decision.' },
      detail: {
        context: [
          'Red Panda Capital confirmed the 10:30 ET meeting this morning.',
          'The required second ShoreVest attendee is not available until 10:45 ET.'
        ],
        recommendation: 'Move the start to 10:45 ET rather than begin a substantive discussion with one attendee.',
        reasoning: 'The agenda is substantive throughout, so the two-attendee requirement applies from the start. A fifteen-minute shift keeps both required attendees present.',
        policy: 'Substantive LP meetings require at least two ShoreVest attendees. Missing required attendance means the meeting is not ready; exceptions require explicit approval and a record.',
        evidence: [
          { label: 'Investor confirmation', detail: 'Red Panda Capital confirmed 10:30 ET', state: 'system-verified' },
          { label: 'Relationship ownership', detail: 'Golden Eagle owns Red Panda Capital', state: 'system-verified' },
          { label: 'Second-attendee availability', detail: 'Available from 10:45 ET', state: 'system-verified' },
          { label: 'Revised start time', detail: 'Not yet proposed to Red Panda Capital', state: 'unavailable' }
        ]
      }
    },
    {
      id: 'koala-mainland',
      bucket: 'do-now',
      action: 'Confirm the mainland attendee for Koala Investment Board',
      workspace: 'Meetings',
      owner: 'Snow Leopard',
      reason: 'A substantive meeting with the Shanghai office of an international LP requires an eligible mainland-team attendee before times are proposed.',
      status: 'Attendance unresolved',
      nextStep: 'Confirm an eligible mainland-team attendee before proposing times.',
      due: 'Before proposing times',
      link: '#/workspace/meetings',
      detail: {
        context: [
          'A substantive meeting is being arranged with the Shanghai office of Koala Investment Board.',
          'Current internal attendance does not include an eligible mainland-team participant.'
        ],
        recommendation: 'Confirm an eligible mainland-team attendee before proposing or confirming the meeting.',
        reasoning: 'The counterparty is the PRC office of an international LP, so the mainland-attendance rule applies. Confirming attendance first avoids proposing a time the meeting cannot satisfy.',
        policy: 'An interaction with the PRC office of an international LP, or any office of a PRC-headquartered LP, requires an eligible mainland-team attendee. Substantive LP meetings also require at least two ShoreVest attendees.',
        evidence: [
          { label: 'Relationship ownership', detail: 'Snow Leopard owns Koala Investment Board', state: 'system-verified' },
          { label: 'Counterparty office', detail: 'Shanghai (PRC) office of an international LP', state: 'system-verified' },
          { label: 'Mainland-team attendee', detail: 'Eligible mainland-team attendee required', state: 'unavailable' },
          { label: 'Proposed times', detail: 'Not yet proposed to Koala Investment Board', state: 'unavailable' }
        ]
      }
    },
    {
      id: 'blueriver-access',
      bucket: 'do-now',
      action: 'Prepare the Blue River Endowment access package',
      workspace: 'Diligence & Requests',
      owner: 'River Otter',
      reason: 'Relationship-owner approval and recipient eligibility are confirmed for Blue River Endowment data-room access.',
      status: 'Ready to prepare',
      nextStep: 'Prepare the named-recipient access package.',
      due: 'Today',
      link: '#/workspace/diligence'
    },
    {
      id: 'approval-cedar',
      bucket: 'do-now',
      action: 'Submit the Cedar Ridge approval package',
      workspace: 'Approvals',
      owner: 'River Otter',
      reason: 'All substantive approvals are complete; the package is assembled and ready to submit.',
      status: 'Ready to submit',
      nextStep: 'Review the assembled package and submit it.',
      due: 'Today',
      link: '#/my-work',
      home: { section: 'do', summary: 'One approval package is ready.' }
    },
    {
      id: 'dq-atp',
      bucket: 'do-now',
      action: 'Correct the ATP account match',
      workspace: 'Diligence & Requests',
      owner: 'Snow Leopard',
      reason: 'Three data-quality issues are blocking the Cedar Ridge outreach list; an automated match linked a contact to the wrong parent account.',
      status: 'Blocking outreach',
      nextStep: 'Reassign the contact to the correct account and re-run validation.',
      due: 'Today',
      link: '#/dataquality',
      home: { section: 'warnings', summary: 'Three data-quality issues are blocking outreach.' }
    },

    /* ── Waiting ────────────────────────────────────────────────────────── */
    {
      id: 'ownership-granite',
      bucket: 'waiting',
      action: 'Confirm ownership of Granite Peak Capital',
      workspace: 'Relationships',
      owner: 'Red Fox',
      waitingOn: 'Grey Wolf',
      reason: 'Grey Wolf has not confirmed ownership of the Granite Peak Capital relationship.',
      status: 'Waiting on Grey Wolf',
      nextStep: 'Follow up Friday if ownership is still unconfirmed.',
      link: '#/workspace/relationships',
      home: { section: 'waiting', summary: 'Grey Wolf has not confirmed Granite Peak ownership.' }
    },
    {
      id: 'recovery-otter',
      bucket: 'waiting',
      action: 'Otter Pension Trust recovery material',
      workspace: 'Recovery & Enforcement',
      owner: 'Golden Eagle',
      waitingOn: 'Investment team',
      reason: 'The Investment team is preparing recovery material for Otter Pension Trust.',
      status: 'Waiting on Investment team',
      nextStep: 'Expected tomorrow; follow up Friday if not received.',
      link: '#/my-work'
    },
    {
      id: 'legal-silverpine',
      bucket: 'waiting',
      action: 'Silver Pine Insurance pack legal review',
      workspace: 'Compliance',
      owner: 'Snow Leopard',
      waitingOn: 'Legal team',
      reason: 'Legal is reviewing the Silver Pine Insurance meeting pack.',
      status: 'Waiting on Legal team',
      nextStep: 'Expected Wednesday; no action needed yet.',
      link: '#/my-work'
    },

    /* ── Suggestions (not yet accepted work) ────────────────────────────── */
    {
      id: 'sugg-deletions',
      bucket: 'suggestion',
      action: 'Review 7 suggested task deletions',
      workspace: 'Workflow Rules',
      owner: 'Peregrine Falcon',
      reason: 'A ranking source suggested removing 7 tasks it believes are stale. These are suggestions, not accepted work.',
      status: 'Suggested — not yet accepted',
      nextStep: 'Accept or dismiss each suggested deletion.',
      link: '#/my-work'
    },
    {
      id: 'sugg-northharbour',
      bucket: 'suggestion',
      action: 'Consider 4 proposed contacts for North Harbour Foundation',
      workspace: 'Outreach',
      owner: 'Red Fox',
      reason: 'A ranking source proposed 4 additional contacts for North Harbour Foundation.',
      status: 'Suggested — not yet accepted',
      nextStep: 'Accept into the outreach list or dismiss.',
      link: '#/outreach'
    },

    /* ── On hold ────────────────────────────────────────────────────────── */
    {
      id: 'ranking-stale',
      bucket: 'on-hold',
      action: 'Granite Peak ranking relies on stale information',
      workspace: 'Investor Intelligence',
      owner: 'Peregrine Falcon',
      reason: 'The ranking for Granite Peak Capital is based on data last refreshed six weeks ago.',
      status: 'On hold — awaiting data refresh',
      nextStep: 'Request a refresh before relying on the ranking.',
      link: '#/workspace/investor-intelligence',
      home: { section: 'warnings', summary: 'A relationship ranking relies on stale information.' }
    },
    {
      id: 'walrus-hold',
      bucket: 'on-hold',
      action: 'Walrus Holdings re-engagement',
      workspace: 'Relationships',
      owner: 'Grey Wolf',
      reason: 'Dormant relationship deliberately deferred to next quarter.',
      status: 'On hold — deferred',
      nextStep: 'Revisit next quarter.',
      link: '#/workspace/relationships'
    },

    /* ── Done (recent work) ─────────────────────────────────────────────── */
    {
      id: 'done-narwhal',
      bucket: 'done',
      action: 'Narwhal Pension Fund follow-up note approved',
      workspace: 'Relationships',
      owner: 'Golden Eagle',
      reason: 'The single follow-up note was approved and the relationship can rest.',
      status: 'Done',
      nextStep: 'No further action.',
      link: '#/my-work',
      home: { section: 'recent', summary: 'Narwhal Pension Fund follow-up approved.' }
    },
    {
      id: 'done-otter-material',
      bucket: 'done',
      action: 'Otter Pension Trust recipient material prepared',
      workspace: 'Materials & Delivery',
      owner: 'River Otter',
      reason: 'The recipient-specific version was prepared from the approved master.',
      status: 'Done',
      nextStep: 'No further action.',
      link: '#/my-work',
      home: { section: 'recent', summary: 'Otter Pension Trust material prepared.' }
    }
  ];

  /* Home "Start here" — the recommended first thing to open, plus the two
     workflows worth continuing. These are curated shortcuts, not queue items. */
  var START_HERE = [
    { label: 'Open the Blue River Endowment access package', sub: 'Recommended first — ready to prepare', hash: '#/workspace/diligence' },
    { label: 'Continue the Outreach workflow', sub: 'Find people → review → prepare messages', hash: '#/outreach' },
    { label: 'Open the complete Tool catalogue', sub: 'Every ShoreVest One tool, grouped by workspace', hash: '#/tools' }
  ];

  /* Ordered Home sections (short, selective). Start here and Recent work sit
     around the attention sections in between. */
  var HOME_SECTIONS = [
    { key: 'decide', title: 'Decide', sub: 'Decisions waiting on you.' },
    { key: 'do', title: 'Do', sub: 'Ready to action now.' },
    { key: 'waiting', title: 'Waiting', sub: 'Sitting with someone else.' },
    { key: 'warnings', title: 'Warnings', sub: 'Exceptions and stale information.' }
  ];

  /* Ordered My Work buckets (the full execution queue). */
  var MYWORK_BUCKETS = [
    { key: 'do-now', title: 'Do now', sub: 'Yours to action now.' },
    { key: 'waiting', title: 'Waiting', sub: 'With someone else. Shown so nothing rests by accident.' },
    { key: 'suggestion', title: 'Suggestions', sub: 'Proposed, not yet accepted. Accept before it becomes a task.' },
    { key: 'on-hold', title: 'On hold', sub: 'Deliberately paused. Nothing is due.' },
    { key: 'done', title: 'Done', sub: 'Recently completed.' }
  ];

  var SITUATIONAL = 'A selective, company-wide view of where attention is needed across ShoreVest One.';

  /* ── People ─────────────────────────────────────────────────────────────
     One neutral demonstration profile with full access. It is not a real
     person: it exists only to show the whole workspace during the demo. When
     the demo is signed off, real named people and per-role navigation replace
     this single profile. `role` carries the shared capability role so every
     tool in the legacy prototype is reachable. */

  var PERSONAS = [
    {
      id: 'demo',
      name: 'ShoreVest Demo',
      firstName: 'team',
      title: 'Demonstration profile',
      coverage: 'Full access',
      displayRole: 'Full demonstration access',
      photo: null,
      initials: 'SV',
      username: 'demo@shorevest.example',
      role: TOOLS_ROLE,
      nav: ALL_NAV,
      homeSchema: 'motherboard'
    }
  ];

  var BY_ID = {};
  PERSONAS.forEach(function (p) { BY_ID[p.id] = p; });

  /* ── Workspace and preview overviews ────────────────────────────────────
     Restrained destinations, clearly marked as demonstration content. No claim
     of real integration or execution, no metrics, no fake live data. */

  var WORKSPACES = {
    relationships: {
      label: 'Relationships',
      title: 'Relationships',
      lede: 'Institutions, people, relationship strategy, commitments and next moves.'
    },
    meetings: {
      label: 'Meetings',
      title: 'Meetings',
      lede: 'Preparation, readiness, materials, attendance and follow-up.'
    },
    diligence: {
      label: 'Diligence & Requests',
      title: 'Diligence & Requests',
      lede: 'DDQs, document requests, data-room requests and delivery control.'
    },
    'investor-intelligence': {
      label: 'Investor Intelligence',
      title: 'Investor Intelligence',
      lede: 'Source-linked investor feedback, recurring themes and management implications.'
    },
    firm: {
      label: 'Firm',
      title: 'Firm',
      lede: 'People, availability, offices, events, resources and internal information.'
    },
    outreach: {
      label: 'Outreach',
      title: 'Outreach',
      lede: 'Find people, review lists, prepare messages and assemble approval packages.'
    }
  };

  /* Preview shells retained for Celestra's coordination navigation. */
  var PREVIEW = {
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
    workspace: function (key) { return WORKSPACES[key] || null; },
    preview: function (key) { return PREVIEW[key] || null; },

    /* Shared work-item store — the single source Home and My Work both read. */
    workItems: WORK_ITEMS,
    startHere: START_HERE,
    homeSections: HOME_SECTIONS,
    myWorkBuckets: MYWORK_BUCKETS,
    situational: SITUATIONAL,
    /* Items surfaced in a given Home section, in queue order. */
    homeItems: function (section) {
      return WORK_ITEMS.filter(function (it) { return it.home && it.home.section === section; });
    },
    /* Items in a given My Work bucket, in queue order. */
    bucketItems: function (bucket) {
      return WORK_ITEMS.filter(function (it) { return it.bucket === bucket; });
    },
    itemById: function (id) {
      for (var i = 0; i < WORK_ITEMS.length; i++) { if (WORK_ITEMS[i].id === id) return WORK_ITEMS[i]; }
      return null;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.SVPortalPersonas;
  }

})(typeof self !== 'undefined' ? self : this);
