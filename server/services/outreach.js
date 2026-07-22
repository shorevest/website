'use strict';

/**
 * Outreach application service — the first fully working vertical slice.
 *
 * Flow: find people → review problems → choose actions → prepare messages →
 * review package → submit for approval → (approve) → request execution →
 * mock connectors execute or fail → sent & responses update. Every step
 * persists and writes audit events.
 */

const crypto = require('node:crypto');
const { id } = require('../domain/ids');
const { assertTransition } = require('../domain/status');
const { requirePermission } = require('../domain/permissions');
const { classify } = require('./eligibility');
const { parse } = require('./searchParser');
const { ValidationError, NotFoundError, ConflictError } = require('./errors');

class OutreachService {
  constructor(ctx) {
    this.ctx = ctx;
  }

  get repos() { return this.ctx.repos; }
  get audit() { return this.ctx.audit; }
  now() { return this.ctx.clock.nowIso(); }

  // ── Step 1: find people ────────────────────────────────────────────────
  async search(user, { query, rules: providedRules, name } = {}) {
    requirePermission(user, 'edit_audience');
    let rules = providedRules;
    let parsed = null;
    if (!rules) {
      parsed = parse(query);
      rules = parsed.rules;
    }
    const results = await this.ctx.connectors.salesforce.searchPeople(rules);
    const audience = this._createAudienceFromResults(user, {
      name: name || (query ? `Search: ${query}` : 'New list'),
      query, rules, people: results,
    });
    return {
      audienceId: audience.id,
      interpreted: parsed ? parsed.interpreted : true,
      message: parsed ? parsed.message : null,
      rules,
      summary: this.getAudience(audience.id).summary,
    };
  }

  // ── Step 1 (alt): paste names / import ─────────────────────────────────
  async import(user, { name, names = [] } = {}) {
    requirePermission(user, 'edit_audience');
    if (!Array.isArray(names) || names.length === 0) {
      throw new ValidationError('Provide at least one name to import.');
    }
    const all = this.repos.people.all('codename');
    const byId = new Map(this.repos.institutions.all().map((i) => [i.id, i]));
    const matched = [];
    for (const raw of names) {
      const q = String(raw).trim().toLowerCase();
      if (!q) continue;
      const person = all.find((p) => p.codename.toLowerCase() === q)
        || all.find((p) => p.codename.toLowerCase().includes(q));
      if (person) matched.push(decorate(person, byId.get(person.institution_id)));
    }
    const audience = this._createAudienceFromResults(user, {
      name: name || 'Imported list', query: null, rules: { source: 'import' }, people: matched,
    });
    return { audienceId: audience.id, matched: matched.length, requested: names.length, summary: this.getAudience(audience.id).summary };
  }

  _createAudienceFromResults(user, { name, query, rules, people }) {
    return this.repos.transaction(() => {
      const now = this.now();
      const audience = this.repos.audiences.insert({
        id: id('aud'), name, owner_id: user.id, objective: null,
        source_query: query || null, rules_json: JSON.stringify(rules || {}),
        created_at: now, updated_at: now,
      });
      const { classifications } = classify(people);
      for (const p of people) {
        const cls = classifications.get(p.id);
        const member = this.repos.audienceMembers.insert({
          id: id('mem'), audience_id: audience.id, person_id: p.id,
          status: statusFromOutcome(cls.outcome),
          issue_code: cls.issueCode, issue_reason: cls.issueReason,
          next_action: cls.nextAction, held_reason: null,
          created_at: now, updated_at: now,
        });
        // Seed record proposals for people needing a Salesforce change.
        if (cls.issueCode === 'account_match_needed') {
          this.repos.recordProposals.insert({
            id: id('prop'), audience_member_id: member.id, person_id: p.id,
            kind: 'account_create', payload_json: JSON.stringify({ institution: 'Unknown' }),
            status: 'proposed', created_at: now, updated_at: now,
          });
        }
        this.audit.record({ actorId: user.id, action: 'member_classified', objectType: 'audience_member', objectId: member.id, newState: member.status, reason: cls.issueCode, meta: { personId: p.id } });
      }
      this.audit.record({ actorId: user.id, action: 'audience_created', objectType: 'audience', objectId: audience.id, newState: 'created', reason: name });
      return audience;
    });
  }

