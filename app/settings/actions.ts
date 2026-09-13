"use server";

import { eq } from "drizzle-orm";
import { hashPassword, requireUser, revokeUserSessions, verifyPassword, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { formString, passwordSchema } from "@/lib/validation";

export type SettingsState = { error?: string; success?: string } | null;

export async function changePasswordAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const current = formString(formData, "currentPassword");
  const nextResult = passwordSchema.safeParse(formString(formData, "newPassword"));
  if (!(await verifyPassword(user.passwordHash, current))) return { error: "当前密码不正确" };
  if (!nextResult.success) return { error: nextResult.error.issues[0].message };
  await db.update(users).set({ passwordHash: await hashPassword(nextResult.data), sessionVersion: user.sessionVersion + 1, updatedAt: new Date().toISOString() }).where(eq(users.id, user.id));
  await revokeUserSessions(user.id);
  await createSession(user.id);
  return { success: "密码已更新，其他设备上的登录已失效" };
}

export async function updateTimezoneAction(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const timezone = formString(formData, "timezone");
  try { new Intl.DateTimeFormat("zh-CN", { timeZone: timezone }).format(); } catch { return { error: "无效的时区" }; }
  await db.update(users).set({ timezone, updatedAt: new Date().toISOString() }).where(eq(users.id, user.id));
  return { success: "时区已保存" };
}
