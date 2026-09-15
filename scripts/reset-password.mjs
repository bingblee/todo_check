import Database from "better-sqlite3";
import { randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";

const scrypt = promisify(nodeScrypt);

for (const envFile of [".env.local", ".env"]) {
  try { process.loadEnvFile(envFile); } catch { /* Environment variables may be supplied by Docker or the shell. */ }
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function usage() {
  console.error("用法：npm run auth:reset -- --username <用户名>");
  console.error("可选：通过管道传入密码：printf '%s\\n' '新密码' | npm run auth:reset -- --username <用户名> --password-stdin");
}

async function readSecret(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    let value = "";
    for await (const chunk of process.stdin) value += chunk;
    return value.trim().split(/\r?\n/, 1)[0] ?? "";
  }

  return new Promise((resolveValue, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = "";
    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      if (error) reject(error);
      else resolveValue(value);
    };
    const onData = (chunk) => {
      for (const char of String(chunk)) {
        if (char === "\u0003") return finish(new Error("已取消"));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f") {
          if (value.length) value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

const username = option("--username").trim();
if (!username) {
  usage();
  process.exitCode = 1;
} else {
  const databasePath = resolve(process.env.DATABASE_PATH || "./data/todo.sqlite");
  const db = new Database(databasePath);
  try {
    const user = db.prepare("SELECT id, username, is_active FROM users WHERE username = ? LIMIT 1").get(username);
    if (!user) throw new Error(`找不到用户：${username}`);
    if (!user.is_active) throw new Error(`用户已停用：${username}`);

    const password = process.argv.includes("--password-stdin")
      ? await readSecret("")
      : await readSecret("请输入新密码（至少 8 位）：");
    if (password.length < 8) throw new Error("密码至少需要 8 位");

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const reset = db.transaction(() => {
      db.prepare("UPDATE users SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?").run(passwordHash, now, user.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    });
    reset();
    console.log(`已重置用户 ${user.username} 的密码，所有旧登录会话已失效。`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
