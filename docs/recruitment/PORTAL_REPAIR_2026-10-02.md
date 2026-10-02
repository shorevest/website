# Careers portal repair — 2 October 2026 UTC

## Current status

Source fixes are prepared for review. This change does not launch recruitment.

Read-only HTTP checks on 2 October 2026 UTC confirmed:

- The live public config still has `applicationsEnabled: false` and
  `openRolesEnabled: false`.
- `svrc26hk-recruit-fn-test` reports an active runtime, valid configuration and
  ready Cosmos, storage and secret dependencies through its health endpoint.

A healthy API is not evidence that CV scanning, reviewer access or delivery
works. No application, CV upload, notification or Azure configuration change was
made during these checks. The configured Function is still the test environment.

## Source fixes

- The application client keeps its submission ID and completed stages in memory.
  Retrying a lost response resumes the same application, including when the
  server already accepted finalization. It does not repeat a verified upload.
- After an ambiguous finalization response, candidate fields stay locked to the
  submitted snapshot and the action becomes **Retry submission**. The error
  explains that the page must remain open. Nothing is persisted in browser
  storage; closing/reloading the page still ends this recovery session.
- Every API stage requires an explicit successful response. Completion and
  finalization must refer to the expected application and file. Missing tokens,
  empty responses and mismatched references cannot produce a success message.
- Desktop and mobile language links retain the selected role and allowed source
  in both languages.
- The submit handler binds before Turnstile finishes loading. An early click
  displays the verification error instead of submitting/reloading the page.
- Frontend file-type and LinkedIn validation now match the relevant backend
  restrictions. The form instruction is hidden when the form is unavailable or
  the application has been received.

## Validation and limits

`tests/recruitment-application-client.test.js` drives the real browser entry
point with a DOM fixture and the committed recruitment core using synthetic,
in-memory adapters. Cases cover lost responses at every stage, duplicate clicks,
malformed confirmations, missing finalization tokens, both language controls,
disabled capture and a delayed verification script. It is included in the normal
recruitment test command.

This is not a live Azure upload test or a real-browser rendering test. The
available Chromium installer returned invalid archives, so desktop/mobile visual
verification remains outstanding. No layout or stylesheet changes are included.

## Exact Azure administrator handoff

The last authenticated scanner repair evidence is the
[16 September run](https://github.com/shorevest/website/actions/runs/35076901057).
Its effective readback still showed the wrong scan cap and no clean-container
exclusion, following `MissingPermissions` / `AuthorizationFailed`. The health
check above does not revalidate that permission or those effective settings.

Ask the Azure administrator to resolve the denied action under the tenant's
access policy, or perform the scoped correction with an already-authorized
administrator identity:

| Item | Recorded value |
| --- | --- |
| Required action | `Microsoft.Security/datascanners/write` |
| Deployment principal object ID | `28501512-ccad-4bc0-8a65-6d2adfcfa902` |
| Deployment client ID | `2a5392be-62d3-44ad-8581-0ab5966b4964` |
| Scanner scope | `/subscriptions/4146f1fc-590f-4ee4-a7b7-57f15c08c74e/providers/Microsoft.Security/datascanners/StorageDataScanner` |
| Recruitment resource group | `rg-shorevest-recruitment-test-eastasia` |
| CV storage account | `svrc26hkcvtest` |

Apply only the existing recruitment account's intended settings: 1 GB monthly
scan cap, exclusion of `recruitment-clean/`, result tags disabled, automatic
deletion disabled and sensitive-data discovery disabled. Preserve the existing
Event Grid destination and all public-capture, delivery, HR and retention gates.
Do not enable subscription-wide paid protection or grant a broad Owner role as
a shortcut. A permission failure remains a stop condition.

The administrator can obtain the effective account settings with this read-only
command after verifying the signed-in tenant/subscription:

```bash
az rest --method get --url 'https://management.azure.com/subscriptions/4146f1fc-590f-4ee4-a7b7-57f15c08c74e/resourceGroups/rg-shorevest-recruitment-test-eastasia/providers/Microsoft.Storage/storageAccounts/svrc26hkcvtest/providers/Microsoft.Security/defenderForStorageSettings/current?api-version=2025-07-01-preview'
```

Require matching effective settings and no scanner operation error before
synthetic uploads. Microsoft documents the account-level contract in
[Defender for Storage REST API configuration](https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-storage-rest-api-enablement).

Then complete the existing [launch evidence checklist](GO_LIVE_STATUS.md): clean
and malicious synthetic document outcomes, authenticated clean-only HR access,
controlled notifications, exact-reference cleanup, and a separately verified
production deployment. Only the final verified launch change may enable public
applications and listings.
