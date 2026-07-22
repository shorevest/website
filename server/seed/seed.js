'use strict';

/**
 * Deterministic seed for MOCK mode. Same run → same IDs and same data, so tests
 * are repeatable. All names are FICTIONAL: animal codenames for external people,
 * invented institutions, and synthetic internal users. No real ShoreVest
 * employees, investors, emails, or confidential data appear here.
 *
 * Exercises realistic workflow conditions: duplicates, missing emails, departed
 * and restricted contacts, recent declines, institution concentration, saved
 * searches, lists, relationships, and approval/sent/reply records.
 */

const crypto = require('node:crypto');
const { seededId } = require('../domain/ids');
const { seedInvestment } = require('./seedInvestment');

const MODIFIERS = ['Red', 'Snow', 'River', 'Peregrine', 'Black', 'Grey', 'Sea', 'Golden', 'Silver', 'Amber', 'Coastal', 'Northern', 'Arctic', 'Copper', 'Cedar', 'Storm', 'Autumn', 'Marsh', 'Ivory', 'Slate', 'Ember', 'Dawn'];
const ANIMALS = ['Fox', 'Leopard', 'Otter', 'Falcon', 'Bear', 'Wolf', 'Turtle', 'Eagle', 'Heron', 'Marten', 'Lynx', 'Osprey', 'Badger', 'Hare', 'Stoat', 'Puffin', 'Ibis', 'Kestrel', 'Raven', 'Seal'];

const INSTITUTION_SEEDS = [
  'Cedar Ridge Pension', 'North Harbour Foundation', 'Silver Pine Insurance',
  'Granite Peak Capital', 'Blue River Endowment', 'Morning Star Family Office',
];
const INSTITUTION_TYPES = ['Pension', 'Foundation', 'Insurance', 'Asset Manager', 'Endowment', 'Family Office'];

// Country → region, and target number of people.
const COUNTRY_PLAN = [
  { country: 'Denmark', region: 'Europe', people: 46, institutions: 10 },
  { country: 'Sweden', region: 'Europe', people: 10, institutions: 3 },
  { country: 'Germany', region: 'Europe', people: 10, institutions: 3 },
  { country: 'United Kingdom', region: 'Europe', people: 10, institutions: 3 },
  { country: 'United States', region: 'Americas', people: 16, institutions: 5 },
  { country: 'Singapore', region: 'Asia-Pacific', people: 10, institutions: 3 },
  { country: 'Japan', region: 'Asia-Pacific', people: 10, institutions: 3 },
];

const TITLES = ['Chief Investment Officer', 'Head of Alternatives', 'Portfolio Manager', 'Director', 'Investment Analyst', 'Managing Director', 'Head of Private Credit'];

function ratio(key) {
  const hex = crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
}

