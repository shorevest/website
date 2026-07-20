# Recruitment application backend — contract and design

Status: **design and contract only. No backend is deployed.** The ShoreVest website is a
static site with no compatible live-backend deployment path, so this document defines the
server-side contract planned for Phase 2, and the reference scaffold under
[`api/`](../api/README.md) preserves useful validation/orchestration logic in reviewable form. Nothing here
is live. Phase 1.1 does not include a public application page or frontend form; application submission stays disabled until the backend
is built, deployed, tested, and approved.

This document complements — it does not replace — the authoritative first-party Azure build
specification in [`docs/recruitment/PHASE_1_BUILD_SPEC.md`](recruitment/PHASE_1_BUILD_SPEC.md).

## 1. What is implemented today (frontend)

- Manifest-driven bilingual role listing (`assets/js/recruitment-role-list.js`) with the public
  open-roles flag defaulting off.
- Reusable role-detail renderer (`assets/js/recruitment-role-detail.js`) that renders role
  content with `textContent`, hides draft roles by default, and supports `?preview=1` for
  internal draft-page review.
- No public application pages, application form, upload control, email fallback, or success mock
  are currently shipped. The former `careers/apply.html`, `careers/apply_cn.html`, and
  `assets/js/recruitment-application.js` Phase 1 prototype were intentionally left out of
  Phase 1.1 until the secure Phase 2 architecture is approved.

## 2. Endpoint

Configurable, same-origin, approved endpoint — set via `data-recruitment-endpoint` on the
application page `<body>`. Example value once live:

```
/api/recruitment/applications
```

- Method: `POST`
- Encoding: `multipart/form-data`
- Transport: HTTPS only.
- When the attribute is empty (its checked-in state), the frontend treats the backend as
  unavailable and shows a neutral failure. No employee email address and no third-party form
  provider is ever hard-coded.

## 3. Request fields (multipart)

| Field | Source | Trust |
| --- | --- | --- |
| `roleId` | manifest-selected | validated server-side against the authoritative manifest |
| `roleTitle`, `roleTeam`, `roleLocation` | manifest (debug/compare only) | **untrusted** — the backend overwrites these from its own manifest |
| `locale` | document | validated (`en` / `zh-CN`) |
| `source` | normalized referral | attribution only; allowlist `website`/`linkedin`/`direct`/`other`, else `direct` |
| `fullName`, `email`, `location`, `applicationStatement` | candidate | required; validated |
| `telephone`, `linkedinUrl` | candidate | optional; validated if present |
| `privacyAccepted` | candidate | must be `true` |
| `privacyNoticeVersion` | page constant | recorded (`recruitment-privacy-draft-2026-07`) |
| `submittedAtClientUtc` | client clock | recorded (untrusted) |
| `applicationPageVersion` | page constant | optional diagnostic |
| `cv` | candidate | required file; re-validated + signature-checked + scanned server-side |

The backend must treat server-side manifest/database data as authoritative and must never
trust `roleTitle`, `roleTeam`, or `roleLocation` from the browser.

## 4. Responses

Success:

```json
{ "success": true, "applicationReference": "SV-2026-000001" }
```

Controlled failure:

```json
{ "success": false, "errorCode": "ROLE_NOT_OPEN" }
```

Supported future error codes (to be mapped to neutral candidate-facing messages by the Phase 2 client):

`ROLE_NOT_FOUND`, `ROLE_NOT_OPEN`, `ROLE_CLOSED`, `APPLICATION_DEADLINE_PASSED`,
`VALIDATION_FAILED`, `FILE_MISSING`, `FILE_TYPE_REJECTED`, `FILE_TOO_LARGE`,
`FILE_SIGNATURE_REJECTED`, `RATE_LIMITED`, `MALWARE_SCAN_FAILED`, `STORAGE_FAILED`,
`SUBMISSION_FAILED`.

Responses must never contain stack traces, HTTP bodies from upstream services, storage
errors, Microsoft Graph errors, SharePoint paths, internal IDs, or raw exception messages.

## 5. Server-side processing pipeline

Reference implementation: [`api/recruitment/handler.js`](../api/recruitment/handler.js)
(validation in [`api/recruitment/applicationValidation.js`](../api/recruitment/applicationValidation.js),
signatures in [`api/recruitment/fileSignatures.js`](../api/recruitment/fileSignatures.js)).

1. Accept HTTPS multipart with strict request-size limits (enforced at the host/binding).
2. Parse fields safely.
3. Validate `roleId` (safe slug).
4. Read the authoritative, server-bundled role configuration.
5. Confirm the role is `active`.
6. Confirm `applicationEnabled` is `true`.
7. Confirm the deadline has not passed.
8. Validate all text fields; bound lengths.
9. Normalize the email cautiously (trim; lowercase domain only).
10. Validate the LinkedIn URL if supplied.
11. Validate file presence, size, extension, MIME, and **actual byte signature**
    (PDF `%PDF-`, OLE `D0CF11E0…`, ZIP/`docx` `PK…`).
12. Reject path traversal in the declared filename.
13. Generate a randomized stored filename `{applicationReference}-{randomId}.{ext}`; the
    original name is kept only as controlled metadata.
14. Store the CV in restricted (private, non-public) storage / quarantine; scan for malware
    before any reviewer can reach it. Never a public link; never an email attachment.
15. Apply rate limiting and bot/spam controls.
16. Create a structured application register record.
17. Return a non-sensitive `applicationReference`.
18. Log operational events with minimal PII — never log CV bytes or full personal data.
19. Handle partial failure safely and idempotently (below).
20. Use managed identity / environment configuration for all secrets. No credentials are ever
    exposed to the frontend.

## 6. Idempotency and duplicate handling

Avoid duplicate application records when the candidate double-clicks, the browser retries after
a timeout, the backend succeeds but the response is lost, or a downstream flow retries.

- Use a **server-derived** idempotency key (e.g. a submission-session identifier). Do **not**
  use the applicant's email address alone as the deduplication key.
- Applying to more than one role with the same email must always be allowed.
- The frontend also guards against double submission (disabled submit button + in-flight lock),
  but the server key is the authoritative dedupe.

## 7. Local development / mock mode

No Phase 1.1 page includes a mock submission flow. If Phase 2 adds a development mock, it must
require both an explicit opt-in and a non-production host, and tests must assert that production
can never fake success.

## 8. Security assumptions for the production backend

- HTTPS only; managed identity where available; environment-specific configuration.
- Restricted SharePoint / storage permissions; private upload storage only.
- File scanning; request-size limits; rate limiting; bot protection; strict input validation.
- Structured logging with minimal personal data; audit trails; secret rotation.
- Separate test and production environments; no production CVs in local development.
- Do not implement a weak security substitute merely to complete the workflow.
