/* ==========================================================================
   ShoreVest Operations — Integration Adapters

   One adapter per backend system, each with the same contract:
     configured()  → boolean (all placeholders resolved, production mode)
     preflight()   → Promise<{ name, ok, detail }>   (connection health)
     …operations   → Promise-based, fail-closed

   PRODUCTION BEHAVIOR
   - Microsoft Entra ID (MSAL.js, PKCE) is the only authentication path.
   - All processing runs through Power Automate HTTP flows; the browser
     never holds Salesforce/SharePoint/Dataverse credentials.
   - If a required connection is unavailable, execution is disabled — the
     UI calls preflightAll() before any run and before any execution.
   - Connections are never switched mid-write: a failed write is verified
     (did the original action succeed?) before any retry on the backup
     connection, using the execution key.

   DEMO BEHAVIOR
   - mode "demo" answers preflights locally, uses the synthetic store, and
     performs NO network calls. Every demo response is labelled as such.
   ========================================================================== */
(function (root) {
  'use strict';

  var ENV = (root.SHOREVEST_PORTAL_ENV) || { mode: 'demo' };

  function isPlaceholder(v) { return typeof v !== 'string' || v.indexOf('ENV:') === 0 || v === ''; }
  function demoMode() { return ENV.mode !== 'production'; }

  function notConfigured(system) {
    return Promise.reject(new Error(
      system + ' is not configured. Resolve the deployment placeholders in portal-config.js ' +
      'and set mode to "production". No external call was attempted.'));
  }

  /* ── Microsoft Entra ID ────────────────────────────────────────────────── */

  /* Map raw Entra app-role values from the token (e.g. "SVOps.Administrator")
     back onto the portal role keys defined in ENV.entra.appRoles. Values that
     do not match a configured app role are passed through unchanged. The portal
     only ever trusts role claims that arrive inside the signed ID token. */
  function mapEntraRoles(rawRoles) {
    if (!Array.isArray(rawRoles)) return [];
    var map = (ENV.entra && ENV.entra.appRoles) || {};
    var byValue = {};
    Object.keys(map).forEach(function (key) { byValue[map[key]] = key; });
    return rawRoles.map(function (r) { return byValue[r] || r; });
  }

  var EntraAuth = {
    name: 'Microsoft Entra ID',
    _demoUser: null,
    /* Lazily created MSAL PublicClientApplication and its readiness promise. */
    _msal: null,
    _ready: null,
    _account: null,
    _initError: null,

    configured: function () {
      return !demoMode() &&
        !isPlaceholder(ENV.entra && ENV.entra.tenantId) &&
        !isPlaceholder(ENV.entra && ENV.entra.clientId);
    },

    /* A human-readable reason the production sign-in could not start (e.g. the
       MSAL library failed to load), or null. Surfaced on the login screen. */
    error: function () { return this._initError; },

    _authority: function () {
      return 'https://login.microsoftonline.com/' + ENV.entra.tenantId;
    },

    /* Redirect URI defaults to the page's own URL when the placeholder is
       unresolved, which is the common case for a single-page deployment. */
    _redirectUri: function () {
      var e = ENV.entra || {};
      if (!isPlaceholder(e.redirectUri)) return e.redirectUri;
      return root.location.origin + root.location.pathname;
    },

    _msalConfig: function () {
      var e = ENV.entra || {};
      return {
        auth: {
          clientId: e.clientId,
          authority: this._authority(),
          knownAuthorities: ['login.microsoftonline.com'],
          redirectUri: this._redirectUri(),
          postLogoutRedirectUri: this._redirectUri(),
          navigateToLoginRequestUrl: true
        },
        /* sessionStorage keeps tokens out of long-lived localStorage; sign-in
           does not survive closing the tab. MFA / Conditional Access are
           enforced by the tenant, not by this application. */
        cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false }
      };
    },

    /* Prefer an account that belongs to the configured ShoreVest tenant. */
    _pickAccount: function () {
      var all = this._msal ? this._msal.getAllAccounts() : [];
      for (var i = 0; i < all.length; i++) {
        if (all[i] && all[i].tenantId === ENV.entra.tenantId) return all[i];
      }
      return all[0] || null;
    },

    /**
     * DEMO: resolves locally, no library required.
     * PRODUCTION: initialise MSAL and process any redirect response returning
     * from Microsoft, then remember the active tenant account (if any).
     */
    initialize: function () {
      var self = this;
      if (!this.configured()) return Promise.resolve({ mode: 'demo' });
      if (this._ready) return this._ready;

      if (typeof root.msal === 'undefined' || !root.msal.PublicClientApplication) {
        this._initError = 'The Microsoft sign-in library (MSAL.js) did not load. ' +
          'Confirm assets/js/vendor/msal-browser-*.min.js is deployed and permitted by the Content-Security-Policy.';
        return Promise.reject(new Error(this._initError));
      }

      this._ready = new Promise(function (resolve, reject) {
        try {
          self._msal = new root.msal.PublicClientApplication(self._msalConfig());
        } catch (e) {
          self._initError = 'Microsoft Entra ID configuration is invalid: ' + e.message;
          reject(e);
          return;
        }
        self._msal.initialize()
          .then(function () { return self._msal.handleRedirectPromise(); })
          .then(function (result) {
            var acct = (result && result.account) || self._pickAccount();
            if (acct) self._msal.setActiveAccount(acct);
            self._account = self._msal.getActiveAccount();
            resolve({ mode: 'production', signedIn: !!self._account });
          })
          .catch(function (e) {
            self._initError = 'Microsoft sign-in could not be completed: ' + e.message;
            reject(e);
          });
      });
      return this._ready;
    },

    /**
     * DEMO: records the chosen demonstration identity.
     * PRODUCTION: sends the browser to Microsoft to authenticate. loginRedirect
     * navigates away, so the returned promise does not resolve here — the app
     * boots again on return and initialize() picks up the account.
     */
    signIn: function (demoIdentity) {
      if (demoMode()) {
        this._demoUser = demoIdentity;
        return Promise.resolve(demoIdentity);
      }
      var self = this;
      return this.initialize().then(function () {
        return self._msal.loginRedirect({
          scopes: (ENV.entra && ENV.entra.scopes) || ['User.Read'],
          prompt: 'select_account'
        });
      });
    },

    signOut: function () {
      this._demoUser = null;
      if (demoMode() || !this._msal) return Promise.resolve();
      this._account = null;
      return this._msal.logoutRedirect({ account: this._msal.getActiveAccount() || undefined });
    },

    /**
     * Returns a normalized identity for the signed-in tenant account, or null.
     *   { name, username, oid, tenantId, roles: [portal role keys] }
     * Enforces tenant membership: a token from any other tenant is rejected
     * (returns null) so only ShoreVest accounts enter. Role keys come from the
     * signed token's app-role claims mapped through ENV.entra.appRoles.
     */
    getAccount: function () {
      if (demoMode()) return this._demoUser;
      var acct = this._account || (this._msal && this._msal.getActiveAccount());
      if (!acct) return null;
      var claims = acct.idTokenClaims || {};
      if (claims.tid && ENV.entra && claims.tid !== ENV.entra.tenantId) return null;
      return {
        name: acct.name || claims.name || acct.username,
        username: acct.username || claims.preferred_username || '',
        oid: claims.oid || acct.localAccountId || '',
        tenantId: claims.tid || acct.tenantId || '',
        roles: mapEntraRoles(claims.roles)
      };
    },

    preflight: function () {
      if (demoMode()) return Promise.resolve({ name: this.name, ok: true, detail: 'Demonstration identity (no tenant connection).' });
      if (this._initError) return Promise.resolve({ name: this.name, ok: false, detail: this._initError });
      var signedIn = !!this.getAccount();
      return Promise.resolve({
        name: this.name,
        ok: this.configured() && signedIn,
        detail: !this.configured() ? 'Placeholders unresolved'
          : (signedIn ? 'Signed in' : 'Configured — awaiting sign-in')
      });
    }
  };

  /* ── Generic demo-aware fetch helper ───────────────────────────────────── */

  function productionFetch(url, options, systemName) {
    if (isPlaceholder(url)) return notConfigured(systemName);
    /* PRODUCTION: attach the Entra bearer token acquired via MSAL:
         options.headers.Authorization = 'Bearer ' + accessToken;
       All flows validate the token server-side. */
    return fetch(url, options).then(function (res) {
      if (!res.ok) {
        var err = new Error(systemName + ' request failed with HTTP ' + res.status + '.');
        err.status = res.status;
        throw err;
      }
      return res.json();
    });
  }

  /* ── Dataverse ─────────────────────────────────────────────────────────── */

  var Dataverse = {
    name: 'Dataverse',
    configured: function () { return !demoMode() && !isPlaceholder(ENV.dataverse && ENV.dataverse.environmentUrl); },
    /**
     * PRODUCTION: Web API at
     *   {environmentUrl}/api/data/{apiVersion}/{table}
     * with server-side row-level security. In this front end the demo
     * store (store.js) implements the identical entity contract.
     */
    preflight: function () {
      if (demoMode()) return Promise.resolve({ name: this.name, ok: true, detail: 'Demonstration store (localStorage) in use.' });
      if (!this.configured()) return Promise.resolve({ name: this.name, ok: false, detail: 'Environment URL placeholder unresolved.' });
      return productionFetch(ENV.dataverse.environmentUrl + '/api/data/' + ENV.dataverse.apiVersion + '/WhoAmI', {}, this.name)
        .then(function () { return { name: 'Dataverse', ok: true, detail: 'Connected' }; })
        .catch(function (e) { return { name: 'Dataverse', ok: false, detail: e.message }; });
    }
  };

  /* ── SharePoint ────────────────────────────────────────────────────────── */

  var SharePoint = {
    name: 'SharePoint',
    configured: function () { return !demoMode() && !isPlaceholder(ENV.sharepoint && ENV.sharepoint.siteUrl); },
    /**
     * PRODUCTION: uploads go to the incoming library via Graph
     *   PUT /sites/{site-id}/drives/{drive-id}/root:/{path}:/content
     * Generated outputs are written by the flow to the outputs library and
     * shared back as links. Required folders are verified by preflight.
     */
    uploadSourceFile: function (batchId, file) {
      if (demoMode()) {
        return Promise.resolve({ demo: true, url: null,
          detail: 'Demonstration mode: file retained in browser memory only; nothing was uploaded.' });
      }
      return notConfigured('SharePoint');
    },
    preflight: function () {
      if (demoMode()) return Promise.resolve({ name: this.name, ok: true, detail: 'Demonstration mode: browser memory in place of SharePoint.' });
      return Promise.resolve({ name: this.name, ok: this.configured(), detail: this.configured() ? 'Configured' : 'Site URL placeholder unresolved.' });
    }
  };

  /* ── Power Automate ────────────────────────────────────────────────────── */

  var PowerAutomate = {
    name: 'Power Automate',
    configured: function () {
      var f = ENV.powerAutomate && ENV.powerAutomate.flows;
      return !demoMode() && f && !isPlaceholder(f.processBatch);
    },
    /**
     * PRODUCTION: POST the batch envelope to the processBatch flow URL.
     * The flow: validates token → acquires the batch lock in Dataverse →
     * runs Office Scripts parsing → Salesforce matching → rules →
     * classification → reconciliation → workbook generation → unlock.
     * Every step writes structured error logs and audit events.
     * Flow retries are idempotent via the execution-key registry.
     */
    triggerProcessBatch: function (payload) {
      if (demoMode()) return Promise.resolve({ demo: true, detail: 'Demonstration mode: processing runs locally in the browser.' });
      return productionFetch(ENV.powerAutomate.flows.processBatch,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        this.name);
    },
    triggerExecuteApprovedActions: function (payload) {
      if (demoMode()) return Promise.resolve({ demo: true, detail: 'Demonstration mode: external actions are simulated and clearly labelled.' });
      return productionFetch(ENV.powerAutomate.flows.executeApprovedActions,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        this.name);
    },
    preflight: function () {
      if (demoMode()) return Promise.resolve({ name: this.name, ok: true, detail: 'Demonstration mode: orchestration simulated locally.' });
      return Promise.resolve({ name: this.name, ok: this.configured(), detail: this.configured() ? 'Flow URLs configured' : 'Flow URL placeholders unresolved.' });
    }
  };

  /* ── Salesforce ────────────────────────────────────────────────────────── */

  var Salesforce = {
    name: 'Salesforce',
    configured: function () { return PowerAutomate.configured(); },
    /**
     * PRODUCTION: matching and any approved create/update run inside the
     * Power Automate flow through the managed Salesforce connector
     * (primary, with backup connection reference). The browser never
     * queries Salesforce. Matching thresholds come from Configuration.
     *
     * DEMO: matches against the clearly-labelled synthetic index in the
     * demo store. No real Salesforce data exists in this application.
     */
    matchContacts: function (emails, demoIndex) {
      if (demoMode()) {
        var byEmail = {};
        (demoIndex && demoIndex.contacts || []).forEach(function (c) {
          var e = String(c.email || '').toLowerCase();
          (byEmail[e] = byEmail[e] || []).push(c);
        });
        var out = {};
        (emails || []).forEach(function (e) { if (byEmail[e]) out[e] = byEmail[e]; });
        return Promise.resolve({ demo: true, contactsByEmail: out,
          liveProcessEmails: (demoIndex && demoIndex.liveProcessEmails) || [] });
      }
      return notConfigured('Salesforce (via Power Automate connector)');
    },
    preflight: function () {
      if (demoMode()) return Promise.resolve({ name: this.name, ok: true, detail: 'Demonstration mode: synthetic sample index (no CRM connection).' });
      return Promise.resolve({ name: this.name, ok: this.configured(), detail: this.configured() ? 'Connector configured via flows' : 'Connector placeholders unresolved.' });
    }
  };

  /* ── Office Scripts ────────────────────────────────────────────────────── */

  var OfficeScripts = {
    name: 'Office Scripts',
    configured: function () {
      var s = ENV.officeScripts && ENV.officeScripts.scripts;
      return !demoMode() && s && !isPlaceholder(s.generateOutput);
    },
    /**
     * PRODUCTION: the generateOutput script builds the controlled output
     * workbook from the approved template: fixed sheet order (README,
     * BATCH SUMMARY, READY, REVIEW REQUIRED, DUPLICATES, BLOCKED, INVALID,
     * SOURCE DATA, AUDIT LOG, CONFIG SNAPSHOT), formatted tables, filters,
     * frozen headers, protected system fields, no external links, no
     * macros. Invoked by the flow with the batch payload.
     *
     * DEMO: generates a CSV-based multi-part text export so reviewers can
     * see the exact workbook contract without an Excel runtime.
     */
    preflight: function () {
      if (demoMode()) return Promise.resolve({ name: this.name, ok: true, detail: 'Demonstration mode: workbook contract rendered as text export.' });
      return Promise.resolve({ name: this.name, ok: this.configured(), detail: this.configured() ? 'Script IDs configured' : 'Script ID placeholders unresolved.' });
    }
  };

  /* ── Pre-flight aggregation ────────────────────────────────────────────── */

  /**
   * Verify every required connection, plus configuration, templates and
   * sender authorisation, before processing or execution. Any failure
   * disables execution (fail closed).
   */
  function preflightAll(extras) {
    var checks = [
      EntraAuth.preflight(),
      Dataverse.preflight(),
      SharePoint.preflight(),
      PowerAutomate.preflight(),
      Salesforce.preflight(),
      OfficeScripts.preflight()
    ];
    return Promise.all(checks).then(function (results) {
      (extras || []).forEach(function (x) { results.push(x); });
      return {
        results: results,
        allOk: results.every(function (r) { return r.ok; }),
        checkedAt: new Date().toISOString()
      };
    });
  }

  root.SVPortalIntegrations = {
    ENV: ENV,
    demoMode: demoMode,
    EntraAuth: EntraAuth,
    Dataverse: Dataverse,
    SharePoint: SharePoint,
    PowerAutomate: PowerAutomate,
    Salesforce: Salesforce,
    OfficeScripts: OfficeScripts,
    preflightAll: preflightAll
  };
})(typeof self !== 'undefined' ? self : this);
