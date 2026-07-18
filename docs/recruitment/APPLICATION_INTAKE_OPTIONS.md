# Candidate application intake — options and recommendation

Status: decision memo for HR, IT, and Legal. This document proposes how candidates submit applications (details + CV) and how those submissions reach HR. It changes nothing on the live site by itself. `docs/recruitment/PHASE_1_BUILD_SPEC.md` remains the authoritative specification for the first-party Azure build (Option C below); adopting Option A or B as an interim intake channel is a business decision that amends the Phase 1 scope statement and should be recorded here when made.

## What already exists

- **Open roles listing**: `careers.html` / `careers_cn.html` render the "Open Roles" section from the role manifest (`assets/data/recruitment/roles.v1.json`) via `assets/js/recruitment-role-list.js`. Bilingual role detail pages live in `careers/`. To go live, the remaining work is editorial: approve the role copy, remove the internal-preview banners and `noindex` tags. No new engineering is needed for the listing itself.
- **No backend**: the website is static. It cannot receive an uploaded file or send an email on its own. Any submission flow therefore uses one of: the candidate's own email client (Option A), a hosted form vendor (Option B), or the first-party Azure backend (Option C).
- **File rules already decided in the manifest**: CV as PDF/DOC/DOCX, max 10 MB, signature validation. Keep these regardless of option.

## The virus question — one principle

The requirement "we don't want a virus sent to us" is met by one rule applied consistently:

> A file uploaded by an anonymous stranger must never land in an HR mailbox as a raw, unscanned attachment.

There are exactly three sound ways to honor that rule, and they map one-to-one onto the options below:

1. **Let the mail provider scan it** (Option A). Microsoft 365 scans every inbound attachment with Exchange Online Protection before delivery; Defender for Office 365 Safe Attachments (if licensed) additionally detonates attachments in a sandbox. The candidate's email *is* the bundle, and it arrives pre-scanned.
2. **Never attach the file at all** (Option B). The vendor stores the CV; HR's notification email contains the form answers plus a *link* to the file. The download then passes through Safe Links and endpoint antivirus. No unscanned bytes ever sit in the inbox.
3. **Scan in our own quarantine before HR can see it** (Option C). Defender for Storage scans the upload in a quarantine container; only clean files are promoted where HR can reach them. This is the Phase 1 spec.

HR handling habits apply in every option: open CVs in Protected View or the browser/Office web preview, never enable macros or editing on a candidate document. If IT prefers to eliminate the macro vector entirely, narrow the allowlist to PDF only (record that as a manifest change).

## Option A — Dedicated recruitment mailbox (fastest; zero build)

Candidates apply by emailing a dedicated shared mailbox (e.g. `careers@shorevest.com`) with their CV attached. Each role detail page states the address and lists the required details (see field list below) so applications arrive reasonably complete.

- **Bundling**: the candidate's own email is the bundle — details in the body, CV attached, delivered straight to HR.
- **Virus safety**: inherited from Microsoft 365 inbound scanning (principle 1 above). Recommended hardening: enable a Safe Attachments policy for the mailbox; keep the default block on executable attachment types; HR opens documents in Protected View.
- **Setup**: create the shared mailbox, grant HR access, add the address and an application checklist to the role pages, lightly obfuscate the address in the HTML to reduce scraping.
- **Weaknesses**: required fields are requested, not enforced; spam and agency submissions arrive in the same mailbox; tracking is manual (inbox folders). Acceptable at ShoreVest's current volume (two roles).
- **Time to live**: as soon as role copy is approved and the mailbox exists.

## Option B — Hosted form vendor (recommended target for "form on the site")

A structured application form embedded on each role detail page, backed by a form vendor that stores the uploaded CV and sends HR a notification email containing all the answers plus a link to the file (principle 2 above).

**HubSpot is the natural first candidate** because the site already integrates HubSpot for the newsletter signup (`assets/js/newsletter-signup.js`, `docs/integrations/HUBSPOT_SETUP.md`). Notes specific to HubSpot:

- The application form must use HubSpot's **embedded form** (`hbspt.forms.create`), not the plain JSON Forms API the newsletter uses — file-upload fields are only supported through the embedded form.
- The uploaded CV is stored in HubSpot's file manager; the HR notification email carries the submission summary and a file link, not an attachment.
- **Confirm before committing**: that the current HubSpot subscription includes file-upload form fields, per-form email notifications, and acceptable file storage limits.

