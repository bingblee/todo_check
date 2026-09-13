import { createHash } from "node:crypto";
import { eachDate, isScheduledOn } from "@/lib/dates";

export type SummaryTask = {
  id: string;
  title: string;
  type: "habit" | "one_time";
  recurrenceMask: number;
  dueDate: string | null;
  completionScore: number;
  incompleteScore: number;
  themeId: string;
  createdAt: string;
  archivedAt: string | null;
};
export type SummaryCheckin = { taskId: string; localDate: string; note: string; awardedScore: number };
export type SummaryScoreVersion = { taskId: string; completionScore: number; incompleteScore: number; effectiveDate: string; createdAt: string };
export type SummaryTheme = { id: string; name: string };
export type ScoreDay = { date: string; score: number; completedScore: number; incompleteScore: number; planned: number; completed: number; provisional: boolean };
export type ScoreEntry = { date: string; taskId: string; title: string; outcome: "completed" | "incomplete"; score: number };

export type SummaryStats = {
  planned: number;
  completed: number;
  completionRate: number;
  activeDays: number;
  totalScore: number;
  completedScore: number;
  incompleteScore: number;
  completedTasks: string[];
  missedTasks: string[];
  notes: string[];
  scoreByDay: ScoreDay[];
  scoreEntries: ScoreEntry[];
  themeBreakdown: Array<{ name: string; planned: number; completed: number; score: number }>;
};

function dateOnly(iso: string) { return iso.slice(0, 10); }

export function computeSummaryStats(input: { startDate: string; endDate: string; todayDate?: string; tasks: SummaryTask[]; checkins: SummaryCheckin[]; scoreVersions?: SummaryScoreVersion[]; themes: SummaryTheme[] }): SummaryStats {
  const dates = eachDate(input.startDate, input.endDate);
  const checkinsByTask = new Map<string, SummaryCheckin[]>();
  for (const checkin of input.checkins) checkinsByTask.set(checkin.taskId, [...(checkinsByTask.get(checkin.taskId) ?? []), checkin]);
  const checkinKey = new Map(input.checkins.map((item) => [`${item.taskId}:${item.localDate}`, item]));
  const days = new Map<string, ScoreDay>(dates.map((date) => [date, { date, score: 0, completedScore: 0, incompleteScore: 0, planned: 0, completed: 0, provisional: date === input.todayDate }]));
  const completedTaskTitles: string[] = [];
  const missedTaskTitles: string[] = [];
  const entries: ScoreEntry[] = [];
  const breakdown = new Map(input.themes.map((theme) => [theme.id, { name: theme.name, planned: 0, completed: 0, score: 0 }]));
  let planned = 0;
  let completed = 0;
  let completedScore = 0;
  let incompleteScore = 0;
  const versions = input.scoreVersions ?? [];
  const scoreFor = (task: SummaryTask, date: string) => {
    const applicable = versions.filter((version) => version.taskId === task.id && version.effectiveDate <= date).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.createdAt.localeCompare(b.createdAt)).at(-1);
    return applicable ?? { completionScore: task.completionScore, incompleteScore: task.incompleteScore };
  };
  const add = (task: SummaryTask, date: string, outcome: "completed" | "incomplete", score: number) => {
    const day = days.get(date);
    const theme = breakdown.get(task.themeId);
    if (!day || !theme) return;
    planned++;
    day.planned++;
    theme.planned++;
    day.score += score;
    theme.score += score;
    entries.push({ date, taskId: task.id, title: task.title, outcome, score });
    if (outcome === "completed") {
      completed++;
      completedScore += score;
      day.completed++;
      day.completedScore += score;
      theme.completed++;
      completedTaskTitles.push(`${task.title}（${date.slice(5)}）`);
    } else {
      incompleteScore += score;
      day.incompleteScore += score;
      missedTaskTitles.push(`${task.title}（${date.slice(5)}）`);
    }
  };

  for (const task of input.tasks) {
    const createdDate = dateOnly(task.createdAt);
    const archivedDate = task.archivedAt ? dateOnly(task.archivedAt) : null;
    const taskCheckins = checkinsByTask.get(task.id) ?? [];
    if (task.type === "habit") {
      for (const date of dates) {
        if (date < createdDate || (archivedDate && date >= archivedDate) || !isScheduledOn(task, date)) continue;
        const checkin = checkinKey.get(`${task.id}:${date}`);
        add(task, date, checkin ? "completed" : "incomplete", checkin?.awardedScore ?? scoreFor(task, date).incompleteScore);
      }
    } else {
      const completionDate = taskCheckins.map((item) => item.localDate).sort()[0];
      if (completionDate && completionDate < input.startDate) continue;
      for (const date of dates) {
        if (date < createdDate || (archivedDate && date >= archivedDate) || (completionDate && date > completionDate)) continue;
        const checkin = checkinKey.get(`${task.id}:${date}`);
        add(task, date, checkin ? "completed" : "incomplete", checkin?.awardedScore ?? scoreFor(task, date).incompleteScore);
      }
    }
  }

  const periodCheckins = input.checkins.filter((item) => item.localDate >= input.startDate && item.localDate <= input.endDate);
  return {
    planned, completed, completionRate: planned ? Math.round((completed / planned) * 100) : 0,
    activeDays: new Set(periodCheckins.map((item) => item.localDate)).size,
    totalScore: completedScore + incompleteScore, completedScore, incompleteScore,
    completedTasks: completedTaskTitles, missedTasks: missedTaskTitles,
    notes: periodCheckins.map((item) => item.note.trim()).filter(Boolean),
    scoreByDay: dates.map((date) => days.get(date)!), scoreEntries: entries,
    themeBreakdown: Array.from(breakdown.values()).filter((item) => item.planned > 0),
  };
}

export function summarySourceHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
