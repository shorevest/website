# Recruitment backend deployment runbook

This runbook deliberately separates backend deployment from public Careers launch. Completing these steps does not publish roles or expose an application form.

## Non-negotiable initial state

The first deployment must use all of the following values:

- `RECRUITMENT_API_ENABLED=false`
- `RECRUITMENT_OUTBOX_DELIVERY_ENABLED=false`
- `RECRUITMENT_CANDIDATE_ACK_ENABLED=false`
- `RECRUITMENT_CANDIDATE_ACK_TEMPLATE_APPROVED=false`
- `RECRUITMENT_HR_ACCESS_ENABLED=false`
- `RECRUITMENT_PLATFORM_AUTH_ENABLED=false`
- `careersOpenRolesEnabled=false`
- every role-level `application.enabled=false`
- `enableDefenderForStorage=false`

No later step may change the public website flags until the non-production acceptance suite is complete.

## Deployment order

### 1. Deploy base Azure resources

Deploy:

`infra/recruitment/main.bicep`

This creates the Function App, managed identity, identity-based host storage, CV storage, private quarantine and clean containers, Cosmos containers, Key Vault, monitoring, and the custom Event Grid topic.

Do not enable Defender yet. The scan-result Function must exist before its Event Grid subscription can be created.

### 2. Populate Key Vault

Create three independent high-entropy secrets through an approved administrative process:

- completion/finalization token signing secret;
- idempotency fingerprint HMAC secret;
- Cloudflare Turnstile verification secret.

Do not put values in source control, Bicep parameters, deployment output, Function App settings, or CI logs.

### 3. Deploy the Function package

Build and deploy `services/recruitment-functions/` to the package container created by the base template. Confirm the following Functions are indexed:

- `initiateApplication`
- `completeUpload`
- `finalizeApplication`
- `defenderScanResult`
- `quarantineCleanup`
- `outboxWorker`
- `hrCleanDocumentAccess`
- `health`

The API must still return unavailable because `RECRUITMENT_API_ENABLED=false`.

### 4. Apply authoritative runtime settings

Deploy:

`infra/recruitment/runtime-settings.bicep`

This replaces manual portal configuration with one controlled app-settings source. Leave every external enablement parameter false. SharePoint IDs and the acknowledgement mailbox remain blank until they are provisioned and approved.

### 5. Configure Microsoft Entra App Service Authentication

Create the approved Entra application registration and the `Recruitment.HR` application role, then deploy:

`infra/recruitment/hr-auth.bicep`

Public candidate endpoints remain anonymous. Easy Auth validates supplied Entra tokens and injects the trusted client principal. The HR document endpoint separately requires the exact `Recruitment.HR` role.

Verify that:

- HTTPS is required;
- the issuer is tenant-specific;
- allowed audiences are exact;
- token storage is disabled;
- an anonymous candidate endpoint remains anonymous;
- an anonymous HR endpoint request receives 401;
- an authenticated user without `Recruitment.HR` receives 403.

Only after those checks may `RECRUITMENT_PLATFORM_AUTH_ENABLED=true` be used in the runtime-settings deployment.

### 6. Provision Microsoft 365 resources and selected permissions

Follow `docs/recruitment/MICROSOFT_365_SETUP.md`.

Create exactly two generic SharePoint lists using:

`infra/recruitment/sharepoint-lists.v1.json`

Grant the Function identity selected write access to those two lists only. Restrict `Mail.ReadWrite` and `Mail.Send` to the approved recruitment mailbox. Record immutable site/list IDs and the approved mailbox in the runtime-settings parameters.

Keep outbox delivery and candidate acknowledgement disabled.

### 7. Connect Defender scan results to the Function

After the Function package is deployed, deploy:

`infra/recruitment/event-grid-subscription.bicep`

The subscription targets the `defenderScanResult` Azure Function resource directly and accepts only:

`Microsoft.Security.MalwareScanningResult`

It delivers one event per invocation and retries for up to 24 hours. Confirm the subscription is healthy before enabling malware scanning.

### 8. Enable Defender for Storage

Redeploy the base template with:

`enableDefenderForStorage=true`

Confirm:

- quarantine uploads are scanned;
- clean-container promotion does not create a scan loop;
- the Event Grid handler receives a clean test result;
- malicious and scan-failed files never become HR-readable;
- scan-result delivery failure is alerted and investigated before the 24-hour retry window expires.

### 9. Enable non-production delivery only

In a dedicated non-production environment, redeploy runtime settings with:

- real SharePoint IDs;
- the restricted test recruitment mailbox;
- `RECRUITMENT_OUTBOX_DELIVERY_ENABLED=true`;
- `RECRUITMENT_CANDIDATE_ACK_ENABLED=true`;
- `RECRUITMENT_CANDIDATE_ACK_TEMPLATE_APPROVED=true` only after copy approval;
- `RECRUITMENT_HR_ACCESS_ENABLED=true`;
- `RECRUITMENT_PLATFORM_AUTH_ENABLED=true`.

Keep `RECRUITMENT_API_ENABLED=false` until direct backend tests pass.

### 10. Run backend acceptance tests

Test at minimum:

- valid PDF and DOCX;
- extension/MIME/signature mismatch;
- oversized and empty files;
- expired and tampered completion/finalization tokens;
- duplicate initiation, completion, finalization and scan events;
- rate-limit exhaustion;
- Turnstile failure and provider outage;
- malicious, failed, timed-out and replayed scan results;
- clean-file promotion and quarantine cleanup retry;
- SharePoint projection replay;
- process crashes before candidate mail draft creation, after draft creation, after Cosmos checkpoint, and after send;
- wrong-role and anonymous HR document access;
- five-minute, read-only, one-Blob HR SAS;
- disabled API behavior;
- audit and alert visibility without candidate document content in logs.

### 11. Enable the non-production API

Only after the acceptance suite passes may the non-production runtime-settings deployment set:

`RECRUITMENT_API_ENABLED=true`

The production API remains disabled.

### 12. Production approval and deployment

Production enablement requires documented approval from HR, Legal, IT/Security, and the named support owner for:

- privacy and consent wording/version;
- file types, maximum size and count;
- retention/deletion and legal-hold rules;
- malicious-file incident treatment;
- cross-border data locations;
- candidate acknowledgement wording and mailbox;
- notification recipients;
- rate-limit threshold;
- monitoring and incident escalation.

Repeat the non-production deployment and acceptance sequence in production with the API still disabled. Enable the backend only after the production smoke test passes.

## Public launch remains the final step

Only after the production backend is proven may a separate frontend PR:

1. add the application form;
2. connect it to the deployed API;
3. enable approved role applications;
4. enable `careersOpenRolesEnabled`;
5. restore role pages to the sitemap and indexability.

Backend and public launch must not be merged as one change.
