import { describe, expect, it } from "vitest";
import { computeSummaryStats } from "./summary";

describe("summary stats", () => {
  it("combines habits, one-time tasks and notes", () => {
    const stats = computeSummaryStats({
      startDate: "2026-09-07",
      endDate: "2026-09-08",
      themes: [{ id: "theme", name: "成长" }],
      tasks: [
        { id: "habit", title: "阅读", type: "habit", recurrenceMask: 127, dueDate: null, completionScore: 10, incompleteScore: 0, themeId: "theme", createdAt: "2026-09-01T00:00:00Z", archivedAt: null },
        { id: "once", title: "整理书桌", type: "one_time", recurrenceMask: 0, dueDate: "2026-09-08", completionScore: 10, incompleteScore: 0, themeId: "theme", createdAt: "2026-09-01T00:00:00Z", archivedAt: null },
      ],
      checkins: [
        { taskId: "habit", localDate: "2026-09-07", note: "读得很投入", awardedScore: 10 },
        { taskId: "once", localDate: "2026-09-08", note: "", awardedScore: 10 },
      ],
    });
    expect(stats.planned).toBe(4);
    expect(stats.completed).toBe(2);
    expect(stats.completionRate).toBe(50);
    expect(stats.activeDays).toBe(2);
    expect(stats.notes).toEqual(["读得很投入"]);
    expect(stats.totalScore).toBe(20);
  });

  it("does not count a one-time task completed outside the range", () => {
    const stats = computeSummaryStats({
      startDate: "2026-09-08", endDate: "2026-09-08", themes: [{ id: "t", name: "日常" }],
      tasks: [{ id: "x", title: "完成", type: "one_time", recurrenceMask: 0, dueDate: "2026-09-08", completionScore: 10, incompleteScore: 0, themeId: "t", createdAt: "2026-09-01T00:00:00Z", archivedAt: null }],
      checkins: [{ taskId: "x", localDate: "2026-09-07", note: "提前完成", awardedScore: 10 }],
    });
    expect(stats.planned).toBe(0);
  });

  it("keeps score versions and replaces an incomplete score on completion day", () => {
    const stats = computeSummaryStats({
      startDate: "2026-09-07", endDate: "2026-09-08", todayDate: "2026-09-08",
      themes: [{ id: "t", name: "成长" }],
      tasks: [{ id: "h", title: "运动", type: "habit", recurrenceMask: 127, dueDate: null, completionScore: 20, incompleteScore: -3, themeId: "t", createdAt: "2026-09-01T00:00:00Z", archivedAt: null }],
      scoreVersions: [{ taskId: "h", completionScore: 8, incompleteScore: -1, effectiveDate: "2026-09-07", createdAt: "2026-09-07T00:00:00Z" }],
      checkins: [{ taskId: "h", localDate: "2026-09-08", note: "完成", awardedScore: 8 }],
    });
    expect(stats.scoreByDay.map((day) => day.score)).toEqual([-1, 8]);
    expect(stats.completedScore).toBe(8);
    expect(stats.incompleteScore).toBe(-1);
    expect(stats.scoreByDay[1].provisional).toBe(true);
  });
});
