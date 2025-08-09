const Database = require('better-sqlite3');
const db = new Database('pastes.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS pastes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    expires_at INTEGER,
    created_at INTEGER,
    read_once TEXT,
    password TEXT,
    available_at INTEGER DEFAULT 0

  )
`);

module.exports = db;