  // ── Step 2: review ─────────────────────────────────────────────────────
  getAudience(audienceId) {
    const audience = this.repos.audiences.get(audienceId);
    if (!audience) throw new NotFoundError('Audience');
    const members = this.repos.members(audienceId);
    const peopleById = new Map(this.repos.people.all().map((p) => [p.id, p]));
    const instById = new Map(this.repos.institutions.all().map((i) => [i.id, i]));
    let ready = 0; let needReview = 0; let cannotBeUsed = 0;
    const rows = members.filter((m) => m.status !== 'removed').map((m) => {
      if (m.status === 'ready') ready += 1;
      else if (m.status === 'held') needReview += 1;
      else if (m.status === 'blocked') cannotBeUsed += 1;
      const person = peopleById.get(m.person_id);
      const inst = person ? instById.get(person.institution_id) : null;
      const proposals = this.repos.recordProposals.find({ audience_member_id: m.id });
      return { ...m, person: person ? decorate(person, inst) : null, proposals };
    });
    return {
      audience,
      summary: { total: rows.length, ready, needReview, cannotBeUsed },
      members: rows,
    };
  }

  // ── Step 2/3: resolve or hold a member ─────────────────────────────────
  updateMember(user, audienceId, memberId, { action, reason } = {}) {
    requirePermission(user, 'resolve_held_record');
    const member = this.repos.audienceMembers.get(memberId);
    if (!member || member.audience_id !== audienceId) throw new NotFoundError('Audience member');
    const map = { ready: 'ready', hold: 'held', block: 'blocked', remove: 'removed', resolve: 'ready' };
    const target = map[action];
    if (!target) throw new ValidationError(`Unknown member action: ${action}`);
    assertTransition('audienceMember', member.status, target); // backend-enforced
    const updated = this.repos.audienceMembers.update(memberId, {
      status: target,
      held_reason: action === 'hold' ? (reason || member.held_reason) : (target === 'ready' ? null : member.held_reason),
      updated_at: this.now(),
    });
    this.audit.record({ actorId: user.id, action: `member_${action}`, objectType: 'audience_member', objectId: memberId, previousState: member.status, newState: target, reason });
    return updated;
  }

  decideProposal(user, proposalId, { decision, reason } = {}) {
    requirePermission(user, 'resolve_held_record');
    const proposal = this.repos.recordProposals.get(proposalId);
    if (!proposal) throw new NotFoundError('Record proposal');
    if (!['accepted', 'rejected'].includes(decision)) throw new ValidationError('decision must be accepted or rejected');
    assertTransition('recordProposal', proposal.status, decision);
    const updated = this.repos.recordProposals.update(proposalId, { status: decision, decided_by: user.id, decided_at: this.now(), updated_at: this.now() });
    this.audit.record({ actorId: user.id, action: `proposal_${decision}`, objectType: 'record_proposal', objectId: proposalId, previousState: proposal.status, newState: decision, reason });
    return updated;
  }

  // ── Step 3: choose next action ─────────────────────────────────────────
  saveSearch(user, audienceId, { name } = {}) {
    requirePermission(user, 'edit_audience');
    const audience = this.repos.audiences.get(audienceId);
    if (!audience) throw new NotFoundError('Audience');
    const now = this.now();
    const saved = this.repos.savedSearches.insert({
      id: id('srch'), name: name || audience.name, owner_id: user.id,
      query_text: audience.source_query || '', rules_json: audience.rules_json || '{}',
      created_at: now, updated_at: now,
    });
    this.audit.record({ actorId: user.id, action: 'search_saved', objectType: 'saved_search', objectId: saved.id, newState: 'created', reason: saved.name });
    return saved;
  }

