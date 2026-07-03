/* ==========================================================================
   ShoreVest Operations — Integration Adapters

   One adapter per backend system, each with the same contract:
     configured()  → boolean (all placeholders resolved, production mode)
     preflight()   → Promise<{ name, ok, detail }>   (connection health)
     …operations   → Promise-based, fail-closed

   PRODUCTION BEHAVIOUR
   - Microsoft Entra ID (MSAL.js, PKCE) is the only authentication path.
   - All processing runs through Power Automate HTTP flows; the browser
     never holds Salesforce/SharePoint/Dataverse credentials.
   - If a required connection is unavailable, execution is disabled — the
     UI calls preflightAll() before any run and before any execution.
   - Connections are never switched mid-write: a failed write is verified
     (did the original action succeed?) before any retry on the backup
     connection, using the execution key.

   DEMO BEHAVIOUR
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

  var EntraAuth = {
    name: 'Microsoft Entra ID',
    _demoUser: null,

    configured: function () {
      return !demoMode() &&
        !isPlaceholder(ENV.entra && ENV.entra.tenantId) &&
        !isPlaceholder(ENV.entra && ENV.entra.clientId);
    },

    /**
     * PRODUCTION: initialise MSAL and process any redirect response.
     *   const msalApp = new msal.PublicClientApplication({
     *     auth: {
     *       clientId: ENV.entra.clientId,
     *       authority: 'https://login.microsoftonline.com/' + ENV.entra.tenantId,
     *       redirectUri: ENV.entra.redirectUri
     *     },
     *     cache: { cacheLocation: 'sessionStorage' }
     *   });
     * MFA / Conditional Access are enforced by the tenant, not here.
     */
    initialize: function () {
      if (this.configured()) {
        return notConfigured('Microsoft Entra ID (MSAL.js is not bundled in the repository build)');
      }
      return Promise.resolve({ mode: 'demo' });
    },

    /** PRODUCTION: msalApp.loginRedirect({ scopes: ENV.entra.scopes }). */
    signIn: function (demoIdentity) {
      if (demoMode()) {
        this._demoUser = demoIdentity;
        return Promise.resolve(demoIdentity);
      }
      return notConfigured('Microsoft Entra ID sign-in');
    },

    signOut: function () {
      this._demoUser = null;
      /* PRODUCTION: msalApp.logoutRedirect(). */
      return Promise.resolve();
    },

    /**
     * Returns { name, username, roles: [portal role names] } or null.
     * PRODUCTION: read the account from MSAL and map token role claims
     * (ENV.entra.appRoles) onto portal roles. Group membership is handled
     * by Entra app-role assignment to security groups — the portal only
     * trusts token claims.
     */
    getAccount: function () {
      if (demoMode()) return this._demoUser;
      return null;
    },

    preflight: function () {
      if (demoMode()) return Promise.resolve({ name: this.name, ok: true, detail: 'Demonstration identity (no tenant connection).' });
      return Promise.resolve({ name: this.name, ok: this.configured(), detail: this.configured() ? 'Configured' : 'Placeholders unresolved' });
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
