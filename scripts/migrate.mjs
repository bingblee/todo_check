import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/todo.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
const hadBaseSchema = Boolean(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'").get());
sqlite.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
const hasMigration = (name) => Boolean(sqlite.prepare("SELECT name FROM schema_migrations WHERE name = ?").get(name));
if (!hasMigration("0000_initial")) {
  sqlite.transaction(() => {
    if (!hadBaseSchema) sqlite.exec(readFileSync(resolve("drizzle/0000_initial.sql"), "utf8"));
    sqlite.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run("0000_initial", new Date().toISOString());
  })();
}
// Existing databases created before the migration ledger may have the base
// schema but none of the score columns.
const columns = new Set(sqlite.prepare("PRAGMA table_info(tasks)").all().map((row) => row.name));
if (!columns.has("completion_score")) sqlite.exec("ALTER TABLE tasks ADD COLUMN completion_score INTEGER NOT NULL DEFAULT 10");
if (!columns.has("incomplete_score")) sqlite.exec("ALTER TABLE tasks ADD COLUMN incomplete_score INTEGER NOT NULL DEFAULT 0");
const checkinColumns = new Set(sqlite.prepare("PRAGMA table_info(checkins)").all().map((row) => row.name));
if (!checkinColumns.has("awarded_score")) sqlite.exec("ALTER TABLE checkins ADD COLUMN awarded_score INTEGER NOT NULL DEFAULT 10");
if (!hasMigration("0001_task_scores")) {
  sqlite.transaction(() => {
    sqlite.exec(readFileSync(resolve("drizzle/0001_task_scores.sql"), "utf8"));
    sqlite.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run("0001_task_scores", new Date().toISOString());
  })();
}
const versionCount = sqlite.prepare("SELECT COUNT(*) AS count FROM task_score_versions").get().count;
if (versionCount === 0) {
  sqlite.exec("INSERT INTO task_score_versions (id, user_id, task_id, completion_score, incomplete_score, effective_date, created_at) SELECT lower(hex(randomblob(16))), user_id, id, completion_score, incomplete_score, substr(created_at, 1, 10), created_at FROM tasks");
}
sqlite.close();

console.log(`Database ready: ${databasePath}`);
