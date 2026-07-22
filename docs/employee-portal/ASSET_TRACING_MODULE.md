# ShoreVest One — Cross-Border Asset Tracing module

## Status

Phase 1B synthetic demonstration scaffold. This is not a production investigative system.

## Purpose

Provide a controlled preliminary screening workflow for personal-guarantor and related-party matters so ShoreVest can decide whether a matter justifies targeted records, a full external asset trace, legal review or no further work at the current stage.

The module does not replace an investigator, lawyer, valuer or enforcement specialist.

## Current demonstration scope

The browser-local prototype supports:

- case intake and decision question
- named owner and separate second-person reviewer
- subjects, aliases, jurisdictions and identity confidence
- source metadata and scoped search results
- explicit jurisdiction-by-jurisdiction research coverage
- findings with ownership/link type, evidence confidence and source references
- finding-level second-person review state
- named next steps and status
- a 0–3 preliminary lead score with written rationale
- a hard approval gate that cannot be bypassed through the status selector
- audit history and preliminary report preview
- synthetic JSON export for demonstration testing

Approval requires:

1. different named owner and reviewer
2. at least one source and one finding
3. a source link on every finding
4. every finding marked Reviewed
5. a 0–3 score and written rationale
6. a stated decision question and scope

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
- `assets/js/employee-portal/asset-tracing-phase1b.js` — research coverage, next steps, finding review and hard approval controls.
- `assets/js/employee-portal/views-asset-tracing.js` — dashboard, case workspace, source log, findings, review and report preview.
- `assets/js/employee-portal/views-asset-tracing-phase1b.js` — Phase 1B planning, review and approval interface.
- `assets/js/employee-portal/asset-tracing-interactions.js` — keyboard-safe case-list search behaviour.
- `assets/css/employee-portal-asset-tracing.css` — core module responsive styles.
- `assets/css/employee-portal-asset-tracing-phase1b.css` — Phase 1B controls and responsive review layout.
- `tests/employee-portal-asset-tracing.test.js` — core static and model-level safety tests.
- `tests/employee-portal-asset-tracing-phase1b.test.js` — approval-gate, fresh-state and Phase 1B safety tests.

## 0–3 screening score

- **0 — None identified:** no meaningful lead in the sources actually searched. This is not proof that no asset exists.
- **1 — Limited:** weak, historical or indirect clues.
- **2 — Meaningful:** credible leads requiring targeted verification.
- **3 — Strong:** confirmed or well-corroborated current asset leads.

The score is a screening output, not a legal, valuation or recoverability opinion. Approval requires a named second-person reviewer and written rationale.

## Next build sequence

1. Review the synthetic workflow and report structure with the business team.
2. Add source-lineage display to the report preview and a printable internal draft view.
3. Add production authentication, server-side authorisation and restricted storage.
4. Replace browser storage with the production case database and audit service.
5. Add controlled file ingestion and page-level evidence references.
6. Add enterprise AI-assisted extraction and cited drafting.
7. Add approved public-source research workflows and selected licensed connectors.
