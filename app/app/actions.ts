"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkins, taskScoreVersions, tasks, themes } from "@/lib/db/schema";
import { formString } from "@/lib/validation";
import { localDateInTimeZone } from "@/lib/dates";

const COLORS = new Set(["#73947c", "#b68968", "#8a7ea8", "#6995a6", "#c08a8a", "#9a935e"]);
const ICONS = new Set(["✓", "☀", "✦", "📚", "🏃", "💼", "💚", "📖", "🎨", "💰", "🏠", "✈️", "🧘", "🎯"]);

function checkedWeekMask(formData: FormData) {
  return Array.from({ length: 7 }, (_, i) => formData.get(`day-${i}`) === "on" ? 1 << i : 0).reduce((a, b) => a | b, 0);
}

export async function saveThemeAction(formData: FormData) {
  const user = await requireUser();
  const id = formString(formData, "id");
  const name = formString(formData, "name").slice(0, 30);
  const requestedIcon = formString(formData, "icon").slice(0, 4);
  const icon = ICONS.has(requestedIcon) ? requestedIcon : "✓";
  const requestedColor = formString(formData, "color");
  const color = COLORS.has(requestedColor) ? requestedColor : "#73947c";
  if (!name) return;
  const now = new Date().toISOString();
  if (id) {
    await db.update(themes).set({ name, icon, color, updatedAt: now }).where(and(eq(themes.id, id), eq(themes.userId, user.id)));
  } else {
    const current = await db.select({ id: themes.id }).from(themes).where(and(eq(themes.userId, user.id), isNull(themes.archivedAt)));
    await db.insert(themes).values({ id: randomUUID(), userId: user.id, name, icon, color, sortOrder: current.length, createdAt: now, updatedAt: now });
  }
  revalidatePath("/app");
}

export async function archiveThemeAction(formData: FormData) {
  const user = await requireUser();
  const id = formString(formData, "id");
  const now = new Date().toISOString();
  await db.update(themes).set({ archivedAt: now, updatedAt: now }).where(and(eq(themes.id, id), eq(themes.userId, user.id)));
  revalidatePath("/app");
}

export async function reorderThemesAction(orderedIds: string[]) {
  const user = await requireUser();
  const owned = await db.select({ id: themes.id }).from(themes).where(and(eq(themes.userId, user.id), isNull(themes.archivedAt)));
  const ownedIds = new Set(owned.map((theme) => theme.id));
  if (orderedIds.length !== ownedIds.size || new Set(orderedIds).size !== orderedIds.length || orderedIds.some((id) => !ownedIds.has(id))) return;
  db.transaction((tx) => {
    orderedIds.forEach((id, index) => tx.update(themes).set({ sortOrder: index }).where(and(eq(themes.id, id), eq(themes.userId, user.id))).run());
  });
  revalidatePath("/app");
}

export async function saveTaskAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const id = formString(formData, "id");
  const themeId = formString(formData, "themeId");
  const title = formString(formData, "title").slice(0, 80);
  const description = formString(formData, "description").slice(0, 300);
  const type = formString(formData, "type") === "one_time" ? "one_time" : "habit";
  const dueDate = type === "one_time" ? formString(formData, "dueDate") || null : null;
  const recurrenceMask = type === "habit" ? checkedWeekMask(formData) : 0;
  const completionScore = Number(formString(formData, "completionScore"));
  const incompleteScore = Number(formString(formData, "incompleteScore"));
  if (!title) return { ok: false, error: "请填写任务名称" };
  if (type === "habit" && recurrenceMask === 0) return { ok: false, error: "请至少选择一个重复日期" };
  if (!Number.isInteger(completionScore) || completionScore < -999 || completionScore > 999) return { ok: false, error: "完成得分需为 -999 到 999 的整数" };
  if (!Number.isInteger(incompleteScore) || incompleteScore < -999 || incompleteScore > 999) return { ok: false, error: "未完成得分需为 -999 到 999 的整数" };
  const [ownedTheme] = await db.select({ id: themes.id }).from(themes).where(and(eq(themes.id, themeId), eq(themes.userId, user.id), isNull(themes.archivedAt))).limit(1);
  if (!ownedTheme) return { ok: false, error: "主题不存在或已归档" };
  const now = new Date().toISOString();
  if (id) {
    const [previous] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.id))).limit(1);
    if (!previous) return { ok: false, error: "任务不存在" };
    await db.update(tasks).set({ themeId, title, description, type, dueDate, recurrenceMask, completionScore, incompleteScore, updatedAt: now }).where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
    if (previous.completionScore !== completionScore || previous.incompleteScore !== incompleteScore) {
      await db.insert(taskScoreVersions).values({ id: randomUUID(), userId: user.id, taskId: id, completionScore, incompleteScore, effectiveDate: localDateInTimeZone(user.timezone), createdAt: now });
    }
  } else {
    const current = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, user.id), eq(tasks.themeId, themeId), isNull(tasks.archivedAt)));
    const taskId = randomUUID();
    await db.insert(tasks).values({ id: taskId, userId: user.id, themeId, title, description, type, recurrenceMask, dueDate, completionScore, incompleteScore, sortOrder: current.length, createdAt: now, updatedAt: now });
    await db.insert(taskScoreVersions).values({ id: randomUUID(), userId: user.id, taskId, completionScore, incompleteScore, effectiveDate: localDateInTimeZone(user.timezone), createdAt: now });
  }
  revalidatePath("/app");
  return { ok: true };
}

