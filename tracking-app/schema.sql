CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- Stored strictly in integer cents (e.g., $10.50 -> 1050)
  remark TEXT NOT NULL,
  spent_at TEXT NOT NULL,   -- ISO8601 string: YYYY-MM-DD
  tag TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, spent_at);
CREATE INDEX IF NOT EXISTS idx_expenses_user_tag ON expenses(user_id, tag);
CREATE INDEX IF NOT EXISTS idx_expenses_user_filters ON expenses(user_id, spent_at, tag);