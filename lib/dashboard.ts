import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { checkins, tasks, themes } from "@/lib/db/schema";
import { localDateInTimeZone } from "@/lib/dates";

export async function getDashboardData(user: { id: string; timezone: string }) {
  const localDate = localDateInTimeZone(user.timezone);
  const [themeRows, taskRows, checkinRows] = await Promise.all([
    db.select().from(themes).where(and(eq(themes.userId, user.id), isNull(themes.archivedAt))).orderBy(asc(themes.sortOrder), asc(themes.createdAt)),
    db.select().from(tasks).where(and(eq(tasks.userId, user.id), isNull(tasks.archivedAt))).orderBy(asc(tasks.sortOrder), asc(tasks.createdAt)),
    db.select().from(checkins).where(eq(checkins.userId, user.id)),
  ]);
  return { localDate, themes: themeRows, tasks: taskRows, checkins: checkinRows };
}
