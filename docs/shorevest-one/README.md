# ShoreVest One — production-shaped application

ShoreVest One is a working internal application running on **fictional data** and
**mock connectors**, built with the same architecture the connected system will
use. Connecting Salesforce / Outlook / SharePoint / Power Automate later means
implementing a connector, not rebuilding the product.

- Architecture, audit, and plan: [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)
- Connector integration guide: [`CONNECTORS.md`](./CONNECTORS.md)
- Remaining blockers before a connected pilot: [`BLOCKERS.md`](./BLOCKERS.md)

## Layers

```
app/                 UI — pages, tables, forms (calls /api only)
server/api/          typed HTTP API + auth adapter
server/services/     workflow commands, validation, permissions, audit, guard
server/domain/       stable IDs, status state machine, permissions
server/db/           SQLite persistence + migrations + repositories
server/connectors/   interfaces + mock implementations + DI factory
server/seed/         deterministic fictional seed
tests/shorevest-one/ unit + integration + e2e
```

## Commands

```bash
npm run one:migrate   # apply database migrations
npm run one:seed      # (re)seed deterministic fictional data
npm run one:dev       # run the app (auto-seeds an empty MOCK database)
npm run one:test      # unit + integration + e2e tests
npm run one:build     # migrate + test (production build gate)
```

Then open the printed URL (default `http://127.0.0.1:4319`). Use the **Acting as**
switcher (top-right) to change preview user/role — permission checks still run.

## Environment modes

Set `SHOREVEST_ONE_MODE`:

- `MOCK` (default) — fictional data, mock connectors, no external writes.
- `CONNECTED_READ_ONLY` — reads from approved external systems (connectors
  required); execution off.
- `CONNECTED_CONTROLLED` — approved, permissioned writes and execution.

See [`../../.env.example`](../../.env.example). No secrets are committed; real
values come from a secret manager at deploy time.

## Working slice

Outreach is the fully working vertical slice: find people → review issues →
choose actions → prepare messages → build & submit approval package → approve →
request guarded execution (mock connectors, with deterministic partial failures)
→ Sent & responses update → full audit trail. My Work and Approvals are
functioning shared queues over the same records. Relationships is a read view of
the shared people. Meetings, Diligence, and Investor Intelligence are
production-shaped shells backed by the same database.
