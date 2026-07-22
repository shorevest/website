'use strict';

/**
 * Investment Toolbox — IC Deck QC service.
 *
 * The problem this solves: a deal deck is built from an Excel model and figures
 * are transcribed by hand. Mistakes get through to the Investment Committee. QC
 * reconciles every figure in a deck version against the authoritative model
 * version and flags each one before it reaches the IC:
 *
 *   ok        deck value ties to the model within tolerance
 *   mismatch  deck value differs from the model (transcription error)
 *   stale     deck value matches an OLDER model version, not the current one
 *   missing   the model has the figure but the deck omits it
 *   orphan    the deck states a figure with no source in the model
 *
 * The engine (`reconcile`) is a pure function so it is trivially testable. The
 * service persists runs and findings, checks permissions, and writes audit
 * events — the same discipline as every other ShoreVest One workspace.
 *
 * Figure EXTRACTION (turning an .xlsx / .pptx into structured rows) is a
 * connector responsibility (DocumentConnector). MOCK extracts fictional
 * fixtures; a connected environment parses the real documents. The engine below
 * is identical in both cases.
 */

const crypto = require('node:crypto');
const { id } = require('../domain/ids');
const { requirePermission } = require('../domain/permissions');
const { NotFoundError, ValidationError } = require('./errors');

const SEVERITIES = ['ok', 'mismatch', 'stale', 'missing', 'orphan'];
const RESOLUTIONS = ['open', 'acknowledged', 'fixed', 'waived'];

