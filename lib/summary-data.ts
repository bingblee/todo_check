import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { checkins, summaries, taskScoreVersions, tasks, themes } from "@/lib/db/schema";
import { getPeriodRange } from "@/lib/dates";
import { computeSummaryStats, summarySourceHash } from "@/lib/summary";

export async function getSummarySnapshot(userId: string, period: "day" | "week", anchorDate: string, themeId?: string, throughDate?: string) {
  const { startDate, endDate } = getPeriodRange(period, anchorDate);
  const statsEndDate = throughDate && throughDate < endDate ? throughDate : endDate;
  const themeWhere = themeId ? and(eq(themes.userId, userId), eq(themes.id, themeId)) : eq(themes.userId, userId);
  const themeRows = await db.select().from(themes).where(themeWhere).orderBy(asc(themes.sortOrder));
  const allowedThemeIds = new Set(themeRows.map((theme) => theme.id));
  const taskRows = (await db.select().from(tasks).where(eq(tasks.userId, userId))).filter((task) => allowedThemeIds.has(task.themeId));
  const taskIds = new Set(taskRows.map((task) => task.id));
  const checkinRows = (await db.select().from(checkins).where(eq(checkins.userId, userId))).filter((item) => taskIds.has(item.taskId));
  const scoreVersionRows = (await db.select().from(taskScoreVersions).where(eq(taskScoreVersions.userId, userId))).filter((item) => taskIds.has(item.taskId));
  const stats = computeSummaryStats({ startDate, endDate: statsEndDate, todayDate: throughDate, tasks: taskRows, checkins: checkinRows, scoreVersions: scoreVersionRows, themes: themeRows });
  const sourceHash = summarySourceHash({ startDate, endDate, statsEndDate, themeId: themeId ?? null, stats });
  const summaryWhere = themeId
    ? and(eq(summaries.userId, userId), eq(summaries.period, period), eq(summaries.startDate, startDate), eq(summaries.endDate, endDate), eq(summaries.themeId, themeId))
    : and(eq(summaries.userId, userId), eq(summaries.period, period), eq(summaries.startDate, startDate), eq(summaries.endDate, endDate), isNull(summaries.themeId));
  const [cached] = await db.select().from(summaries).where(summaryWhere).orderBy(desc(summaries.updatedAt)).limit(1);
  return { startDate, endDate, themes: themeRows, stats, sourceHash, cached };
}