  exportCsv(user, audienceId) {
    requirePermission(user, 'view_workspace');
    const { members } = this.getAudience(audienceId);
    const eligible = members.filter((m) => m.status === 'ready');
    const header = ['codename', 'institution', 'title', 'email', 'country', 'region'];
    const lines = [header.join(',')];
    for (const m of eligible) {
      const p = m.person || {};
      lines.push([p.codename, p.institutionName, p.title, p.email, p.country, p.region]
        .map((v) => csvCell(v)).join(','));
    }
    this.audit.record({ actorId: user.id, action: 'audience_exported', objectType: 'audience', objectId: audienceId, newState: 'exported', meta: { rows: eligible.length } });
    return { filename: `outreach-${audienceId}.csv`, csv: lines.join('\n'), rows: eligible.length };
  }

  assign(user, audienceId, { kind = 'review', ownerId, title } = {}) {
    requirePermission(user, 'edit_audience');
    const audience = this.repos.audiences.get(audienceId);
    if (!audience) throw new NotFoundError('Audience');
    const now = this.now();
    const item = this.repos.workspaceItems.insert({
      id: id('wsi'), workspace: 'Outreach', type: kind === 'research' ? 'research_task' : 'review_task',
      title: title || `${kind === 'research' ? 'Research' : 'Review'}: ${audience.name}`,
      description: `Assigned from audience ${audience.name}`, owner_id: ownerId || user.id,
      status: 'Needs review', priority: 'normal', due_at: null,
      source_refs_json: JSON.stringify([{ type: 'audience', id: audienceId }]),
      next_action: 'Open the list and resolve flagged records', created_at: now, updated_at: now,
    });
    this.audit.record({ actorId: user.id, action: 'audience_assigned', objectType: 'workspace_item', objectId: item.id, newState: item.status, reason: kind, meta: { audienceId, ownerId: item.owner_id } });
    return item;
  }

  // ── Step 4: prepare messages ───────────────────────────────────────────
  createDraftGroup(user, audienceId, { name, treatment, objective, senderId, signatureId, subject, body } = {}) {
    requirePermission(user, 'edit_draft');
    const audience = this.repos.audiences.get(audienceId);
    if (!audience) throw new NotFoundError('Audience');
    const sender = senderId ? this.repos.users.get(senderId) : null;
    if (senderId && !sender) throw new ValidationError('Unknown sender.');
    const signature = signatureId ? this.repos.signatures.get(signatureId)
      : (senderId ? this.repos.signatures.findOne({ sender_id: senderId, active: 1 }) : null);
    const readyMembers = this.repos.members(audienceId).filter((m) => m.status === 'ready');
    if (readyMembers.length === 0) throw new ValidationError('No ready recipients to prepare messages for.');
    const now = this.now();
    return this.repos.transaction(() => {
      const group = this.repos.draftGroups.insert({
        id: id('drg'), audience_id: audienceId, name: name || 'Draft group',
        treatment: treatment || 'standard', objective: objective || audience.objective,
        sender_id: senderId || null, signature_id: signature ? signature.id : null,
        subject: subject || 'Introduction from ShoreVest', body: body || 'Draft body — edit before review.',
        status: 'draft', version: 1, created_at: now, updated_at: now,
      });
      for (const m of readyMembers) {
        this.repos.draftGroupMembers.insert({ id: id('dgm'), draft_group_id: group.id, audience_member_id: m.id, person_id: m.person_id });
      }
      this.repos.draftVersions.insert({ id: id('drv'), draft_group_id: group.id, version: 1, subject: group.subject, body: group.body, sender_id: group.sender_id, signature_id: group.signature_id, editor_id: user.id, note: 'created', created_at: now });
      this.audit.record({ actorId: user.id, action: 'draft_group_created', objectType: 'draft_group', objectId: group.id, newState: 'draft', meta: { recipients: readyMembers.length } });
      return { ...group, recipientCount: readyMembers.length };
    });
  }

