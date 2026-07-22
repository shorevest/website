'use strict';

/**
 * Typed HTTP API. Routes map to application services only — no business logic
 * lives here, and the UI never reaches past this layer. Permission and status
 * enforcement happen inside the services. Errors carry a `.status`, mapped here
 * to HTTP codes.
 */

const { readBody, sendJson, errorPayload } = require('./http');
const { authenticate } = require('./auth');
const { permissionsFor } = require('../domain/permissions');
const { healthAll } = require('../connectors');

// Route table. Each entry: [METHOD, pathRegex, handler]. Path params are named
// capture groups. Handlers receive ({ app, user, params, body, query }).
function buildRoutes() {
  return [
    ['GET', /^\/api\/health$/, async ({ app }) => ({ ok: true, mode: app.config.mode, banner: app.config.banner }) ],

    ['GET', /^\/api\/session$/, async ({ app, user }) => ({
      user: user ? { id: user.id, name: user.display_name, title: user.title, role: user.role } : null,
      permissions: user ? permissionsFor(user.role) : [],
      mode: app.config.mode,
      banner: app.config.banner,
      externalWritesEnabled: app.config.externalWritesEnabled,
    }) ],

    ['GET', /^\/api\/users$/, async ({ app }) => ({ users: app.repos.users.all('display_name') }) ],

    ['GET', /^\/api\/connectors$/, async ({ app }) => ({ connectors: await healthAll(app.connectors), mode: app.config.mode }) ],

    ['GET', /^\/api\/workspaces$/, async ({ app }) => ({ workspaces: workspaceSummary(app) }) ],

    // Work items / My Work
    ['GET', /^\/api\/work-items$/, async ({ app, user, query }) => ({
      items: query.mine === 'false'
        ? app.services.workItems.list({ workspace: query.workspace })
        : app.services.workItems.myWork(user, { includeCompleted: query.all === 'true' }),
    }) ],
    ['PATCH', /^\/api\/work-items\/(?<id>[^/]+)$/, async ({ app, user, params, body }) => ({ item: app.services.workItems.update(user, params.id, body) }) ],
    ['POST', /^\/api\/work-items\/(?<id>[^/]+)\/accept$/, async ({ app, user, params }) => ({ item: app.services.workItems.accept(user, params.id) }) ],

    ['GET', /^\/api\/relationships$/, async ({ app }) => ({ relationships: relationshipsView(app) }) ],

    // Outreach
    ['GET', /^\/api\/outreach\/reference$/, async ({ app }) => ({
      senders: app.repos.users.find({}, { orderBy: 'display_name' }).filter((u) => ['director', 'associate', 'admin'].includes(u.role)),
      deliveryPolicies: app.repos.deliveryPolicies.find({}, { orderBy: 'approved DESC, name' }),
      savedSearches: app.repos.savedSearches.all('created_at DESC'),
    }) ],
    ['GET', /^\/api\/outreach\/audiences$/, async ({ app }) => ({ audiences: app.services.outreach.listAudiences() }) ],
    ['POST', /^\/api\/outreach\/search$/, async ({ app, user, body }) => app.services.outreach.search(user, body) ],
    ['POST', /^\/api\/outreach\/import$/, async ({ app, user, body }) => app.services.outreach.import(user, body) ],
    ['GET', /^\/api\/outreach\/audiences\/(?<id>[^/]+)$/, async ({ app, params }) => app.services.outreach.getAudience(params.id) ],
    ['GET', /^\/api\/outreach\/audiences\/(?<id>[^/]+)\/draft-groups$/, async ({ app, params }) => ({ draftGroups: app.services.outreach.listDraftGroups(params.id) }) ],
    ['GET', /^\/api\/outreach\/audiences\/(?<id>[^/]+)\/packages$/, async ({ app, params }) => ({ packages: app.services.outreach.listPackages(params.id) }) ],
    ['PATCH', /^\/api\/outreach\/audiences\/(?<id>[^/]+)\/members\/(?<memberId>[^/]+)$/, async ({ app, user, params, body }) => ({ member: app.services.outreach.updateMember(user, params.id, params.memberId, body) }) ],
    ['POST', /^\/api\/outreach\/audiences\/(?<id>[^/]+)\/save-search$/, async ({ app, user, params, body }) => ({ savedSearch: app.services.outreach.saveSearch(user, params.id, body) }) ],
    ['POST', /^\/api\/outreach\/audiences\/(?<id>[^/]+)\/export$/, async ({ app, user, params }) => app.services.outreach.exportCsv(user, params.id) ],
    ['POST', /^\/api\/outreach\/audiences\/(?<id>[^/]+)\/assign$/, async ({ app, user, params, body }) => ({ item: app.services.outreach.assign(user, params.id, body) }) ],
    ['POST', /^\/api\/outreach\/audiences\/(?<id>[^/]+)\/drafts$/, async ({ app, user, params, body }) => ({ draftGroup: app.services.outreach.createDraftGroup(user, params.id, body) }) ],
    ['POST', /^\/api\/outreach\/audiences\/(?<id>[^/]+)\/packages$/, async ({ app, user, params, body }) => ({ package: app.services.outreach.createPackage(user, params.id, body) }) ],
    ['PATCH', /^\/api\/outreach\/draft-groups\/(?<id>[^/]+)$/, async ({ app, user, params, body }) => ({ draftGroup: app.services.outreach.updateDraftGroup(user, params.id, body) }) ],
    ['POST', /^\/api\/outreach\/draft-groups\/(?<id>[^/]+)\/mark$/, async ({ app, user, params, body }) => ({ draftGroup: app.services.outreach.markDraftGroup(user, params.id, body) }) ],
    ['POST', /^\/api\/outreach\/proposals\/(?<id>[^/]+)\/decide$/, async ({ app, user, params, body }) => ({ proposal: app.services.outreach.decideProposal(user, params.id, body) }) ],
    ['POST', /^\/api\/outreach\/packages\/(?<id>[^/]+)\/submit$/, async ({ app, user, params }) => app.services.outreach.submitPackage(user, params.id) ],
    ['POST', /^\/api\/outreach\/packages\/(?<id>[^/]+)\/request-execution$/, async ({ app, user, params, body }) => app.services.outreach.requestExecution(user, params.id, body) ],
    ['POST', /^\/api\/outreach\/packages\/(?<id>[^/]+)\/repair$/, async ({ app, user, params, body }) => app.services.outreach.repairPackage(user, params.id, body) ],
    ['GET', /^\/api\/outreach\/messages$/, async ({ app, query }) => ({ messages: app.services.outreach.listMessages({ packageId: query.packageId }) }) ],
    ['GET', /^\/api\/outreach\/responses$/, async ({ app }) => ({ responses: app.services.outreach.listResponses() }) ],

    // Approvals
    ['GET', /^\/api\/approvals$/, async ({ app }) => ({ queue: app.services.approvals.queue() }) ],
    ['GET', /^\/api\/approvals\/(?<id>[^/]+)$/, async ({ app, params }) => ({ package: app.services.approvals.get(params.id) }) ],
    ['POST', /^\/api\/approvals\/(?<id>[^/]+)\/decide$/, async ({ app, user, params, body }) => ({ package: app.services.approvals.decide(user, params.id, body) }) ],

    // Audit
    ['GET', /^\/api\/audit-events$/, async ({ app, query }) => ({ events: query.objectId ? app.repos.auditFor(query.objectType, query.objectId) : app.services.audit.recent(Number(query.limit) || 200) }) ],
  ];
}

