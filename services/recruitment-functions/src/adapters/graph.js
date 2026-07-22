'use strict';

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const DEFAULT_ENDPOINT = 'https://graph.microsoft.com/v1.0';
const IMMUTABLE_ID_PREFERENCE = 'IdType="ImmutableId"';

class GraphDeliveryError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'GraphDeliveryError';
    this.code = code;
    this.status = options.status || 0;
    this.permanent = options.permanent === true;
    this.retryAfterMs = options.retryAfterMs || 0;
  }
}

function cleanEndpoint(value) {
  return String(value || DEFAULT_ENDPOINT).replace(/\/+$/, '');
}

function escapeFilterString(value) {
  return String(value).replace(/'/g, "''");
}

function encodeSegment(value) {
  return encodeURIComponent(String(value));
}

function retryAfterMs(response) {
  const raw = response?.headers?.get?.('retry-after');
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

function graphErrorCode(status) {
  if (status === 401 || status === 403) return 'GRAPH_AUTHORIZATION_FAILED';
  if (status === 404) return 'GRAPH_RESOURCE_NOT_FOUND';
  if (status === 409 || status === 412) return 'GRAPH_CONFLICT';
  if (status === 429) return 'GRAPH_RATE_LIMITED';
  if (status >= 500) return 'GRAPH_UNAVAILABLE';
  return 'GRAPH_REQUEST_FAILED';
}

function isPermanentStatus(status) {
  return status >= 400 && status < 500 && ![408, 409, 412, 429].includes(status);
}

async function safeJson(response) {
  if (!response || response.status === 204 || response.status === 202) return null;
  const contentType = response.headers?.get?.('content-type') || '';
  if (!/application\/json/i.test(contentType)) return null;
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

function createGraphAdapter({
  credential,
  endpoint = DEFAULT_ENDPOINT,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!credential || typeof credential.getToken !== 'function') {
    throw new GraphDeliveryError('GRAPH_CREDENTIAL_MISSING', 'Microsoft Graph credential is not configured', {
      permanent: true
    });
  }
  if (typeof fetchImpl !== 'function') {
    throw new GraphDeliveryError('GRAPH_FETCH_MISSING', 'Fetch implementation is not available', {
      permanent: true
    });
  }

  const baseUrl = cleanEndpoint(endpoint);

  async function request(path, options = {}) {
    let accessToken;
    try {
      const token = await credential.getToken(GRAPH_SCOPE);
      accessToken = token?.token;
    } catch (_) {
      throw new GraphDeliveryError('GRAPH_TOKEN_FAILED', 'Unable to acquire Microsoft Graph token');
    }
    if (!accessToken) {
      throw new GraphDeliveryError('GRAPH_TOKEN_FAILED', 'Microsoft Graph token was empty');
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    };
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(options.timeoutMs || 10000)
          : undefined
      });
    } catch (_) {
      throw new GraphDeliveryError('GRAPH_NETWORK_FAILED', 'Microsoft Graph request failed');
    }

    const expectedStatuses = options.expectedStatuses || [200];
    if (!expectedStatuses.includes(response.status)) {
      throw new GraphDeliveryError(
        graphErrorCode(response.status),
        `Microsoft Graph returned HTTP ${response.status}`,
        {
          status: response.status,
          permanent: isPermanentStatus(response.status),
          retryAfterMs: retryAfterMs(response)
        }
      );
    }
    return safeJson(response);
  }

  async function findListItem(siteId, listId, fieldName, fieldValue) {
    const filter = `fields/${fieldName} eq '${escapeFilterString(fieldValue)}'`;
    const query = new URLSearchParams({
      '$expand': `fields($select=${fieldName})`,
      '$filter': filter,
      '$top': '2'
    });
    const result = await request(
      `/sites/${encodeSegment(siteId)}/lists/${encodeSegment(listId)}/items?${query.toString()}`
    );
    const items = Array.isArray(result?.value) ? result.value : [];
    if (items.length > 1) {
      throw new GraphDeliveryError(
        'GRAPH_DUPLICATE_LIST_ITEM',
        `Multiple SharePoint items match ${fieldName}`,
        { permanent: true }
      );
    }
    return items[0] || null;
  }

  function createListItem(siteId, listId, fields) {
    return request(`/sites/${encodeSegment(siteId)}/lists/${encodeSegment(listId)}/items`, {
      method: 'POST',
      body: { fields },
      expectedStatuses: [200, 201]
    });
  }

  function updateListItem(siteId, listId, itemId, fields) {
    return request(
      `/sites/${encodeSegment(siteId)}/lists/${encodeSegment(listId)}/items/${encodeSegment(itemId)}/fields`,
      {
        method: 'PATCH',
        body: fields,
        expectedStatuses: [200]
      }
    );
  }

  async function upsertListItem({ siteId, listId, keyField, keyValue, fields }) {
    const existing = await findListItem(siteId, listId, keyField, keyValue);
    if (existing) {
      await updateListItem(siteId, listId, existing.id, fields);
      return { itemId: existing.id, created: false };
    }

    try {
      const created = await createListItem(siteId, listId, fields);
      return { itemId: created?.id, created: true };
    } catch (error) {
      if (!(error instanceof GraphDeliveryError) || !['GRAPH_CONFLICT', 'GRAPH_REQUEST_FAILED'].includes(error.code)) {
        throw error;
      }
      const raced = await findListItem(siteId, listId, keyField, keyValue);
      if (!raced) throw error;
      await updateListItem(siteId, listId, raced.id, fields);
      return { itemId: raced.id, created: false, reconciled: true };
    }
  }

  async function findMessagesByExtendedProperty(mailbox, propertyId, propertyValue) {
    const filter = `singleValueExtendedProperties/Any(ep: ep/id eq '${escapeFilterString(propertyId)}' and ep/value eq '${escapeFilterString(propertyValue)}')`;
    const query = new URLSearchParams({
      '$filter': filter,
      '$select': 'id,isDraft,sentDateTime,subject',
      '$top': '5'
    });
    const result = await request(
      `/users/${encodeSegment(mailbox)}/messages?${query.toString()}`,
      { headers: { Prefer: IMMUTABLE_ID_PREFERENCE } }
    );
    return Array.isArray(result?.value) ? result.value : [];
  }

  async function getMessage(mailbox, messageId) {
    try {
      return await request(
        `/users/${encodeSegment(mailbox)}/messages/${encodeSegment(messageId)}?$select=id,isDraft,sentDateTime,subject`,
        { headers: { Prefer: IMMUTABLE_ID_PREFERENCE } }
      );
    } catch (error) {
      if (error instanceof GraphDeliveryError && error.code === 'GRAPH_RESOURCE_NOT_FOUND') return null;
      throw error;
    }
  }

  function createDraftMessage(mailbox, message, extendedProperty) {
    return request(`/users/${encodeSegment(mailbox)}/messages`, {
      method: 'POST',
      body: {
        ...message,
        singleValueExtendedProperties: [extendedProperty]
      },
      headers: { Prefer: IMMUTABLE_ID_PREFERENCE },
      expectedStatuses: [201]
    });
  }

  async function sendDraftMessage(mailbox, messageId) {
    await request(`/users/${encodeSegment(mailbox)}/messages/${encodeSegment(messageId)}/send`, {
      method: 'POST',
      headers: { Prefer: IMMUTABLE_ID_PREFERENCE },
      expectedStatuses: [202]
    });
    return { accepted: true };
  }

  async function sendMail(mailbox, message) {
    await request(`/users/${encodeSegment(mailbox)}/sendMail`, {
      method: 'POST',
      body: { message, saveToSentItems: true },
      expectedStatuses: [202]
    });
    return { accepted: true };
  }

  async function health({ siteId, applicationsListId, filesListId, mailbox } = {}) {
    if (![siteId, applicationsListId, filesListId, mailbox].every((value) => typeof value === 'string' && value.length > 0)) {
      throw new GraphDeliveryError(
        'GRAPH_HEALTH_CONFIGURATION_INVALID',
        'Microsoft Graph readiness configuration is incomplete',
        { permanent: true }
      );
    }

    await Promise.all([
      request(`/sites/${encodeSegment(siteId)}/lists/${encodeSegment(applicationsListId)}?$select=id`, { timeoutMs: 5000 }),
      request(`/sites/${encodeSegment(siteId)}/lists/${encodeSegment(filesListId)}?$select=id`, { timeoutMs: 5000 }),
      request(`/users/${encodeSegment(mailbox)}/messages?$select=id&$top=1`, {
        headers: { Prefer: IMMUTABLE_ID_PREFERENCE },
        timeoutMs: 5000
      })
    ]);
    return { ok: true };
  }

  return {
    request,
    findListItem,
    createListItem,
    updateListItem,
    upsertListItem,
    findMessagesByExtendedProperty,
    getMessage,
    createDraftMessage,
    sendDraftMessage,
    sendMail,
    health
  };
}

module.exports = {
  GRAPH_SCOPE,
  DEFAULT_ENDPOINT,
  IMMUTABLE_ID_PREFERENCE,
  GraphDeliveryError,
  escapeFilterString,
  retryAfterMs,
  createGraphAdapter
};
