# ShoreVest One — internal operating platform

> **Naming:** the product is presented to users as **ShoreVest One**. The
> `employee-portal/` folder and URL path are retained as the current *legacy
> implementation path* for ShoreVest One to avoid routing/deployment risk; a
> folder rename is intentionally out of scope for now. Internal code namespaces
> (`SVOps`, `ops-*`, `svops`) are unchanged. Do not reintroduce the user-facing
> names "Employee Portal" or "ShoreVest Operations" in rendered copy.

A private internal operating platform for ShoreVest personnel. It provides one
controlled entry point for routine list processing, weekly reporting, Salesforce
data quality, and outreach preparation. The public ShoreVest website is only the
entry point; all operational functions live inside this authenticated
application.

> **Central operating principle:** the system may stop unnecessarily, but it
> must never continue incorrectly. Ambiguous, incomplete, duplicate, or
> unauthorised work is stopped or routed to review — never guessed.

## Where it lives

| Path | Purpose |
| --- | --- |
| `employee-portal/index.html` | Portal entry page. Loads the scripts and mounts the app. `noindex`. |
| `assets/css/employee-portal.css` | Portal stylesheet — institutional design system (DIN 2014 / Spectral, ShoreVest red, charcoal/gray). |
| `assets/js/employee-portal/portal-config.js` | **Deployment configuration — placeholders only.** Tenant URLs, client IDs, flow URLs, script IDs. Every value is an `ENV:*` placeholder. |
| `assets/js/employee-portal/rules.js` | Pure rules engine: error codes, column mapping, file/row validation, classification, reconciliation, execution keys, NL interpreter. No DOM, no network. |
| `assets/js/employee-portal/files.js` | File sniffing (byte-level), CSV parser, dependency-free minimal `.xlsx` reader, SHA-256 hashing. |
| `assets/js/employee-portal/store.js` | Demonstration workflow store implementing the Dataverse entity contract (localStorage). Replaced by the Dataverse adapter in production. |
| `assets/js/employee-portal/integrations.js` | Adapters for Entra ID, Dataverse, SharePoint, Power Automate, Salesforce, Office Scripts — fail-closed, with pre-flight checks. |
| `assets/js/employee-portal/ui.js` | Small DOM helpers and the view registry. |
| `assets/js/employee-portal/workflow.js` | Demonstration processing engine: the executable specification of the Power Automate `processBatch` flow (stages, workbook, approvals, idempotent execution). |
| `assets/js/employee-portal/views-*.js` | Process a List wizard, Review Exceptions, Previous Runs, Administration, Monitoring, reporting modules, HR drafts, and the website media library tool. |
| `assets/js/employee-portal/app.js` | Application shell: authentication gate, navigation, hash router, dashboard. |
| `tests/employee-portal-rules.test.js` | Node test suite (`node tests/employee-portal-rules.test.js`). |

The public site links to the platform from a footer **Access** group (Investor
Portal + ShoreVest One) added to every page and to the shared footer
(`assets/js/shared-footer.js`). The ShoreVest One link opens in a new tab and
still points at `employee-portal/index.html` (the legacy path).

## Demonstration mode vs. production

`portal-config.js` ships with `mode: 'demo'`. In demo mode the portal runs
entirely in the browser with synthetic data and performs **no external calls** —
no emails, no Salesforce changes, no tenant connections. This lets the full
workflow be exercised and reviewed safely.

To run in production:

1. Replace every `ENV:*` placeholder in `portal-config.js` with the matching
   environment variable / Key Vault secret (tenant ID, client ID, flow URLs,
   SharePoint site, Dataverse URL, Office Scripts IDs, sender addresses).
2. Set `mode: 'production'`.
3. Bundle MSAL.js and wire `integrations.js` `EntraAuth` to it (the integration
   points and token/role mapping are documented inline).

Nothing tenant-specific — no credentials, tokens, account IDs, template IDs,
folder locations, Salesforce object IDs, owner IDs, sender addresses, or
security roles — is committed to this repository.

## Backend architecture (production)

```
Public ShoreVest website  ──▶  Employee Portal (this app, new tab)
                                     │
                     Microsoft Entra ID (MSAL, PKCE, MFA, RBAC)
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                             ▼
  Power Automate            Dataverse (control DB)          SharePoint
  (orchestration)          Batches / Rows / Audit        source + outputs
        │                   SavedProcess / Config              │
        ├─▶ Office Scripts (Excel parse + workbook generation) │
        └─▶ Salesforce connector (matching + approved writes) ─┘
```

- **Entra ID** is the only authentication path — no separate username/password.
  MFA and Conditional Access are enforced by tenant policy. App roles map to the
  six portal roles; group membership is handled by app-role assignment.
- **Power Automate** flows orchestrate processing. Each flow validates the caller
  token and the batch lock before acting. Retries are idempotent via the
  execution-key registry.
- **Dataverse** is the workflow and control database and the source of truth for
  approvals — never an edited spreadsheet cell.
- **SharePoint** holds the immutable source files and generated outputs.
- **Office Scripts** parse workbooks and generate the controlled output workbook.
- **Salesforce** is reached only through the managed connector inside flows; the
  browser never holds Salesforce credentials.

