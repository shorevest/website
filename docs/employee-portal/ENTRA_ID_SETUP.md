# ShoreVest One — Microsoft Entra ID (Office 365) sign-in

This is the password gate for ShoreVest One. Instead of a shared password, the
portal signs people in with their **ShoreVest Microsoft 365 / Entra ID account**
using MSAL.js and the Authorization Code + PKCE flow. Only accounts in the
ShoreVest tenant can enter, and multi-factor authentication and Conditional
Access are enforced by the tenant — not by this application.

Everything needed to run it ships in the repository. What remains is a one-time
**Azure app registration** (an Azure/Entra admin task) and filling three values
into [`portal-config.js`](../../assets/js/employee-portal/portal-config.js).

> **Scope / honesty note.** This gates *access to the ShoreVest One workspace*,
> which currently runs on **synthetic data with mock connectors**. It is real
> authentication, but it is a client-side single-page-app sign-in: there is no
> ShoreVest server validating tokens yet. Standing up a real backend, real
> connectors, and server-side authorization remains a separate blocker — see
> [`../shorevest-one/BLOCKERS.md`](../shorevest-one/BLOCKERS.md). Do not put real
> investor data behind this gate until that work is done.

---

## What's already built

- `assets/js/vendor/msal-browser-3.30.0.min.js` — the official Microsoft MSAL
  browser library, vendored locally (served from `'self'`, no CDN).
- `assets/js/employee-portal/integrations.js` — the `EntraAuth` adapter: MSAL
  init, `loginRedirect`, redirect handling, **tenant enforcement**, and
  app-role → portal-role mapping.
- `assets/js/employee-portal/app.js` — a real **"Sign in with Microsoft"** login
  screen shown in production mode; the demo profile chooser is used otherwise.
- `_headers` — Content-Security-Policy allows `login.microsoftonline.com` for the
  token endpoint and silent token renewal (only relevant on hosts that apply
  `_headers`, i.e. Netlify / Cloudflare Pages; GitHub Pages sends no CSP).

The portal stays in **demo mode** — the current behaviour, no external calls —
until every step below is complete. Nothing here changes the public website.

---

## Step 1 — Register the application in Microsoft Entra ID

