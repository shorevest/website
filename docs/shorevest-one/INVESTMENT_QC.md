# Investment Toolbox — IC Deck QC

A working ShoreVest One workspace that reconciles a deal deck against its Excel
model **before Investment Committee**, so a mis-transcribed figure is caught by
the tool instead of in the room.

## The problem it solves

A deal deck is built from the model. Figures are transcribed by hand, and
mistakes get through — a gross balance typed as 1,240 instead of 1,420, a
recovery rate carried over from a superseded model, a figure dropped from the
deck, a number in the deck that the model never produced. QC turns that from a
manual eyeball check into a deterministic reconciliation with an audit trail.

## What a run produces

Every figure the model produces, and every figure the deck states, is
classified:

| Severity | Meaning |
| --- | --- |
| **ok** | Deck value ties to the model within the metric's tolerance. |
| **mismatch** | Deck value differs from the current model — a transcription error. |
| **stale** | Deck value does not match the current model but *does* match an **older** model version — the deck was built off a superseded model. |
| **missing** | The model has the figure; the deck omits it. |
| **orphan** | The deck states a figure with no corresponding model metric (unsourced). |

A run's status rolls up as `issues_found` (any mismatch/stale), else
`review_advised` (any missing/orphan), else `clean`. Findings can be
**acknowledged / fixed / waived**, a run can be **assigned to My Work**, and the
result exports to CSV. Every action is written to the audit trail.

## Architecture

Same four layers as the rest of ShoreVest One; the UI only ever calls `/api`.

```
app/app.js                              #/investment views (list, deal, run)
server/api/router.js                    /api/investment/* routes
server/services/investmentQc.js         reconcile() engine + service (permissions, audit)
server/db/migrations/002_investment_qc  deals, deal_models, model_metrics,
                                        decks, deck_figures, qc_runs, qc_findings
server/connectors/.../document.mock.js  extractModelMetrics / extractDeckFigures
```

`reconcile()` is a **pure function** (`{ metrics, figures, priorVersions } →
findings`), so the classification logic is tested directly with no database.

## The connector seam (mock now, real later)

Turning an `.xlsx` model or `.pptx` deck into structured figures is a
**connector** responsibility — `DocumentConnector.extractModelMetrics(sourceRef)`
and `extractDeckFigures(sourceRef)`. In `MOCK` mode these return deterministic
fictional fixtures (`server/connectors/mock/investmentFixtures.js`); a connected
environment implements the same two methods against SharePoint + a spreadsheet /
slide parser. **The reconciliation engine, findings, workflow, and audit are
identical either way** — connecting real documents is an integration task, not a
redesign. The live path is exercised today via
`POST /api/investment/{decks,models}/:id/reingest`.

> What is *not* built yet: parsing real Office files. That is the connector
> implementation behind the two `extract*` methods. Everything downstream of the
> extracted figures is real.

## API

| Method & path | Purpose | Permission |
| --- | --- | --- |
| `GET /api/investment/deals` | Deals with current deck/model + last run. | view |
| `GET /api/investment/deals/:id` | Deal detail: model & deck versions, run history. | view |
| `POST /api/investment/deals/:id/qc-runs` | Run QC (`{deckId?, modelId?}`, defaults to current). | `edit_audience` |
| `GET /api/investment/qc-runs/:id` | Run + findings. | view |
| `POST /api/investment/qc-runs/:id/assign` | Put the run's issues on a reviewer's My Work. | `edit_audience` |
| `POST /api/investment/findings/:id/resolve` | `{resolution, note}` — acknowledged/fixed/waived. | `resolve_held_record` |
| `POST /api/investment/{decks,models}/:id/reingest` | Re-extract figures through the connector. | `edit_audience` |

## Seed data (fictional)

`server/seed/seedInvestment.js` loads four invented deals — no real ShoreVest
deal, borrower, or figure appears:

- **PRJ-KINGFISHER** — `issues_found`: reproduces the transcription error
  (balance 1,240 vs 1,420), a wrong IRR, a stale recovery rate (matches model
  v1), a dropped exit year, and an unsourced sponsor-promote figure.
- **PRJ-MARLIN** — `clean`: every figure ties out.
- **PRJ-OSPREY** — `review_advised`: a rounded balance within tolerance plus one
  dropped figure.
- **PRJ-HERON** — no run until you ask (one wrong LTV when run).

## Run it

```bash
npm run one:migrate   # applies 002_investment_qc.sql
npm run one:dev       # auto-seeds MOCK; open the printed URL → Investment → IC Deck QC
npm run one:test      # engine + service + API tests
```