function round6(n) { return Math.round(n * 1e6) / 1e6; }
function normText(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
function isNum(v) { return typeof v === 'number' && !Number.isNaN(v); }

/**
 * Pure reconciliation. Compares deck figures against a model's metrics.
 *
 * @param {object} input
 * @param {Array}  input.metrics       authoritative metrics of the chosen model version
 * @param {Array}  input.figures       figures found in the chosen deck version
 * @param {Array}  input.priorVersions [{ version, metrics }] older model versions,
 *                                      used to classify a mismatch as `stale`.
 * @returns {Array} findings (not persisted)
 */
function reconcile({ metrics = [], figures = [], priorVersions = [] } = {}) {
  const figByKey = new Map();
  for (const fg of figures) if (!figByKey.has(fg.key)) figByKey.set(fg.key, fg);
  const metricKeys = new Set(metrics.map((mt) => mt.key));
  const findings = [];

  for (const mt of metrics) {
    const fg = figByKey.get(mt.key);
    const base = {
      metricKey: mt.key, label: mt.label, unit: mt.unit || '', format: mt.format || 'number',
      tolerance: mt.tolerance || 0, modelNum: isNum(mt.valueNum) ? mt.valueNum : null,
      modelText: mt.valueText || null, slide: fg ? (fg.slide == null ? null : fg.slide) : null,
      deckNum: fg && isNum(fg.statedNum) ? fg.statedNum : null,
      deckText: fg ? (fg.statedText || null) : null, deltaNum: null, matchedVersion: null,
    };

    if (!fg) { findings.push({ ...base, severity: 'missing' }); continue; }

    // Text metric: compare normalized strings.
    if (!isNum(mt.valueNum)) {
      const same = normText(fg.statedText != null ? fg.statedText : fg.statedNum) === normText(mt.valueText);
      findings.push({ ...base, severity: same ? 'ok' : 'mismatch' });
      continue;
    }

    // Numeric metric but the deck shows no number where one is expected.
    if (!isNum(fg.statedNum)) { findings.push({ ...base, severity: 'mismatch' }); continue; }

    const delta = round6(fg.statedNum - mt.valueNum);
    base.deltaNum = delta;
    if (Math.abs(delta) <= (mt.tolerance || 0)) { findings.push({ ...base, severity: 'ok' }); continue; }

    // Off the current model — is it stale (matches an older version) or wrong?
    const staleVersion = findStaleVersion(mt.key, fg.statedNum, priorVersions);
    if (staleVersion != null) findings.push({ ...base, severity: 'stale', matchedVersion: staleVersion });
    else findings.push({ ...base, severity: 'mismatch' });
  }

  // Orphans: deck figures with no corresponding model metric.
  for (const fg of figures) {
    if (metricKeys.has(fg.key)) continue;
    findings.push({
      metricKey: fg.key, label: fg.label, unit: '', format: 'number', tolerance: 0,
      modelNum: null, modelText: null, slide: fg.slide == null ? null : fg.slide,
      deckNum: isNum(fg.statedNum) ? fg.statedNum : null, deckText: fg.statedText || null,
      deltaNum: null, matchedVersion: null, severity: 'orphan',
    });
  }

  return findings;
}

/** Return the most recent prior model version whose value the deck figure matches. */
function findStaleVersion(key, statedNum, priorVersions) {
  const sorted = priorVersions.slice().sort((a, b) => b.version - a.version);
  for (const pv of sorted) {
    const pm = (pv.metrics || []).find((x) => x.key === key);
    if (pm && isNum(pm.valueNum) && Math.abs(round6(statedNum - pm.valueNum)) <= (pm.tolerance || 0)) {
      return pv.version;
    }
  }
  return null;
}

/** Roll findings up into per-severity counts and an overall status. */
function summarize(findings) {
  const counts = { ok: 0, mismatch: 0, stale: 0, missing: 0, orphan: 0, total: findings.length };
  for (const f of findings) if (counts[f.severity] != null) counts[f.severity] += 1;
  let status = 'clean';
  if (counts.mismatch > 0 || counts.stale > 0) status = 'issues_found';
  else if (counts.missing > 0 || counts.orphan > 0) status = 'review_advised';
  return { counts, status };
}

class InvestmentQcService {
  constructor(ctx) { this.ctx = ctx; }
  get repos() { return this.ctx.repos; }
  get connectors() { return this.ctx.connectors; }
  now() { return this.ctx.clock.nowIso(); }

  // ── ingestion (through the connector seam) ────────────────────────────────

  /** Extract a model version's metrics through the document connector. */
  async ingestModel(user, modelId) {
    requirePermission(user, 'edit_audience');
    const model = this.repos.dealModels.get(modelId);
    if (!model) throw new NotFoundError('Model version');
    const rows = await this.connectors.document.extractModelMetrics(model.source_ref);
    this.repos.db.prepare('DELETE FROM model_metrics WHERE model_id = ?').run(modelId);
    rows.forEach((r, i) => this.repos.modelMetrics.insert({
      id: id('mmt'), model_id: modelId, deal_id: model.deal_id, metric_key: r.key, label: r.label,
      unit: r.unit || '', format: r.format || 'number', value_num: isNum(r.valueNum) ? r.valueNum : null,
      value_text: r.valueText || null, tolerance: r.tolerance || 0, sort: i, created_at: this.now(),
    }));
    this.ctx.audit.record({ actorId: user.id, action: 'model_ingested', objectType: 'deal_model', objectId: modelId, newState: `${rows.length} metrics`, meta: { sourceRef: model.source_ref } });
    return { modelId, metrics: rows.length };
  }

  /** Extract a deck version's figures through the document connector. */
  async ingestDeck(user, deckId) {
    requirePermission(user, 'edit_audience');
    const deck = this.repos.decks.get(deckId);
    if (!deck) throw new NotFoundError('Deck version');
    const rows = await this.connectors.document.extractDeckFigures(deck.source_ref);
    this.repos.db.prepare('DELETE FROM deck_figures WHERE deck_id = ?').run(deckId);
    rows.forEach((r, i) => this.repos.deckFigures.insert({
      id: id('dfg'), deck_id: deckId, deal_id: deck.deal_id, metric_key: r.key, label: r.label,
      slide: r.slide == null ? null : r.slide, stated_num: isNum(r.statedNum) ? r.statedNum : null,
      stated_text: r.statedText || null, sort: i, created_at: this.now(),
    }));
    this.ctx.audit.record({ actorId: user.id, action: 'deck_ingested', objectType: 'deck', objectId: deckId, newState: `${rows.length} figures`, meta: { sourceRef: deck.source_ref } });
    return { deckId, figures: rows.length };
  }

  // ── reads ─────────────────────────────────────────────────────────────────

  listDeals() {
    const users = new Map(this.repos.users.all().map((u) => [u.id, u]));
    return this.repos.deals.all('ic_date').map((d) => {
      const model = this.currentModel(d.id);
      const deck = this.currentDeck(d.id);
      const lastRun = this.repos.qcRuns.find({ deal_id: d.id }, { orderBy: 'created_at DESC', limit: 1 })[0] || null;
      return {
        ...d,
        owner: users.get(d.owner_id) ? users.get(d.owner_id).display_name : null,
        currentModel: model ? { id: model.id, version: model.version, label: model.label } : null,
        currentDeck: deck ? { id: deck.id, version: deck.version, label: deck.label } : null,
        lastRun: lastRun ? { id: lastRun.id, status: lastRun.status, counts: JSON.parse(lastRun.counts_json), createdAt: lastRun.created_at } : null,
      };
    });
  }

  getDeal(dealId) {
    const deal = this.repos.deals.get(dealId);
    if (!deal) throw new NotFoundError('Deal');
    const models = this.repos.dealModels.find({ deal_id: dealId }, { orderBy: 'version DESC' });
    const decks = this.repos.decks.find({ deal_id: dealId }, { orderBy: 'version DESC' });
    const runs = this.repos.qcRuns.find({ deal_id: dealId }, { orderBy: 'created_at DESC' })
      .map((r) => ({ ...r, counts: JSON.parse(r.counts_json) }));
    return { deal, models, decks, runs };
  }

  currentModel(dealId) {
    return this.repos.dealModels.findOne({ deal_id: dealId, is_current: true })
      || this.repos.dealModels.find({ deal_id: dealId }, { orderBy: 'version DESC', limit: 1 })[0] || null;
  }

  currentDeck(dealId) {
    return this.repos.decks.findOne({ deal_id: dealId, is_current: true })
      || this.repos.decks.find({ deal_id: dealId }, { orderBy: 'version DESC', limit: 1 })[0] || null;
  }

  getRun(runId) {
    const run = this.repos.qcRuns.get(runId);
    if (!run) throw new NotFoundError('QC run');
    const findings = this.repos.qcFindings.find({ run_id: runId }, { orderBy: 'severity, slide, label' });
    const deal = this.repos.deals.get(run.deal_id);
    const deck = this.repos.decks.get(run.deck_id);
    const model = this.repos.dealModels.get(run.model_id);
    return { run: { ...run, counts: JSON.parse(run.counts_json) }, findings, deal, deck, model };
  }

  // ── the QC run ──────────────────────────────────────────────────────────

  runQc(user, dealId, { deckId, modelId, note } = {}) {
    requirePermission(user, 'edit_audience');
    const deal = this.repos.deals.get(dealId);
    if (!deal) throw new NotFoundError('Deal');
    const model = modelId ? this.repos.dealModels.get(modelId) : this.currentModel(dealId);
    const deck = deckId ? this.repos.decks.get(deckId) : this.currentDeck(dealId);
    if (!model) throw new ValidationError('This deal has no model version to check against.');
    if (!deck) throw new ValidationError('This deal has no deck version to check.');

    const metrics = this.metricsOf(model.id);
    const figures = this.figuresOf(deck.id);
    const priorVersions = this.repos.dealModels
      .find({ deal_id: dealId }, { orderBy: 'version DESC' })
      .filter((mv) => mv.version < model.version)
      .map((mv) => ({ version: mv.version, metrics: this.metricsOf(mv.id) }));

    const findings = reconcile({ metrics, figures, priorVersions });
    const { counts, status } = summarize(findings);
    const inputHash = hashInputs(metrics, figures);
    const nowIso = this.now();
    const runId = id('qcr');

    return this.repos.transaction(() => {
      this.repos.qcRuns.insert({
        id: runId, deal_id: dealId, deck_id: deck.id, model_id: model.id, status,
        input_hash: inputHash, counts_json: JSON.stringify(counts), run_by: user.id,
        note: note || null, created_at: nowIso,
      });
      for (const fn of findings) {
        this.repos.qcFindings.insert({
          id: id('qcf'), run_id: runId, deal_id: dealId, metric_key: fn.metricKey, label: fn.label,
          slide: fn.slide == null ? null : fn.slide, severity: fn.severity, unit: fn.unit || '',
          format: fn.format || 'number', model_num: fn.modelNum, model_text: fn.modelText,
          deck_num: fn.deckNum, deck_text: fn.deckText, delta_num: fn.deltaNum, tolerance: fn.tolerance || 0,
          matched_version: fn.matchedVersion == null ? null : fn.matchedVersion, resolution: 'open',
          resolution_note: null, resolved_by: null, resolved_at: null, created_at: nowIso,
        });
      }
      this.ctx.audit.record({
        actorId: user.id, action: 'qc_run', objectType: 'qc_run', objectId: runId, newState: status,
        meta: { dealCode: deal.code, deckVersion: deck.version, modelVersion: model.version, counts },
      });
      return this.getRun(runId);
    });
  }

  metricsOf(modelId) {
    return this.repos.modelMetrics.find({ model_id: modelId }, { orderBy: 'sort' })
      .map((r) => ({ key: r.metric_key, label: r.label, unit: r.unit, format: r.format, valueNum: r.value_num, valueText: r.value_text, tolerance: r.tolerance }));
  }

  figuresOf(deckId) {
    return this.repos.deckFigures.find({ deck_id: deckId }, { orderBy: 'sort' })
      .map((r) => ({ key: r.metric_key, label: r.label, slide: r.slide, statedNum: r.stated_num, statedText: r.stated_text }));
  }

  // ── finding resolution + hand-off ─────────────────────────────────────────

  resolveFinding(user, findingId, { resolution, note } = {}) {
    requirePermission(user, 'resolve_held_record');
    if (!RESOLUTIONS.includes(resolution)) throw new ValidationError(`Unknown resolution "${resolution}".`);
    const finding = this.repos.qcFindings.get(findingId);
    if (!finding) throw new NotFoundError('Finding');
    const updated = this.repos.qcFindings.update(findingId, {
      resolution, resolution_note: note || null, resolved_by: user.id, resolved_at: this.now(),
    });
    this.ctx.audit.record({ actorId: user.id, action: 'qc_finding_resolved', objectType: 'qc_finding', objectId: findingId, previousState: finding.resolution, newState: resolution, reason: note || null, meta: { metricKey: finding.metric_key, severity: finding.severity } });
    return updated;
  }

  /** Put a run's open issues onto a reviewer's My Work queue. */
  assignForReview(user, runId, { ownerId, title } = {}) {
    requirePermission(user, 'edit_audience');
    const { run, deal, findings } = this.getRun(runId);
    const open = findings.filter((f) => f.severity !== 'ok' && f.resolution === 'open').length;
    const nowIso = this.now();
    const item = this.repos.workspaceItems.insert({
      id: id('wsi'), workspace: 'investment-qc', type: 'qc_review',
      title: title || `QC review — ${deal.code} (${open} open issue${open === 1 ? '' : 's'})`,
      description: `Reconcile the flagged figures for ${deal.name} before IC.`,
      owner_id: ownerId || null, status: open > 0 ? 'Needs review' : 'Ready', priority: run.status === 'issues_found' ? 'high' : 'normal',
      due_at: deal.ic_date || null, source_refs_json: JSON.stringify([{ type: 'qc_run', id: runId }]),
      next_action: 'Open QC run and resolve findings', created_at: nowIso, updated_at: nowIso,
    });
    this.ctx.audit.record({ actorId: user.id, action: 'qc_assigned', objectType: 'qc_run', objectId: runId, newState: 'assigned', meta: { workItemId: item.id, ownerId: ownerId || null } });
    return item;
  }
}

function hashInputs(metrics, figures) {
  const norm = {
    metrics: metrics.map((m) => [m.key, m.valueNum, m.valueText]).sort((a, b) => String(a[0]).localeCompare(b[0])),
    figures: figures.map((f) => [f.key, f.statedNum, f.statedText]).sort((a, b) => String(a[0]).localeCompare(b[0])),
  };
  return crypto.createHash('sha1').update(JSON.stringify(norm)).digest('hex');
}

module.exports = { InvestmentQcService, reconcile, summarize, SEVERITIES, RESOLUTIONS };
