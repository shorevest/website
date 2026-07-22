# Recruitment Microsoft 365 setup

This setup is administrative and must be completed before recruitment outbox delivery is enabled. It does not make the public Careers page or application form live.

## Separation of duties

Use two separate permission contexts:

1. **Provisioning administrator**
   - Creates and configures the two SharePoint lists.
   - Grants the recruitment managed identity selected access to those lists.
   - Grants and scopes mailbox permissions for candidate acknowledgements.
   - May use temporary delegated or application permissions such as `Sites.Manage.All` only for setup.

2. **Recruitment Function managed identity**
   - Must not create lists, administer sites, list storage keys, or access unrelated SharePoint content.
   - Uses `Lists.SelectedOperations.Selected` with write access granted only to:
     - `RecruitmentApplications`
     - `RecruitmentFiles`
   - Uses the minimum approved Microsoft Graph mail permission, restricted to the designated recruitment mailbox through Exchange Online application access controls.

The runtime list permission is recorded in `infra/recruitment/sharepoint-lists.v1.json`. The list contract is validated in CI.

## SharePoint lists

Create exactly two generic lists in the approved HR-restricted SharePoint site:

- `RecruitmentApplications`
- `RecruitmentFiles`

Do not use a SharePoint document library for CV storage. Do not enable public upload links. Do not attach CVs to SharePoint items. Candidate documents remain in the private Azure Blob Storage containers.

Use the internal column names, types, choices, unique keys, and indexes defined in:

`infra/recruitment/sharepoint-lists.v1.json`

After provisioning, record the immutable identifiers as Function App settings:

- `RECRUITMENT_SHAREPOINT_SITE_ID`
- `RECRUITMENT_APPLICATIONS_LIST_ID`
- `RECRUITMENT_FILES_LIST_ID`

List display names are not sufficient because they can be renamed.

## Selected list permission

The managed identity must first have the Microsoft Graph application scope `Lists.SelectedOperations.Selected` consented in Microsoft Entra ID. A SharePoint administrator must then grant the identity write access to each of the two specific list resources.

Granting the scope without the resource grant does not provide access. Granting a list permission without the consented scope also does not provide access.

No permission should be granted to the broader site unless list-level selected permissions are unavailable in the tenant and an explicit security exception is approved.

## Candidate acknowledgement mailbox

Set the approved sender mailbox using:

`RECRUITMENT_CANDIDATE_ACK_MAILBOX`

Before enabling candidate acknowledgements:

- approve the English and Chinese wording;
- set `RECRUITMENT_CANDIDATE_ACK_TEMPLATE_APPROVED=true`;
- restrict the managed identity's Graph mail access to the approved recruitment mailbox;
- verify the mailbox records sent messages;
- confirm the privacy notice URL in `RECRUITMENT_CANDIDATE_ACK_PRIVACY_URL`;
- test duplicate-delivery recovery before production.

The acknowledgement contains no attachments, CV links, clean Blob URLs, internal SharePoint links, or reusable SAS URLs.

## Runtime settings

Keep these disabled until the lists, permissions, mailbox restriction, and tests are complete:

- `RECRUITMENT_OUTBOX_DELIVERY_ENABLED=false`
- `RECRUITMENT_CANDIDATE_ACK_ENABLED=false`
- `RECRUITMENT_API_ENABLED=false`

The backend configuration validator rejects an enabled API unless abuse controls, SharePoint identifiers, outbox delivery, candidate acknowledgement, mailbox configuration, managed identity, and template approval are all present.

## Power Automate

Power Automate is limited to two HR notification flows:

1. New application received.
2. Documents clean and ready.

Both flows must:

- run with trigger concurrency control enabled;
- process only `NotificationState=Pending`;
- atomically claim the event by changing `Pending` to `Sending`;
- use `NotificationEventKey` as the stable event identifier;
- finish as `Sent` or `Failed`;
- increment `NotificationAttemptCount`;
- write `NotificationSentAtUtc` or `NotificationLastErrorCode`;
- send summary information and internal SharePoint links only;
- never attach candidate documents or include public/reusable document links.

## Verification checklist

Before enabling delivery, verify:

- the Function identity cannot list unrelated sites or lists;
- both key columns enforce unique values;
- indexed columns match the versioned contract;
- SharePoint items contain metadata only;
- the candidate mailbox is the only mailbox accessible to the identity;
- a repeated application projection updates the existing item instead of creating a duplicate;
- a repeated candidate acknowledgement event is reconciled without sending a duplicate;
- failed Graph calls remain retryable and preserve the outbox lease state;
- all three enablement settings remain false in the production deployment template until final approval.
