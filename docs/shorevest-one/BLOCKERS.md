# ShoreVest One — Remaining blockers before a connected pilot

This pass delivers a **real application** running on **fictional data + mock
connectors**. It is deliberately **not** production-ready. Do not represent it as
connected to any real system. The following must be resolved first.

## Hard blockers (must be done before any connected pilot)

1. **Runtime hosting for the Node application.** The public site is static
   (GitHub Pages); it cannot run this server. A connected pilot needs a Node
   host (Azure App Service / Container Apps / Functions) and a managed database.
   The app is written to move off SQLite at the repository layer without service
   changes.
2. **Authentication connected.** The auth adapter (`server/api/auth.js`) uses
   seeded fictional users selected by header in MOCK mode. Real Entra ID (MSAL /
   OAuth) sign-in and token→user/role mapping must replace it. Permissions are
   already enforced in services, so this is an adapter change.
3. **External connectors implemented and configured.** Salesforce, Microsoft
   Graph, SharePoint, Power Automate real connectors (see `CONNECTORS.md`), with
   secrets in a secret manager. Until then `CONNECTED_*` modes fail closed.
4. **Security review.** Server-side input validation exists, but a full review is
   required: authz on every route, rate limiting, secret handling, dependency
   posture, transport security, and abuse cases for the execution path.
5. **Data governance decisions.** Real names replace animal codenames; confirm
   lawful basis, retention, minimisation, and access boundaries for investor PII.
6. **Audit retention approved.** Audit events persist, but a retention period,
   immutability/export, and review process must be approved.
7. **Permissions validated with ShoreVest.** The role→permission matrix
   (`server/domain/permissions.js`) is a reasonable default; it must be reviewed
   and signed off against real roles.

## Softer follow-ups (not blocking a pilot, but planned)

- Migrate the legacy motherboard views (under `employee-portal/`) onto the real
  API, or formally retire them.
- Bring Meetings, Diligence & Requests, and Investor Intelligence from
  production-shaped shells to functioning slices.
- CSV upload for Find People (paste-names and search already work).
- Concurrency: optimistic version checks on member/draft edits under multi-user
  load.
- Observability: structured logs, metrics, connector health dashboard.

## What is already true (definition-of-done for this pass)

- Refreshing / restarting preserves workflow state (SQLite on disk; verified by
  the e2e "reopen" test).
- Two views reflect a change to the same underlying record (shared domain model).
- Every core Outreach action goes through the service/API layer.
- Every material action writes an audit event.
- Editing a draft after approval invalidates the approval package.
- Mock execution uses the same connector interface real execution will.
- Duplicate execution is prevented via idempotency keys.
- Failed rows are held and can be repaired.
- Automated tests (unit + integration + e2e) prove the full workflow.
