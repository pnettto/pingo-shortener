CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,          -- first chars of the key, for display
  hash TEXT NOT NULL UNIQUE,     -- sha256(key), the key itself is never stored
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

ALTER TABLE links ADD COLUMN created_by TEXT;  -- api_keys.id, NULL = browser
CREATE INDEX IF NOT EXISTS links_created_by ON links(created_by);

CREATE TABLE IF NOT EXISTS rate_limits (
  k TEXT PRIMARY KEY,            -- name:subject:window
  n INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expires ON rate_limits(expires);
