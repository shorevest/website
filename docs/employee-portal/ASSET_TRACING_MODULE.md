# ShoreVest One — Cross-Border Asset Tracing module

## Status

Phase 1B synthetic demonstration scaffold with guided workflow, accessibility hardening and browser QA. This is not a production investigative system.

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
- finding-to-source lineage with stable synthetic source labels
- a full source register with exact reference/page fields
- a controlled browser print layout
- synthetic JSON export for demonstration testing

## Guided workflow

Each case shows a simple five-step path:

1. **Overview** — add the subject and confirm the decision being supported.
2. **Sources** — log the evidence and exact reference.
3. **Findings** — create conclusions linked to their sources.
4. **Review** — complete second-person review, score and approval checks.
5. **Report** — review the source-linked preliminary output.

The case page shows one recommended next action based on the actual missing information. Completed steps receive a visible check mark. The case queue explicitly tells the user to select a row and labels each row with “Open case”.

The new-case drawer:

- marks the five required fields
- explains each field in plain language
- identifies the deadline as optional
- requires a reviewer different from the owner
- keeps **Create case** disabled until the required information is complete
- announces how many required fields remain

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
- `assets/js/employee-portal/views-asset-tracing-report.js` — finding-to-source lineage, source register and print action.
- `assets/js/employee-portal/asset-tracing-interactions.js` — keyboard-safe case-list search behaviour.
- `assets/js/employee-portal/asset-tracing-accessibility.js` — dynamic labels, table semantics and drawer accessibility.
- `assets/js/employee-portal/asset-tracing-usability.js` — guided steps, next-action card, clearer queue and case-form validation.
- `assets/css/employee-portal-asset-tracing.css` — core module responsive styles.
- `assets/css/employee-portal-asset-tracing-phase1b.css` — Phase 1B controls and responsive review layout.
- `assets/css/employee-portal-asset-tracing-report.css` — source-lineage and print layout.
- `assets/css/employee-portal-asset-tracing-usability.css` — workflow guidance and case-form usability styles.
- `tests/employee-portal-asset-tracing.test.js` — core static and model-level safety tests.
- `tests/employee-portal-asset-tracing-phase1b.test.js` — approval-gate, fresh-state and Phase 1B safety tests.
- `tests/employee-portal-asset-tracing-report.test.js` — report lineage, print and safety tests.
- `tests/employee-portal-asset-tracing-accessibility.test.js` — dynamic accessibility tests.
- `tests/employee-portal-asset-tracing-usability.test.js` — guided workflow and case-form usability tests.
- `scripts/qa-asset-tracing-browser.cjs` — desktop and mobile headless-browser workflow QA.

## 0–3 screening score

- **0 — None identified:** no meaningful lead in the sources actually searched. This is not proof that no asset exists.
- **1 — Limited:** weak, historical or indirect clues.
- **2 — Meaningful:** credible leads requiring targeted verification.
- **3 — Strong:** confirmed or well-corroborated current asset leads.

The score is a screening output, not a legal, valuation or recoverability opinion. Approval requires a named second-person reviewer and written rationale.

## Next build sequence

1. Review the synthetic workflow and report structure with the business team.
2. Add production authentication, server-side authorisation and restricted storage.
3. Replace browser storage with the production case database and audit service.
4. Add controlled file ingestion and page-level evidence references.
5. Add enterprise AI-assisted extraction and cited drafting.
6. Add approved public-source research workflows and selected licensed connectors.
