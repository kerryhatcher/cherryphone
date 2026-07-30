-- CherryPhone D1 Schema
-- Run: wrangler d1 execute cherryphone --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- Cloudflare Access user email
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS configs (
  user_id TEXT PRIMARY KEY,
  account_sid_encrypted TEXT NOT NULL,   -- AES-GCM encrypted
  auth_token_encrypted TEXT NOT NULL,    -- AES-GCM encrypted
  twilio_number TEXT NOT NULL,
  identity TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  to_number TEXT NOT NULL,
  status TEXT NOT NULL,              -- 'initiated', 'connected', 'completed', 'failed'
  duration_seconds INTEGER,
  call_sid TEXT,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_call_logs_user ON call_logs(user_id, created_at DESC);