## Data model (Dataverse entities)

`ProcessingBatch`, `ProcessingRow`, `SavedProcess`, `Configuration`,
`AuditEvent`, plus the execution-key registry. Field lists are implemented in
`store.js` and mirror the specification exactly. Raw source values, normalised
values, final values, mapping decisions, validation results, matching results,
review decisions, and execution history are all preserved per row; raw source
data is stored once and never overwritten.

## Control mechanisms

| Concern | Mechanism |
| --- | --- |
| Unconfirmed NL instructions | Interpreter produces *proposed settings only*; a mandatory "I understood your request as follows" screen must be confirmed before processing. External actions are never enabled from text. |
| Fail-closed defaults | Dry run defaults **Yes**; Prepare draft emails / Create Salesforce actions / Update Salesforce default **No**. Saved processes cannot pre-enable external actions. |
| Classification | Every row ends in exactly one status via strict precedence: Blocked → Invalid → Duplicate → Review Required → System Error → Ready. |
| Reconciliation | `Input = Ready + Review + Duplicate + Blocked + Invalid + System Error`, checked exactly. A mismatch fails the batch and disables execution. |
| Duplicate-action prevention | Every external action has a unique execution key (`Batch + Row + Action + Recipient + TemplateVersion`). A key that exists (or is mid-flight) blocks the repeat and is classified *Already Executed*. |
| Batch locking | One process modifies a batch at a time; a lock records Batch/Flow-run/Locked-by/Locked-at/Version. |
| Execution conditions | A row executes only when all conditions hold (approved, Ready, review approved, not dry run, sender authorised, template approved, recipient valid, suppression/owner/duplicate checks passed, batch version matches). |
| Approvals | Three levels — data, relationship-owner, execution — recorded in the portal with reviewer, time, and reason. Consequential buttons stay disabled until conditions are met. |
| Configuration changes | Every change is audited; changing configuration after approval flags the batch for revalidation before execution. |
| Connections | Managed connection references (primary + backup); pre-flight verifies every connection, and any unavailable connection disables execution. Connections are never switched mid-write without checking whether the original action succeeded. |

## Roles and permissions

Employee · IR Operations · Relationship Manager · Execution Approver ·
Administrator · Management/Auditor. The capability matrix is in `rules.js`
(`PERMISSIONS`); every UI surface and action gate checks a capability, never a
role name. Employees see only their own batches; Administration and Monitoring
are hidden unless the role permits them.

## Website media library tool

The Tools hub includes **Website Media Library**, a demonstration-only staging
workflow for public-site media candidates. Administrators can choose an image or
PDF, add title/alt text/intended use/rights/source metadata, and run suitability
checks before a candidate can be staged. The checks cover approved formats, file
size, accessibility text, intended placement, rights confirmation, image
resolution, and obvious sensitive markers such as confidential/draft/password
labels. Staged records are stored in the demo configuration key
`siteMediaLibrary` with audit events; removing a candidate is also audited. The
tool does not publish files or modify public website assets until a deployment
backed publishing service is connected.

## Generated workbook

Produced from a controlled template with a fixed worksheet order: `README`,
`BATCH SUMMARY`, `READY`, `REVIEW REQUIRED`, `DUPLICATES`, `BLOCKED`, `INVALID`,
`SOURCE DATA`, `AUDIT LOG`, `CONFIG SNAPSHOT`. In production Office Scripts build
a protected `.xlsx` (tables, filters, frozen headers, protected system fields,
no external links, no macros). In demo mode the same contract is rendered as a
downloadable text export. The workbook is an output and review surface — never
the primary workflow database.

## Testing

`node tests/employee-portal-rules.test.js` covers column detection and
alternative headers, header-row detection, the file-validation rejections
(empty, corrupted, password-protected, unsupported, oversize, over-row-limit,
already-processed, ambiguous header, macros, external links, configuration
unavailable), email/normalisation, per-row validation and the full
classification precedence, reconciliation (balanced and mismatch), execution
keys and conditions (double-click / retry / version-mismatch), batch locking,
the NL interpreter (proposals without enabling external actions, owner mapping,
unknown-owner routing), CSV/`.xlsx` parsing, and the permission matrix.

Browser end-to-end behavior (upload → interpret → confirm → process →
reconcile → review → disabled execution) was verified with Chromium against a
local static server. To reproduce locally:

```bash
python3 -m http.server 8000
# open http://localhost:8000/employee-portal/index.html
```

Sign in with any demonstration role to explore; each role sees only what its
permissions allow.

## Sample data for demonstration

All demonstration reference data is synthetic and clearly labelled. The demo
Salesforce index uses the `@demo-institution.crm` domain. Useful demo emails:

- `existing.contact@demo-institution.crm` — single Salesforce match.
- `ambiguous@demo-institution.crm` — multiple matches → Review Required (E006).
- `opted.out@example.com` — suppressed → Blocked (E008).
- `live.process@demo-institution.crm` — existing live process → Review (E011).
- any `@blocked-domain.example.com` address — Blocked (E009).
