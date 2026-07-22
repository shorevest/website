'use strict';

/**
 * Connector factory / dependency-injection seam.
 *
 * `buildConnectors(config, deps)` returns the set of connectors for the active
 * environment. MOCK → mock connectors. CONNECTED_* → real connectors (to be
 * implemented). Services receive this bundle and never construct connectors
 * themselves, so switching implementations is a one-line change here — not a
 * change to any page, service, or the data model.
 */

const { MODES } = require('../config');
const { MockSalesforceConnector } = require('./mock/salesforce.mock');
const { MockMailConnector } = require('./mock/mail.mock');
const { MockWorkflowConnector } = require('./mock/workflow.mock');
const { MockDocumentConnector } = require('./mock/document.mock');
const { MockVendorSignalConnector } = require('./mock/vendorSignal.mock');
const interfaces = require('./interfaces');

function buildConnectors(config, deps) {
  if (config.mode === MODES.MOCK) {
    return {
      salesforce: new MockSalesforceConnector(deps),
      mail: new MockMailConnector(deps),
      workflow: new MockWorkflowConnector(deps),
      document: new MockDocumentConnector(deps),
      vendorSignal: new MockVendorSignalConnector(deps),
    };
  }

  // CONNECTED_READ_ONLY / CONNECTED_CONTROLLED:
  // Real connectors are not implemented yet. They must implement the same
  // interface classes. Until then the base classes fail closed (503), which is
  // the correct, safe behaviour — never a silent fallback to mock data.
  return {
    salesforce: new interfaces.SalesforceConnector(),
    mail: new interfaces.MailConnector(),
    workflow: new interfaces.WorkflowConnector(),
    document: new interfaces.DocumentConnector(),
    vendorSignal: new interfaces.VendorSignalConnector(),
  };
}

async function healthAll(connectors) {
  const names = Object.keys(connectors);
  const results = await Promise.all(names.map((n) => connectors[n].health()));
  return results;
}

module.exports = { buildConnectors, healthAll, interfaces };
