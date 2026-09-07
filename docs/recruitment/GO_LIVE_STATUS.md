# Recruitment careers/application — go-live status

Status: **contained and not ready for public candidate capture.** Both public
switches are disabled while the committed backend, deployed Function package,
and malware-scanning path are reconciled and verified.

## Current safe state

- `openRolesEnabled: false`: public role listings stay hidden.
- `applicationsEnabled: false`: direct application URLs cannot submit.
- The configured API is the Azure **test** Function App. It must not receive real
  candidate data or be described as production.
- CV storage remains private. Browser uploads use a short-lived, write-only SAS
  for one quarantine blob; only verified-clean documents may be read by HR.

## Confirmed source/deployment mismatch

The application client already uses the three-stage protocol:

1. `POST /applications/initiate`
2. upload the CV to the returned blob-specific SAS, then
   `POST /applications/complete`
3. read `finalizationToken` from the completion response and
   `POST /applications/finalize`

The backend previously committed to the website repository exposed only
`initiate` and `complete`, returned no `finalizationToken`, did not register the
`finalize` route, and did not allow the token through the public response filter.
The deployed test Function contained newer code, so it could not be reproduced
from the repository.

The reconciliation change imports the exact deployed runtime contract onto
current `main`, including:

- bound, short-lived finalization tokens;
- an idempotent `finalizeApplication` flow;
- explicit privacy and accuracy confirmation;
- finalization-gated notifications and projection;
- the `/applications/finalize` Function route;
- response filtering for `finalizationToken` and `alreadyFinalized`;
- real Turnstile and endpoint-scoped rate limiting;
- HR clean-document access and retention controls;
- immutable Function packaging and cross-layer contract tests.

No new signing secret or Cosmos schema migration is required.

## Malware scanning blocker

The deployed Defender scan topic has not produced verdicts and test uploads have
remained `ScanPending`. The self-hosted ClamAV path is retained, but hardened so
that it uses the reconciled backend adapters and wrapped scan flow. It now:

- reads the file by the current file-reference contract;
- rejects oversized or incomplete reads rather than scanning a prefix;
- preserves retryable queue messages;
- moves exhausted messages to a dedicated poison queue only after that write
  succeeds; and
- moves a scan-pending record to `ManualReview` on persistent engine failure.

The scanner Bicep is part of CI and the deployed container must be referenced by
an immutable registry digest.

## Required launch evidence

Use synthetic data only. Record no candidate fields, CV content, SAS URLs, or
tokens in logs or screenshots.

1. Deploy the reconciled Function package from a recorded Git SHA to the test
   environment and verify all required Functions are indexed.
2. Deploy the scanner and confirm the event queue, poison queue, managed-identity
   access, and no-ingress Container App.
3. Run the browser flow with a metadata-scrubbed synthetic PDF:
   `initiate → upload → complete → finalize`.
4. Confirm completion returns a non-empty finalization token, finalization is
   idempotent, and tampered/cross-application tokens fail.
5. Confirm a clean file progresses `ScanPending → Ready`, exists only in the
   clean container after promotion, and is available through authenticated HR
   access for the exact synthetic reference.
6. In the isolated test environment, confirm an EICAR-containing valid test
   document progresses to `Blocked` and is never promoted or retrievable.
7. Confirm candidate/team notifications go only to controlled ShoreVest test
   mailboxes and contain no CV attachment or storage URL.
8. Remove only the exact synthetic test records and blobs under the approved
   retention procedure. Never enumerate, download, or bulk-delete other records.
9. Deploy a separately verified production environment and update `apiBase`.
10. Enable `applicationsEnabled` and `openRolesEnabled` only in the final launch
    change after every item above has evidence tied to the deployed SHA.

## Prior test claims

Earlier status text combined two different claims: a browser submission reached
“Application received,” while the uploaded CV remained `ScanPending`. That is not
a completed end-to-end test. Launch evidence requires the clean and malicious
security outcomes, authenticated reviewer access, and a reproducible committed
deployment—not only a successful HTTP submission.
