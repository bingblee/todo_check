"use server";

import { and, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { hashPassword, requireAdmin, revokeUserSessions } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes, users } from "@/lib/db/schema";
import { formString, passwordSchema, usernameSchema } from "@/lib/validation";

export type UserActionState = { error?: string; success?: string } | null;

export async function createUserAction(_: UserActionState, formData: FormData): Promise<UserActionState> {
  await requireAdmin();
  const usernameResult = usernameSchema.safeParse(formString(formData, "username"));
  const passwordResult = passwordSchema.safeParse(formString(formData, "password"));
  if (!usernameResult.success) return { error: usernameResult.error.issues[0].message };
  if (!passwordResult.success) return { error: passwordResult.error.issues[0].message };
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, usernameResult.data)).limit(1);
  if (existing) return { error: "用户名已存在" };
  const id = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(passwordResult.data);
  db.transaction((tx) => {
    tx.insert(users).values({ id, username: usernameResult.data, passwordHash, role: "user", createdAt: now, updatedAt: now }).run();
    tx.insert(themes).values({ id: randomUUID(), userId: id, name: "我的日常", icon: "☀", color: "#73947c", createdAt: now, updatedAt: now }).run();
  });
  revalidatePath("/admin/users");
  return { success: `已创建账号 ${usernameResult.data}` };
}

export async function resetUserPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = formString(formData, "userId");
  const passwordResult = passwordSchema.safeParse(formString(formData, "password"));
  if (!passwordResult.success || userId === admin.id) return;
  await db.update(users).set({ passwordHash: await hashPassword(passwordResult.data), sessionVersion: 2, updatedAt: new Date().toISOString() }).where(and(eq(users.id, userId), ne(users.role, "admin")));
  await revokeUserSessions(userId);
  revalidatePath("/admin/users");
}

export async function toggleUserActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = formString(formData, "userId");
  if (userId === admin.id) return;
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.role === "admin") return;
  await db.update(users).set({ isActive: !target.isActive, updatedAt: new Date().toISOString() }).where(eq(users.id, userId));
  if (target.isActive) await revokeUserSessions(userId);
  revalidatePath("/admin/users");
}
