'use strict';

/**
 * Deterministic seed for the Investment Toolbox (IC Deck QC).
 *
 * Loads a handful of FICTIONAL deals, each with an Excel model version and an
 * IC deck version drawn from the shared mock fixtures, then runs one QC pass so
 * the workspace is populated on first open. Same run → same IDs and outcomes.
 *
 * All content is invented (project codenames, jurisdictions, numbers). No real
 * ShoreVest deal, borrower, counterparty, or figure appears.
 */

const { seededId } = require('../domain/ids');
const { MODEL_FIXTURES, DECK_FIXTURES } = require('../connectors/mock/investmentFixtures');

const DEALS = [
  { key: 'kingfisher', code: 'PRJ-KINGFISHER', name: 'Project Kingfisher', asset_type: 'NPL portfolio', jurisdiction: 'United Kingdom', stage: 'IC', ic_date: '2026-07-31', owner: 'ashby',
    models: [{ v: 1, ref: 'model/kingfisher/v1', label: 'Model v1 (superseded)', current: false }, { v: 2, ref: 'model/kingfisher/v2', label: 'Model v2 (current)', current: true }],
    decks: [{ v: 3, ref: 'deck/kingfisher/v3', label: 'IC deck v3 (draft)', current: true }], run: true },
  { key: 'marlin', code: 'PRJ-MARLIN', name: 'Project Marlin', asset_type: 'NPL portfolio', jurisdiction: 'Germany', stage: 'IC', ic_date: '2026-08-07', owner: 'ashby',
    models: [{ v: 1, ref: 'model/marlin/v1', label: 'Model v1 (current)', current: true }],
    decks: [{ v: 2, ref: 'deck/marlin/v2', label: 'IC deck v2 (final)', current: true }], run: true },
  { key: 'osprey', code: 'PRJ-OSPREY', name: 'Project Osprey', asset_type: 'NPL portfolio', jurisdiction: 'United Kingdom', stage: 'Screening', ic_date: '2026-08-14', owner: 'ellison',
    models: [{ v: 1, ref: 'model/osprey/v1', label: 'Model v1 (current)', current: true }],
    decks: [{ v: 1, ref: 'deck/osprey/v1', label: 'IC deck v1 (draft)', current: true }], run: true },
  { key: 'heron', code: 'PRJ-HERON', name: 'Project Heron', asset_type: 'Single credit', jurisdiction: 'United States', stage: 'IC', ic_date: '2026-08-21', owner: 'ellison',
    models: [{ v: 1, ref: 'model/heron/v1', label: 'Model v1 (current)', current: true }],
    decks: [{ v: 1, ref: 'deck/heron/v1', label: 'IC deck v1 (draft)', current: true }], run: false },
];

function seedInvestment(app, now) {
  const { repos } = app;
  if (repos.deals.count() > 0) return { deals: repos.deals.count() }; // already seeded

  const ownerId = (key) => seededId('usr', key);

  for (const d of DEALS) {
    repos.deals.insert({
      id: seededId('deal', d.key), code: d.code, name: d.name, asset_type: d.asset_type,
      jurisdiction: d.jurisdiction, stage: d.stage, ic_date: d.ic_date, owner_id: ownerId(d.owner),
      status: 'active', created_at: now, updated_at: now,
    });
    for (const mv of d.models) {
      const modelId = seededId('dm', `${d.key}-${mv.v}`);
      repos.dealModels.insert({ id: modelId, deal_id: seededId('deal', d.key), version: mv.v, label: mv.label, source_ref: mv.ref, checksum: null, is_current: mv.current, created_at: now });
      (MODEL_FIXTURES[mv.ref] || []).forEach((m, i) => repos.modelMetrics.insert({
        id: seededId('mmt', `${mv.ref}-${m.key}`), model_id: modelId, deal_id: seededId('deal', d.key), metric_key: m.key, label: m.label,
        unit: m.unit || '', format: m.format || 'number', value_num: typeof m.valueNum === 'number' ? m.valueNum : null,
        value_text: m.valueText || null, tolerance: m.tolerance || 0, sort: i, created_at: now,
      }));
    }
    for (const dv of d.decks) {
      const deckId = seededId('dk', `${d.key}-${dv.v}`);
      repos.decks.insert({ id: deckId, deal_id: seededId('deal', d.key), version: dv.v, label: dv.label, source_ref: dv.ref, checksum: null, is_current: dv.current, created_at: now });
      (DECK_FIXTURES[dv.ref] || []).forEach((f, i) => repos.deckFigures.insert({
        id: seededId('dfg', `${dv.ref}-${f.key}`), deck_id: deckId, deal_id: seededId('deal', d.key), metric_key: f.key, label: f.label,
        slide: f.slide == null ? null : f.slide, stated_num: typeof f.statedNum === 'number' ? f.statedNum : null,
        stated_text: f.statedText || null, sort: i, created_at: now,
      }));
    }
  }

  // Run one QC pass on the deals that should show a result on first open.
  const operator = repos.users.get(seededId('usr', 'operator'));
  for (const d of DEALS) {
    if (d.run && operator) app.services.investmentQc.runQc(operator, seededId('deal', d.key));
  }

  return { deals: repos.deals.count(), models: repos.dealModels.count(), decks: repos.decks.count(), runs: repos.qcRuns.count() };
}

module.exports = { seedInvestment };
