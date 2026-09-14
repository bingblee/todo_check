import "server-only";

import { and, eq, gt } from "drizzle-orm";
import { createHash, randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";

const BASE_COOKIE_NAME = "checkin_session";
const SESSION_DAYS = 30;
const scrypt = promisify(nodeScrypt);

function appBasePath() {
  const value = process.env.APP_BASE_PATH?.trim() ?? "";
  if (!value || value === "/") return "";
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

function sessionCookieName() {
  const suffix = appBasePath().slice(1).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return suffix ? `${BASE_COOKIE_NAME}_${suffix}` : BASE_COOKIE_NAME;
}

function sessionCookiePath() {
  // The app has protected routes at /app, /summary, /settings and /today.
  // Restricting this to APP_BASE_PATH would make a value such as `/app`
  // accidentally hide the session from every other page. A root-scoped
  // cookie works both for normal deployments and for apps mounted behind a
  // reverse-proxy sub-path.
  return "/";
}

async function secureCookie() {
  const configured = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;

  const forwardedProto = (await headers()).get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
  if (forwardedProto === "http" || forwardedProto === "https") return forwardedProto === "https";

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    try {
      return new URL(appUrl).protocol === "https:";
    } catch {
      // Fall back to the deployment mode for an invalid or incomplete APP_URL.
    }
  }
  return process.env.NODE_ENV === "production";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(hash: string, password: string) {
  try {
    const [algorithm, encodedSalt, encodedHash] = hash.split("$");
    if (algorithm !== "scrypt" || !encodedSalt || !encodedHash) return false;
    const expected = Buffer.from(encodedHash, "base64url");
    const actual = await scrypt(password, Buffer.from(encodedSalt, "base64url"), expected.length) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName(), rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookie(),
    path: sessionCookiePath(),
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  cookieStore.set(sessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookie(),
    path: sessionCookiePath(),
    expires: new Date(0),
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);
  const user = rows[0]?.user;
  if (!user?.isActive) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/app");
  return user;
}

export async function revokeUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
