# Recruitment operations setup — Microsoft environment, LinkedIn, retention

Status: **design and operating model only. Nothing described here is provisioned or verified.**
No Microsoft tenant, SharePoint site, list, library, Power Automate flow, mailbox, or endpoint
is claimed to exist. No tenant identifiers, site IDs, list IDs, library IDs, or email addresses
are invented in this repository. Application submission remains disabled until every item below
is completed and approved.

See also: [`docs/recruitment-application-backend.md`](recruitment-application-backend.md) and the
authoritative [`docs/recruitment/PHASE_1_BUILD_SPEC.md`](recruitment/PHASE_1_BUILD_SPEC.md).

## 1. Target Microsoft model

```
Application endpoint (Azure Function, HTTPS, managed identity)
    ↓
Restricted SharePoint document library (private; HR + approved hiring managers only)
    ↓
SharePoint List or Dataverse register record
    ↓
Power Automate notification (HR notification + candidate acknowledgement)
```

## 2. SharePoint document library — `Recruitment Applications`

Proposed restricted library for stored CVs.

- Folder pattern:

  ```
  Recruitment Applications/
    {roleId}/
      {year}/
  ```

- Stored filename pattern (never the candidate's name as the sole filename):

  ```
  {applicationReference}-{randomId}.{extension}
  ```

  The original filename is stored only as controlled metadata if needed.
- Access limited to: Human Resources, approved hiring managers, and required system service
  accounts. **No anonymous access. No publicly shareable links.**
- CV files are **never** attached to notification emails.

## 3. Register — `Recruitment Application Register` (SharePoint List or Dataverse)

Proposed fields:

Application ID · Submitted date and time · Role ID · Role title · Team · Role location ·
Candidate name · Candidate email · Candidate telephone · Candidate current location ·
LinkedIn URL · Application statement · CV secure file link · Status · Assigned reviewer ·
Reviewer notes · Referral source · Submission language · Privacy notice version ·
Retention date · Last updated date · Duplicate-detection key (if approved) ·
Backend processing status · Notification status.

Application (HR evaluation) statuses:
`New` · `HR Review` · `Hiring Manager Review` · `Interview` · `Hold` · `Rejected` · `Offer` ·
`Hired` · `Withdrawn`.

Technical processing statuses (kept separate from evaluation state):
`Received` · `Validated` · `File Scanned` · `Stored` · `Notification Pending` · `Complete` ·
`Failed` · `Quarantined`.

Keep technical processing state separate from candidate evaluation state. Build the register so
a **retention date** can be stored later; do not auto-delete data without an approved policy.

## 4. Power Automate

Two purposes, both triggered only **after** the backend has validated and securely stored the
application:

1. **HR notification** — reads the application record; notifies the designated HR owner;
   includes the role title and candidate name; includes secure internal links to the record and
   the CV (never a CV attachment or a public/SAS link); avoids unnecessary personal data in the
   subject line; logs notification success/failure; retries controlled transient failures;
   escalates permanent failure through an internal operational route; preserves an audit trail.
2. **Candidate acknowledgement** — a neutral, idempotent acknowledgement that never exposes
   reviewer notes, internal reviewer names, or the CV link, and is not duplicated on retries.

Recipient configuration: prefer a **configurable HR recruitment address or workflow owner**. Do
not hard-code any individual's personal email address unless it already exists in approved
repository configuration (it does not).

### Candidate acknowledgement email content

Subject: `ShoreVest application received`

Body (English):

```
Thank you for your application to ShoreVest.

We have received your application for the {Role Title} position.

Application reference: {Application Reference}

ShoreVest will contact candidates selected for the next stage.

This is an automated acknowledgement. Please do not send sensitive personal information in response.
```

Body (Simplified Chinese):

```
感谢您向 ShoreVest 提交申请。

我们已收到您应聘“{Role Title}”职位的申请。

申请编号：{Application Reference}

ShoreVest 将联系进入下一轮的候选人。

本邮件为系统自动发送的确认通知，请勿在回复中提供敏感个人信息。
```

Never attach the CV; never include internal reviewer names.

## 5. LinkedIn operating model

The website is the authoritative vacancy record; LinkedIn is a distribution channel only. Do
not build a LinkedIn API integration and do not use LinkedIn Easy Apply as the application
system.

Manual process:

1. HR approves the vacancy.
2. Add/update the role in `assets/data/recruitment/roles.v1.json`.
3. Review the ShoreVest role page (desktop + mobile).
4. Test the backend and form.
5. Set `applicationEnabled: true`.
6. Deploy the website.
7. HR creates the LinkedIn Job.
8. Configure LinkedIn to use an **external application website**.
9. Enter the exact ShoreVest application URL.
10. Optionally publish a separate LinkedIn company-page announcement.
11. On close: close the website role and manually close the LinkedIn Job.

### URL patterns

- LinkedIn external apply: `https://shorevest.com/careers/apply.html?role={roleId}&source=linkedin`
- Website apply (EN): `https://shorevest.com/careers/apply.html?role={roleId}&source=website`
- Website apply (ZH): `https://shorevest.com/careers/apply_cn.html?role={roleId}&source=website`

Do not create tracking URLs that contain candidate information. Do not add arbitrary campaign
parameters; only the allowlisted, normalized `source` values are honored (anything else →
`direct`).

## 6. Data retention (HR + Legal must approve — not invented here)

The following require HR/Legal approval before production; the register stores a retention date
so a policy can be applied later, but **no automatic deletion** occurs without an approved
policy:

- Applicant-data retention period; rejected-candidate retention; hired-candidate transfer to
  employee records; withdrawal handling; deletion requests; cross-border data-transfer
  requirements (e.g. PIPL for China-resident candidates); access reviews; audit-log retention;
  backup retention.

## 7. Security assumptions

HTTPS only · managed identity where available · environment-specific configuration · restricted
SharePoint permissions · file scanning · request-size limits · rate limiting · bot protection ·
input validation · structured logging · minimal personal data in logs · audit trails · secret
rotation · separate test/production environments · no production CVs in local development.

## 8. What still requires action

- **Microsoft/IT**: deploy the Azure Function backend; create the storage account + private
  containers; enable malware scanning; create the SharePoint library + register; configure
  managed identity, CORS, monitoring, and alerts; configure the production endpoint.
- **HR**: approve role copy; own the recruitment mailbox/notification recipient; approve
  retention decisions.
- **Legal**: approve the privacy notice and consent wording; complete cross-border/PIPL
  analysis; approve retention.
