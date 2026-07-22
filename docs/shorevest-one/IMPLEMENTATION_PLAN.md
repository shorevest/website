# ShoreVest One — Production-Shaped Application: Audit & Implementation Plan

**Status:** Living document. This pass turns the ShoreVest One motherboard from a
browser-only localStorage demonstration into a real, layered application with a
server-side database, an HTTP API, an enforced workflow engine, permissions,
an audit trail, and swappable connector interfaces (mock implementations now;
Salesforce / Microsoft Graph / SharePoint / Power Automate later).

> The intended progression:
> **Now** — real application + fictional animal data + mocked connectors.
> **Next** — replace mock connector implementations with Salesforce, Microsoft
> Graph, SharePoint and Power Automate **without rebuilding the UI, data model,
> or workflow engine.**

---

## 1. Repository audit (as found)

| Concern | Finding |
| --- | --- |
| Frontend framework | None. Vanilla HTML/CSS/JS. 82 static HTML pages (public marketing site + bilingual variants). |
| The "motherboard" | `employee-portal/index.html` + ~6,600 lines of vanilla JS in `assets/js/employee-portal/` presenting **ShoreVest One**. |
| Routing | Client-side hash router inside `app.js`. |
| State management | `store.js` — **localStorage** ("Dataverse entity contract" demo store). This is exactly the localStorage-as-database pattern the brief says to remove. |
| Persistence | localStorage only. No server. |
| Backend framework | None deployed. `api/recruitment/*` is an explicitly **reference-only, not-deployed** Node scaffold. |
| Authentication | None wired. `integrations.js` has a fail-closed Entra ID placeholder + a demo profile chooser. |
| Deployment target | **Static host (GitHub Pages).** Root HTML files are live URLs. No build step, no serverless host, no function bindings. |
| Test framework | Home-grown Node scripts using `node:assert` (e.g. `tests/employee-portal-rules.test.js`), run directly with `node`. One dev dependency: `ajv`. |
| Existing connector code | `integrations.js` — adapters for Entra, Dataverse, SharePoint, Power Automate, Salesforce, Office Scripts, all fail-closed placeholders. Good intent, but browser-side and coupled to the demo store. |
| Runtime available | **Node v22.22** — ships built-in **`node:sqlite`** (a real embedded SQL database) and `node:test`. Zero-dependency real persistence is possible. |

### Consequences for the design
1. **A real backend is required** and is built here under `server/`. It runs
   locally and in tests today (`npm run dev`, `npm test`).
2. **The static host cannot run that Node server yet.** That is the single
   largest deployment blocker (see `BLOCKERS.md`), not a reason to fake it.
3. **Zero new runtime dependencies.** Persistence uses `node:sqlite`; the HTTP
   server uses `node:http`; tests use `node:test`. This matches the repo's
   existing dependency-free ethos and avoids native-compile / npm-install risk.
4. **The legacy motherboard is preserved.** It stays reachable as the "Tools /
   legacy preview" surface. The new production-shaped app is additive, so no
   visual work is thrown away. Workspaces migrate onto the real API over time.

## 2. Four-layer architecture

```
UI (app/)                     pages, drawers, tables, workspace nav — calls /api only
  │  fetch()
Application services          workflow commands, validation, permissions,
(server/services)             status transitions, orchestration, audit
  │
Domain + persistence          shared records, SQLite schema, migrations,
(server/domain, server/db)    audit trail, status state machine
  │
Connectors                    SalesforceConnector, MailConnector, DocumentConnector,
(server/connectors)           WorkflowConnector, VendorSignalConnector
                              — mock now, real later, chosen by environment mode
```

**Hard rule:** UI never calls a connector directly. UI → API → service → domain
→ connector. The execution guard is the only path to an external write.

## 3. Environment modes

| Mode | Reads | Writes / execution | Data |
| --- | --- | --- | --- |
| `MOCK` (default) | mock connectors | simulated only, no external writes | fictional animal data |
| `CONNECTED_READ_ONLY` | approved external systems | none | real reads |
| `CONNECTED_CONTROLLED` | approved external systems | approved, permissioned | real |

The mode is chosen by `SHOREVEST_ONE_MODE`. Same execution guard runs in every
mode — MOCK simply resolves the guard through mock connectors. No demo shortcuts.

Compact banner copy: `Internal Preview · Mock connectors · External execution off`.

## 4. Build order (this pass prioritises the Outreach vertical slice)

1. ✅ Config + environment modes.
2. ✅ SQLite database, migration runner, repositories.
3. ✅ Domain: stable IDs, centralized status state machine, permissions.
4. ✅ Connector interfaces + 5 mock connectors + DI factory.
5. ✅ Services: audit, execution guard (idempotency + partial failure), outreach,
   approvals, work items.
6. ✅ Deterministic seed (≥100 people, ≥30 institutions, duplicates, missing
   emails, restrictions, declines, saved searches, lists, packages, messages,
   replies).
7. ✅ HTTP API surface + static app serving.
8. ✅ Frontend app for the Outreach slice + My Work + Approvals + Audit.
9. ✅ Tests: unit (transitions, guard, idempotency, partial failure, permissions,
   concentration, duplicates), integration (API + persistence + audit), e2e
   (full outreach flow, persistence across restart).
10. ✅ Docs: `.env.example`, connector integration guide, blockers.

Workspaces beyond Outreach are production-shaped shells backed by the same
persisted data and the same API — not dead galleries.

## 5. Definition of done for this pass

- Restarting the server preserves workflow state (SQLite file on disk).
- Two views reflect a change to the same underlying record (shared domain model).
- Every core Outreach action hits the service/API layer.
- Every material action writes an audit event.
- Approval versions can be invalidated by editing a draft after approval.
- Mock execution uses the **same** connector interface future real execution will.
- Duplicate execution is prevented (idempotency keys).
- Failed rows can be repaired.
- Tests prove the full workflow.
- Swapping mock → real connectors is an integration task, not a redesign.

See `BLOCKERS.md` for what must happen before a connected pilot.
