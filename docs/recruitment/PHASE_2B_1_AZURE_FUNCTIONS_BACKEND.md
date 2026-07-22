# Recruitment Phase 2B.1 Azure Functions backend

> **Warning:** Merging this code does not deploy or enable recruitment applications. The Function App defaults `RECRUITMENT_API_ENABLED=false`, both production roles remain drafts with applications disabled, and no public website application form is added.

## Architecture
Careers page -> Azure Functions HTTP API -> Cosmos DB for NoSQL (`submissions`, `idempotency`, `rateLimits`) -> private Blob Storage (`recruitment-quarantine`, `recruitment-clean`) -> optional Microsoft Defender for Storage -> Event Grid -> scan Function -> durable outbox for later SharePoint projection.

## Directory structure
* `services/recruitment-functions/`: Node 20, CommonJS, Azure Functions runtime 4 programming-model-v4 project.
* `services/recruitment-functions/src/adapters/`: production Cosmos, Blob, Key Vault secret, token, and fingerprint adapters using managed identity.
* `infra/recruitment/`: Bicep resources and safe placeholder parameters.

## Configuration
Required names include `RECRUITMENT_API_ENABLED`, `RECRUITMENT_ALLOWED_ORIGINS`, `RECRUITMENT_COSMOS_ENDPOINT`, `RECRUITMENT_COSMOS_DATABASE`, `RECRUITMENT_STORAGE_ACCOUNT_URL`, `RECRUITMENT_UPLOAD_STORAGE_ACCOUNT_NAME`, `RECRUITMENT_KEYVAULT_URL`, `RECRUITMENT_COMPLETION_TOKEN_SECRET_NAME`, and `RECRUITMENT_FINGERPRINT_SECRET_NAME`. Production origins are only `https://shorevest.com` and `https://www.shorevest.com`; preview origins are for named non-production environments only.

## Data design
`submissions` is partitioned by `/applicationReference` and stores `application`, `file:{fileReference}`, `completion:{fileReference}`, `scan:{eventId}:{fileReference}`, `outbox:{eventType}:{stableEventKey}`, and `cleanup:{fileReference}` documents. Aggregate updates use Cosmos transactional batches in one application partition. `idempotency` is partitioned by `/idempotencyKey` and stores fingerprints, reservations, leases, generations, expiry metadata, and stable result metadata, never SAS URLs, completion-token signatures, full candidate details, or canonical fingerprint plaintext. `rateLimits` is partitioned by `/key` with TTL.

## Blob, SAS, and Defender
Upload URLs are user-delegation SAS URLs scoped to one quarantine blob with create/write only, HTTPS only, and at most ten-minute expiry. The Blob adapter verifies exact path, size, content type, bounded bytes, ETag, and SHA-256. Clean promotion is idempotent and separately leaves quarantine deletion to cleanup. Defender for Storage is cost-bearing and remains disabled by default through `enableDefenderForStorage=false`; enabling requires an explicit deployment decision.

## Managed identity roles
The Bicep grants Cosmos DB Built-in Data Contributor for Cosmos data operations, Storage Blob Data Contributor scoped to the CV storage account for blob and user-delegation SAS operations, and Key Vault Secrets User scoped to the recruitment vault. It does not grant Owner, Contributor, Storage Account Contributor, key listing, or broad Key Vault administration.

## Local development and validation
Copy `local.settings.example.json` to local untracked settings only if needed. Local emulator support is limited; production code uses managed identity and Key Vault. Validate with `npm run check:functions`, `npm run test:functions`, `npm run bicep:build:recruitment`, and root recruitment/security checks.

## Rollout, rollback, and health
Deploy prerequisites are approved Azure names, networking/private access, Key Vault secrets, and an explicit decision on paid Defender. Rollback is disabling `RECRUITMENT_API_ENABLED`, stopping Event Grid subscription delivery, and reverting the function package. The health endpoint reports only runtime/configuration shape, not resource names or data counts.

## Unresolved decisions and Phase 2B.2
Production rate-limit thresholds remain unresolved pending approval. Phase 2B.2 will implement SharePoint projection, Power Automate notifications, and HR-facing private links. This phase deliberately uses a no-external-delivery outbox worker that leaves events pending.

## Phase 2B.1A deployability notes

Phase 2B.1A keeps `RECRUITMENT_API_ENABLED=false` by default and does not publish roles, add an application form, deploy code, or configure SharePoint/Power Automate delivery.

Reference format is authoritative across generation, Blob paths, Event Grid parsing, and tests:

- `SV-APP-{YYYY}-{16 uppercase hexadecimal characters}`
- `SV-FILE-{16 uppercase hexadecimal characters}`
- `recruitment/{year}/{roleId}/{applicationReference}/{fileReference}.{extension}`

Production launch still requires an approved bot-verification provider. Local and test environments may use an explicit test bypass, but production must not enable the recruitment API with a bypass verifier.

The undeployed infrastructure scaffold uses authenticated public service endpoints for dev/test storage reachability while disabling anonymous Blob access and Shared Key access. Production launch requires the approved networking mode before enabling applications; that may be the full private endpoint/VNet path or another reviewed design that preserves Defender scan-result delivery to Event Grid.

The outbox worker intentionally uses a no-delivery lifecycle in this phase. It can claim events and record retryable attempts with backoff, but it must not mark events delivered until Phase 2B.2 provides the projection destination.
