/* ==========================================================================
   ShoreVest One — role (persona) configuration
   A single small configuration layer describing the three demonstration
   people: their exact identity, permanent navigation, Home schema, My Work,
   and the restrained previews behind workspace navigation.

   Everything here is synthetic. External institutions and contacts are entirely
   fictional and use professional animal-based names. Only internal ShoreVest
   names are real, used solely to identify the selected demonstration profile or
   to name a real internal colleague in a limited assignment context. No real
   emails, LP names, contact data, or confidential information appears.

   ShoreVest One absorbs complexity rather than displaying it. For John and
   Kelvin, Home answers "What should I pay attention to right now?" with exactly
   one Focus Now item, a short Today list, one Under Control reassurance line,
   and an optional quiet Around ShoreVest note. My Work answers "What currently
   depends on me?". Celestra keeps her existing coordination Home. The legacy
   operational prototype is preserved under Tools for every profile.
   ========================================================================== */
(function (root) {
  'use strict';

  var R = root.SVPortalRules;

  /* Underlying capability role used only to keep the legacy Tools prototype
     fully accessible for every demonstration profile. This is not the person's
     display role — see `title`/`coverage`/`displayRole` on each persona. */
  var TOOLS_ROLE = R ? R.ROLES.ADMINISTRATOR : 'Administrator';

  /* ── Navigation ─────────────────────────────────────────────────────────
     John and Kelvin share one frozen structure. Firm and Tools sit below the
     Workspaces group; Tools holds the preserved operational prototype and is
     collapsible. Celestra keeps a coordination-oriented structure. */

  var RM_NAV = [
    { key: 'home', label: 'Home', hash: '#/home' },
    { key: 'my-work', label: 'My Work', hash: '#/my-work' },
    { sep: 'Workspaces' },
    { key: 'relationships', label: 'Relationships', hash: '#/workspace/relationships' },
    { key: 'outreach', label: 'Outreach', hash: '#/workspace/outreach' },
    { key: 'meetings', label: 'Meetings', hash: '#/workspace/meetings' },
    { key: 'diligence', label: 'Diligence & Requests', hash: '#/workspace/diligence' },
    { key: 'investor-intelligence', label: 'Investor Intelligence', hash: '#/workspace/investor-intelligence' },
    { divider: true },
    { key: 'firm', label: 'Firm', hash: '#/workspace/firm' },
    { key: 'tools', label: 'Tools', hash: '#/tools', collapsible: true }
  ];

  var IR_NAV = [
    { key: 'home', label: 'Home', hash: '#/home' },
    { key: 'my-work', label: 'My Work', hash: '#/preview/my-work' },
    { sep: 'Workspaces' },
    { key: 'materials', label: 'Materials & Delivery', hash: '#/preview/materials' },
    { key: 'diligence', label: 'Diligence & Requests', hash: '#/preview/diligence' },
    { key: 'meeting-support', label: 'Meeting Support', hash: '#/preview/meeting-support' },
    { divider: true },
    { key: 'tools', label: 'Tools', hash: '#/tools', collapsible: true }
  ];

  /* ── Commercial Home schema (John & Kelvin) ─────────────────────────────
     One expanded Focus Now item that meets the ten-second standard; a short
     Today list that never repeats Focus Now; one Under Control reassurance
     line; an optional quiet Around ShoreVest note. Meeting-attendance policy is
     explained inside the affected decision only, never as a standing warning. */

  var JOHN_HOME = {
    situational: 'One decision needs you before your next meeting.',
    focus: {
      id: 'john-red-panda-meeting',
      institution: 'Red Panda Capital',
      title: 'Red Panda Capital meeting — second attendee no longer available',
      context: [
        'Red Panda Capital confirmed the 10:30 ET meeting this morning.',
        'The required second ShoreVest attendee is no longer available until 10:45 ET.'
      ],
      decision: 'Move the meeting start to 10:45 ET, or begin at 10:30 ET with one ShoreVest attendee.',
      whyYou: 'You own the Red Panda Capital relationship. This is a substantive LP meeting, and ShoreVest policy requires at least two ShoreVest attendees for substantive LP discussions.',
      due: 'Decide before 10:30 ET',
      dueZone: 'ET',
      recLabel: 'ShoreVest One recommends',
      recommendation: 'Move the meeting start to 10:45 ET rather than begin the substantive discussion with one ShoreVest attendee.',
      reasoning: 'The agenda is substantive throughout, so the two-attendee requirement applies from the start. A fifteen-minute shift keeps both required attendees present without splitting the agenda.',
      verifiedAt: '07:42 ET',
      evidenceLine: 'Relationship ownership and attendee availability checked at 07:42 ET. Red Panda Capital has confirmed; a revised start time has not yet been proposed or confirmed with them.',
      evidence: [
        { label: 'Investor confirmation', detail: 'Red Panda Capital confirmed 10:30 ET', state: 'system-verified' },
        { label: 'Relationship ownership', detail: 'John Jones owns Red Panda Capital', state: 'system-verified' },
        { label: 'Second-attendee availability', detail: 'Available from 10:45 ET', state: 'system-verified' },
        { label: 'Meeting purpose', detail: 'Substantive LP discussion (two attendees required)', state: 'human-confirmed' },
        { label: 'Revised start time', detail: 'Not yet proposed to Red Panda Capital', state: 'unavailable' }
      ],
      policy: 'Substantive LP meetings require at least two ShoreVest attendees. A genuinely casual coffee may be solo. Missing required attendance means the meeting is not ready; exceptions require explicit approval and a record.',
      primary: 'Review revised meeting plan',
      afterConfirm: 'Confirming would prepare a revised 10:45 ET plan for you to send. Nothing is proposed to Red Panda Capital until you confirm the exact package.',
      owner: 'After you confirm, the revised time is yours to send to Red Panda Capital; the second attendee is notified only once you confirm.'
    },
    today: [
      { time: '13:00', title: 'Narwhal Pension Fund', note: 'Investor confirmed', state: 'confirmed', zone: 'ET' },
      { time: '15:30', title: 'Otter Pension Trust', note: 'Ready for meeting', state: 'ready', zone: 'ET' },
      { time: '17:00', title: 'Internal Investment update', note: 'No preparation required', state: 'calm', zone: 'ET' }
    ],
    underControl: 'Other items are progressing with Finance, Legal and Investment. Nothing is overdue.',
    around: [
      { title: 'Firm dinner in Hong Kong on Thursday', note: 'Details in Firm', link: '#/workspace/firm' }
    ]
  };

  var KELVIN_HOME = {
    situational: 'One meeting needs the right attendance before you propose times.',
    focus: {
      id: 'kelvin-koala-mainland',
      institution: 'Koala Investment Board (Shanghai office)',
      title: 'Koala Investment Board (Shanghai) — mainland attendee required',
      context: [
        'A substantive meeting is being arranged with the Shanghai office of Koala Investment Board, an international LP.',
        'Current internal attendance does not include an eligible mainland-team participant.'
      ],
      decision: 'Add an eligible mainland-team attendee before the meeting is proposed or confirmed.',
      whyYou: 'You own the Koala Investment Board relationship in Asia-Pacific. A substantive interaction with the PRC office of an international LP requires Ben or an eligible mainland-team attendee.',
      due: 'Resolve before proposing times',
      dueZone: 'HKT',
      recLabel: 'ShoreVest One recommends',
      recommendation: 'Add an eligible mainland-team attendee before proposing or confirming the meeting. No confirmed eligible named attendee is available for this slot yet.',
      reasoning: 'The counterparty is the PRC office of an international LP, so the mainland-attendance rule applies. Confirming attendance first avoids proposing a time the meeting cannot yet satisfy.',
      verifiedAt: '08:05 HKT',
      evidenceLine: 'Relationship ownership and counterparty office checked at 08:05 HKT. Eligible mainland-team availability for this slot is not yet confirmed.',
      evidence: [
        { label: 'Relationship ownership', detail: 'Kelvin Chan owns Koala Investment Board (Asia-Pacific)', state: 'system-verified' },
        { label: 'Counterparty office', detail: 'Shanghai (PRC) office of an international LP', state: 'system-verified' },
        { label: 'Meeting purpose', detail: 'Substantive discussion', state: 'human-confirmed' },
        { label: 'Mainland-team attendee', detail: 'Eligible mainland-team attendee required', state: 'unavailable' },
        { label: 'Proposed times', detail: 'Not yet proposed to Koala Investment Board', state: 'unavailable' }
      ],
      policy: 'An interaction with the PRC office of an international LP, or any office of a PRC-headquartered LP, requires Ben or an eligible mainland-team attendee. Substantive LP meetings also require at least two ShoreVest attendees. Missing required attendance means the meeting is not ready; exceptions require explicit approval and a record.',
      primary: 'Review attendance and meeting plan',
      requiredAttendee: 'Eligible mainland-team attendee required',
      afterConfirm: 'Confirming would prepare a meeting plan that includes the required mainland-team attendee for you to review. No times are proposed to Koala Investment Board until you confirm the exact package.',
      owner: 'After you confirm attendance, proposing times to Koala Investment Board remains yours; the mainland-team attendee is contacted internally only once you confirm.'
    },
    today: [
      { time: '11:00', title: 'Puffin Asset Management', note: 'Ready for meeting', state: 'ready', zone: 'HKT' },
      { time: '14:00', title: 'Alpaca Foundation', note: 'Needs preparation', state: 'prep', zone: 'HKT' },
      { time: '16:30', title: 'Internal Investment update', note: 'No preparation required', state: 'calm', zone: 'HKT' }
    ],
    underControl: 'Other items are progressing with Finance, Legal and Investment. Nothing is overdue.',
    around: [
      { title: 'Yao Fu marks five years at ShoreVest this week', note: 'Details in Firm', link: '#/workspace/firm' }
    ]
  };

  /* ── My Work (John & Kelvin) ────────────────────────────────────────────
     A lightweight demonstration shell: what needs me, what is waiting on others
     (with who, when, follow-up and accountability), and what is deliberately
     later. No inbox, activity feed, or metric dashboard. */

  var JOHN_MYWORK = {
    needsMe: [
      { title: 'Red Panda Capital meeting time', note: 'Confirm the revised 10:45 ET plan.', due: 'Before 10:30 ET today' },
      { title: 'Narwhal Pension Fund follow-up note', note: 'Approve the single follow-up before the relationship rests.', due: 'This week' }
    ],
    waiting: [
      { title: 'Otter Pension Trust recovery material', who: 'Investment team', when: 'Expected tomorrow', followUp: 'Follow up Friday if not received', accountable: 'You remain accountable to Otter Pension Trust.' },
      { title: 'Quokka Capital introduction', who: 'Ben (Benjamin Fanger)', when: 'Expected this week', followUp: 'No action needed yet', accountable: 'Ben owns the next step.' }
    ],
    later: [
      { title: 'Walrus Holdings re-engagement', note: 'Dormant relationship; revisit next quarter.' }
    ]
  };

  var KELVIN_MYWORK = {
    needsMe: [
      { title: 'Koala Investment Board attendance', note: 'Confirm an eligible mainland-team attendee before proposing times.', due: 'Before proposing times' },
      { title: 'Puffin Asset Management pack', note: 'Approve the final meeting pack.', due: 'Today' }
    ],
    waiting: [
      { title: 'Alpaca Foundation term summary', who: 'Investment team', when: 'Expected tomorrow', followUp: 'Follow up Thursday if not received', accountable: 'You remain accountable to Alpaca Foundation.' },
      { title: 'Puffin Asset Management legal review', who: 'Legal team', when: 'Expected Wednesday', followUp: 'No action needed yet', accountable: 'Legal owns the next step.' }
    ],
    later: [
      { title: 'Koala Investment Board (HK office) reconnection', note: 'Separate relationship; revisit after the Shanghai meeting.' }
    ]
  };

  /* ── Coordination Home (Celestra — preserved from the prior phase) ───────
     Celestra keeps her existing demonstration Home and functionality. She is
     not forced into the John/Kelvin commercial structure. */

  var CELESTRA_HOME = {
    needsYou: [
      {
        id: 'celestra-quokka-ddq',
        title: 'Quokka Capital DDQ',
        context: ['All substantive approvals are complete.', 'The final package needs assembly.'],
        recLabel: 'Current state',
        recommendation: 'Ready to assemble.',
        actions: [
          { label: 'Prepare package', intent: 'primary', done: 'Package prepared' },
          { label: 'Need review', intent: 'secondary', done: 'Sent for review' }
        ],
        detail: 'Each section has an approval recorded against it. Assembly gathers the approved answers into a single document for a final check before delivery.'
      },
      {
        id: 'celestra-narwhal-dataroom',
        title: 'Narwhal Pension Fund data-room access',
        context: ['Relationship-owner approval and recipient eligibility are confirmed.'],
        recLabel: 'Current state',
        recommendation: 'Ready to prepare access.',
        actions: [
          { label: 'Prepare access', intent: 'primary', done: 'Access prepared' },
          { label: 'Need review', intent: 'secondary', done: 'Sent for review' }
        ],
        detail: 'The relationship owner has approved access and the recipient has passed the eligibility check. Preparing access sets up the named recipient without granting anything beyond the approved scope.'
      },
      {
        id: 'celestra-otter-materials',
        title: 'Otter Pension Trust meeting materials',
        context: ['An approved master exists.', 'A recipient-specific derivative has not been prepared.'],
        recLabel: 'Current state',
        recommendation: 'Ready to prepare the recipient version.',
        actions: [
          { label: 'Prepare material', intent: 'primary', done: 'Material prepared' },
          { label: 'Need review', intent: 'secondary', done: 'Sent for review' }
        ],
        detail: 'The approved master is the source. The recipient version applies the agreed adjustments for this audience without changing any approved content.'
      }
    ],
    today: [
      { time: '11:00', title: 'Quokka Capital DDQ package', note: 'Due today', tone: 'attention' },
      { time: '14:00', title: 'Narwhal data-room', note: 'Access requested', tone: 'ready' },
      { time: '16:30', title: 'Otter Pension Trust prep', note: 'Supporting John', tone: 'calm' }
    ],
    waiting: [
      { title: 'Finance confirmation', note: 'Due tomorrow · No action needed yet' },
      { title: 'Legal review', note: 'Expected Wednesday · No action needed yet' },
      { title: 'John commercial decision', note: 'Pending · No action needed yet' }
    ]
  };

  /* ── People ─────────────────────────────────────────────────────────────
     `role` carries the shared capability role so the legacy Tools prototype
     keeps working. `title` + `coverage` are the exact approved identity;
     `displayRole` is a single-line convenience that preserves the parentheses.
     `photo` is an approved employee photograph where one exists in the repo;
     otherwise `initials` drives a restrained avatar (never a generated face). */

  var PERSONAS = [
    {
      id: 'john',
      name: 'John Jones',
      firstName: 'John',
      title: 'Director of Client Solutions',
      coverage: 'Americas, Europe & Middle East',
      displayRole: 'Director of Client Solutions (Americas, Europe & Middle East)',
      photo: '../assets/img/team/john-jones.jpg',
      initials: 'JJ',
      username: 'john.jones@shorevest.example',
      role: TOOLS_ROLE,
      nav: RM_NAV,
      homeSchema: 'commercial',
      home: JOHN_HOME,
      myWork: JOHN_MYWORK
    },
    {
      id: 'kelvin',
      name: 'Kelvin Chan',
      firstName: 'Kelvin',
      title: 'Director of Client Solutions',
      coverage: 'Asia-Pacific',
      displayRole: 'Director of Client Solutions (Asia-Pacific)',
      photo: '../assets/img/team/kelvin-chan.jpg',
      initials: 'KC',
      username: 'kelvin.chan@shorevest.example',
      role: TOOLS_ROLE,
      nav: RM_NAV,
      homeSchema: 'commercial',
      home: KELVIN_HOME,
      myWork: KELVIN_MYWORK
    },
    {
      id: 'celestra',
      name: 'Celestra Gallagher',
      firstName: 'Celestra',
      title: 'Investor Relations Associate',
      coverage: '',
      displayRole: 'Investor Relations Associate',
      photo: null,
      initials: 'CG',
      username: 'celestra.gallagher@shorevest.example',
      role: TOOLS_ROLE,
      nav: IR_NAV,
      homeSchema: 'coordination',
      home: CELESTRA_HOME
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
    outreach: {
      label: 'Outreach',
      title: 'Outreach',
      lede: 'Targeting, campaigns, sequencing, replies and re-engagement.'
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
    preview: function (key) { return PREVIEW[key] || null; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.SVPortalPersonas;
  }

})(typeof self !== 'undefined' ? self : this);