If HubSpot licensing does not fit, evaluate alternatives (Formspree, Basin, Tally, or similar) against the same non-negotiable criteria:

1. File delivered to HR as a stored-file **link, never a raw email attachment**.
2. Enforced required fields; file type restricted to PDF/DOC/DOCX; size cap ≤ 10 MB.
3. Spam protection (CAPTCHA or equivalent) on by default.
4. Data export and deletion controls adequate for privacy compliance (see Legal items below).

- **Bundling**: the vendor's notification email to HR is the bundle: every field answer plus the CV link in one message per candidate.
- **Weaknesses**: candidate personal data is processed by a third party. Chinese-resident candidates make PIPL cross-border transfer analysis mandatory before launch — this maps to the already-open "Cross-border data handling" decision in the Phase 1 spec and is Legal's call, not an engineering task.
- **Time to live**: days once the vendor account and Legal sign-off exist. The form embed, bilingual labels, and consent wording are ordinary frontend work in this repo.

## Option C — First-party Azure pipeline (the existing Phase 1 spec)

The fully specified build in `docs/recruitment/PHASE_1_BUILD_SPEC.md`: Azure Functions API, quarantine blob storage with Defender for Storage malware scanning, SharePoint as the HR system of record, Power Automate HR notification emails (summary + secure internal link, never attachments).

- Maximum control: our tenancy, our retention rules, real malware quarantine, structured records, audit trail.
- It is a genuine backend build, staged over ~12 PRs, and blocked on the spec's table of unresolved HR/Legal/IT decisions.
- Options A and B do not preclude it; they are interim intake channels while (or instead of) building it. If A or B proves sufficient at current hiring volume, C can stay on the shelf indefinitely.

## Comparison

| | A — Mailbox | B — Form vendor | C — Azure pipeline |
| --- | --- | --- | --- |
| Structured, enforced fields | No | Yes | Yes |
| Virus protection | M365 inbound mail scanning | Link-not-attachment + endpoint AV | Own quarantine + Defender scan |
| "Bundled to HR email" | Candidate's own email | Vendor notification email | Power Automate summary email |
| Spam control | Weak | CAPTCHA | API-level controls |
| Candidate data location | M365 mailbox | Third-party vendor | Own Azure/SharePoint |
| Build effort | None | Small (frontend only) | Large (backend, staged) |
| Blocking decisions | Role copy, mailbox owner | Vendor licensing, PIPL/cross-border sign-off | 17-row decision table in Phase 1 spec |

## Required application details (all options)

Aligned with the Phase 1 spec — request these whether by checklist (A) or enforced form fields (B/C): full name; email; telephone; current city and country; role applied for; availability / notice period; short application statement; CV. Optional: LinkedIn URL, current employer and position, referral source, cover letter. Do **not** collect date of birth, photographs, gender, marital status, identification numbers, or salary history.

## Recommended sequence

1. **Now**: approve role copy; publish the open-roles listing and role detail pages (editorial work only).
2. **Same week**: stand up the recruitment mailbox and go live with Option A so applications can be accepted immediately, with M365 scanning as the virus control.
3. **Next**: confirm HubSpot (or alternative vendor) licensing and obtain Legal's cross-border/PIPL sign-off; then build the Option B embedded form on the role detail pages and retire the mailbox instructions (keep the mailbox as a fallback contact).
4. **Later, if volume or governance demands it**: resume the Phase 1 Azure build per the existing spec.

## Decisions needed to proceed (owners)

| Decision | Owner |
| --- | --- |
| Approve role copy for the two manifest roles | HR |
| Approve go-live of open-roles listing + detail pages | HR |
| Create recruitment shared mailbox; name its owner | IT + HR |
| Confirm Safe Attachments policy coverage for that mailbox | IT |
| PDF-only vs PDF/DOC/DOCX allowlist | IT + Security |
| HubSpot licensing check for file-upload forms | IT |
| Cross-border / PIPL analysis for vendor-hosted candidate data | Legal |
| Privacy notice + consent wording for applications | Legal |
| Retention period for unsuccessful applications | HR + Legal |
