'use strict';

/** Mock vendor-signal connector (future: enrichment / intent vendors). */

const { VendorSignalConnector } = require('../interfaces');
const { ratio } = require('./determinism');

class MockVendorSignalConnector extends VendorSignalConnector {
  constructor(deps) {
    super();
    this.repos = deps.repos;
  }
  async health() {
    return { name: 'vendor_signal', ok: true, detail: 'mock connector (suggestions only, never authoritative)' };
  }
  async getContactSuggestions({ institutionId } = {}) {
    return [{ institutionId, suggestion: 'Possible new contact identified at this institution', confidence: 0.6 }];
  }
  async getEnrichmentSuggestions({ personId } = {}) {
    return [{ personId, field: 'title', suggested: 'Updated title from vendor signal', confidence: ratio(personId || '') }];
  }
  async getSecondaryPrioritySignals() {
    return [{ signal: 'increased_allocation_intent', strength: 'medium' }];
  }
  async getMeetingNoteSuggestions({ meetingId } = {}) {
    return [{ meetingId, note: 'Suggested follow-up topic based on prior thread' }];
  }
}

module.exports = { MockVendorSignalConnector };
