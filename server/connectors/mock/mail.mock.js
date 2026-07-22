'use strict';

/**
 * Mock mail connector (future: Microsoft Graph / Outlook). Simulates delivery,
 * deterministically failing a fraction of recipients so partial-failure repair
 * is exercised. Real implementation performs Graph sendMail / draft creation.
 */

const { MailConnector } = require('../interfaces');
const { chance, ratio } = require('./determinism');

class MockMailConnector extends MailConnector {
  constructor(deps) {
    super();
    this.repos = deps.repos;
  }

  async health() {
    return { name: 'mail', ok: true, detail: 'mock connector (no external mail sent)' };
  }

  async prepareDraft({ subject, body, senderId, personId }) {
    return { draftId: `mock-draft-${personId}`, subject, body, senderId };
  }

  /**
   * @returns {Promise<{status,externalId?,errorCode?,errorDetail?}>}
   * Deterministic outcome per (person, idempotencyKey) so repeated calls with
   * the same key would resolve identically.
   */
  async sendApprovedMessage({ personId, email, idempotencyKey }) {
    if (!email) {
      return { status: 'failed', errorCode: 'NO_RECIPIENT_ADDRESS', errorDetail: 'Recipient has no email address.' };
    }
    if (chance(`mail-fail:${personId}:${idempotencyKey || ''}`, 0.15)) {
      return { status: 'failed', errorCode: 'SMTP_REJECTED', errorDetail: 'Mock mail server rejected the recipient (simulated).' };
    }
    return { status: 'sent', externalId: `mock-msg-${personId}-${Math.floor(ratio(personId) * 1e6)}` };
  }

  async getDeliveryStatus(externalId) {
    return { externalId, delivered: true };
  }

  /** Deterministically synthesise a few replies for sent messages. */
  async getReplies(sentMessages = []) {
    const replies = [];
    for (const m of sentMessages) {
      const r = ratio(`reply:${m.personId}`);
      if (r < 0.25) replies.push({ personId: m.personId, kind: 'reply', classification: 'interested', snippet: 'Thanks — happy to find time to talk.' });
      else if (r < 0.32) replies.push({ personId: m.personId, kind: 'decline', classification: 'not_now', snippet: 'Not the right time for us, please recontact next year.' });
      else if (r < 0.37) replies.push({ personId: m.personId, kind: 'ooo', classification: 'auto_reply', snippet: 'I am out of office until next week.' });
    }
    return replies;
  }

  async searchMessages() { return []; }
  async getThread() { return { messages: [] }; }
}

module.exports = { MockMailConnector };
