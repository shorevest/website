-- ShoreVest One — Investment Toolbox: IC Deck QC.
--
-- Pre-Investment-Committee quality control. A deal deck is built from an Excel
-- model; figures are transcribed by hand and mistakes creep in. This schema
-- stores the authoritative figures extracted from a model version and the
-- figures found in a deck version, so a reconciliation run can flag every
-- transcription error, stale value, missing figure, and unsourced number
-- before the deck reaches the IC. The reconciliation engine and its findings
-- are enforced in the service layer (see server/services/investmentQc.js).

-- A deal heading to Investment Committee.
CREATE TABLE deals (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,            -- e.g. PRJ-KINGFISHER
  name        TEXT NOT NULL,
  asset_type  TEXT NOT NULL,            -- NPL portfolio | Single credit | ...
  jurisdiction TEXT,
  stage       TEXT NOT NULL DEFAULT 'Screening',
  ic_date     TEXT,
  owner_id    TEXT REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- A version of the deal's Excel model. Holds the authoritative figures.
CREATE TABLE deal_models (
  id         TEXT PRIMARY KEY,
  deal_id    TEXT NOT NULL REFERENCES deals(id),
  version    INTEGER NOT NULL,
  label      TEXT NOT NULL,
  source_ref TEXT,                      -- future: SharePoint path / document id
  checksum   TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_deal_models_deal ON deal_models(deal_id);

-- Authoritative figures extracted from a model version. The deck is checked
-- against these. value_num carries the numeric truth; value_text handles
-- non-numeric metrics (currency codes, labels).
CREATE TABLE model_metrics (
  id         TEXT PRIMARY KEY,
  model_id   TEXT NOT NULL REFERENCES deal_models(id),
  deal_id    TEXT NOT NULL REFERENCES deals(id),
  metric_key TEXT NOT NULL,             -- stable join key, e.g. gross_npl_balance
  label      TEXT NOT NULL,
  unit       TEXT,                      -- £m | % | x | yr | ''
  format     TEXT NOT NULL DEFAULT 'number', -- number | percent | currency | multiple | text
  value_num  REAL,                      -- NULL for text metrics
  value_text TEXT,
  tolerance  REAL NOT NULL DEFAULT 0,   -- absolute tolerance for a numeric match
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_model_metrics_model ON model_metrics(model_id);
CREATE INDEX idx_model_metrics_key ON model_metrics(deal_id, metric_key);

-- A version of the IC deck for a deal.
CREATE TABLE decks (
  id         TEXT PRIMARY KEY,
  deal_id    TEXT NOT NULL REFERENCES deals(id),
  version    INTEGER NOT NULL,
  label      TEXT NOT NULL,
  source_ref TEXT,
  checksum   TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_decks_deal ON decks(deal_id);

-- Figures found in a deck version, each tagged with the metric it claims to
-- represent and the slide it appears on.
CREATE TABLE deck_figures (
  id          TEXT PRIMARY KEY,
  deck_id     TEXT NOT NULL REFERENCES decks(id),
  deal_id     TEXT NOT NULL REFERENCES deals(id),
  metric_key  TEXT NOT NULL,
  label       TEXT NOT NULL,
  slide       INTEGER,
  stated_num  REAL,
  stated_text TEXT,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_deck_figures_deck ON deck_figures(deck_id);

-- A reconciliation run: one deck version compared against one model version.
-- Frozen by input_hash so the run is a durable record of what was compared.
CREATE TABLE qc_runs (
  id         TEXT PRIMARY KEY,
  deal_id    TEXT NOT NULL REFERENCES deals(id),
  deck_id    TEXT NOT NULL REFERENCES decks(id),
  model_id   TEXT NOT NULL REFERENCES deal_models(id),
  status     TEXT NOT NULL,             -- clean | review_advised | issues_found
  input_hash TEXT NOT NULL,
  counts_json TEXT NOT NULL,
  run_by     TEXT REFERENCES users(id),
  note       TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_qc_runs_deal ON qc_runs(deal_id);

-- Per-figure result of a run.
CREATE TABLE qc_findings (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES qc_runs(id),
  deal_id         TEXT NOT NULL REFERENCES deals(id),
  metric_key      TEXT NOT NULL,
  label           TEXT NOT NULL,
  slide           INTEGER,
  severity        TEXT NOT NULL,        -- ok | mismatch | stale | missing | orphan
  unit            TEXT,
  format          TEXT NOT NULL DEFAULT 'number',
  model_num       REAL,
  model_text      TEXT,
  deck_num        REAL,
  deck_text       TEXT,
  delta_num       REAL,
  tolerance       REAL NOT NULL DEFAULT 0,
  matched_version INTEGER,              -- for stale: the model version the deck value matches
  resolution      TEXT NOT NULL DEFAULT 'open', -- open | acknowledged | fixed | waived
  resolution_note TEXT,
  resolved_by     TEXT REFERENCES users(id),
  resolved_at     TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX idx_qc_findings_run ON qc_findings(run_id);
