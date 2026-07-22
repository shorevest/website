-- ShoreVest One — initial schema.
-- Shared domain model. Every workspace reads and writes these same records,
-- so a change in one view is visible everywhere. Statuses are enforced in the
-- service layer (see server/domain/status.js); columns here are the store.

-- Staff users (message senders / actors). Fictional in MOCK mode; later mapped
-- to authorized real users via configuration.
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  title        TEXT NOT NULL,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL,          -- associate | director | approver | admin
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- Institutions (fictional).
CREATE TABLE institutions (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  country    TEXT NOT NULL,
  region     TEXT NOT NULL,
  owner_id   TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- People (CRM contacts). Animal codenames only.
CREATE TABLE people (
  id             TEXT PRIMARY KEY,
  codename       TEXT NOT NULL,
  institution_id TEXT REFERENCES institutions(id),
  title          TEXT NOT NULL,
  email          TEXT,                        -- may be NULL (missing contact)
  email_status   TEXT NOT NULL DEFAULT 'ok',  -- ok | missing | bounced
  status         TEXT NOT NULL DEFAULT 'active', -- active | departed
  owner_id       TEXT REFERENCES users(id),
  region         TEXT NOT NULL,
  country        TEXT NOT NULL,
  restricted     INTEGER NOT NULL DEFAULT 0,
  declined_at    TEXT,                        -- recent explicit decline
  duplicate_of   TEXT REFERENCES people(id),  -- flagged possible duplicate
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_people_institution ON people(institution_id);
CREATE INDEX idx_people_country ON people(country);
CREATE INDEX idx_people_owner ON people(owner_id);

CREATE TABLE relationships (
  id             TEXT PRIMARY KEY,
  person_id      TEXT NOT NULL REFERENCES people(id),
  institution_id TEXT REFERENCES institutions(id),
  owner_id       TEXT REFERENCES users(id),
  stage          TEXT NOT NULL,        -- prospect | active | dormant | conflict
  health         TEXT NOT NULL,        -- strong | steady | at_risk
  last_contact_at TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_relationships_person ON relationships(person_id);

CREATE TABLE opportunities (
  id             TEXT PRIMARY KEY,
  institution_id TEXT REFERENCES institutions(id),
  name           TEXT NOT NULL,
  stage          TEXT NOT NULL,
  amount         INTEGER,
  owner_id       TEXT REFERENCES users(id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE saved_searches (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  owner_id   TEXT REFERENCES users(id),
  query_text TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audiences (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  owner_id     TEXT REFERENCES users(id),
  objective    TEXT,
  source_query TEXT,
  rules_json   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE audience_members (
  id          TEXT PRIMARY KEY,
  audience_id TEXT NOT NULL REFERENCES audiences(id),
  person_id   TEXT NOT NULL REFERENCES people(id),
  status      TEXT NOT NULL DEFAULT 'proposed', -- proposed|ready|held|blocked|removed
  issue_code  TEXT,
  issue_reason TEXT,
  next_action TEXT,
  held_reason TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (audience_id, person_id)
);
CREATE INDEX idx_members_audience ON audience_members(audience_id);

CREATE TABLE record_proposals (
  id                 TEXT PRIMARY KEY,
  audience_member_id TEXT REFERENCES audience_members(id),
  person_id          TEXT REFERENCES people(id),
  kind               TEXT NOT NULL,   -- contact_match|contact_create|account_create|record_update
  payload_json       TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'proposed', -- proposed|accepted|rejected|applied|failed
  decided_by         TEXT REFERENCES users(id),
  decided_at         TEXT,
  result_json        TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE signatures (
  id        TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id),
  version   INTEGER NOT NULL,
  html      TEXT NOT NULL,
  active    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE delivery_policies (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  approved        INTEGER NOT NULL DEFAULT 0,
  throttle_per_hour INTEGER NOT NULL DEFAULT 50,
  description     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE draft_groups (
  id          TEXT PRIMARY KEY,
  audience_id TEXT NOT NULL REFERENCES audiences(id),
  name        TEXT NOT NULL,
  treatment   TEXT,
  objective   TEXT,
  sender_id   TEXT REFERENCES users(id),
  signature_id TEXT REFERENCES signatures(id),
  subject     TEXT,
  body        TEXT,
  status      TEXT NOT NULL DEFAULT 'draft', -- draft|needs_review|changes_requested|accepted|invalidated
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE draft_group_members (
  id             TEXT PRIMARY KEY,
  draft_group_id TEXT NOT NULL REFERENCES draft_groups(id),
  audience_member_id TEXT NOT NULL REFERENCES audience_members(id),
  person_id      TEXT NOT NULL REFERENCES people(id),
  UNIQUE (draft_group_id, audience_member_id)
);

CREATE TABLE draft_versions (
  id             TEXT PRIMARY KEY,
  draft_group_id TEXT NOT NULL REFERENCES draft_groups(id),
  version        INTEGER NOT NULL,
  subject        TEXT,
  body           TEXT,
  sender_id      TEXT,
  signature_id   TEXT,
  editor_id      TEXT,
  note           TEXT,
  created_at     TEXT NOT NULL
);

CREATE TABLE approval_packages (
  id               TEXT PRIMARY KEY,
  audience_id      TEXT NOT NULL REFERENCES audiences(id),
  name             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',
  version_hash     TEXT,
  frozen_json      TEXT,
  sender_id        TEXT REFERENCES users(id),
  delivery_policy_id TEXT REFERENCES delivery_policies(id),
  submitted_by     TEXT REFERENCES users(id),
  submitted_at     TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE approval_decisions (
  id                 TEXT PRIMARY KEY,
  package_id         TEXT NOT NULL REFERENCES approval_packages(id),
  decision           TEXT NOT NULL,   -- approved | returned
  decided_by         TEXT REFERENCES users(id),
  reason             TEXT,
  package_version_hash TEXT,
  created_at         TEXT NOT NULL
);

CREATE TABLE execution_requests (
  id              TEXT PRIMARY KEY,
  package_id      TEXT NOT NULL REFERENCES approval_packages(id),
  idempotency_key TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'queued', -- queued|executed|failed|partial
  requested_by    TEXT REFERENCES users(id),
  result_json     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE messages (
  id                  TEXT PRIMARY KEY,
  execution_request_id TEXT REFERENCES execution_requests(id),
  package_id          TEXT REFERENCES approval_packages(id),
  draft_group_id      TEXT REFERENCES draft_groups(id),
  person_id           TEXT NOT NULL REFERENCES people(id),
  sender_id           TEXT REFERENCES users(id),
  subject             TEXT,
  body                TEXT,
  status              TEXT NOT NULL DEFAULT 'queued', -- queued|sent|failed|held
  external_id         TEXT,
  error_code          TEXT,
  error_detail        TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE responses (
  id             TEXT PRIMARY KEY,
  message_id     TEXT REFERENCES messages(id),
  person_id      TEXT REFERENCES people(id),
  kind           TEXT NOT NULL,    -- reply | bounce | decline | ooo
  classification TEXT,
  snippet        TEXT,
  received_at    TEXT NOT NULL,
  created_at     TEXT NOT NULL
);

CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  kind        TEXT NOT NULL,
  owner_id    TEXT REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'Ready',
  priority    TEXT NOT NULL DEFAULT 'normal',
  due_at      TEXT,
  source_type TEXT,
  source_id   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE workspace_items (
  id          TEXT PRIMARY KEY,
  workspace   TEXT NOT NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  owner_id    TEXT REFERENCES users(id),
  status      TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal',
  due_at      TEXT,
  source_refs_json TEXT,
  next_action TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_workspace_items_owner ON workspace_items(owner_id);
CREATE INDEX idx_workspace_items_workspace ON workspace_items(workspace);

CREATE TABLE audit_events (
  id             TEXT PRIMARY KEY,
  actor_id       TEXT,
  action         TEXT NOT NULL,
  object_type    TEXT NOT NULL,
  object_id      TEXT NOT NULL,
  previous_state TEXT,
  new_state      TEXT,
  reason         TEXT,
  source         TEXT NOT NULL DEFAULT 'shorevest-one',
  meta_json      TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_audit_object ON audit_events(object_type, object_id);
CREATE INDEX idx_audit_created ON audit_events(created_at);

CREATE TABLE connector_sync (
  id            TEXT PRIMARY KEY,
  connector     TEXT NOT NULL,
  status        TEXT NOT NULL,
  last_sync_at  TEXT,
  cursor        TEXT,
  detail        TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Idempotency registry. Guarantees an execution side-effect runs at most once.
CREATE TABLE execution_keys (
  key         TEXT PRIMARY KEY,
  scope       TEXT NOT NULL,
  request_id  TEXT,
  result_json TEXT,
  created_at  TEXT NOT NULL
);
