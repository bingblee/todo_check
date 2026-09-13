PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  is_active INTEGER NOT NULL DEFAULT 1,
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '✓',
  color TEXT NOT NULL DEFAULT '#73947c',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_id TEXT NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('habit', 'one_time')),
  recurrence_mask INTEGER NOT NULL DEFAULT 127,
  due_date TEXT,
  completion_score INTEGER NOT NULL DEFAULT 10,
  incomplete_score INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  awarded_score INTEGER NOT NULL DEFAULT 10,
  completed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(task_id, local_date)
);

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK(period IN ('day', 'week')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  theme_id TEXT,
  source_hash TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  content_json TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_score_versions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completion_score INTEGER NOT NULL,
  incomplete_score INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS themes_user_idx ON themes(user_id, archived_at);
CREATE INDEX IF NOT EXISTS tasks_user_theme_idx ON tasks(user_id, theme_id, archived_at);
CREATE INDEX IF NOT EXISTS checkins_user_date_idx ON checkins(user_id, local_date);
CREATE INDEX IF NOT EXISTS summaries_lookup_idx ON summaries(user_id, period, start_date, end_date, theme_id, updated_at);
CREATE INDEX IF NOT EXISTS ai_usage_user_date_idx ON ai_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS task_score_versions_lookup_idx ON task_score_versions(task_id, effective_date);
