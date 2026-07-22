'use strict';

/**
 * Fictional deal documents for the Investment Toolbox (IC Deck QC).
 *
 * These stand in for the Excel models and PowerPoint decks a connected
 * environment would parse out of SharePoint. The mock DocumentConnector
 * "extracts" from these; the deterministic seeder loads the same data so the
 * app is populated on first run. Single source of truth for both paths.
 *
 * Everything here is INVENTED — project codenames, jurisdictions, and numbers.
 * No real ShoreVest deal, borrower, counterparty, or figure appears. The
 * figures are engineered so the reconciliation engine produces a realistic
 * spread of outcomes (transcription errors, a stale value carried from an old
 * model, a dropped figure, an unsourced figure, and clean passes).
 */

function metric(key, label, unit, format, valueNum, tolerance, valueText) {
  return { key, label, unit, format, valueNum, valueText: valueText || null, tolerance };
}
function figure(key, label, slide, statedNum, statedText) {
  return { key, label, slide, statedNum: statedNum === undefined ? null : statedNum, statedText: statedText || null };
}

// metric_key → the figures extracted from each model version, by source ref.
const MODEL_FIXTURES = {
  // Project Kingfisher — current authoritative model (v2).
  'model/kingfisher/v2': [
    metric('gross_npl_balance', 'Gross NPL balance (UPB)', '£m', 'currency', 1420, 0.5),
    metric('net_purchase_price', 'Net purchase price', '£m', 'currency', 512, 0.5),
    metric('gross_moic', 'Gross MOIC', 'x', 'multiple', 1.9, 0.02),
    metric('projected_irr', 'Projected gross IRR', '%', 'percent', 17.9, 0.05),
    metric('recovery_rate', 'Blended recovery rate', '%', 'percent', 62.5, 0.05),
    metric('weighted_avg_life', 'Weighted average life', 'yr', 'number', 3.2, 0.05),
    metric('num_loans', 'Number of loans', '', 'number', 214, 0),
    metric('gross_collections_yr1', 'Gross collections — Year 1', '£m', 'currency', 88, 0.5),
    metric('exit_year', 'Expected final exit', '', 'number', 2031, 0),
    metric('base_currency', 'Base currency', '', 'text', null, 0, 'GBP'),
  ],
  // Project Kingfisher — superseded model (v1). Kept so the engine can tell a
  // stale figure (matches an older model) from a plain transcription error.
  'model/kingfisher/v1': [
    metric('gross_npl_balance', 'Gross NPL balance (UPB)', '£m', 'currency', 1400, 0.5),
    metric('projected_irr', 'Projected gross IRR', '%', 'percent', 16.5, 0.05),
    metric('recovery_rate', 'Blended recovery rate', '%', 'percent', 58.0, 0.05),
    metric('num_loans', 'Number of loans', '', 'number', 214, 0),
  ],
  // Project Marlin — a clean deal: the deck matches the model exactly.
  'model/marlin/v1': [
    metric('gross_npl_balance', 'Gross NPL balance (UPB)', '€m', 'currency', 640, 0.5),
    metric('net_purchase_price', 'Net purchase price', '€m', 'currency', 300, 0.5),
    metric('gross_moic', 'Gross MOIC', 'x', 'multiple', 1.7, 0.02),
    metric('projected_irr', 'Projected gross IRR', '%', 'percent', 15.2, 0.05),
    metric('recovery_rate', 'Blended recovery rate', '%', 'percent', 55.0, 0.05),
    metric('num_loans', 'Number of loans', '', 'number', 96, 0),
    metric('base_currency', 'Base currency', '', 'text', null, 0, 'EUR'),
  ],
  // Project Osprey — exercises numeric tolerance (rounded display) plus a gap.
  'model/osprey/v1': [
    metric('gross_npl_balance', 'Gross NPL balance (UPB)', '£m', 'currency', 1419.6, 0.5),
    metric('projected_irr', 'Projected gross IRR', '%', 'percent', 14.0, 0.05),
    metric('num_loans', 'Number of loans', '', 'number', 120, 0),
    metric('exit_year', 'Expected final exit', '', 'number', 2030, 0),
  ],
  // Project Heron — a single-credit deal.
  'model/heron/v1': [
    metric('principal', 'Principal balance', '£m', 'currency', 45, 0.5),
    metric('coupon', 'Contract coupon', '%', 'percent', 12.5, 0.05),
    metric('ltv', 'Loan-to-value', '%', 'percent', 68.0, 0.1),
    metric('maturity_year', 'Final maturity', '', 'number', 2029, 0),
  ],
};

const DECK_FIXTURES = {
  // Project Kingfisher deck (v3). Reproduces the story that prompted this tool:
  // Gross NPL balance was typed as 1,240 instead of 1,420 (transcription
  // error); the projected IRR is also wrong; the recovery rate was carried over
  // from the previous model (stale); the final-exit figure was dropped
  // (missing); and a sponsor-promote figure appears with no model source
  // (orphan).
  'deck/kingfisher/v3': [
    figure('gross_npl_balance', 'Gross NPL balance', 7, 1240),
    figure('net_purchase_price', 'Net purchase price', 7, 512),
    figure('gross_moic', 'Gross MOIC', 4, 1.9),
    figure('projected_irr', 'Projected gross IRR', 12, 18.4),
    figure('recovery_rate', 'Blended recovery rate', 8, 58.0),
    figure('weighted_avg_life', 'Weighted average life', 8, 3.2),
    figure('num_loans', 'Number of loans', 3, 214),
    figure('gross_collections_yr1', 'Gross collections — Year 1', 9, 88),
    figure('base_currency', 'Base currency', 2, undefined, 'GBP'),
    figure('sponsor_promote', 'Sponsor promote', 11, 6.5),
  ],
  // Project Marlin deck (v2) — every figure ties to the model.
  'deck/marlin/v2': [
    figure('gross_npl_balance', 'Gross NPL balance', 6, 640),
    figure('net_purchase_price', 'Net purchase price', 6, 300),
    figure('gross_moic', 'Gross MOIC', 4, 1.7),
    figure('projected_irr', 'Projected gross IRR', 10, 15.2),
    figure('recovery_rate', 'Blended recovery rate', 7, 55.0),
    figure('num_loans', 'Number of loans', 3, 96),
    figure('base_currency', 'Base currency', 2, undefined, 'EUR'),
  ],
  // Project Osprey deck (v1) — a rounded balance (within tolerance) and a
  // dropped exit-year figure.
  'deck/osprey/v1': [
    figure('gross_npl_balance', 'Gross NPL balance', 5, 1420),
    figure('projected_irr', 'Projected gross IRR', 9, 14.0),
    figure('num_loans', 'Number of loans', 3, 120),
  ],
  // Project Heron deck (v1) — one wrong figure (LTV: 72.0 vs model 68.0).
  'deck/heron/v1': [
    figure('principal', 'Principal balance', 4, 45),
    figure('coupon', 'Contract coupon', 6, 12.5),
    figure('ltv', 'Loan-to-value', 6, 72.0),
    figure('maturity_year', 'Final maturity', 3, 2029),
  ],
};

module.exports = { MODEL_FIXTURES, DECK_FIXTURES };
