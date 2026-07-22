'use strict';

/**
 * Pure eligibility / issue-classification engine for Outreach. No DB, no
 * network — takes decorated people and returns a classification per person plus
 * the audience-level summary. Unit-tested directly.
 *
 * Outcome maps to the audience_member status:
 *   ready   → usable now
 *   held    → needs review (a person can proceed once resolved)
 *   blocked → cannot be used
 */

const CONCENTRATION_LIMIT = 4; // people per institution before review is required

const ISSUES = {
  restriction: { outcome: 'blocked', owner: 'Compliance', nextAction: 'Confirm restriction status', explain: 'This contact is restricted and cannot receive outreach.' },
  hard_bounce: { outcome: 'blocked', owner: 'Data quality', nextAction: 'Find a working address', explain: 'The last message to this contact hard-bounced.' },
  explicit_decline: { outcome: 'held', owner: 'Coverage owner', nextAction: 'Confirm re-contact timing', explain: 'This contact recently declined outreach.' },
  possible_duplicate: { outcome: 'held', owner: 'Data quality', nextAction: 'Resolve the duplicate', explain: 'A possible duplicate record exists for this person.' },
  departed_contact: { outcome: 'held', owner: 'Coverage owner', nextAction: 'Identify the current contact', explain: 'This contact appears to have left the institution.' },
  missing_current_contact: { outcome: 'held', owner: 'Data quality', nextAction: 'Add a current email address', explain: 'No usable email address is on file.' },
  institution_concentration: { outcome: 'held', owner: 'Coverage owner', nextAction: 'Confirm who to include', explain: 'Several contacts at this institution are in the list; confirm coverage.' },
  ownership_review: { outcome: 'held', owner: 'Coverage owner', nextAction: 'Confirm ownership', explain: 'Record ownership needs confirmation before outreach.' },
  account_match_needed: { outcome: 'held', owner: 'Data quality', nextAction: 'Match to an account', explain: 'This person is not linked to a known institution.' },
};

function allowedActions(outcome) {
  if (outcome === 'ready') return ['hold', 'remove', 'prepare'];
  if (outcome === 'held') return ['resolve', 'ready', 'hold', 'remove'];
  return ['remove']; // blocked
}

/**
 * @param {Array} people decorated person records (see salesforce.mock decorate)
 * @returns {{ classifications: Map<id, cls>, summary }}
 */
function classify(people) {
  // Institution concentration counts.
  const counts = new Map();
  for (const p of people) {
    const k = p.institutionId || 'none';
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  const classifications = new Map();
  let ready = 0; let held = 0; let blocked = 0;

  people.forEach((p, index) => {
    let code = null;
    if (p.restricted) code = 'restriction';
    else if (p.emailStatus === 'bounced') code = 'hard_bounce';
    else if (p.duplicateOf) code = 'possible_duplicate';
    else if (p.status === 'departed') code = 'departed_contact';
    else if (!p.email || p.emailStatus === 'missing') code = 'missing_current_contact';
    else if (p.declinedAt) code = 'explicit_decline';
    else if (!p.institutionId) code = 'account_match_needed';
    else if ((counts.get(p.institutionId) || 0) > CONCENTRATION_LIMIT && index >= firstIndexOverLimit(people, p.institutionId, CONCENTRATION_LIMIT)) {
      code = 'institution_concentration';
    }

    const meta = code ? ISSUES[code] : null;
    const outcome = meta ? meta.outcome : 'ready';
    if (outcome === 'ready') ready += 1;
    else if (outcome === 'held') held += 1;
    else blocked += 1;

    classifications.set(p.id, {
      personId: p.id,
      outcome,
      issueCode: code,
      issueReason: meta ? meta.explain : null,
      owner: meta ? meta.owner : null,
      nextAction: meta ? meta.nextAction : 'Ready to prepare',
      allowedActions: allowedActions(outcome),
    });
  });

  return {
    classifications,
    summary: { total: people.length, ready, needReview: held, cannotBeUsed: blocked },
  };
}

// The first N contacts at an institution are fine; those beyond the limit are
// flagged. This returns the array index at which flagging starts.
function firstIndexOverLimit(people, institutionId, limit) {
  let seen = 0;
  for (let i = 0; i < people.length; i += 1) {
    if (people[i].institutionId === institutionId) {
      seen += 1;
      if (seen > limit) return i;
    }
  }
  return Infinity;
}

module.exports = { classify, allowedActions, ISSUES, CONCENTRATION_LIMIT };
