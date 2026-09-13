"use server";

import { count, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes, users } from "@/lib/db/schema";
import { formString, passwordSchema, usernameSchema } from "@/lib/validation";

export type AuthState = { error?: string } | null;

export async function setupAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (total > 0) return { error: "初始化已完成，请直接登录" };
  const usernameResult = usernameSchema.safeParse(formString(formData, "username"));
  const passwordResult = passwordSchema.safeParse(formString(formData, "password"));
  if (!usernameResult.success) return { error: usernameResult.error.issues[0].message };
  if (!passwordResult.success) return { error: passwordResult.error.issues[0].message };

  const now = new Date().toISOString();
  const userId = randomUUID();
  const passwordHash = await hashPassword(passwordResult.data);
  try {
    db.transaction((tx) => {
      const current = tx.select({ total: count() }).from(users).get();
      if ((current?.total ?? 0) > 0) throw new Error("already initialized");
      tx.insert(users).values({
        id: userId,
        username: usernameResult.data,
        passwordHash,
        role: "admin",
        timezone: "Asia/Shanghai",
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.insert(themes).values([
        { id: randomUUID(), userId, name: "日常", icon: "☀", color: "#73947c", sortOrder: 0, createdAt: now, updatedAt: now },
        { id: randomUUID(), userId, name: "成长", icon: "✦", color: "#b68968", sortOrder: 1, createdAt: now, updatedAt: now },
      ]).run();
    });
  } catch {
    return { error: "初始化失败，可能已有管理员完成了设置" };
  }
  await createSession(userId);
  redirect("/app");
}

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const username = formString(formData, "username");
  const password = formString(formData, "password");
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || !user.isActive || !(await verifyPassword(user.passwordHash, password))) {
    return { error: "用户名或密码不正确" };
  }
  await createSession(user.id);
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
