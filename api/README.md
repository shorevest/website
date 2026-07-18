# `api/` — Recruitment backend reference scaffold (NOT deployed)

This directory holds a **reference-only** server-side scaffold for the recruitment
application endpoint. **It is not deployed and cannot receive traffic from this repository.**

## Why this is a scaffold, not a live backend

The ShoreVest website is a **static site** (root HTML files are live URLs; there is no build
step, no serverless configuration, no Azure Functions host, and no CI deploy for functions).
There is no compatible deployment path for a live backend in this repository. Rather than
force an incompatible framework into a static repo, this scaffold provides:

- `applicationValidation.js` — dependency-free, unit-tested server-side validation that mirrors
  and supersedes the client-side checks (role resolution, field validation, file
  extension/MIME/**signature** validation, safe filename generation, path-traversal guard).
- `fileSignatures.js` — magic-byte detection for PDF, legacy OLE `.doc`, and ZIP-based `.docx`.
- `handler.js` — a runnable, framework-agnostic orchestration reference showing the exact
  submission pipeline (rate limit → validate → store in restricted storage → create register
  record → acknowledge), with **all** side-effecting collaborators injected. It is deliberately
  **not** registered as an Azure Function (no `host.json` / `function.json`).

## What is intentionally absent

- No `host.json`, `function.json`, or any deployable trigger binding.
- No secrets, credentials, tenant IDs, storage keys, connection strings, or email addresses.
- No live SharePoint, Dataverse, Power Automate, or Microsoft Graph connection.

## Where to go next

The full production backend design, the frontend↔backend contract, the Microsoft environment
design (SharePoint document library, application register, Power Automate flows), security
assumptions, idempotency, and retention decisions are documented in:

- [`docs/recruitment-application-backend.md`](../docs/recruitment-application-backend.md)
- [`docs/recruitment/PHASE_1_BUILD_SPEC.md`](../docs/recruitment/PHASE_1_BUILD_SPEC.md) (the
  authoritative first-party Azure build specification)
- [`docs/recruitment-operations-setup.md`](../docs/recruitment-operations-setup.md)

Application submission remains **disabled** in the manifest (`applicationEnabled: false`) and
must stay disabled until the backend is deployed, tested, and approved.
