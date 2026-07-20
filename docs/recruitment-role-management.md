# Recruitment role management — adding, closing, and activating roles

Status: operational guide for ShoreVest staff. Adding a role to the manifest does **not** enable
application submission. Phase 1.1 has no public application form; roles stay as `draft` until the
full publication and Phase 2 application checklist is complete.

Key files:

- Manifest: `assets/data/recruitment/roles.v1.json`
- Schema: `assets/data/recruitment/roles.v1.schema.json`
- Validator: `scripts/validate-recruitment-roles.js` (`npm run validate:recruitment`)
- Renderers: `assets/js/recruitment-role-list.js`, `assets/js/recruitment-role-detail.js`
  (no Phase 1.1 application renderer is shipped)
- Tests: `npm run test:recruitment`

## 1. Manifest role shape

Each role supports (optional fields may be omitted or left empty until approved):

```json
{
  "roleId": "investment-analyst",
  "status": "active",
  "applicationEnabled": false,
  "employmentType": "Full-time",
  "applicationDeadline": null,
  "deadlineAdminOverride": false,
  "reportingLine": null,
  "locales": {
    "en": {
      "title": "Investment Analyst",
      "location": "Guangzhou",
      "team": "Investment",
      "detailPath": "careers/investment-analyst.html",
      "summary": "",
      "responsibilities": [],
      "requirements": [],
      "preferredQualifications": [],
      "applicationStatementPrompt": ""
    },
    "zh-CN": { "…": "mirror of en with _cn.html detailPath" }
  },
  "files": [ { "filePurpose": "cv", "required": true, "maxSizeBytes": 10485760, "…": "…" } ],
  "screening": { "workAuthorization": { "enabled": false, "required": false, "jurisdictions": [] }, "roleSpecificQuestions": [] }
}
```

Rules enforced by the validator (see `tests/recruitment-roles.test.js`):

- `roleId` is a unique, safe lowercase slug — no spaces, slashes, URL/query syntax, or traversal.
- `status` ∈ {`draft`, `published`, `closed`, `archived`}; `employmentType` ∈
  {`Full-time`, `Part-time`, `Internship`, `Contract`}.
- Both `en` and `zh-CN` locales are present; only those locale IDs are accepted.
- Titles, team, and location are non-empty plain strings; `detailPath` is an internal relative
  `careers/*.html` path (no external, `javascript:`, protocol-relative, traversal, or absolute
  paths). No raw HTML is allowed in any candidate-facing text.
- `applicationDeadline` is `null` or a valid ISO date. Responsibilities / requirements /
  preferred qualifications are arrays of plain strings (empty arrays allowed).
- An inactive/closed role cannot have `applicationEnabled: true`.
- A role cannot be `applicationEnabled` without a valid required CV-upload definition **and**
  the minimum reviewed content (summary, ≥1 responsibility, ≥1 requirement, and application
  prompt) in **both** locales.
- A role cannot be `applicationEnabled` when its deadline has passed unless
  `deadlineAdminOverride: true` records an approved administrative override.

## 2. Role listing vs. application availability

- The Careers listing (`careers.html` / `careers_cn.html`) shows roles with `status: active`,
  regardless of `applicationEnabled`. This lets HR display an approved vacancy before the
  application system is switched on.
- The Phase 1.1 role-detail page does not render an Apply button. Draft roles are hidden by
  default and render only for internal review URLs that include `?preview=1`; closed roles show
  a controlled closed message.
- A `closed` role is removed from the listing but its direct URL still shows a controlled closed
  message, and the application page rejects it.

## 3. Adding a vacancy

1. Duplicate a safe manifest role template; assign a unique lowercase `roleId`.
2. Add approved English content; add approved Chinese content (professional, not machine
   translation). **Do not invent** responsibilities, requirements, reporting lines, deadlines,
   or compensation.
3. Create the English role-detail shell (`careers/{roleId}.html`) and the Chinese shell
   (`careers/{roleId}_cn.html`) from an existing role page: set `data-recruitment-role-id`,
   keep `noindex, nofollow, noarchive`, and keep the no-JS fallback + preview banner until copy
   is approved.
4. Keep `"applicationEnabled": false`.
5. Run `npm run validate:recruitment`.
6. Run `npm run test:recruitment`.
7. Review desktop and mobile presentation.
8. Obtain HR approval (role copy) and Legal approval (privacy wording).
9. Confirm backend availability; submit test applications; confirm SharePoint storage, register
   creation, HR notification, candidate acknowledgement, and closed-role rejection behavior.
10. Only then set `"applicationEnabled": true`, remove the internal-preview banner, and (for a
    genuinely public role) remove `noindex` — see §5.
11. Deploy; verify the live form.
12. Create the LinkedIn Job using the external application URL; record the live LinkedIn Job URL
    internally.

## 4. Closing a vacancy

1. Set the role `status` to `closed`.
2. Set `"applicationEnabled": false`.
3. Deploy.
4. Confirm the role disappears from the Careers listing.
5. Confirm the role-detail page shows the closed message.
6. Confirm the application URL rejects the role (`ROLE_CLOSED`).
7. Confirm the backend rejects direct submission attempts for the role.
8. Manually close the LinkedIn Job.
9. Preserve application records per approved retention policy. **Do not delete applicant records
   merely because the public role was closed.**

## 5. Search-engine controls and structured data

Until a role and its recruitment copy are approved:

- Keep sample role pages and application pages `noindex, nofollow, noarchive`.
- Keep applications disabled; do not add sample vacancies to a sitemap.
- Do not add `JobPosting` structured data for sample/unapproved roles.

When a real role becomes public, `noindex` may be removed and valid `JobPosting` structured data
may be added, but only derived from approved manifest content with accurate dates and locations.

## 6. Production activation checklist

Before changing `"applicationEnabled": false` → `true`:

1. HR has approved the role copy (both locales).
2. Legal has approved the privacy notice + consent wording; the privacy-notice version is set.
3. Retention decisions (rejected/withdrawn/hired, deletion, cross-border) are approved.
4. The Azure Function backend is deployed, tested, and reachable at the configured same-origin
   endpoint; `data-recruitment-endpoint` is set on the application pages.
5. Private CV storage + malware scanning are configured and verified.
6. The SharePoint document library and application register exist with HR-only permissions.
7. Power Automate HR notification + candidate acknowledgement flows are configured with
   concurrency control and verified end-to-end.
8. Rate limiting and bot protection are enabled.
9. `npm run validate:recruitment` and `npm run test:recruitment` pass, including the readiness
   checks that block enabling a role without approved content and a valid CV definition.
10. Test applications confirm storage, register creation, HR notification, candidate
    acknowledgement, and closed-role rejection.
11. Deploy; verify the live form; create the LinkedIn Job with the external apply URL.

## Application configuration in the role manifest

Each role now carries an `application` object used by the future backend as the authoritative eligibility and CV-rule source. Keep draft roles with `application.enabled: false`. A role may accept applications only after publication, approved privacy notice version, no content-review hold, valid locale, and an unexpired deadline. PDF and DOCX are the only accepted CV formats; legacy `.doc` must not be added.

Do not add public Apply buttons, forms, mailto links, candidate accounts, candidate portals, live API URLs, or live SAS generation while `careersOpenRolesEnabled` remains false and roles remain draft.