  updateDraftGroup(user, draftGroupId, patch = {}) {
    requirePermission(user, 'edit_draft');
    const group = this.repos.draftGroups.get(draftGroupId);
    if (!group) throw new NotFoundError('Draft group');
    const fields = {};
    for (const k of ['name', 'treatment', 'objective', 'sender_id', 'signature_id', 'subject', 'body']) {
      if (patch[k] !== undefined) fields[k] = patch[k];
    }
    const contentChanged = ['subject', 'body', 'sender_id', 'signature_id'].some((k) => fields[k] !== undefined);
    const now = this.now();
    fields.updated_at = now;
    // Editing content re-opens an accepted group and bumps the version.
    if (contentChanged && group.status === 'accepted') {
      assertTransition('draftGroup', group.status, 'needs_review');
      fields.status = 'needs_review';
    }
    if (contentChanged) fields.version = group.version + 1;
    const updated = this.repos.draftGroups.update(draftGroupId, fields);
    if (contentChanged) {
      this.repos.draftVersions.insert({ id: id('drv'), draft_group_id: draftGroupId, version: updated.version, subject: updated.subject, body: updated.body, sender_id: updated.sender_id, signature_id: updated.signature_id, editor_id: user.id, note: 'edited', created_at: now });
      this._invalidateApprovalsForAudience(user, group.audience_id, `Draft "${group.name}" was edited`);
    }
    this.audit.record({ actorId: user.id, action: 'draft_group_edited', objectType: 'draft_group', objectId: draftGroupId, previousState: group.status, newState: updated.status });
    return updated;
  }

  markDraftGroup(user, draftGroupId, { status, reason } = {}) {
    requirePermission(user, 'edit_draft');
    const group = this.repos.draftGroups.get(draftGroupId);
    if (!group) throw new NotFoundError('Draft group');
    const targets = { needs_review: 'needs_review', accepted: 'accepted', changes_requested: 'changes_requested' };
    const target = targets[status];
    if (!target) throw new ValidationError(`Unknown draft status: ${status}`);
    assertTransition('draftGroup', group.status, target);
    const updated = this.repos.draftGroups.update(draftGroupId, { status: target, updated_at: this.now() });
    this.audit.record({ actorId: user.id, action: `draft_${target}`, objectType: 'draft_group', objectId: draftGroupId, previousState: group.status, newState: target, reason });
    return updated;
  }

  _invalidateApprovalsForAudience(user, audienceId, reason) {
    const pkgs = this.repos.approvalPackages.find({ audience_id: audienceId });
    for (const pkg of pkgs) {
      if (['submitted', 'approved'].includes(pkg.status)) {
        assertTransition('approvalPackage', pkg.status, 'invalidated');
        this.repos.approvalPackages.update(pkg.id, { status: 'invalidated', updated_at: this.now() });
        this.audit.record({ actorId: user.id, action: 'approval_invalidated', objectType: 'approval_package', objectId: pkg.id, previousState: pkg.status, newState: 'invalidated', reason });
      }
    }
  }

  // ── Step 5/6: package + submit for approval ────────────────────────────
  createPackage(user, audienceId, { name, senderId, deliveryPolicyId } = {}) {
    requirePermission(user, 'edit_audience');
    const audience = this.repos.audiences.get(audienceId);
    if (!audience) throw new NotFoundError('Audience');
    const now = this.now();
    const pkg = this.repos.approvalPackages.insert({
      id: id('pkg'), audience_id: audienceId, name: name || `${audience.name} — approval`,
      status: 'draft', version_hash: null, frozen_json: null,
      sender_id: senderId || null, delivery_policy_id: deliveryPolicyId || null,
      submitted_by: null, submitted_at: null, created_at: now, updated_at: now,
    });
    this.audit.record({ actorId: user.id, action: 'package_created', objectType: 'approval_package', objectId: pkg.id, newState: 'draft' });
    return pkg;
  }

