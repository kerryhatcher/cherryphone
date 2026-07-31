-- CherryPhone D1 Schema
-- Run: wrangler d1 execute cherryphone --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- Cloudflare Access user email
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- WebRTC calling needs an API Key (SID + Secret) and a TwiML App SID to
-- mint a valid Twilio Access Token, plus the Account SID. The Auth Token
-- is kept too, but only to verify the X-Twilio-Signature header on the
-- /voice TwiML webhook — it is never used to sign the Access Token.
CREATE TABLE IF NOT EXISTS configs (
  user_id TEXT PRIMARY KEY,
  api_key_sid_encrypted TEXT NOT NULL,      -- AES-GCM encrypted, SKxxxx
  api_key_secret_encrypted TEXT NOT NULL,   -- AES-GCM encrypted
  twiml_app_sid_encrypted TEXT NOT NULL,    -- AES-GCM encrypted, APxxxx
  account_sid_encrypted TEXT NOT NULL,      -- AES-GCM encrypted, ACxxxx
  auth_token_encrypted TEXT NOT NULL,       -- AES-GCM encrypted; /voice webhook signature validation only
  twilio_number TEXT NOT NULL,
  identity TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- The /voice webhook receives From=client:<identity> and must look up
-- the right user's config before it can validate the request signature.
CREATE INDEX IF NOT EXISTS idx_configs_identity ON configs(identity);

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
