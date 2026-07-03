/* ==========================================================================
   ShoreVest Operations — Deployment Configuration (PLACEHOLDERS ONLY)

   This file is the single place where tenant-specific configuration is
   injected at deployment. Every value below is a placeholder; nothing
   tenant-specific, no credentials, no tokens, no account IDs, and no real
   URLs are committed to this repository.

   HOW TO DEPLOY
   1. Copy this file into the deployment pipeline (or serve it from a
      configuration endpoint) and replace each "ENV:*" placeholder with the
      value of the matching environment variable / Key Vault secret.
   2. Set mode to "production". While mode is "demo", the portal runs
      entirely locally with synthetic data and NO external calls are made.
   3. Authentication uses Microsoft Entra ID via MSAL.js with PKCE. There is
      no separate username/password system. MFA and Conditional Access are
      enforced by Entra ID tenant policy, not by this application.
   ========================================================================== */
window.SHOREVEST_PORTAL_ENV = {
  /* "demo" — synthetic local mode, no external calls (default in repo).
     "production" — requires every placeholder below to be resolved. */
  mode: 'demo',

  /* ── Microsoft Entra ID (authentication + roles) ─────────────────────── */
  entra: {
    tenantId: 'ENV:SVOPS_ENTRA_TENANT_ID',
    clientId: 'ENV:SVOPS_ENTRA_CLIENT_ID',
    /* Redirect URI registered on the app registration, e.g. the portal URL. */
    redirectUri: 'ENV:SVOPS_ENTRA_REDIRECT_URI',
    /* App roles defined on the Entra app registration. Group-based
       permissions map security groups to these roles via app role
       assignment; the portal only ever reads role claims from the token. */
    appRoles: {
      employee: 'SVOps.Employee',
      irOperations: 'SVOps.IROperations',
      relationshipManager: 'SVOps.RelationshipManager',
      executionApprover: 'SVOps.ExecutionApprover',
      administrator: 'SVOps.Administrator',
      auditor: 'SVOps.Auditor'
    },
    scopes: ['User.Read']
  },

  /* ── Dataverse (workflow + control database) ─────────────────────────── */
  dataverse: {
    environmentUrl: 'ENV:SVOPS_DATAVERSE_URL',        /* https://<org>.crm.dynamics.com */
    apiVersion: 'v9.2',
    tables: {
      processingBatch: 'svops_processingbatch',
      processingRow: 'svops_processingrow',
      savedProcess: 'svops_savedprocess',
      configuration: 'svops_configuration',
      auditEvent: 'svops_auditevent',
      executionRegistry: 'svops_executionregistry'
    }
  },

  /* ── SharePoint (source files + generated outputs) ───────────────────── */
  sharepoint: {
    siteUrl: 'ENV:SVOPS_SHAREPOINT_SITE_URL',
    libraries: {
      incoming: 'ENV:SVOPS_SP_LIBRARY_INCOMING',
      outputs: 'ENV:SVOPS_SP_LIBRARY_OUTPUTS',
      templates: 'ENV:SVOPS_SP_LIBRARY_TEMPLATES'
    }
  },

  /* ── Power Automate (orchestration) ──────────────────────────────────── */
  powerAutomate: {
    /* HTTP-trigger URLs for the orchestration flows. Each flow validates
       the caller's Entra token and the batch lock before doing anything. */
    flows: {
      processBatch: 'ENV:SVOPS_FLOW_PROCESS_BATCH_URL',
      generateWorkbook: 'ENV:SVOPS_FLOW_GENERATE_WORKBOOK_URL',
      executeApprovedActions: 'ENV:SVOPS_FLOW_EXECUTE_ACTIONS_URL',
      retrySystemSteps: 'ENV:SVOPS_FLOW_RETRY_URL',
      connectionHealth: 'ENV:SVOPS_FLOW_CONNECTION_HEALTH_URL'
    },
    /* Managed connection references (primary + backup). Personal accounts
       are never used; a service principal or dedicated automation account
       owns the connections, with named human co-owners for recovery. */
    connectionReferences: {
      sharepointPrimary: 'ENV:SVOPS_CONNREF_SP_PRIMARY',
      sharepointBackup: 'ENV:SVOPS_CONNREF_SP_BACKUP',
      dataversePrimary: 'ENV:SVOPS_CONNREF_DV_PRIMARY',
      salesforcePrimary: 'ENV:SVOPS_CONNREF_SF_PRIMARY',
      salesforceBackup: 'ENV:SVOPS_CONNREF_SF_BACKUP',
      officeScripts: 'ENV:SVOPS_CONNREF_OS_PRIMARY',
      outlookAutomation: 'ENV:SVOPS_CONNREF_OUTLOOK_AUTOMATION'
    }
  },

  /* ── Salesforce (CRM matching + approved updates) ────────────────────── */
  salesforce: {
    /* All Salesforce access goes through the Power Automate Salesforce
       connector — the browser never talks to Salesforce directly and no
       Salesforce credentials exist client-side. */
    connectedVia: 'power-automate-connector',
    objects: { contact: 'Contact', account: 'Account', opportunity: 'Opportunity' }
  },

  /* ── Office Scripts (Excel processing + workbook generation) ─────────── */
  officeScripts: {
    /* Script IDs are deployment configuration, resolved by the flow. */
    scripts: {
      parseWorkbook: 'ENV:SVOPS_SCRIPT_PARSE_WORKBOOK_ID',
      generateOutput: 'ENV:SVOPS_SCRIPT_GENERATE_OUTPUT_ID'
    }
  },

  /* ── Sending identity ────────────────────────────────────────────────── */
  senders: {
    irMailbox: 'ENV:SVOPS_SENDER_IR'
  }
};
