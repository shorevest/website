# Recruitment careers/application — go-live status

Status: **contained and not ready for public candidate capture.** Both public
switches are disabled. The backend finalization contract has been reconciled and
deployed; live scanner and application acceptance evidence remains outstanding.

## Verified state — 16 September 2026

[Read-only Azure verification](https://github.com/shorevest/website/actions/runs/35042224023)
confirmed:

- The test Function is healthy (`configuration: valid`, `dependencies: ready`).
- `initiateApplication`, `completeUpload`, `finalizeApplication` and
  `defenderScanResult` are indexed.
- The scan-result event subscription is provisioned successfully and targets the
  correct Function for `Microsoft.Security.MalwareScanningResult` events.
- Capture-only mode and Turnstile are enabled. Outbound delivery, candidate/team
  notifications, HR document access and retention/deletion are disabled.
- Public roles and applications remain disabled. The two prepared manifest roles
  are Distressed Debt Investment Manager and Legal Assistant.

The same readback found a real scanner settings mismatch: a 500 GB cap rather
than 1 GB, no clean-container exclusion, and blob result tags still enabled.
Do not treat the successful 8 September ARM deployment as proof that the
requested settings took effect. See `MALWARE_SCANNING_DEFENDER.md` for the managed
scanner acceptance requirements.

The [16 September repair](https://github.com/shorevest/website/actions/runs/35076901057)
used the documented account-level REST contract but failed effective-settings
verification. Azure reported `MissingPermissions`: the deployment identity lacks
`Microsoft.Security/datascanners/write` on the subscription's `StorageDataScanner`
resource. The final readback still reported the 500 GB cap and missing exclusion.
This is an Azure authorization blocker, not a remaining frontend/token bug.

An authorized Azure administrator must resolve that scanner permission before
the scoped correction or synthetic uploads are retried. No permissions, storage
keys, subscription-wide pricing or public-capture switches were changed in
response to the failure. The completed temporary readback, repair and old package
deployment workflows have been removed; their source and run evidence remain in
Git history and the linked Actions runs.

## Current safe state

- `openRolesEnabled: false`: public role listings stay hidden.
- `applicationsEnabled: false`: direct application URLs cannot submit.
- The configured API is the Azure **test** Function App. It must not receive real
  candidate data or be described as production.
- CV storage remains private. Browser uploads use a short-lived, write-only SAS
  for one quarantine blob; only verified-clean documents may be read by HR.

## Resolved source/deployment mismatch

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

The reconciliation in PR #826 imported the runtime contract onto `main`, and the
contained deployment in PRs #827–829 deployed it to the test Function, including:

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

## Malware scanning acceptance still required

Earlier test uploads remained `ScanPending`; there is no completed live clean and
malicious CV acceptance evidence. The managed Defender path is the current test
deployment. The self-hosted ClamAV path is retained as an alternative, hardened so
that it uses the reconciled backend adapters and wrapped scan flow. It now:

- reads the file by the current file-reference contract;
- rejects oversized or incomplete reads rather than scanning a prefix;
- preserves retryable queue messages;
- moves exhausted messages to a dedicated poison queue only after that write
  succeeds; and
- moves a scan-pending record to `ManualReview` on persistent engine failure.

Scanner Bicep is part of CI. If the alternative ClamAV path is deployed, its
container must be referenced by an immutable registry digest.

## Required launch evidence

Use synthetic data only. Record no candidate fields, CV content, SAS URLs, or
tokens in logs or screenshots.

1. Preserve the recorded Function deployment SHA and indexed-route evidence;
   reverify if the package changes.
2. Verify the effective managed Defender settings and event destination, including
   the 1 GB cap and clean-container exclusion. A Container App is needed only if
   the alternative ClamAV path is selected.
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