async function handleApi(app, req, res, url) {
  const routes = app._routes || (app._routes = buildRoutes());
  const method = req.method.toUpperCase();
  const pathname = url.pathname;
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue;
    const match = pattern.exec(pathname);
    if (!match) continue;
    try {
      const user = authenticate(app, req);
      const body = (method === 'POST' || method === 'PATCH' || method === 'PUT') ? await readBody(req) : {};
      const query = Object.fromEntries(url.searchParams.entries());
      const params = match.groups || {};
      const result = await handler({ app, user, params, body, query });
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, err.status || 500, errorPayload(err));
      if (!err.status) console.error('[api]', err);
    }
    return true;
  }
  return false; // no route matched
}

function workspaceSummary(app) {
  const { repos } = app;
  return [
    { key: 'outreach', name: 'Outreach', maturity: 'functioning', description: 'Find people, resolve issues, prepare, approve and execute outreach.', records: repos.audiences.count(), dependencies: ['Salesforce', 'Microsoft Graph'] },
    { key: 'relationships', name: 'Relationships', maturity: 'read_update', description: 'Durable relationship records shared with Outreach.', records: repos.relationships.count(), dependencies: ['Salesforce'] },
    { key: 'my-work', name: 'My Work', maturity: 'functioning', description: 'Shared queue of what depends on you.', records: repos.workspaceItems.count(), dependencies: [] },
    { key: 'approvals', name: 'Approvals', maturity: 'functioning', description: 'Shared approval queue. Approval and execution are separate.', records: repos.approvalPackages.count(), dependencies: ['Power Automate'] },
    { key: 'meetings', name: 'Meetings', maturity: 'shell', description: 'Meeting context and notes. Not connected yet.', records: 0, dependencies: ['Microsoft Graph'] },
    { key: 'diligence', name: 'Diligence & Requests', maturity: 'shell', description: 'Diligence cases and material requests. Not connected yet.', records: repos.opportunities.count(), dependencies: ['SharePoint'] },
    { key: 'investor-intel', name: 'Investor Intelligence', maturity: 'shell', description: 'Vendor signals and enrichment. Suggestions only.', records: 0, dependencies: ['VendorSignal'] },
  ];
}

function relationshipsView(app) {
  const peopleById = new Map(app.repos.people.all().map((p) => [p.id, p]));
  const instById = new Map(app.repos.institutions.all().map((i) => [i.id, i]));
  return app.repos.relationships.all('updated_at DESC').map((r) => {
    const p = peopleById.get(r.person_id);
    const inst = p ? instById.get(p.institution_id) : null;
    return { ...r, codename: p ? p.codename : null, institutionName: inst ? inst.name : null, personStatus: p ? p.status : null };
  });
}

module.exports = { handleApi, buildRoutes };