  submitPackage(user, packageId) {
    requirePermission(user, 'submit_approval');
    const pkg = this.repos.approvalPackages.get(packageId);
    if (!pkg) throw new NotFoundError('Approval package');
    const frozen = this._freezePackage(pkg);
    this._validatePackage(frozen);
    assertTransition('approvalPackage', pkg.status, 'submitted');
    const hash = hashObject(frozen);
    const now = this.now();
    const updated = this.repos.approvalPackages.update(packageId, {
      status: 'submitted', version_hash: hash, frozen_json: JSON.stringify(frozen),
      submitted_by: user.id, submitted_at: now, updated_at: now,
    });
    // Approval task in the shared queue.
    const item = this.repos.workspaceItems.insert({
      id: id('wsi'), workspace: 'Approvals', type: 'approval', title: `Approve: ${pkg.name}`,
      description: `${frozen.recipients.length} recipients · ${frozen.draftGroups.length} draft groups`,
      owner_id: null, status: 'Needs review', priority: 'high', due_at: null,
      source_refs_json: JSON.stringify([{ type: 'approval_package', id: packageId }]),
      next_action: 'Review and approve or return', created_at: now, updated_at: now,
    });
    this.audit.record({ actorId: user.id, action: 'approval_submitted', objectType: 'approval_package', objectId: packageId, previousState: pkg.status, newState: 'submitted', meta: { versionHash: hash, recipients: frozen.recipients.length } });
    return { package: updated, approvalItemId: item.id, versionHash: hash };
  }

  _freezePackage(pkg) {
    const groups = this.repos.draftGroups.find({ audience_id: pkg.audience_id });
    const activeGroups = groups.filter((g) => g.status !== 'invalidated');
    const draftGroups = activeGroups.map((g) => {
      const members = this.repos.draftGroupMembers.find({ draft_group_id: g.id });
      const recipients = members.map((m) => {
        const p = this.repos.people.get(m.person_id);
        const am = this.repos.audienceMembers.get(m.audience_member_id);
        return { personId: m.person_id, codename: p ? p.codename : null, email: p ? p.email : null, memberStatus: am ? am.status : null, audienceMemberId: m.audience_member_id };
      });
      return { id: g.id, name: g.name, status: g.status, version: g.version, subject: g.subject, body: g.body, senderId: g.sender_id, signatureId: g.signature_id, recipients };
    });
    const recipients = [];
    for (const g of draftGroups) for (const r of g.recipients) recipients.push(r);
    const policy = pkg.delivery_policy_id ? this.repos.deliveryPolicies.get(pkg.delivery_policy_id) : null;
    return {
      packageId: pkg.id, audienceId: pkg.audience_id, name: pkg.name,
      senderId: pkg.sender_id, deliveryPolicy: policy ? { id: policy.id, name: policy.name, approved: policy.approved } : null,
      draftGroups, recipients, frozenAt: this.now(),
    };
  }

  _validatePackage(frozen) {
    if (frozen.recipients.length === 0) throw new ValidationError('An approval package must have at least one recipient.');
    if (frozen.draftGroups.length === 0) throw new ValidationError('An approval package must contain at least one draft group.');
    for (const g of frozen.draftGroups) {
      if (g.status !== 'accepted') throw new ValidationError(`Draft group "${g.name}" must be accepted before approval (status: ${g.status}).`);
      if (!g.senderId) throw new ValidationError(`Draft group "${g.name}" has no permitted sender.`);
      const sender = this.repos.users.get(g.senderId);
      if (!sender) throw new ValidationError(`Draft group "${g.name}" sender is unknown.`);
      if (!g.signatureId || !this.repos.signatures.get(g.signatureId)) throw new ValidationError(`Draft group "${g.name}" is missing a managed signature version.`);
      // A blocked person must never enter a message group.
      for (const r of g.recipients) {
        if (r.memberStatus !== 'ready') throw new ValidationError(`Recipient ${r.codename || r.personId} in "${g.name}" is not ready (status: ${r.memberStatus}).`);
      }
    }
    if (frozen.deliveryPolicy && !frozen.deliveryPolicy.approved) {
      throw new ValidationError('Delivery policy is not approved.');
    }
  }

