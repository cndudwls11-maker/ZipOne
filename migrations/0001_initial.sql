PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 2 AND 20),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 100),
  content TEXT NOT NULL CHECK(length(content) BETWEEN 10 AND 5000),
  category TEXT NOT NULL CHECK(category IN ('product','usage','idea','other')),
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_created ON posts(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS posts_category_created ON posts(category, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS replies (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK(length(content) BETWEEN 2 AND 5000),
  admin_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires_at);
CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
INSERT OR IGNORE INTO schema_migrations VALUES ('0001_initial.sql', unixepoch());