export async function archiveTaskAction(formData: FormData) {
  const user = await requireUser();
  const now = new Date().toISOString();
  await db.update(tasks).set({ archivedAt: now, updatedAt: now }).where(and(eq(tasks.id, formString(formData, "id")), eq(tasks.userId, user.id)));
  revalidatePath("/app");
}

export async function toggleCheckinAction(formData: FormData): Promise<{ status: "completed" | "undone"; taskTitle?: string; awardedScore?: number }> {
  const user = await requireUser();
  const taskId = formString(formData, "taskId");
  const localDate = formString(formData, "localDate");
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id), isNull(tasks.archivedAt))).limit(1);
  if (!task || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return { status: "undone" };
  const [existing] = await db.select().from(checkins).where(and(eq(checkins.taskId, taskId), eq(checkins.localDate, localDate))).limit(1);
  if (existing) {
    await db.delete(checkins).where(and(eq(checkins.id, existing.id), eq(checkins.userId, user.id)));
    revalidatePath("/app");
    revalidatePath("/today");
    revalidatePath("/summary");
    return { status: "undone", taskTitle: task.title };
  }
  else {
    const now = new Date().toISOString();
    await db.insert(checkins).values({ id: randomUUID(), userId: user.id, taskId, localDate, note: "", awardedScore: task.completionScore, completedAt: now, updatedAt: now });
  }
  revalidatePath("/app");
  revalidatePath("/today");
  revalidatePath("/summary");
  return { status: "completed", taskTitle: task.title, awardedScore: task.completionScore };
}

export async function saveCheckinNoteAction(formData: FormData) {
  const user = await requireUser();
  const taskId = formString(formData, "taskId");
  const localDate = formString(formData, "localDate");
  const note = formString(formData, "note").slice(0, 500);
  await db.update(checkins).set({ note, updatedAt: new Date().toISOString() }).where(and(eq(checkins.userId, user.id), eq(checkins.taskId, taskId), eq(checkins.localDate, localDate)));
  revalidatePath("/app");
  revalidatePath("/summary");
}

export async function reorderTasksAction(themeId: string, orderedIds: string[]) {
  const user = await requireUser();
  if (new Set(orderedIds).size !== orderedIds.length) return;
  const siblings = await db.select().from(tasks).where(and(eq(tasks.userId, user.id), eq(tasks.themeId, themeId), isNull(tasks.archivedAt))).orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
  const siblingIds = new Set(siblings.map((task) => task.id));
  if (!orderedIds.length || orderedIds.some((id) => !siblingIds.has(id))) return;
  const reorderedSet = new Set(orderedIds);
  let orderedIndex = 0;
  const mergedIds = siblings.map((task) => reorderedSet.has(task.id) ? orderedIds[orderedIndex++] : task.id);
  db.transaction((tx) => {
    mergedIds.forEach((id, index) => tx.update(tasks).set({ sortOrder: index }).where(and(eq(tasks.id, id), eq(tasks.userId, user.id))).run());
  });
  revalidatePath("/app");
}