  // ── Step 8/9: request execution (guarded) ──────────────────────────────
  async requestExecution(user, packageId, { idempotencyKey } = {}) {
    const pkg = this.repos.approvalPackages.get(packageId);
    if (!pkg) throw new NotFoundError('Approval package');
    await this.ctx.guard.authorizeExecution({ user, pkg });

    // Idempotency: a repeated request with the same key returns the prior result.
    const reservation = this.ctx.guard.reserveIdempotency(idempotencyKey, 'outreach_execution', packageId);
    if (!reservation.fresh) {
      const stored = reservation.existing.result_json ? JSON.parse(reservation.existing.result_json) : null;
      return { idempotent: true, result: stored };
    }

    const now = this.now();
    const execReq = this.repos.executionRequests.insert({
      id: id('exec'), package_id: packageId, idempotency_key: idempotencyKey,
      status: 'queued', requested_by: user.id, result_json: null, created_at: now, updated_at: now,
    });
    if (pkg.status === 'approved') {
      assertTransition('approvalPackage', pkg.status, 'execution_requested');
      this.repos.approvalPackages.update(packageId, { status: 'execution_requested', updated_at: now });
    }
    this.audit.record({ actorId: user.id, action: 'execution_requested', objectType: 'approval_package', objectId: packageId, newState: 'execution_requested', meta: { executionRequestId: execReq.id, idempotencyKey } });

    const result = await this._execute(user, pkg, execReq);
    this.ctx.guard.storeIdempotentResult(idempotencyKey, result);
    return { idempotent: false, result };
  }

