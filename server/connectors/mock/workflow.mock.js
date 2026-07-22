'use strict';

/**
 * Mock workflow connector (future: Power Automate approval + execution routing).
 * In MOCK mode approval routing resolves locally; execution is driven by the
 * execution guard through the mail/salesforce mocks.
 */

const { WorkflowConnector } = require('../interfaces');

class MockWorkflowConnector extends WorkflowConnector {
  async health() {
    return { name: 'workflow', ok: true, detail: 'mock connector (local approval routing)' };
  }

  async submitApproval({ packageId, versionHash }) {
    return { routed: true, packageId, versionHash, approvalTaskId: `mock-approval-${packageId}` };
  }

  async requestExecution({ packageId, idempotencyKey }) {
    return { accepted: true, packageId, idempotencyKey, runId: `mock-run-${idempotencyKey}` };
  }

  async getExecutionStatus(runId) {
    return { runId, status: 'completed' };
  }
}

module.exports = { MockWorkflowConnector };