In the [Entra admin center](https://entra.microsoft.com) → **Applications** →
**App registrations** → **New registration**:

1. **Name:** `ShoreVest One`.
2. **Supported account types:** *Accounts in this organizational directory only
   (ShoreVest only — single tenant).*
3. **Redirect URI:** platform **Single-page application (SPA)**, value = the
   exact portal URL, e.g. `https://shorevest.com/employee-portal/`.
   - The SPA platform is required — it enables PKCE and CORS on the token
     endpoint and means **no client secret** is created or stored.
   - Add every origin the portal is served from (production, and any staging
     URL) as additional SPA redirect URIs. The trailing slash must match.
4. Register, then from the **Overview** page copy:
   - **Application (client) ID** → `entra.clientId`
   - **Directory (tenant) ID** → `entra.tenantId`

Under **Authentication**, confirm the SPA redirect URI is listed and that
implicit grant (access/ID tokens) is **off** — the code+PKCE flow does not use
it.

Under **Token configuration** (optional but recommended) add the optional claim
**`email`** and, if you want group-driven roles later, the **groups** claim.

---

## Step 2 — Define app roles (optional now, needed for per-role access)

The portal reads role claims from the token and maps them to portal roles via
`entra.appRoles` in `portal-config.js`. Until roles are assigned, every
authenticated ShoreVest account enters the full demonstration workspace (this is
intentional for the current phase; per-role navigation is a documented later
step in `ARCHITECTURE.md`).

To prepare roles, in the app registration → **App roles** → create one role per
entry in `entra.appRoles`, using the **value** shown there:

| Portal role key       | App role value (Entra)      |
| --------------------- | --------------------------- |
| `employee`            | `SVOps.Employee`            |
| `irOperations`        | `SVOps.IROperations`        |
| `relationshipManager` | `SVOps.RelationshipManager` |
| `executionApprover`   | `SVOps.ExecutionApprover`   |
| `administrator`       | `SVOps.Administrator`       |
| `auditor`             | `SVOps.Auditor`             |

Then in **Enterprise applications** → *ShoreVest One* → **Users and groups**,
assign the appropriate security groups or users to each role. Group-to-role
assignment is how permissions are granted; the portal only ever trusts the role
claims inside the signed token.

Restricting who can sign in at all (beyond tenant membership) is done here too:
set the enterprise application to **Assignment required = Yes** and assign only
the ShoreVest security group that should have access.

---

## Step 3 — Fill in `portal-config.js` and switch to production

Edit [`assets/js/employee-portal/portal-config.js`](../../assets/js/employee-portal/portal-config.js)
(or inject these at deploy time):

```js
window.SHOREVEST_PORTAL_ENV = {
  mode: 'production',                 // was 'demo'
  entra: {
    tenantId: '<Directory (tenant) ID>',
    clientId: '<Application (client) ID>',
    redirectUri: 'https://shorevest.com/employee-portal/',
    // appRoles: { ... }  // leave as shipped unless you renamed the app roles
    scopes: ['User.Read']
  },
  // ...leave the other sections as placeholders until those systems are wired.
};
```

Notes:

- `tenantId` and `clientId` are **not secrets** — a public client ID is expected
  to be visible in a browser app. There is no client secret in this flow.
- If `redirectUri` is left as a placeholder, the portal falls back to the page's
  own URL at runtime; setting it explicitly is clearer and must match what you
  registered in Step 1.
- Sign-in only activates when **both** `tenantId` and `clientId` are real (no
  `ENV:` prefix) and `mode` is `'production'`. Any placeholder → the portal
  stays in demo mode and makes no external calls.

---

## Step 4 — Verify

1. Deploy and open `/employee-portal/`.
2. You should see **"Sign in with Microsoft"** (not the demo profile card).
3. Click it → redirect to Microsoft → authenticate (with MFA if the tenant
   requires it) → redirect back → the workspace loads with your real name and
   initials in the sidebar profile.
4. Sign out (profile menu) returns you to the Microsoft-sign-in screen.

Checks to confirm the gate holds:

- A personal or other-tenant Microsoft account is rejected — the portal
  enforces `tid === tenantId` and shows the sign-in screen again.
- If MSAL fails to load or the config is wrong, the sign-in screen shows the
  specific error instead of silently entering.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Still shows the demo profile card | `mode` isn't `'production'`, or `tenantId`/`clientId` still contain an `ENV:` placeholder. |
| `AADSTS9002326` / cross-origin token error | The SPA redirect URI (exact origin + path, trailing slash) isn't registered, or it was added under the **Web** platform instead of **Single-page application**. |
| `AADSTS50011` redirect mismatch | `redirectUri` in `portal-config.js` doesn't exactly match a registered SPA redirect URI. |
| "The Microsoft sign-in library (MSAL.js) did not load" | The vendored `assets/js/vendor/msal-browser-*.min.js` isn't deployed, or a stricter CSP blocked it. On Netlify/Cloudflare confirm the `_headers` policy; GitHub Pages applies no CSP. |
| Signed in but redirected back to sign-in | The account is in a different tenant, or **Assignment required** is on and the account isn't assigned to the enterprise app. |

---

## Upgrading the vendored MSAL library

The library is pinned at `msal-browser-3.30.0.min.js`. To update:

```bash
npm pack @azure/msal-browser@<version>
tar xzf azure-msal-browser-<version>.tgz
cp package/lib/msal-browser.min.js assets/js/vendor/msal-browser-<version>.min.js
```

Then update the `<script>` src in `employee-portal/index.html` and remove the
old file. Keep it a locally served UMD build so it stays within a `'self'`
`script-src`.