  async _execute(user, pkg, execReq) {
    const frozen = pkg.frozen_json ? JSON.parse(pkg.frozen_json) : this._freezePackage(pkg);
    let sent = 0; let failed = 0; let held = 0;
    const outcomes = [];
    for (const g of frozen.draftGroups) {
      for (const r of g.recipients) {
        const member = this.repos.audienceMembers.get(r.audienceMemberId);
        const person = this.repos.people.get(r.personId);
        const check = this.ctx.guard.revalidateRecipient(member, person);
        const now = this.now();
        if (!check.eligible) {
          const msg = this.repos.messages.insert({ id: id('msg'), execution_request_id: execReq.id, package_id: pkg.id, draft_group_id: g.id, person_id: r.personId, sender_id: g.senderId, subject: g.subject, body: g.body, status: 'held', error_code: check.reason, error_detail: `Held at execution: ${check.reason}`, created_at: now, updated_at: now });
          held += 1;
          outcomes.push({ personId: r.personId, status: 'held', reason: check.reason });
          this.audit.record({ actorId: user.id, action: 'message_held', objectType: 'message', objectId: msg.id, newState: 'held', reason: check.reason });
          continue;
        }
        const sendResult = await this.ctx.connectors.mail.sendApprovedMessage({ personId: r.personId, email: person.email, subject: g.subject, body: g.body, senderId: g.senderId, idempotencyKey: `${execReq.idempotency_key}:${r.personId}` });
        const status = sendResult.status === 'sent' ? 'sent' : 'failed';
        const msg = this.repos.messages.insert({ id: id('msg'), execution_request_id: execReq.id, package_id: pkg.id, draft_group_id: g.id, person_id: r.personId, sender_id: g.senderId, subject: g.subject, body: g.body, status, external_id: sendResult.externalId || null, error_code: sendResult.errorCode || null, error_detail: sendResult.errorDetail || null, created_at: now, updated_at: now });
        if (status === 'sent') { sent += 1; outcomes.push({ personId: r.personId, status: 'sent', externalId: sendResult.externalId }); this.audit.record({ actorId: user.id, action: 'message_sent', objectType: 'message', objectId: msg.id, newState: 'sent' }); }
        else { failed += 1; outcomes.push({ personId: r.personId, status: 'failed', reason: sendResult.errorCode }); this.audit.record({ actorId: user.id, action: 'message_failed', objectType: 'message', objectId: msg.id, newState: 'failed', reason: sendResult.errorCode });
          // Failure holds only the affected row.
          if (member && member.status === 'ready') { this.repos.audienceMembers.update(member.id, { status: 'held', held_reason: 'delivery_failed', updated_at: now }); }
        }
      }
    }
    // Apply accepted Salesforce record proposals (partial failures possible).
    const proposals = this.repos.recordProposals.find({ status: 'accepted' });
    for (const prop of proposals) {
      const member = prop.audience_member_id ? this.repos.audienceMembers.get(prop.audience_member_id) : null;
      if (member && member.audience_id !== pkg.audience_id) continue;
      const applyResult = await this.ctx.connectors.salesforce.applyApprovedChanges({ kind: prop.kind, personId: prop.person_id });
      const now = this.now();
      if (applyResult.ok) { this.repos.recordProposals.update(prop.id, { status: 'applied', result_json: JSON.stringify(applyResult), updated_at: now }); this.audit.record({ actorId: user.id, action: 'proposal_applied', objectType: 'record_proposal', objectId: prop.id, previousState: 'accepted', newState: 'applied' }); }
      else { this.repos.recordProposals.update(prop.id, { status: 'failed', result_json: JSON.stringify(applyResult), updated_at: now }); failed += 1; this.audit.record({ actorId: user.id, action: 'proposal_apply_failed', objectType: 'record_proposal', objectId: prop.id, previousState: 'accepted', newState: 'failed', reason: applyResult.errorCode }); }
    }

    const execStatus = failed > 0 && sent > 0 ? 'partial' : (failed > 0 && sent === 0 ? 'failed' : 'executed');
    const now = this.now();
    this.repos.executionRequests.update(execReq.id, { status: execStatus, result_json: JSON.stringify({ sent, failed, held, outcomes }), updated_at: now });
    assertTransition('approvalPackage', 'execution_requested', execStatus === 'executed' ? 'executed' : execStatus);
    this.repos.approvalPackages.update(pkg.id, { status: execStatus === 'executed' ? 'executed' : execStatus, updated_at: now });
    this.audit.record({ actorId: user.id, action: `execution_${execStatus}`, objectType: 'approval_package', objectId: pkg.id, newState: execStatus, meta: { sent, failed, held } });

    // Simulate a few replies for sent messages (mock mail connector).
    const sentMessages = this.repos.messages.find({ execution_request_id: execReq.id, status: 'sent' });
    const replies = await this.ctx.connectors.mail.getReplies(sentMessages.map((m) => ({ personId: m.person_id, messageId: m.id })));
    const msgByPerson = new Map(sentMessages.map((m) => [m.person_id, m]));
    for (const reply of replies) {
      const m = msgByPerson.get(reply.personId);
      if (!m) continue;
      const r = this.repos.responses.insert({ id: id('resp'), message_id: m.id, person_id: reply.personId, kind: reply.kind, classification: reply.classification, snippet: reply.snippet, received_at: this.now(), created_at: this.now() });
      this.audit.record({ actorId: null, action: 'reply_classified', objectType: 'response', objectId: r.id, newState: reply.classification, source: 'mail_connector' });
    }

    return { executionRequestId: execReq.id, status: execStatus, sent, failed, held, outcomes };
  }

