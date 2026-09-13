import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

const sourcePath = resolve(process.env.DATABASE_PATH ?? "./data/todo.sqlite");
const backupDir = resolve(process.env.BACKUP_DIR ?? "./backups");
mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replaceAll(":", "-");
const targetPath = resolve(backupDir, `todo-${timestamp}.sqlite`);
const sqlite = new Database(sourcePath, { readonly: true });
await sqlite.backup(targetPath);
sqlite.close();
console.log(`Backup created: ${targetPath}`);
