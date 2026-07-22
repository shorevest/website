'use strict';

/**
 * Connector interfaces — the contract that both mock and future real
 * implementations satisfy. UI never touches these; only services do, through
 * the factory (index.js). Swapping a mock for a real connector is implementing
 * the same class against Salesforce / Graph / SharePoint / Power Automate.
 *
 * Every method returns a Promise to mirror real network I/O.
 */

function notImplemented(name) {
  return async () => {
    const err = new Error(`${name} is not connected in this environment.`);
    err.code = 'CONNECTOR_NOT_CONNECTED';
    err.status = 503;
    throw err;
  };
}

class SalesforceConnector {
  async searchPeople() { return notImplemented('SalesforceConnector.searchPeople')(); }
  async searchInstitutions() { return notImplemented('SalesforceConnector.searchInstitutions')(); }
  async getAccount() { return notImplemented('SalesforceConnector.getAccount')(); }
  async getContact() { return notImplemented('SalesforceConnector.getContact')(); }
  async proposeContactCreate() { return notImplemented('SalesforceConnector.proposeContactCreate')(); }
  async proposeAccountCreate() { return notImplemented('SalesforceConnector.proposeAccountCreate')(); }
  async proposeRecordUpdate() { return notImplemented('SalesforceConnector.proposeRecordUpdate')(); }
  async applyApprovedChanges() { return notImplemented('SalesforceConnector.applyApprovedChanges')(); }
  async health() { return { name: 'salesforce', ok: false, detail: 'not connected' }; }
}

class MailConnector {
  async searchMessages() { return notImplemented('MailConnector.searchMessages')(); }
  async getThread() { return notImplemented('MailConnector.getThread')(); }
  async prepareDraft() { return notImplemented('MailConnector.prepareDraft')(); }
  async sendApprovedMessage() { return notImplemented('MailConnector.sendApprovedMessage')(); }
  async getDeliveryStatus() { return notImplemented('MailConnector.getDeliveryStatus')(); }
  async getReplies() { return notImplemented('MailConnector.getReplies')(); }
  async health() { return { name: 'mail', ok: false, detail: 'not connected' }; }
}

class DocumentConnector {
  async searchDocuments() { return notImplemented('DocumentConnector.searchDocuments')(); }
  async getDocumentMetadata() { return notImplemented('DocumentConnector.getDocumentMetadata')(); }
  async createRecipientVersion() { return notImplemented('DocumentConnector.createRecipientVersion')(); }
  async getApprovedTemplate() { return notImplemented('DocumentConnector.getApprovedTemplate')(); }
  async createControlledLink() { return notImplemented('DocumentConnector.createControlledLink')(); }
  // Investment Toolbox — figure extraction. Later: parse an Excel model /
  // PowerPoint deck out of SharePoint into structured figures. The QC engine
  // reconciles whatever these return; it does not care how they were parsed.
  async extractModelMetrics() { return notImplemented('DocumentConnector.extractModelMetrics')(); }
  async extractDeckFigures() { return notImplemented('DocumentConnector.extractDeckFigures')(); }
  async health() { return { name: 'document', ok: false, detail: 'not connected' }; }
}

class WorkflowConnector {
  async submitApproval() { return notImplemented('WorkflowConnector.submitApproval')(); }
  async requestExecution() { return notImplemented('WorkflowConnector.requestExecution')(); }
  async getExecutionStatus() { return notImplemented('WorkflowConnector.getExecutionStatus')(); }
  async health() { return { name: 'workflow', ok: false, detail: 'not connected' }; }
}

class VendorSignalConnector {
  async getContactSuggestions() { return notImplemented('VendorSignalConnector.getContactSuggestions')(); }
  async getEnrichmentSuggestions() { return notImplemented('VendorSignalConnector.getEnrichmentSuggestions')(); }
  async getSecondaryPrioritySignals() { return notImplemented('VendorSignalConnector.getSecondaryPrioritySignals')(); }
  async getMeetingNoteSuggestions() { return notImplemented('VendorSignalConnector.getMeetingNoteSuggestions')(); }
  async health() { return { name: 'vendor_signal', ok: false, detail: 'not connected' }; }
}

module.exports = {
  SalesforceConnector, MailConnector, DocumentConnector,
  WorkflowConnector, VendorSignalConnector,
};
