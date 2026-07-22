# ShoreVest One — Cross-Border Asset Tracing module

## Status

Phase 1 synthetic demonstration scaffold. This is not a production investigative system.

## Purpose

Provide a controlled preliminary screening workflow for personal-guarantor and related-party matters so ShoreVest can decide whether a matter justifies targeted records, a full external asset trace, legal review or no further work at the current stage.

The module does not replace an investigator, lawyer, valuer or enforcement specialist.

## Current demonstration scope

The browser-local prototype supports:

- case intake and decision question
- named owner and second-person reviewer
- subjects, aliases, jurisdictions and identity confidence
- source metadata and scoped search results
- findings with ownership/link type, evidence confidence and source references
- a 0–3 preliminary lead score with written rationale
- review checks, audit history and preliminary report preview
- synthetic JSON export for demonstration testing

## Data rule

Everything committed to this public repository is synthetic.

Do not add:

- real guarantor, family or associate names
- real identifiers, addresses or contact details
- confidential investigation reports or excerpts
- real asset, litigation, banking or transaction information
- legal advice, privileged material or human-source allegations

The current module stores only synthetic structured data in browser `localStorage`. It does not upload files, call an API, scrape a website, send a message or perform an external action.

## Production blockers

Real case use requires the separately hosted ShoreVest One production foundation:

1. Microsoft Entra sign-in with assigned users.
2. Server-side token, role and case-level permission checks.
3. Restricted SharePoint/OneDrive case storage.
4. Managed database and immutable audit history.
5. Approved enterprise AI service with no training on ShoreVest case data.
6. Retention, legal-hold, privilege and external-sharing policy.
7. Source-by-source approval for licensed data, registry access and any web automation.
8. Word/PDF report generation from an approved, frozen source snapshot.

## File map

- `assets/js/employee-portal/asset-tracing.js` — schema, constants, synthetic fixtures and browser-local store.
- `assets/js/employee-portal/views-asset-tracing.js` — dashboard, case workspace, source log, findings, review and report preview.
- `assets/css/employee-portal-asset-tracing.css` — module-specific responsive styles.
- `tests/employee-portal-asset-tracing.test.js` — static and model-level safety tests.

## 0–3 screening score

- **0 — None identified:** no meaningful lead in the sources actually searched. This is not proof that no asset exists.
- **1 — Limited:** weak, historical or indirect clues.
- **2 — Meaningful:** credible leads requiring targeted verification.
- **3 — Strong:** confirmed or well-corroborated current asset leads.

The score is a screening output, not a legal, valuation or recoverability opinion. Production approval must require a named reviewer and written rationale.

## Next build sequence

1. Validate the information architecture and report output with the business team using synthetic data.
2. Add production authentication, server-side authorisation and restricted storage.
3. Replace browser storage with the production case database and audit service.
4. Add controlled file ingestion and page-level evidence references.
5. Add enterprise AI-assisted extraction and cited drafting.
6. Add approved public-source research workflows and selected licensed connectors.
