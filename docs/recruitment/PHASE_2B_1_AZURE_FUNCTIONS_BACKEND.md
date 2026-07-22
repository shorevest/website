# Recruitment Phase 2B.1 Azure Functions backend

> **Warning:** Merging this code does not deploy or enable recruitment applications. The Function App defaults `RECRUITMENT_API_ENABLED=false`, role-level application switches remain disabled, the public Careers feature flag remains off, and no public website application form is added.

## Architecture

Careers page -> Azure Functions HTTP API -> Cosmos DB for NoSQL (`submissions`, `idempotency`, `rateLimits`) -> private Blob containers (`recruitment-quarantine`, `recruitment-clean`) -> optional Microsoft Defender for Storage -> Event Grid -> scan Function -> durable outbox for later SharePoint projection.

The CV storage endpoint remains network-reachable because candidate browsers upload directly to one exact quarantine Blob using a short-lived user-delegation SAS. This does **not** make the containers public: anonymous Blob access and Shared Key access are disabled, and each upload credential is write-only, HTTPS-only, single-Blob scoped, and short-lived.

## Directory structure

* `services/recruitment-functions/`: Node 20, CommonJS, Azure Functions runtime 4 programming-model-v4 project.
* `services/recruitment-functions/src/adapters/`: production Cosmos, Blob, Key Vault secret, token, fingerprint, Turnstile, and fixed-window rate-limit adapters using managed identity.
* `infra/recruitment/`: Flex Consumption, identity-based host/deployment storage, Cosmos, CV Blob Storage, Key Vault, monitoring, Event Grid, role assignments, and safe deployment parameters.

## Configuration

Required production settings include:

* `RECRUITMENT_API_ENABLED`
* `RECRUITMENT_ENVIRONMENT`
* `RECRUITMENT_ALLOWED_ORIGINS`
* `RECRUITMENT_REQUIRE_ORIGIN`
* `RECRUITMENT_MANAGED_IDENTITY_CLIENT_ID`
* `RECRUITMENT_COSMOS_ENDPOINT`
* `RECRUITMENT_COSMOS_DATABASE`
* `RECRUITMENT_STORAGE_ACCOUNT_URL`
* `RECRUITMENT_UPLOAD_STORAGE_ACCOUNT_NAME`
* `RECRUITMENT_KEYVAULT_URL`
* `RECRUITMENT_COMPLETION_TOKEN_SECRET_NAME`
* `RECRUITMENT_FINGERPRINT_SECRET_NAME`
* `RECRUITMENT_RATE_LIMIT_ENABLED`
* `RECRUITMENT_RATE_LIMIT_COUNT`
* `RECRUITMENT_RATE_LIMIT_WINDOW_SECONDS`
* `RECRUITMENT_BOT_VERIFICATION_MODE`
* `RECRUITMENT_BOT_VERIFICATION_SECRET_NAME`
* `RECRUITMENT_BOT_VERIFICATION_HOSTNAME`

Production origins are only `https://shorevest.com` and `https://www.shorevest.com`. The enabled production API fails configuration validation unless a managed identity client ID, Cosmos/Blob/Key Vault settings, rate limiting, and Turnstile are configured. The Bicep template writes all non-secret settings but deliberately does not create secret values.

## Functions host and deployment storage

Flex Consumption uses a dedicated private deployment container and user-assigned managed identity authentication. The same identity is explicitly configured for `AzureWebJobsStorage`, so timer coordination, host keys, and deployment package access do not rely on storage account keys or connection strings. `RECRUITMENT_API_ENABLED` remains `false` in the infrastructure template.

## Data design

`submissions` is partitioned by `/applicationReference` and stores `application`, `file:{fileReference}`, `completion:{fileReference}`, `scan:{eventId}:{fileReference}`, `outbox:{eventType}:{stableEventKey}`, and `cleanup:{fileReference}` documents. Aggregate updates use Cosmos transactional batches in one application partition. `idempotency` is partitioned by `/idempotencyKey` and stores fingerprints, reservations, leases, generations, expiry metadata, and stable result metadata, never SAS URLs, completion-token signatures, full candidate details, or canonical fingerprint plaintext. `rateLimits` is partitioned by `/key` with TTL and stores only HMAC-derived request keys.

## Abuse controls

Production requests require an approved `Origin`. The Function derives client context from trusted request headers, never from candidate JSON. Turnstile verification fails closed on missing tokens, invalid responses, hostname mismatches, network failures, or missing Key Vault configuration. Rate limiting uses a Cosmos-backed fixed window and an HMAC of server-derived request context so raw IP addresses and user-agent strings are not stored.

## Blob, SAS, and Defender

Upload URLs are user-delegation SAS URLs scoped to one quarantine Blob with create/write only, HTTPS only, and at most ten-minute expiry. The Blob adapter verifies exact path, size, content type, bounded bytes, ETag, and SHA-256. Clean promotion is idempotent and separately leaves quarantine deletion to cleanup. Defender for Storage is cost-bearing and remains disabled by default through `enableDefenderForStorage=false`; enabling requires an explicit deployment decision.

## Managed identity roles

The Bicep grants:

* Cosmos DB Built-in Data Contributor on the recruitment Cosmos account.
* Storage Blob Data Contributor on the CV storage account for exact-Blob upload authorization, verification, promotion, and cleanup.
* Storage Blob Data Owner on the dedicated Functions host/deployment storage account, required for identity-based Functions host storage and package deployment.
* Key Vault Secrets User on the recruitment vault.

It does not grant subscription Owner, resource-group Contributor, Storage Account Contributor, storage key listing, or broad Key Vault administration.

## Local development and validation

Copy `local.settings.example.json` to local untracked settings only if needed. Local emulator support is limited; production code uses managed identity and Key Vault. Validate with `npm run check:functions`, `npm run test:functions`, `npm run bicep:build:recruitment`, and the root recruitment/security checks.

## Rollout, rollback, and health

Deployment prerequisites are approved Azure names, three populated Key Vault secrets, a Function package uploaded to the deployment container, and an explicit decision on paid Defender. Rollback is disabling `RECRUITMENT_API_ENABLED`, stopping Event Grid subscription delivery, and reverting the Function package. The health endpoint reports only runtime/configuration shape, not resource names, secrets, candidate data, or data counts.

## Unresolved decisions and Phase 2B.2

Production rate-limit thresholds still require final approval. Phase 2B.2 will implement SharePoint projection, Power Automate notifications, and HR-facing private links. This phase deliberately uses a no-external-delivery outbox worker that leaves events pending.