function seed(app, { reset = true } = {}) {
  const { repos } = app;
  const now = '2026-07-01T09:00:00.000Z'; // fixed timestamp for determinism

  if (reset) resetAll(repos);
  if (repos.users.count() > 0) {
    seedInvestment(app, now); // idempotent; populates on a migrated-but-seeded DB
    return summary(repos);
  }

  repos.transaction(() => {
    // ── Users (synthetic internal staff / senders) ───────────────────────
    const users = [
      { id: seededId('usr', 'operator'), display_name: 'Preview Operator', title: 'Internal Preview (all access)', email: 'operator@example.invalid', role: 'admin' },
      { id: seededId('usr', 'ashby'), display_name: 'Morgan Ashby', title: 'Director of Client Solutions', email: 'm.ashby@example.invalid', role: 'director' },
      { id: seededId('usr', 'ellison'), display_name: 'Rowan Ellison', title: 'Director of Client Solutions', email: 'r.ellison@example.invalid', role: 'director' },
      { id: seededId('usr', 'brooks'), display_name: 'Devan Brooks', title: 'Investor Relations Associate', email: 'd.brooks@example.invalid', role: 'associate' },
      { id: seededId('usr', 'warden'), display_name: 'Casey Warden', title: 'Approver', email: 'c.warden@example.invalid', role: 'approver' },
    ];
    for (const u of users) repos.users.insert({ ...u, active: true, created_at: now, updated_at: now });
    const directorA = users[1].id;
    const directorB = users[2].id;

    // Signatures.
    for (const u of users) {
      if (['director', 'associate'].includes(u.role)) {
        repos.signatures.insert({ id: seededId('sig', u.id), sender_id: u.id, version: 1, html: `<p>${u.display_name}<br>${u.title}<br>ShoreVest (fictional preview)</p>`, active: true, created_at: now });
      }
    }

    // Delivery policies.
    repos.deliveryPolicies.insert({ id: seededId('pol', 'standard'), name: 'Standard outreach', approved: true, throttle_per_hour: 40, description: 'Approved default policy for controlled outreach.', created_at: now, updated_at: now });
    repos.deliveryPolicies.insert({ id: seededId('pol', 'highvol'), name: 'High-volume campaign', approved: false, throttle_per_hour: 200, description: 'Not yet approved.', created_at: now, updated_at: now });

    // ── Institutions ─────────────────────────────────────────────────────
    const institutions = [];
    let instIdx = 0;
    for (const plan of COUNTRY_PLAN) {
      for (let i = 0; i < plan.institutions; i += 1) {
        const base = INSTITUTION_SEEDS[instIdx % INSTITUTION_SEEDS.length];
        const name = instIdx < INSTITUTION_SEEDS.length ? base : `${base.split(' ')[0]} ${['Global', 'Trust', 'Partners', 'Group', 'Reserve', 'Mutual'][i % 6]} ${plan.country.split(' ')[0]}`;
        const type = INSTITUTION_TYPES[instIdx % INSTITUTION_TYPES.length];
        const owner = plan.region === 'Asia-Pacific' ? directorB : directorA;
        const inst = repos.institutions.insert({ id: seededId('ins', `${plan.country}-${i}`), name: `${name}`, type, country: plan.country, region: plan.region, owner_id: owner, created_at: now, updated_at: now });
        institutions.push({ ...inst, _plan: plan });
        instIdx += 1;
      }
    }

    // ── People ───────────────────────────────────────────────────────────
    let comboIdx = 0;
    const usedNames = new Set();
    function nextCodename() {
      while (comboIdx < MODIFIERS.length * ANIMALS.length) {
        const m = MODIFIERS[Math.floor(comboIdx / ANIMALS.length)];
        const a = ANIMALS[comboIdx % ANIMALS.length];
        comboIdx += 1;
        const name = `${m} ${a}`;
        if (!usedNames.has(name)) { usedNames.add(name); return name; }
      }
      return `Codename ${comboIdx++}`;
    }

    const peopleByCountry = {};
    for (const plan of COUNTRY_PLAN) {
      const countryInsts = institutions.filter((x) => x._plan.country === plan.country);
      peopleByCountry[plan.country] = [];
      for (let i = 0; i < plan.people; i += 1) {
        const codename = nextCodename();
        const inst = countryInsts[i % countryInsts.length]; // round-robin → some concentration
        const owner = plan.region === 'Asia-Pacific' ? directorB : directorA;
        const r = ratio(`${plan.country}-${i}`);
        let email = `${codename.toLowerCase().replace(/ /g, '.')}@example.invalid`;
        let email_status = 'ok';
        let status = 'active';
        let restricted = false;
        let declined_at = null;
        if (r < 0.08) { restricted = true; }
        else if (r < 0.18) { status = 'departed'; }
        else if (r < 0.28) { email = null; email_status = 'missing'; }
        else if (r < 0.33) { email_status = 'bounced'; }
        else if (r < 0.39) { declined_at = '2026-06-10T00:00:00.000Z'; }
        const person = repos.people.insert({
          id: seededId('per', `${plan.country}-${i}`), codename, institution_id: inst.id,
          title: TITLES[i % TITLES.length], email, email_status, status, owner_id: owner,
          region: plan.region, country: plan.country, restricted, declined_at, duplicate_of: null,
          created_at: now, updated_at: now,
        });
        peopleByCountry[plan.country].push(person);
      }
    }
    // Duplicates: mark a few Danish people as duplicates of an earlier one.
    const dk = peopleByCountry.Denmark;
    for (let i = 5; i < dk.length; i += 12) {
      repos.people.update(dk[i].id, { duplicate_of: dk[i - 5].id });
    }

    // ── Relationships & opportunities ────────────────────────────────────
    const stages = ['prospect', 'active', 'dormant', 'conflict'];
    const health = ['strong', 'steady', 'at_risk'];
    for (const plan of COUNTRY_PLAN) {
      peopleByCountry[plan.country].slice(0, Math.ceil(plan.people / 3)).forEach((p, i) => {
        repos.relationships.insert({ id: seededId('rel', p.id), person_id: p.id, institution_id: p.institution_id, owner_id: p.owner_id, stage: stages[i % stages.length], health: health[i % health.length], last_contact_at: '2026-05-15T00:00:00.000Z', notes: 'Fictional relationship record.', created_at: now, updated_at: now });
      });
    }
    institutions.slice(0, 12).forEach((inst, i) => {
      repos.opportunities.insert({ id: seededId('opp', inst.id), institution_id: inst.id, name: `${inst.name} — allocation review`, stage: ['exploring', 'diligence', 'committed'][i % 3], amount: 5000000 * ((i % 5) + 1), owner_id: inst.owner_id, created_at: now, updated_at: now });
    });

    // ── Saved searches ───────────────────────────────────────────────────
    repos.savedSearches.insert({ id: seededId('srch', 'denmark'), name: 'Denmark pensions', owner_id: directorA, query_text: 'Denmark pension contacts', rules_json: JSON.stringify({ country: 'Denmark' }), created_at: now, updated_at: now });
    repos.savedSearches.insert({ id: seededId('srch', 'apac'), name: 'Asia-Pacific active', owner_id: directorB, query_text: 'active Asia-Pacific investors', rules_json: JSON.stringify({ region: 'Asia-Pacific', status: 'active' }), created_at: now, updated_at: now });

    // ── Connector sync markers ───────────────────────────────────────────
    for (const c of ['salesforce', 'mail', 'workflow', 'document', 'vendor_signal']) {
      repos.connectorSync.insert({ id: seededId('sync', c), connector: c, status: 'mock', last_sync_at: now, cursor: null, detail: 'Mock connector — no external system attached.', created_at: now, updated_at: now });
    }

    app.ctx.audit.record({ actorId: seededId('usr', 'operator'), action: 'seed_loaded', objectType: 'system', objectId: 'seed', newState: 'loaded', source: 'seed' });
  });

  // Investment Toolbox seed runs outside the transaction above: a QC run opens
  // its own transaction, which cannot nest inside SQLite's single-level BEGIN.
  seedInvestment(app, now);

  return summary(repos);
}

function resetAll(repos) {
  const tables = ['qc_findings', 'qc_runs', 'deck_figures', 'decks', 'model_metrics', 'deal_models', 'deals', 'responses', 'messages', 'execution_requests', 'execution_keys', 'approval_decisions', 'approval_packages', 'draft_versions', 'draft_group_members', 'draft_groups', 'record_proposals', 'audience_members', 'audiences', 'saved_searches', 'workspace_items', 'tasks', 'relationships', 'opportunities', 'signatures', 'delivery_policies', 'people', 'institutions', 'connector_sync', 'audit_events', 'users'];
  for (const t of tables) repos.db.exec(`DELETE FROM ${t};`);
}

function summary(repos) {
  return {
    users: repos.users.count(), institutions: repos.institutions.count(),
    people: repos.people.count(), relationships: repos.relationships.count(),
    savedSearches: repos.savedSearches.count(),
  };
}

module.exports = { seed };
