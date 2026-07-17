/* ==========================================================================
   ShoreVest One — role (persona) configuration
   A single small configuration layer describing the three preview
   people: their identity, permanent navigation, Home information, and the
   restrained previews behind future-facing navigation.

   Everything here is mocked. External institutions, contacts, and account
   details are entirely fictional. Only the internal ShoreVest names are real,
   used solely to identify the selected preview role. No real emails,
   contact data, or confidential information appears.

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
     fully accessible for every preview persona. This is not the person's
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

  /* ── Commercial Home schema (John & Kelvin) ─────────────────────────────
     One expanded Focus Now item that meets the ten-second standard; a short
     Today list that never repeats Focus Now; one Under Control reassurance
     line; an optional quiet Around ShoreVest note. Meeting-attendance policy is
     explained inside the affected decision only, never as a standing warning. */

  function homeItem(id, title, explanation, status, next, cta, why, owner, source, rule, section, href, history) {
    return {
      id: id, title: title, explanation: explanation, status: status, next: next,
      cta: cta || 'Open item', href: href || '#/my-work', owner: owner,
      section: section, source: source, rule: rule,
      why: why || 'This item is assigned to you because your role owns the next judgement or action.',
      detail: why || 'This item is assigned to you because your role owns the next judgement or action.',
      ignored: 'The item remains open and may block outreach, reporting, approvals or record quality.',
      systems: source || 'ShoreVest One',
      history: history || ['Created from current work queue.', 'Assigned to ' + owner + '.', 'Waiting for next action.'],
      recommendation: next,
      actions: [{ label: cta || 'Open item', intent: 'primary', done: 'Opened' }]
    };
  }

  function makeHome(owner, decide, today, waiting, warning) {
    var home = { needsYou: decide, today: today, waiting: waiting };
    Object.defineProperty(home, 'warning', { value: warning || 'Suggested work is not official until a person accepts it.', enumerable: false });
    Object.defineProperty(home, 'recent', { value: [
      { title: 'My Work queue refreshed', note: 'Home items now match your My Work list.' },
      { title: 'Salesforce exceptions checked', note: 'No external writeback was run.' },
      { title: 'ShoreVest One status reviewed', note: 'Internal Preview remains on mock data.' }
    ], enumerable: false });
    return home;
  }

  var CELESTRA_HOME = makeHome('Celestra Gallagher', [
    homeItem('celestra-mergepoint-contact-review', 'MergePoint contact review', '12 proposed contacts need review before Salesforce writeback.', 'On hold', 'Confirm owner and account match.', 'Review records', 'Prevents a contact from being attached to the wrong owner or account.', 'Celestra Gallagher', 'MergePoint proposal + Salesforce account match', 'Proposed Salesforce writes require human review', 'Decide', '#/my-work', ['MergePoint proposed 12 contacts.', 'Salesforce match confidence was incomplete.', 'Held for Celestra review.']),
    homeItem('celestra-task-cleanup', 'Automated task cleanup', '7 suggested tasks may be duplicate or low-value.', 'Suggested', 'Decide which suggestions become official cleanup work.', 'Review suggestions', 'Suggested tasks are not official tasks until accepted by a person.', 'Celestra Gallagher', 'MergePoint task suggestions + Salesforce activity', 'Suggested task cleanup requires operations acceptance', 'Decide'),
    homeItem('celestra-approval-version', 'Approval version issue', 'One approval package has a version mismatch before release.', 'Needs review', 'Confirm the approved version before anyone uses it.', 'Review version', 'Keeps people from using a stale approval package.', 'Celestra Gallagher', 'Approvals + document version log', 'Released packages must match the approved version', 'Decide')
  ], [
    homeItem('celestra-dataroom-package', 'Assemble data-room access package', 'Meridian request is ready for controlled access assembly.', 'Ready', 'Build the access package from the approved version.', 'Open workflow', 'The request has cleared initial checks and needs operations assembly.', 'Celestra Gallagher', 'Diligence request + approvals', 'Access packages require recipient and version checks', 'Do', '#/diligence'),
    homeItem('celestra-held-records', 'Review held contact records', 'Held contact records need an owner decision before outreach.', 'Needs review', 'Clear records that have enough evidence.', 'Review records', 'Held records cannot be used in outreach until reviewed.', 'Celestra Gallagher', 'Salesforce contact exceptions', 'Held contact records require human review', 'Do'),
    homeItem('celestra-account-match', 'Update Salesforce account match', 'One account match is ready for confirmation.', 'Ready', 'Accept or correct the proposed account match.', 'Update match', 'The matched account controls ownership and reporting.', 'Celestra Gallagher', 'Salesforce account match', 'Account matches require operations confirmation', 'Do')
  ], [
    homeItem('celestra-wait-john', 'Ownership confirmation from John', 'John needs to confirm ownership for Ex-Asia records.', 'Waiting', 'No action until John responds.', 'Open item', 'This blocks contact writeback but is owned by John.', 'John Jones', 'Salesforce owner field', 'Owner confirmation is required before writeback', 'Waiting'),
    homeItem('celestra-wait-kelvin', 'Asia account match from Kelvin', 'Kelvin needs to confirm Asia account ownership.', 'Waiting', 'No action until Kelvin responds.', 'Open item', 'This blocks Asia records from moving forward.', 'Kelvin Chan', 'Salesforce account match', 'Regional owner must confirm ambiguous account matches', 'Waiting'),
    homeItem('celestra-wait-ben', 'Approval version from Ben', 'Ben needs to confirm the approval package version.', 'Waiting', 'No action until Ben responds.', 'Open item', 'This blocks release of the package.', 'Ben Fanger', 'Approvals', 'Approval owner must freeze the version', 'Waiting')
  ], '7 suggested tasks are not official tasks yet. MergePoint ranking relies on stale manual input.');

  var JOHN_HOME = makeHome('John Jones', [
    homeItem('john-ex-asia-priority', 'Ex-Asia priority mismatch', 'System signal is high but owner priority is low for one LP.', 'Needs review', 'Confirm whether the owner priority is still right.', 'Review priority', 'Keeps stale priority fields from driving the wrong follow-up.', 'John Jones', 'Salesforce priority + activity signals', 'Owner judgement controls priority changes', 'Decide'),
    homeItem('john-placement-agent', 'Placement agent diligence', 'Placement-agent diligence needs a commercial judgement.', 'On hold', 'Decide whether the retainer question should move to Ben.', 'Review diligence', 'Prevents an outside-party question from moving without senior context.', 'John Jones', 'Diligence notes + relationship plan', 'Placement-agent topics require owner judgement', 'Decide'),
    homeItem('john-stage4-no-plan', 'Stage 4 LP with no action plan', 'One advanced LP has no current next-action plan.', 'Blocked', 'Set a plan or lower the relationship stage.', 'Set action plan', 'Advanced relationships should not sit without a next step.', 'John Jones', 'Salesforce stage + My Work', 'Stage 4 relationships require an action plan', 'Decide')
  ], [
    homeItem('john-positive-responses', 'Review positive responses', 'Recent positive replies are ready for owner review.', 'Ready', 'Choose the next follow-up for each response.', 'Open workflow', 'A reply creates a relationship next step owned by you.', 'John Jones', 'Outlook response summary', 'Positive responses require owner follow-up', 'Do', '#/outreach/sent'),
    homeItem('john-priority-tomorrow', 'Update priority for tomorrow’s LP review', 'Tomorrow’s LP review needs current priority fields.', 'Ready', 'Update priority before the review meeting.', 'Update priority', 'Priority fields drive the review agenda.', 'John Jones', 'Salesforce priority field', 'Review agendas use current owner priority', 'Do'),
    homeItem('john-brief-examples', 'Send meeting brief examples to Emily', 'Emily needs examples to standardise the meeting brief.', 'Ready', 'Send two useful examples.', 'Open item', 'Good examples help make the template practical.', 'John Jones', 'Meeting notes + template request', 'Template design needs owner examples', 'Do')
  ], [
    homeItem('john-wait-ben', 'Ben decision on placement-agent retainer', 'Ben needs to decide the placement-agent retainer question.', 'Waiting', 'No action until Ben responds.', 'Open item', 'The diligence route depends on Ben’s decision.', 'Ben Fanger', 'Approvals', 'Senior decision required for retainer strategy', 'Waiting'),
    homeItem('john-wait-nico', 'Nico research on missing contacts', 'Nico is researching missing current contacts.', 'Waiting', 'No action until Nico completes research.', 'Open item', 'Outreach should not use outdated contacts.', 'Nico Jacques', 'Research queue', 'Missing-contact research precedes outreach', 'Waiting'),
    homeItem('john-wait-celestra', 'Celestra cleanup of old task records', 'Celestra is cleaning up old task records.', 'Waiting', 'No action until cleanup is complete.', 'Open item', 'Old tasks can obscure the current plan.', 'Celestra Gallagher', 'Salesforce tasks', 'Task cleanup must happen before final review', 'Waiting')
  ], 'One Stage 4 relationship has no action plan.');

  var KELVIN_HOME = makeHome('Kelvin Chan', [
    homeItem('kelvin-asia-priority-stale', 'Asia priority field stale', 'Asia priority has not been refreshed after recent activity.', 'Needs review', 'Confirm current priority for top Asia accounts.', 'Review priority', 'Stale priority can hide active Asia relationships.', 'Kelvin Chan', 'Salesforce priority + meeting activity', 'Regional owner controls priority changes', 'Decide'),
    homeItem('kelvin-mergepoint-ranking', 'MergePoint ranking mismatch', 'MergePoint ranking conflicts with your account view.', 'On hold', 'Accept the ranking or keep owner judgement.', 'Review ranking', 'Automated ranking should not override relationship judgement.', 'Kelvin Chan', 'MergePoint ranking + Salesforce owner priority', 'Ranking mismatches require owner review', 'Decide'),
    homeItem('kelvin-insurer-route', 'Asia insurer contact route', 'An insurer contact has two possible relationship routes.', 'Needs review', 'Choose the right owner route.', 'Choose route', 'Wrong routing creates confusing outreach ownership.', 'Kelvin Chan', 'Salesforce account hierarchy', 'Ambiguous account routes require owner decision', 'Decide')
  ], [
    homeItem('kelvin-top-asia', 'Update top Asia accounts', 'Top Asia accounts need current priority and next steps.', 'Ready', 'Update account priorities and next actions.', 'Open workflow', 'Current fields keep the Asia review accurate.', 'Kelvin Chan', 'Salesforce account list', 'Owner priorities feed the review queue', 'Do'),
    homeItem('kelvin-brief-format', 'Review briefing-note format', 'Emily’s note format needs Asia owner feedback.', 'Ready', 'Review the format and add comments.', 'Review format', 'The standard brief must work for Asia meetings.', 'Kelvin Chan', 'Template draft', 'Regional owners review briefing standards', 'Do'),
    homeItem('kelvin-held-records', 'Confirm Asia held records', 'Asia held records are ready for owner confirmation.', 'Needs review', 'Confirm records that can move forward.', 'Confirm records', 'Held records cannot be used until confirmed.', 'Kelvin Chan', 'Salesforce contact exceptions', 'Regional owner confirms held Asia records', 'Do')
  ], [
    homeItem('kelvin-wait-emily', 'Emily template draft', 'Emily is drafting the briefing template.', 'Waiting', 'No action until the draft is ready.', 'Open item', 'Feedback depends on the draft.', 'Emily Oestericher', 'Template workstream', 'Template draft precedes regional review', 'Waiting'),
    homeItem('kelvin-wait-celestra', 'Celestra account cleanup', 'Celestra is cleaning account records.', 'Waiting', 'No action until cleanup is complete.', 'Open item', 'Clean records reduce duplicate review.', 'Celestra Gallagher', 'Salesforce account cleanup', 'Operations cleanup precedes owner confirmation', 'Waiting'),
    homeItem('kelvin-wait-francis', 'Francis / MergePoint algorithm variant', 'Francis and MergePoint are checking the ranking variant.', 'Waiting', 'No action until the variant is confirmed.', 'Open item', 'The ranking mismatch depends on the algorithm version.', 'Francis / MergePoint', 'MergePoint ranking logic', 'Algorithm variant must be identified before owner action', 'Waiting')
  ], 'Asia priority fields are stale on high-activity accounts.');

  var EMILY_HOME = makeHome('Emily Oestericher', [
    homeItem('emily-next-step-category', 'Next-step category design', 'Next-step categories need a simpler operating design.', 'Needs review', 'Pick the categories that owners will actually use.', 'Review design', 'Clear categories make My Work understandable.', 'Emily Oestericher', 'Process design notes', 'Category changes require process owner approval', 'Decide'),
    homeItem('emily-brief-standard', 'Briefing-note standard format', 'Two briefing-note formats are competing.', 'Suggested', 'Choose the standard format.', 'Choose format', 'One standard avoids inconsistent meeting preparation.', 'Emily Oestericher', 'Template library', 'Briefing-note standards require process approval', 'Decide'),
    homeItem('emily-reporting-logic', 'Reporting logic change', 'A reporting logic change may alter exception counts.', 'On hold', 'Confirm the logic before it appears in reporting.', 'Review logic', 'Reporting should not change without a clear rule.', 'Emily Oestericher', 'Reporting configuration', 'Reporting logic changes require review', 'Decide')
  ], [
    homeItem('emily-draft-template', 'Draft briefing template', 'A standard briefing template is ready to draft.', 'Ready', 'Draft the template for owner review.', 'Open workflow', 'Owners need a practical template to provide feedback.', 'Emily Oestericher', 'Template workstream', 'Process owner drafts standard templates', 'Do'),
    homeItem('emily-action-categories', 'Update action categories', 'Action categories need clearer labels.', 'Ready', 'Update labels and examples.', 'Update categories', 'Clear labels reduce confusion in My Work.', 'Emily Oestericher', 'Process configuration', 'Category updates require process owner edits', 'Do'),
    homeItem('emily-sf-structure', 'Review Salesforce structure issue', 'A Salesforce field ownership issue needs review.', 'Needs review', 'Confirm who owns the field.', 'Review structure', 'Field ownership prevents silent process changes.', 'Emily Oestericher', 'Salesforce fields', 'Field changes require owner clarity', 'Do')
  ], [
    homeItem('emily-wait-john-kelvin', 'John and Kelvin note examples', 'John and Kelvin need to send note examples.', 'Waiting', 'No action until examples arrive.', 'Open item', 'The template should be based on real owner usage.', 'John Jones / Kelvin Chan', 'Meeting notes', 'Owner examples precede template finalisation', 'Waiting'),
    homeItem('emily-wait-ben', 'Ben review of template', 'Ben needs to review the template.', 'Waiting', 'No action until Ben responds.', 'Open item', 'Senior review is needed before rollout.', 'Ben Fanger', 'Template approval', 'Template rollout requires senior review', 'Waiting'),
    homeItem('emily-wait-celestra', 'Celestra field cleanup feedback', 'Celestra needs to give field cleanup feedback.', 'Waiting', 'No action until feedback arrives.', 'Open item', 'Operations feedback prevents impractical fields.', 'Celestra Gallagher', 'Salesforce field cleanup', 'Operations feedback precedes configuration changes', 'Waiting')
  ], 'Reporting logic change is on hold until the rule is confirmed.');

  var NICO_HOME = makeHome('Nico Jacques', [
    homeItem('nico-pitchbook-duplicate', 'PitchBook duplicate uncertainty', 'One PitchBook match may duplicate a Salesforce contact.', 'Needs review', 'Decide whether to hold or pass for owner review.', 'Review duplicate', 'Duplicate contacts create bad outreach history.', 'Nico Jacques', 'PitchBook + Salesforce match', 'Possible duplicates require review before outreach', 'Decide'),
    homeItem('nico-audience-ready', 'Audience ready for review', 'A prepared audience is ready but needs quality judgement.', 'Suggested', 'Confirm whether it is ready for John or Kelvin.', 'Review audience', 'Prepared audiences should not move without evidence.', 'Nico Jacques', 'Research queue', 'Prepared audiences require operator quality review', 'Decide'),
    homeItem('nico-missing-contact-priority', 'Missing-contact research priority', 'Missing-contact research needs priority order.', 'Ready', 'Choose which missing contacts to research first.', 'Set priority', 'Research time should go to highest-value gaps first.', 'Nico Jacques', 'Research queue + owner requests', 'Research priority is set by operator judgement', 'Decide')
  ], [
    homeItem('nico-pitchbook-cross-check', 'Continue PitchBook cross-check', 'PitchBook records need Salesforce cross-checking.', 'Ready', 'Continue the cross-check queue.', 'Open workflow', 'Cross-checking prevents duplicate records.', 'Nico Jacques', 'PitchBook + Salesforce', 'External research is checked before preparation', 'Do'),
    homeItem('nico-current-contacts', 'Research missing current contacts', 'Several accounts are missing current contacts.', 'Ready', 'Find current contacts with evidence.', 'Research contacts', 'Outreach needs current contacts, not stale names.', 'Nico Jacques', 'Research queue', 'Missing contacts require evidence before handoff', 'Do'),
    homeItem('nico-prepare-audience', 'Prepare outreach audience', 'A researched audience is ready to prepare.', 'Ready', 'Prepare the handoff audience.', 'Prepare audience', 'Owners need a clean audience before sender review.', 'Nico Jacques', 'Research queue + My Work', 'Prepared outreach requires evidence and owner handoff', 'Do')
  ], [
    homeItem('nico-wait-john', 'John handoff acceptance', 'John needs to accept the Ex-Asia handoff.', 'Waiting', 'No action until John accepts.', 'Open item', 'The audience cannot move to owner review without acceptance.', 'John Jones', 'My Work handoff', 'Owner acceptance is required for handoff', 'Waiting'),
    homeItem('nico-wait-kelvin', 'Kelvin contact decision', 'Kelvin needs to decide an Asia contact route.', 'Waiting', 'No action until Kelvin decides.', 'Open item', 'The contact route controls preparation.', 'Kelvin Chan', 'Salesforce account route', 'Regional owner decides contact route', 'Waiting'),
    homeItem('nico-wait-celestra', 'Celestra approval on record matching', 'Celestra needs to approve record matching.', 'Waiting', 'No action until Celestra approves.', 'Open item', 'Record matching blocks safe preparation.', 'Celestra Gallagher', 'Salesforce matching', 'Operations approval required for ambiguous matches', 'Waiting')
  ], 'One possible duplicate must be reviewed before outreach preparation.');

  var BEN_HOME = makeHome('Ben Fanger', [
    homeItem('ben-stage4-no-plan', 'Stage 4 LP with no action plan', 'An advanced LP has no current action plan.', 'Blocked', 'Decide whether to assign a plan or downgrade.', 'Review exception', 'Advanced relationships should not sit without a plan.', 'Ben Fanger', 'Salesforce stage + owner plans', 'Stage 4 relationships require an action plan', 'Decide'),
    homeItem('ben-priority-mismatch', 'Priority mismatch', 'Owner priority conflicts with system signal.', 'Needs review', 'Decide whether to ask owners for an update.', 'Review mismatch', 'Priority mismatches affect coverage decisions.', 'Ben Fanger', 'Salesforce priority + activity signals', 'Strategic priority mismatches require senior review', 'Decide'),
    homeItem('ben-placement-strategy', 'Placement-agent strategy', 'Placement-agent strategy needs a senior decision.', 'On hold', 'Choose the strategy before diligence proceeds.', 'Review strategy', 'The route affects commercial and governance posture.', 'Ben Fanger', 'Diligence notes + approvals', 'Placement-agent strategy requires senior review', 'Decide')
  ], [
    homeItem('ben-approval-package', 'Review approval package', 'One approval package is ready for senior review.', 'Ready', 'Review and approve or return it.', 'Open workflow', 'The package cannot release until reviewed.', 'Ben Fanger', 'Approvals', 'Approval packages require senior review', 'Do', '#/approvals'),
    homeItem('ben-regional-strategy', 'Confirm regional strategy question', 'A regional strategy question needs confirmation.', 'Ready', 'Confirm the strategic direction.', 'Confirm strategy', 'Owners need a clear direction before updating plans.', 'Ben Fanger', 'Strategy notes', 'Regional strategy changes require senior confirmation', 'Do'),
    homeItem('ben-brief-standard', 'Review meeting brief standard', 'Emily’s brief standard is ready for review.', 'Ready', 'Review the standard and comment.', 'Review standard', 'The standard affects all meeting preparation.', 'Ben Fanger', 'Template draft', 'Firm-wide standards require senior review', 'Do')
  ], [
    homeItem('ben-wait-john', 'John placement-agent summary', 'John is preparing the placement-agent summary.', 'Waiting', 'No action until John sends it.', 'Open item', 'The strategy decision needs John’s summary.', 'John Jones', 'Diligence summary', 'Owner summary precedes senior decision', 'Waiting'),
    homeItem('ben-wait-kelvin', 'Kelvin updated priority field', 'Kelvin is updating the priority field.', 'Waiting', 'No action until Kelvin updates it.', 'Open item', 'The priority mismatch depends on the updated field.', 'Kelvin Chan', 'Salesforce priority field', 'Regional update precedes senior review', 'Waiting'),
    homeItem('ben-wait-emily', 'Emily template draft', 'Emily is drafting the meeting brief standard.', 'Waiting', 'No action until Emily sends it.', 'Open item', 'Review depends on the draft.', 'Emily Oestericher', 'Template workstream', 'Draft precedes senior review', 'Waiting')
  ], 'One Stage 4 LP has no current action plan.');

  /* ── People ─────────────────────────────────────────────────────────────
     `role` carries the shared capability role so the legacy Tools prototype
     keeps working. `title` + `coverage` are the exact approved identity;
     `displayRole` is a single-line convenience that preserves the parentheses.
     `photo` is an approved employee photograph where one exists in the repo;
     otherwise `initials` drives a restrained avatar (never a generated face). */

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
     Restrained overviews, clearly marked as preview content. No claim of
     real integration or execution. */

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
