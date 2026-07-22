# Recruitment Function deployment contract

The recruitment backend is not deployed by merging source code. Deployment is a separate, approved operation.

## Safety boundary

All deployment and launch controls default off:

- `RECRUITMENT_API_ENABLED=false`
- `RECRUITMENT_OUTBOX_DELIVERY_ENABLED=false`
- `RECRUITMENT_CANDIDATE_ACK_ENABLED=false`
- `RECRUITMENT_HR_ACCESS_ENABLED=false`
- `RECRUITMENT_RETENTION_ENABLED=false`
- `RECRUITMENT_RETENTION_DELETION_ENABLED=false`
- Microsoft Defender for Storage disabled unless explicitly enabled

Deploying the Function package does not make recruitment applications public.

## Artifact contract

Create the deployment artifact only through:

```powershell
powershell -ExecutionPolicy Bypass -File services/recruitment-functions/scripts/package.ps1 \
  -CommitSha <full-commit-sha> \
  -OutputPath artifacts/recruitment-functions.zip
```

The script:

1. installs production dependencies with `npm ci --omit=dev`;
2. creates a temporary staging directory;
3. copies only the Function runtime, bundled domain core, manifest contract and production dependencies;
4. writes `deployment-metadata.json` with the source commit, package time and package SHA-256;
5. runs syntax checks against the staged files;
6. creates the ZIP from the staging root;
7. rejects forbidden local settings, environment files, keys, certificates and archives.

The ZIP root must contain:

- `host.json`
- `package.json`
- `src/`
- `node_modules/`
- `api/recruitment/core/`
- `assets/data/recruitment/`
- `deployment-metadata.json`

The ZIP must not contain a wrapper folder such as `staging/` or `recruitment-functions/`.

## Required approvals before deployment

- approved Azure resource names and region;
- approved retention, privacy, consent and malicious-file policies;
- three populated Key Vault secrets;
- approved Turnstile configuration;
- approved Defender cost decision;
- approved SharePoint list IDs and selected-resource grants;
- approved recruitment mailbox and Exchange application-access restriction;
- approved Easy Auth app registration and app-role assignments;
- named operational and security owners.

## Deployment order

### 1. Deploy the Azure foundation

```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/recruitment/main.bicep \
  --parameters environmentName=<environment> namePrefix=<prefix>
```

This creates the Function App, managed identity, Cosmos DB, private Blob containers, Key Vault, monitoring resources and least-privilege Azure RBAC. It leaves the public API and external delivery disabled.

### 2. Apply candidate-upload Blob CORS

```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/recruitment/candidate-upload-cors.bicep \
  --parameters storageAccountName=<recruitment-cv-storage-account>
```

This is required for direct candidate browser uploads. The policy allows only:

- origins `https://shorevest.com` and `https://www.shorevest.com`;
- methods `PUT` and `OPTIONS`;
- upload headers required by Azure Blob Storage.

It does not allow browser `GET`, listing, deletion or wildcard origins. Do not test the public upload flow until this step is complete.

### 3. Apply the complete runtime settings contract

```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/recruitment/runtime-settings.bicep \
  --parameters \
    functionAppName=<function-app> \
    managedIdentityName=<managed-identity> \
    hostStorageAccountName=<host-storage> \
    cosmosAccountName=<cosmos-account> \
    cvStorageAccountName=<cv-storage> \
    keyVaultName=<key-vault> \
    applicationInsightsName=<application-insights> \
    environmentName=<environment>
```

Keep every enablement parameter at its default `false` during initial deployment.

### 4. Build and upload an immutable Function package

```bash
az storage blob upload \
  --auth-mode login \
  --account-name <host-storage-account> \
  --container-name recruitment-functions \
  --name packages/recruitment-functions-<commit-sha>.zip \
  --file artifacts/recruitment-functions.zip \
  --overwrite false
```

