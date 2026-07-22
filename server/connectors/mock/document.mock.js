'use strict';

/** Mock document connector (future: SharePoint controlled documents). */

const { DocumentConnector } = require('../interfaces');
const { MODEL_FIXTURES, DECK_FIXTURES } = require('./investmentFixtures');

const TEMPLATES = [
  { id: 'tpl-intro', name: 'Introductory outreach', approved: true },
  { id: 'tpl-reconnect', name: 'Reconnect / warm follow-up', approved: true },
  { id: 'tpl-diligence', name: 'Diligence materials cover note', approved: true },
];

class MockDocumentConnector extends DocumentConnector {
  async health() {
    return { name: 'document', ok: true, detail: 'mock connector (fictional document library)' };
  }
  async searchDocuments() { return TEMPLATES; }
  async getDocumentMetadata(id) { return TEMPLATES.find((t) => t.id === id) || null; }
  async getApprovedTemplate(id) {
    const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
    return { ...t, body: `[Approved template: ${t.name}]` };
  }
  async createRecipientVersion({ templateId, personId }) {
    return { versionId: `mock-docver-${templateId}-${personId}`, controlled: true };
  }
  async createControlledLink({ versionId }) {
    return { url: `https://example.invalid/controlled/${versionId}`, expiresInHours: 72 };
  }

  // Investment Toolbox — extraction. Returns the structured figures a future
  // real connector would parse out of the model / deck at `sourceRef`. A real
  // implementation reads the .xlsx / .pptx; the QC engine is identical either
  // way because it only ever sees these structured rows.
  async extractModelMetrics(sourceRef) { return (MODEL_FIXTURES[sourceRef] || []).map((m) => ({ ...m })); }
  async extractDeckFigures(sourceRef) { return (DECK_FIXTURES[sourceRef] || []).map((f) => ({ ...f })); }
}

module.exports = { MockDocumentConnector };