  /** Repair failed rows by re-requesting execution with a fresh idempotency key. */
  async repairPackage(user, packageId, { idempotencyKey } = {}) {
    const pkg = this.repos.approvalPackages.get(packageId);
    if (!pkg) throw new NotFoundError('Approval package');
    if (!['partial', 'failed'].includes(pkg.status)) throw new ConflictError('Only partial/failed packages can be repaired.');
    // Re-ready held rows whose person is now eligible.
    const failedMessages = this.repos.messages.find({ package_id: packageId }).filter((m) => ['failed', 'held'].includes(m.status));
    for (const m of failedMessages) {
      const member = this.repos.audienceMembers.findOne({ audience_id: pkg.audience_id, person_id: m.person_id });
      const person = this.repos.people.get(m.person_id);
      const check = this.ctx.guard.revalidateRecipient(member, person);
      if (member && member.status === 'held' && check.eligible) {
        this.repos.audienceMembers.update(member.id, { status: 'ready', held_reason: null, updated_at: this.now() });
      }
    }
    assertTransition('approvalPackage', pkg.status, 'execution_requested');
    this.repos.approvalPackages.update(packageId, { status: 'execution_requested', updated_at: this.now() });
    this.audit.record({ actorId: user.id, action: 'package_repair_requested', objectType: 'approval_package', objectId: packageId, previousState: pkg.status, newState: 'execution_requested' });
    return this.requestExecution(user, packageId, { idempotencyKey });
  }

  // ── Step 10: sent & responses ──────────────────────────────────────────
  listMessages(filter = {}) {
    const where = {};
    if (filter.packageId) where.package_id = filter.packageId;
    const messages = this.repos.messages.find(where, { orderBy: 'created_at DESC' });
    const peopleById = new Map(this.repos.people.all().map((p) => [p.id, p]));
    return messages.map((m) => ({ ...m, codename: peopleById.get(m.person_id) ? peopleById.get(m.person_id).codename : null }));
  }

  listResponses() {
    const responses = this.repos.responses.all('received_at DESC');
    const peopleById = new Map(this.repos.people.all().map((p) => [p.id, p]));
    return responses.map((r) => ({ ...r, codename: peopleById.get(r.person_id) ? peopleById.get(r.person_id).codename : null }));
  }

  listDraftGroups(audienceId) {
    return this.repos.draftGroups.find({ audience_id: audienceId }, { orderBy: 'created_at' }).map((g) => {
      const recipientCount = this.repos.draftGroupMembers.count({ draft_group_id: g.id });
      return { ...g, recipientCount };
    });
  }

  listPackages(audienceId) {
    return this.repos.approvalPackages.find({ audience_id: audienceId }, { orderBy: 'created_at' });
  }

  listAudiences() {
    return this.repos.audiences.all('created_at DESC').map((a) => {
      const members = this.repos.members(a.id).filter((m) => m.status !== 'removed');
      return { ...a, memberCount: members.length, readyCount: members.filter((m) => m.status === 'ready').length };
    });
  }
}

// ── helpers ───────────────────────────────────────────────────────────────
function statusFromOutcome(outcome) {
  if (outcome === 'ready') return 'ready';
  if (outcome === 'blocked') return 'blocked';
  return 'held';
}

function decorate(p, inst) {
  return {
    id: p.id, codename: p.codename, title: p.title, email: p.email,
    emailStatus: p.email_status, status: p.status, ownerId: p.owner_id,
    region: p.region, country: p.country, restricted: p.restricted,
    declinedAt: p.declined_at, duplicateOf: p.duplicate_of,
    institutionId: p.institution_id, institutionName: inst ? inst.name : null,
  };
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function hashObject(obj) {
  return 'v1-' + crypto.createHash('sha256').update(canonical(obj)).digest('hex').slice(0, 32);
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

module.exports = { OutreachService, hashObject, statusFromOutcome };
