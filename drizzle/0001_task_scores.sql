CREATE TABLE IF NOT EXISTS task_score_versions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completion_score INTEGER NOT NULL,
  incomplete_score INTEGER NOT NULL,
  effective_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS task_score_versions_lookup_idx ON task_score_versions(task_id, effective_date);
