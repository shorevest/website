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
     Relationship Managers (John, Kelvin) share one navigation structure and
     interaction design. Celestra has a coordination-oriented structure. Every
     persona ends on Tools, which holds the preserved operational prototype.
     Future-facing items route to a single restrained preview shell. */

  var RM_NAV = [
    { key: 'home', label: 'Home', hash: '#/home' },
    { key: 'outreach', label: 'Outreach', hash: '#/preview/outreach' },
    { key: 'relationships', label: 'Relationships', hash: '#/preview/relationships' },
    { key: 'meetings', label: 'Meetings', hash: '#/preview/meetings' },
    { key: 'weekly-review', label: 'Weekly Review', hash: '#/preview/weekly-review' },
    { sep: 'Workspace' },
    { key: 'tools', label: 'Tools', hash: '#/tools' }
  ];

  var IR_NAV = [
    { key: 'home', label: 'Home', hash: '#/home' },
    { key: 'my-work', label: 'My Work', hash: '#/preview/my-work' },
    { key: 'materials', label: 'Materials & Delivery', hash: '#/preview/materials' },
    { key: 'diligence', label: 'Diligence & Requests', hash: '#/preview/diligence' },
    { key: 'meeting-support', label: 'Meeting Support', hash: '#/preview/meeting-support' },
    { sep: 'Workspace' },
    { key: 'tools', label: 'Tools', hash: '#/tools' }
  ];

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
        id: 'celestra-greenvale-ddq',
        title: 'GreenVale DDQ',
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
        id: 'celestra-meridian-dataroom',
        title: 'Meridian data-room access',
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
        id: 'celestra-summit-materials',
        title: 'Summit meeting materials',
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
      { time: '11:00', title: 'GreenVale DDQ package', note: 'Due today', tone: 'attention' },
      { time: '14:00', title: 'Meridian data-room', note: 'Access requested', tone: 'ready' },
      { time: '16:30', title: 'Summit meeting prep', note: 'Supporting John', tone: 'calm' }
    ],
    waiting: [
      { title: 'Finance confirmation', note: 'Due tomorrow · No action needed yet' },
      { title: 'Legal review', note: 'Expected Wednesday · No action needed yet' },
      { title: 'John commercial decision', note: 'Pending · No action needed yet' }
    ]
  };

  /* ── People ─────────────────────────────────────────────────────────────
     `role` carries the shared capability role so the legacy Tools prototype
     keeps working; `displayRole` is what the person actually sees. */

  var PERSONAS = [
    {
      id: 'john',
      name: 'John Jones',
      displayRole: 'Director of Client Solutions — Ex-Asia',
      username: 'john.jones@shorevest.example',
      role: TOOLS_ROLE,
      nav: RM_NAV,
      home: JOHN_HOME
    },
    {
      id: 'kelvin',
      name: 'Kelvin Chan',
      displayRole: 'Director of Client Solutions — Asia',
      username: 'kelvin.chan@shorevest.example',
      role: TOOLS_ROLE,
      nav: RM_NAV,
      home: KELVIN_HOME
    },
    {
      id: 'celestra',
      name: 'Celestra Gallagher',
      displayRole: 'Investor Relations Associate',
      username: 'celestra.gallagher@shorevest.example',
      role: TOOLS_ROLE,
      nav: IR_NAV,
      home: CELESTRA_HOME
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
