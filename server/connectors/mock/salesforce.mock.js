'use strict';

/**
 * Mock Salesforce. In MOCK mode the seeded SQLite `people`/`institutions`
 * tables ARE the fictional Salesforce org, so search returns realistic,
 * self-consistent results and every other view shares the same records.
 *
 * The real SalesforceConnector will implement these same methods against the
 * Salesforce REST/Bulk APIs. Signatures and return shapes must not change.
 */

const { SalesforceConnector } = require('../interfaces');
const { chance } = require('./determinism');

class MockSalesforceConnector extends SalesforceConnector {
  constructor(deps) {
    super();
    this.repos = deps.repos;
  }

  async health() {
    return { name: 'salesforce', ok: true, detail: 'mock connector (fictional org)' };
  }

  /**
   * @param {object} rules structured rules { country, region, status, ... }
   * @returns {Promise<Array>} matching person records with institution context
   */
  async searchPeople(rules = {}) {
    const people = this.repos.people.all('codename');
    const byId = new Map(this.repos.institutions.all().map((i) => [i.id, i]));
    return people
      .filter((p) => matches(p, byId.get(p.institution_id), rules))
      .map((p) => decorate(p, byId.get(p.institution_id)));
  }

  async searchInstitutions(rules = {}) {
    return this.repos.institutions.all('name').filter((i) => {
      if (rules.country && norm(i.country) !== norm(rules.country)) return false;
      if (rules.region && norm(i.region) !== norm(rules.region)) return false;
      return true;
    });
  }

  async getAccount(id) { return this.repos.institutions.get(id) || null; }
  async getContact(id) { return this.repos.people.get(id) || null; }

  async proposeContactCreate(payload) {
    return { kind: 'contact_create', accepted: null, payload };
  }
  async proposeAccountCreate(payload) {
    return { kind: 'account_create', accepted: null, payload };
  }
  async proposeRecordUpdate(payload) {
    return { kind: 'record_update', accepted: null, payload };
  }

  /**
   * Simulate applying an approved write. Deterministically fails a fraction of
   * rows so partial-failure handling is exercised. The SAME method on the real
   * connector will perform the actual Salesforce write.
   */
  async applyApprovedChanges(change) {
    const key = `${change.kind}:${change.personId || change.recordId || ''}`;
    if (chance(`sf-fail:${key}`, 0.12)) {
      return {
        ok: false, errorCode: 'FIELD_INTEGRITY_EXCEPTION',
        errorDetail: 'Mock Salesforce rejected the write (simulated field integrity error).',
      };
    }
    return { ok: true, externalId: `mock-sfid-${key}`, appliedAt: new Date().toISOString() };
  }
}

function norm(v) { return String(v || '').trim().toLowerCase(); }

function matches(person, inst, rules) {
  if (rules.country && norm(person.country) !== norm(rules.country)) return false;
  if (rules.region && norm(person.region) !== norm(rules.region)) return false;
  if (rules.status && norm(person.status) !== norm(rules.status)) return false;
  if (rules.institutionType && inst && norm(inst.type) !== norm(rules.institutionType)) return false;
  if (rules.titleIncludes && !norm(person.title).includes(norm(rules.titleIncludes))) return false;
  return true;
}

function decorate(p, inst) {
  return {
    id: p.id,
    codename: p.codename,
    title: p.title,
    email: p.email,
    emailStatus: p.email_status,
    status: p.status,
    ownerId: p.owner_id,
    region: p.region,
    country: p.country,
    restricted: p.restricted,
    declinedAt: p.declined_at,
    duplicateOf: p.duplicate_of,
    institutionId: p.institution_id,
    institutionName: inst ? inst.name : null,
  };
}

module.exports = { MockSalesforceConnector };