Use an immutable commit-addressed Blob name. Do not overwrite deployment artifacts. Retain the metadata and package SHA-256 with the change record.

Update the Flex Consumption deployment storage package reference through the approved Azure deployment command for the environment. Do not use storage account keys or connection strings.

### 5. Deploy Easy Auth after the Entra application exists

```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/recruitment/hr-auth.bicep \
  --parameters \
    functionAppName=<function-app> \
    tenantId=<tenant-id> \
    entraClientId=<application-client-id> \
    appRegistrationIssuer=<issuer-url>
```

Assign `Recruitment.HR` only to approved HR reviewers and `Recruitment.RetentionAdmin` only to approved Legal/retention administrators.

### 6. Provision and grant Microsoft 365 resources

- create exactly `RecruitmentApplications` and `RecruitmentFiles` using `sharepoint-lists.v1.json`;
- grant the Function identity selected write access to only those two lists;
- restrict `Mail.ReadWrite` and `Mail.Send` to the approved recruitment mailbox;
- configure the two event-specific Power Automate notification state machines;
- verify the identity cannot access unrelated sites, lists or mailboxes.

### 7. Enable Defender in non-production only

Redeploy `main.bicep` with `enableDefenderForStorage=true` only after the cost decision is approved.

Then deploy the scan-result Event Grid subscription:

```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/recruitment/event-grid-subscription.bicep \
  --parameters \
    eventGridTopicName=<scan-topic> \
    functionAppName=<function-app>
```

The subscription filters only `Microsoft.Security.MalwareScanningResult`. Retryable processing failures are thrown back to Event Grid, which applies the configured redelivery policy. Long-running private clean-Blob copies return `Pending` and resume on redelivery rather than starting duplicate copies.

### 8. Deploy monitoring rules

```bash
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/recruitment/monitoring-rules.bicep \
  --parameters \
    applicationInsightsName=<application-insights> \
    actionGroupResourceId=<action-group-resource-id>
```

Verify alert delivery to the named operational and security owners.

### 9. Execute non-production end-to-end tests

Required cases include:

- successful PDF and DOCX submissions;
- rejected malformed, oversized, encrypted and mismatched files;
- duplicate initiate, complete, finalize and Event Grid delivery;
- clean scan completing before and after finalization;
- pending clean copy across multiple Event Grid deliveries;
- malicious, unsupported, timeout and scan-error outcomes;
- Graph throttling and mailbox reconciliation;
- SharePoint duplicate-key handling;
- legal hold before, during and after an expired purge lease;
- partial Blob deletion followed by Cosmos failure and lease recovery;
- retention purge and idempotency-cleanup retry;
- dependency outage and recovery;
- expired upload, completion, finalization and HR read credentials.

### 10. Enable capabilities incrementally

Enable one capability at a time through `runtime-settings.bicep`, verifying readiness, logs and alerts after each change:

1. retention policy assignment only;
2. HR clean-document access;
3. SharePoint/outbox projection;
4. candidate acknowledgement;
5. destructive retention only after explicit approval and recovery testing;
6. public candidate API last.

The frontend application form and public role switches remain separate final steps.

## Rollback

Rollback in this order:

1. set `RECRUITMENT_API_ENABLED=false`;
2. set external delivery, HR access and retention-deletion settings false;
3. disable the Event Grid subscription if scan processing is unsafe;
4. revert to the last approved immutable package;
5. preserve Cosmos, Blob, SharePoint and monitoring records for investigation;
6. do not delete candidate data as part of an application rollback.

## Evidence to retain

- approved deployment parameters;
- source commit and PR;
- package SHA-256 and `deployment-metadata.json`;
- Bicep deployment results;
- CORS verification result;
- Key Vault secret version identifiers, not secret values;
- Entra role assignments;
- SharePoint and mailbox permission evidence;
- test results and failure-injection evidence;
- alert delivery evidence;
- final enablement approval.
