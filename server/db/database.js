'use strict';

/**
 * SQLite persistence for ShoreVest One.
 *
 * Uses the built-in `node:sqlite` module (Node >= 22.5). This is a *real*
 * embedded SQL database written to disk — not localStorage, not an in-memory
 * object graph. Workflow state survives process restarts.
 *
 * The schema lives in `migrations/`. Later, replacing SQLite with Postgres or
 * Dataverse is a repository-layer change (see repositories.js) — the services
 * and API do not know which engine backs them.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function openDatabase(databaseFile) {
  if (databaseFile !== ':memory:') {
    fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  }
  const db = new DatabaseSync(databaseFile);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  return db;
}

function runMigrations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);
  const applied = new Set(
    db.prepare('SELECT id FROM _migrations').all().map((r) => r.id),
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN;');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString(),
      );
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }
}

module.exports = { openDatabase, runMigrations };
