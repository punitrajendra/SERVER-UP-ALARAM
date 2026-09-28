const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'watches.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS watches (
    id            TEXT PRIMARY KEY,
    user_id       TEXT DEFAULT '1',
    url           TEXT NOT NULL,
    status        TEXT DEFAULT 'checking',
    consecutive   INTEGER DEFAULT 0,
    last_checked  TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    expires_at    TEXT
  )
`);

// ─── Helpers ───────────────────────────────────────────────

const addWatch = db.prepare(`
  INSERT INTO watches (id, url, status, expires_at)
  VALUES (?, ?, 'checking', datetime('now', '+24 hours'))
`);

const getActiveWatches = db.prepare(`
  SELECT * FROM watches
  WHERE expires_at > datetime('now')
  ORDER BY created_at DESC
`);

const getWatchById = db.prepare(`SELECT * FROM watches WHERE id = ?`);

const countActiveWatches = db.prepare(`
  SELECT COUNT(*) as count FROM watches
  WHERE expires_at > datetime('now')
`);

const updateWatchStatus = db.prepare(`
  UPDATE watches
  SET status = ?, consecutive = ?, last_checked = datetime('now')
  WHERE id = ?
`);

const deleteWatch = db.prepare(`DELETE FROM watches WHERE id = ?`);

const expireOldWatches = db.prepare(`
  DELETE FROM watches WHERE expires_at <= datetime('now')
`);

module.exports = {
  db,
  addWatch,
  getActiveWatches,
  getWatchById,
  countActiveWatches,
  updateWatchStatus,
  deleteWatch,
  expireOldWatches,
};
