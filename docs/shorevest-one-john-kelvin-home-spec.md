# ShoreVest One — John & Kelvin Home, Login and Public Visibility (Phase 2B)

**Status:** Source of truth for the Phase 2B corrective refinement.
**Branch:** `claude/shorevest-one-home-correction-g4hxbs`
**Supersedes:** the Phase 2A intermediate prototype (PR #101 work) where this document conflicts with it.

ShoreVest One is an **internal demonstration environment**. It is an
investment-firm operating layer, not a task dashboard, CRM, reporting or
performance dashboard, activity feed, generic SaaS portal, intranet homepage,
chatbot homepage, a collection of Power Automate utilities, or an
employee-monitoring product.

Core product principle: **ShoreVest One absorbs complexity rather than
displaying it.**

- **Home** answers: *"What should I pay attention to right now?"*
- **My Work** answers: *"What currently depends on me?"*
- **A workspace** represents a durable shared business process.
- **Tools** contains bounded utilities and the preserved legacy prototype.

Operating pattern: **Notice → Prepare → Confirm → Complete.** The demonstration
may prepare and recommend, but **no external action ever occurs** (no email,
calendar, Salesforce, SharePoint, data-room, DDQ, publishing, external contact,
or real approval).

---

## 1. Frozen requirements

These are fixed and must not be silently omitted or reinterpreted.

### 1.1 Product naming
- Normal prose: **ShoreVest One**.
- Visual application lockup: **SHOREVEST ONE**.
- Never: `ShoreVestOne`, `ShoreVest ONE`, `Shorevest One`, a generic "One"
  wordmark, or an invented product logo.
- Full bilingual ShoreVest corporate lockup is reserved for **login** and formal
  corporate surfaces. Inside the app shell use only the **compact ShoreVest
  mark + `SHOREVEST ONE`**. Do not duplicate the full corporate lockup inside
  the app.

### 1.2 Exact role identities
- **John Jones** — Director of Client Solutions — *(Americas, Europe & Middle
  East)*. Never "Ex-Asia", never without parentheses, never with an em-dash
  region suffix.
- **Kelvin Chan** — Director of Client Solutions — *(Asia-Pacific)*. Never
  "Asia", "APAC", or an em-dash region suffix.
- **Celestra Gallagher** — Investor Relations Associate.
- Real approved employee photographs only where the repo already contains them
  (`assets/img/team/john-jones.jpg`, `kelvin-chan.jpg`). Celestra is synthetic
  and has no approved photo → restrained **initials avatar** (never a generated
  face, invented photo, or stock photography).

### 1.3 Frozen John & Kelvin navigation
```
SHOREVEST ONE
Home
My Work
WORKSPACES
  Relationships
  Outreach
  Meetings
  Diligence & Requests
  Investor Intelligence
Firm
Tools
```
- **Excluded** from John/Kelvin nav: Weekly Review, Investor Inbox, Tasks,
  Calendar, Reports, Pipeline, Materials & Delivery, Meeting Support, Library,
  Rules & Compliance, Approvals, Notifications, Settings, Administration,
  Monitoring, Previous Runs (as a permanent top-level item), All Workspaces,
  Knowledge, Recent Activity.
- Legacy modules (Process a List, Review Exceptions, Previous Runs,
  Administration, Monitoring, data-quality/reporting utilities) remain available
  **under Tools**: visible, secondary, collapsed by default, functionality
  preserved, not the main experience.

### 1.4 Sidebar behaviour
- Desktop: expanded by default; light cream/warm-white; compact collapse
  chevron; collapse preference remembered in local/session storage; accessible
  tooltips when collapsed; keyboard accessible. Selected Home state uses a
  narrow cinnabar accent / subtle warm tint — **no large filled red block**.
- Profile identity lives at the **bottom** of the sidebar; profile is clickable;
  menu = Profile, Preferences, Help, Sign out. **No** permanent Sign-out button,
  **no** duplicated large user identity at the top, **no** logout icon in the
  top bar.

### 1.5 Top bar
- Show: Search or Ask ShoreVest One; Add to ShoreVest One; Help / Report issue;
  compact profile control.
- Search/Ask and Add open clearly-labelled **synthetic placeholder** panels; no
  implied real integration or external action.
- **Do not show:** notification bell, unread counters, Quick Actions, generic
  New button, logout icon, run IDs, execution IDs, environment codes, permanent
  integration status, duplicate corporate branding.

### 1.6 Demonstration notice
- One restrained notice only:
  *"Demonstration — Synthetic data only. No external actions occur."*
- No overlapping labels (Demo / Preview / Demonstration environment / Sign-in
  simulated / Authorised access only). No R-2026.07, T-2026.07, build numbers,
  environment IDs, session IDs, or browser-storage wording.

### 1.7 John & Kelvin Home structure (supersedes Phase 2A)
Home contains, in order:
1. **Focus Now** — exactly one expanded priority.
2. **Today** — remaining important schedule (≤3, never repeats Focus Now).
3. **Under Control** — one reassurance line by default.
4. **Around ShoreVest** — optional, quiet, ≤2 items.

Not on Home: "Needs you 3", three equal priority cards, decision-card grid,
Waiting elsewhere, pipeline summary, recent activity, metrics row, relationship
scores, activity counts, performance indicators. Waiting work lives in My Work.

### 1.8 Home header
- Local greeting (Good morning/afternoon/evening, {first name}).
- Discreet purpose line: *"What should I pay attention to right now?"*
- One situational sentence (e.g. *"One decision needs you before your next
  meeting."*). Under Control reassurance is **not** repeated in the header.
- Browser-local date, or a clearly-labelled 2026 synthetic date. **Never 2025.**
  No permanent dual NY/HK clock; time zones contextually only.

### 1.9 Home default & customisation
- Show *"ShoreVest default — Recommended for your role"*.
- Restrained **Customise Home**: reorder secondary sections; show/hide Around
  ShoreVest; compact/expanded secondary display; **Restore ShoreVest default**.
- Users may **not** hide urgent decisions, safety warnings, or overdue external
  commitments. The system controls importance; the user controls non-critical
  arrangement.

### 1.10 Focus Now (ten-second standard)
One card that makes clear: what happened, what changed, the exact decision
required, why it needs them, when it is due (with time zone), what ShoreVest One
recommends and why, evidence quality, what opening the review will do, what
happens only after confirmation, and who owns the next step. Progressive
disclosure — not a long checklist.

Card contains: concise title; 1–2 lines of context; exact commercial decision;
"Why this needs you"; due time; recommendation + reasoning; evidence-quality
summary; **one** primary action (review-oriented, e.g. *"Review revised meeting
plan"*); ≤2 quiet secondary actions; disclosures ("Why am I seeing this?",
"Evidence and sources", "What will happen if I confirm?").

Opening the review must not send, invite, publish, write to a system, or change
a calendar. State clearly: *"No message or invitation will be sent until you
confirm the exact package."*

### 1.11 Safe correction routes
Every Focus Now item offers: Change, Need review, Not enough information, This is
not mine, The information is wrong, Someone else should decide, Need help.
Grouped under one accessible control (*"Something wrong?"*) but all readily
available. Never: Challenge, Proceed, Submit, Done, generic "Action required".

### 1.12 No false-green language
Never: "Safe to act", "Fully verified", "All clear", "Everything is safe",
"Verified and approved", green shield, large green check, traffic-light safety
indicators. Use scoped wording (e.g. *"Relationship ownership and attendee
availability checked at 07:42 ET. External confirmation is still required."*).
Distinguish system-verified / human-confirmed / inferred / conflicting / stale /
unavailable. Show a concise evidence-quality summary, not just "Evidence (3)".

### 1.13 Synthetic Focus examples
- **John** — *Red Panda Capital meeting*: LP confirmed 10:30 ET; the required
  second ShoreVest attendee is unavailable until 10:45 ET; recommend moving the
  start to 10:45 ET. Two-attendee policy explained contextually.
- **Kelvin** — a different animal-based institution demonstrating the **mainland
  attendance rule**: a substantive interaction with a PRC-headquartered LP (or
  the PRC office of an international LP) where internal attendance lacks an
  eligible mainland-team participant; recommend adding an eligible mainland-team
  attendee before proposing/confirming. Where no confirmed eligible named
  employee is available, show *"Eligible mainland-team attendee required"* (do
  not invent an employee). No WeChat/translation/bilingual features.

### 1.14 Meeting policy (explained contextually, not as permanent warnings)
1. Substantive LP meetings require ≥2 ShoreVest attendees.
2. A genuinely casual coffee may be solo.
3. An interaction with the PRC office of an international LP, or any office of a
   PRC-headquartered LP, requires Ben or an eligible mainland-team attendee.
4. Missing required attendance ⇒ the meeting is not ready.
5. Exceptions require explicit approval and a record.

### 1.15 Today / Under Control / Around ShoreVest
- **Today:** remaining schedule only, ≤3, precise states (Ready for meeting,
  Internal attendance incomplete, Needs preparation, No preparation required,
  Investor confirmed). "Investor confirmed" ≠ "Ready for meeting". Contextual
  time zones. No colourful status pills.
- **Under Control:** one reassurance line by default; expand only for overdue
  work, conflict, broken external promise, material risk, or need for senior
  intervention.
- **Around ShoreVest:** optional, quiet, ≤2; real ShoreVest employee names only;
  no pressure actions (no "Send congratulations", "Send message", "RSVP now") —
  a quiet information link suffices.

### 1.16 My Work
Lightweight demonstration shell with views **Needs me / Waiting / Later**, each
clearly explained. Waiting items show who has the next action, expected timing,
when John/Kelvin should follow up, and whether they remain accountable. Not a
Salesforce Tasks page, inbox, activity feed, or metric dashboard.

### 1.17 Workspace placeholders
Restrained routes for Relationships, Outreach, Meetings, Diligence & Requests,
Investor Intelligence, Firm. Each shows destination name, one-line plain-English
description, and *"Demonstration capability — workflow not yet connected."* No
metrics, empty dashboards, fake integrations, or fake live data. Descriptions:
- Relationships: Institutions, people, relationship strategy, commitments and next moves.
- Outreach: Targeting, campaigns, sequencing, replies and re-engagement.
- Meetings: Preparation, readiness, materials, attendance and follow-up.
- Diligence & Requests: DDQs, document requests, data-room requests and delivery control.
- Investor Intelligence: Source-linked investor feedback, recurring themes and management implications.
- Firm: People, availability, offices, events, resources and internal information.

### 1.18 Celestra
Preserve her role and existing synthetic demonstration Home/functionality. Do
not remove her or force her into the John/Kelvin commercial Home structure.
Shared improvements (shell, login, branding, accessibility, profile menu,
demonstration notice) apply. No role leakage between the three.

### 1.19 Login (complete compositional redesign)
- Rejected: the small centred card. Replace the composition.
- Desktop: balanced editorial two-column frame ≈900–1040px on a 1440px viewport
  (never the previous narrow card), one outer border, no nested card in the
  right column, generous padding, minimal/no shadow, ≤ ~⅓ viewport as empty
  space, frame ≥ ~800px unless the viewport forces otherwise.
- **Left:** approved ShoreVest bilingual corporate lockup; discreet
  `SHOREVEST ONE`; *"The operating workspace for ShoreVest teams."*; *"Internal
  demonstration environment"*.
- **Right:** heading *"Enter ShoreVest One"*; instruction *"Choose a
  demonstration profile to continue."*; selector default *"Choose a profile"*;
  options John Jones / Kelvin Chan / Celestra Gallagher. After selection show
  name, exact approved title, coverage description, initials/photo. Primary
  button updates: *Continue as John / Kelvin / Celestra*. Small notice:
  *"Synthetic data only. No external actions occur."* Button disabled until a
  profile is selected.
- **Copy restrictions:** never "Select access role", "Choose access level",
  "Sign in as role", "Authorised access only", "Preview — sign-in simulated",
  "Authenticate", "Execution Approver", "Administrator", technical capability
  names, fake SSO, password fields, real emails, version/environment/build/run
  IDs. Profile selection is a demonstration choice, **not authentication**.
- **Branding:** existing approved bilingual lockup asset, once on desktop, once
  at top of mobile; never redrawn/rebuilt/stretched/duplicated; compact app mark
  is **not** placed next to it on the login surface. Hierarchy: corporate
  identity → product name → selected employee identity.
- **Responsive:** two columns retained near 1024px if comfortable, else a wide
  single column; at 390px a single vertical sequence (lockup → description →
  selector → selected details → full-width button → notice), no horizontal
  overflow, no tiny floating card, usable at increased text size. Prefer a
  native `<select>`.
- **Type & colour:** DIN 2014 from local assets; no external font provider; warm
  off-white page, white/cream frame, charcoal text, muted secondary text, faint
  beige-grey border, sparse cinnabar. Primary button refined (not an oversized
  black slab), clear hover/focus/disabled states, sufficient contrast.

### 1.20 Visual design (shell & Home)
DIN 2014 throughout; warm off-white background; white/cream sidebar; white/pale
cards; charcoal text; faint borders; minimal shadows; generous whitespace;
sparse cinnabar (brand, selected-nav accent, one primary action, genuine
urgency). No dark sidebar, gradients, glassmorphism, glow, heavy shadows, giant
red panels, bright blue/purple, traffic-light pills, giant icons, KPI cards,
pipeline totals, activity feeds, relationship/employee scores, gamification.
Desktop Home hierarchy: header → situational sentence → one full-width Focus Now
card → Today + Under Control → optional quiet Around ShoreVest. No three-equal-
card / tile-row / coloured-card-wall layouts.

### 1.21 Mobile application shell
Replace the large boxed MENU treatment with a compact app bar: compact ShoreVest
mark, SHOREVEST ONE, menu icon, compact profile control. Accessible drawer nav.
Focus Now first; primary action visible; Today/Under Control scannable; Around
ShoreVest quiet; no horizontal scroll; usable touch targets; exact role title
accessible without dominating; no run IDs / technical metadata.

### 1.22 Public website visibility (temporary, reversible)
ShoreVest One must not be promoted or discoverable from the public site this
phase. Remove **all** public entry points: desktop nav, mobile nav, footer,
homepage, Firm page, Investor Portal page, any public page/CTA, public
client-side search index, generated nav manifests, public sitemap, public
structured-data / JSON-LD / Open Graph / Twitter-card / canonical / hreflang,
PWA shortcuts, web-app manifests, 404 suggestions, related-link sections. Do
**not** add a replacement public link (Employee login, Internal/Staff/Employee/
Team portal). Do not delete or break the app; the direct preview route
(`employee-portal/index.html`) remains available.

### 1.23 Search-engine controls
Apply, **only to the ShoreVest One preview entry page**:
`<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />`.
Add the path to `robots.txt` where appropriate. Do not noindex any public page
(homepage, Firm, Strategy, Team, Research, Investor Portal, Important
Information, etc.). The public site and the portal are **separate HTML entry
documents**, so route-specific metadata is straightforward.

### 1.24 Public-website non-regression
No redesign; only targeted changes to hide ShoreVest One. Preserve public
navigation, content, visual design, unrelated SEO, unrelated Investor Portal
links, and all other public routes. Removing ShoreVest One must leave no empty
nav groups, broken dividers, gaps, dead buttons, broken footer columns, JS
errors, or broken links.

### 1.25 Testing & screenshots
All items in Phase 2B §46 tests and §47 screenshots. Existing rules-engine and
portal tests preserved and passing. Screenshots capture only the rendered
viewport (no browser chrome).

---

## 2. Intentionally deferred production authentication

- The demonstration **profile selector is not authentication.**
- Real authentication, SSO, and production role permissions are **intentionally
  deferred** to a later phase. The Microsoft Entra ID / MSAL production path
  remains stubbed and fail-closed in `integrations.js` / `portal-config.js`.
- ShoreVest One must **not** be described as secure, protected, private,
  authenticated, access-controlled, or available only to authorised employees.
  Accurate wording: **"Internal demonstration environment."**

## 3. Temporary public-site hiding

- Removal from the public site is **temporary and reversible**.
- One clear source flag governs intent:
  `assets/js/site-config.js → showShoreVestOnePublicLink: false`.
- The shared footer module (`assets/js/shared-footer.js`) honours the flag, and
  the hardcoded per-page footers were edited by a single consistent rule
  (removing exactly the ShoreVest One access anchor), so restoration is a single
  flag flip plus re-applying the same one-line rule — not manual hunting across
  unrelated files. A `robots.txt` `Disallow: /employee-portal/` entry is added.

## 4. Future proposals (not built this phase)

Real outreach/audience matching/sending, reply triage, meeting scheduling,
calendar writes, meeting-readiness engine, Salesforce/SharePoint/Outlook/Teams/
data-room integration, DDQ extraction, document delivery, WeChat/bilingual
workflow, real AI recommendations, continuity incident management, investment
research tools, website publishing, production notifications/approval routing.
Static synthetic recommendations are allowed.

## 5. Assumptions

1. **PR #101 status:** the Phase 2A work is already present on this branch's
   history; the stale `origin/main` is far behind. Per the explicit branch
   instruction, all Phase 2B work is developed on
   `claude/shorevest-one-home-correction-g4hxbs`. PR #101 is not modified.
2. **DIN 2014 assets:** DIN 2014 is a licensed commercial font loaded via
   `local()` sources site-wide (see `shorevest-brand-tokens.css`); no `.woff` is
   committed for licensing reasons. The portal reuses the same `local()`
   @font-face rules and requests **no external font provider**. Where DIN 2014
   is not installed on the viewing device the stack falls back to `system-ui`
   (a device font, not an external web-font request).
3. **No sitemap.xml / robots.txt / web-app manifest / public JSON-LD /
   structured data / client-side search index currently reference ShoreVest
   One** — a full-repo audit found the only public entry points are the footer
   "Access" links. A minimal `robots.txt` is added defensively.
4. **Celestra** keeps a distinct coordination Home schema; only John and Kelvin
   receive the new commercial Home structure.
5. **Synthetic date:** Home uses the browser-local date, labelled as synthetic;
   examples are set in 2026.
