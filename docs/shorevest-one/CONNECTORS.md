# ShoreVest One — Connector Integration Guide

This is the checklist for replacing each **mock** connector with a **real** one.
The application, data model, workflow engine, permissions, and API do **not**
change — you implement the connector interface and the field mappings.

## How the seam works

- Interfaces: `server/connectors/interfaces.js` (the contract every connector
  satisfies — mock and real).
- Mock implementations: `server/connectors/mock/*.js`.
- Factory / dependency injection: `server/connectors/index.js`. It returns mock
  or real connectors based on `SHOREVEST_ONE_MODE`.
- Services depend only on the factory output. UI never calls a connector.

To add a real connector:
1. Create `server/connectors/real/<name>.js` implementing the interface class.
2. Wire it in `buildConnectors()` under the `CONNECTED_*` branch.
3. Provide config via environment variables (`.env.example`) resolved from the
   secret manager. Presence of config never enables writes — the **mode** does,
   and every write still passes the central execution guard
   (`server/services/executionGuard.js`).

The `CONNECTED_*` branch currently returns the fail-closed base classes (HTTP
503). That is the correct, safe default until a real connector is implemented —
never a silent fallback to mock data.

---

## Salesforce  → `SalesforceConnector`

| Objects | Accounts, Contacts, Opportunities, Tasks, Activities |
| Reads | `searchPeople`, `searchInstitutions`, `getAccount`, `getContact` |
| Writes | `applyApprovedChanges` (only via execution guard, only in CONNECTED_CONTROLLED) |
| Proposals | `proposeContactCreate`, `proposeAccountCreate`, `proposeRecordUpdate` |

- **Auth:** OAuth 2.0 JWT bearer or client-credentials; token via secret manager.
- **Scopes:** `api`, `refresh_token`; least-privilege profile limited to the
  objects above.
- **Field mapping placeholders (to confirm with ShoreVest):**
  - `people.codename` → Contact.Name (real names replace codenames on connect)
  - `people.email` → Contact.Email · `people.title` → Contact.Title
  - `people.owner_id` → Contact.OwnerId (map fictional users → real users)
  - `institutions.name` → Account.Name · `institutions.type` → Account.Type
- **Sync strategy:** initial full pull → incremental via `SystemModstamp` cursor
  stored in `connector_sync.cursor`. Consider Change Data Capture / Platform
  Events for near-real-time.
- **Retry/error:** exponential backoff on 5xx / row-lock; surface
  `FIELD_INTEGRITY_EXCEPTION`-class errors as per-row failures (the guard already
  holds only the affected row).
- **Rule:** Opportunity creation must NOT occur from cold outreach unless a
  separately approved rule exists (enforced in the service, not the connector).

## Microsoft Graph / Outlook  → `MailConnector`

| Reads | `searchMessages`, `getThread`, `getDeliveryStatus`, `getReplies` |
| Writes | `prepareDraft`, `sendApprovedMessage` (guarded, CONNECTED_CONTROLLED) |

- **Auth:** Microsoft Entra ID app registration, client credentials.
- **Scopes:** `Mail.Send`, `Mail.ReadWrite`, `Mail.Read` (shared/sender mailbox),
  optionally `Calendars.Read` for meeting context.
- **Mapping:** fictional sender identity → authorized real mailbox (config map).
  `signatures` → managed signature applied server-side.
- **Webhooks:** Graph change notifications (subscriptions) for replies/bounces →
  create `responses`; renew subscriptions before expiry.
- **Retry/error:** honour `Retry-After`; map non-delivery reports to hard-bounce
  → the person is held and flagged `hard_bounce`.

## SharePoint  → `DocumentConnector`

| Reads | `searchDocuments`, `getDocumentMetadata`, `getApprovedTemplate` |
| Writes | `createRecipientVersion`, `createControlledLink` |

- **Auth:** Entra ID app; **Scopes:** `Sites.Selected` (specific site only).
- **Mapping:** approved templates library → `getApprovedTemplate`; recipient
  versions written to a controlled library with retention labels.
- **Links:** controlled, expiring links only; no anonymous links.

## Power Automate  → `WorkflowConnector`

| `submitApproval` | route approval package to approvers |
| `requestExecution` | controlled execution trigger |
| `getExecutionStatus` | poll run status |

- **Auth:** HTTP-triggered flows with per-flow SAS URL from the secret manager.
- **Responsibilities:** approval routing, controlled execution, notifications,
  retries, operational alerts.
- **Idempotency:** pass the execution idempotency key to the flow; the flow must
  be idempotent on that key as well as the app.

## Vendor signals  → `VendorSignalConnector`

- Enrichment / intent vendors. **Suggestions only — never authoritative.**
  Suggestions surface in the UI and require human acceptance before any record
  change (which then flows through the normal proposal → approval path).

---

## Setup checklist (per connector)

- [ ] App registration created; least-privilege scopes granted and admin-consented.
- [ ] Secrets stored in the secret manager; referenced by env var only.
- [ ] Field mapping confirmed and written into the real connector.
- [ ] Sync cursor + strategy validated against a sandbox tenant.
- [ ] Webhook/subscription lifecycle (create, renew, validate) implemented.
- [ ] Retry/backoff and error→status mapping implemented.
- [ ] Health check (`health()`) returns real connectivity status (the guard
      blocks execution when a required connector is unhealthy).
- [ ] Read path validated in `CONNECTED_READ_ONLY` before enabling writes.
- [ ] Write path validated in `CONNECTED_CONTROLLED` behind the execution guard.
