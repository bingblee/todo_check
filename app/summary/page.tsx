import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { themes } from "@/lib/db/schema";
import { localDateInTimeZone } from "@/lib/dates";
import { getSummarySnapshot } from "@/lib/summary-data";
import { PageHeader } from "@/components/page-header";
import { GenerateSummary } from "@/components/generate-summary";

export const dynamic = "force-dynamic";

type AiContent = { headline: string; overview: string; highlights: string[]; improvements: string[]; nextAction: string };

export default async function SummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const period = params.period === "week" ? "week" : "day";
  const rawDate = typeof params.date === "string" ? params.date : "";
  const anchorDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : localDateInTimeZone(user.timezone);
  const themeId = typeof params.theme === "string" && params.theme ? params.theme : undefined;
  const snapshot = await getSummarySnapshot(user.id, period, anchorDate, themeId, localDateInTimeZone(user.timezone));
  let content: AiContent | null = null;
  try { if (snapshot.cached) content = JSON.parse(snapshot.cached.contentJson); } catch { content = null; }
  const stale = Boolean(snapshot.cached && snapshot.cached.sourceHash !== snapshot.sourceHash);
  const themeName = themeId ? snapshot.themes[0]?.name : "全部主题";

  return <main className="content-page"><div className="content-wrap">
    <PageHeader title="打卡总结" />
    <section className="page-card">
      <div className="top-row" style={{ marginBottom: 20 }}><div><p className="eyebrow">AI REVIEW</p><h1 className="date-title">回看走过的每一步</h1><p className="muted">统计永远基于真实记录，AI 只负责帮你读懂它。</p></div></div>
      <div className="summary-controls">
        <div className="segmented"><Link className={period === "day" ? "active" : ""} href={`/summary?period=day&date=${anchorDate}${themeId ? `&theme=${themeId}` : ""}`}>今日</Link><Link className={period === "week" ? "active" : ""} href={`/summary?period=week&date=${anchorDate}${themeId ? `&theme=${themeId}` : ""}`}>本周</Link></div>
        <form method="get" style={{ display: "flex", gap: 9, alignItems: "end", flexWrap: "wrap" }}>
          <input type="hidden" name="period" value={period} />
          {themeId && <input type="hidden" name="theme" value={themeId} />}
          <label className="field">日期<input className="input" type="date" name="date" defaultValue={anchorDate} /></label>
          <button className="button secondary">查看</button>
        </form>
      </div>
      <ThemeSummarySelector userId={user.id} period={period} anchorDate={anchorDate} selected={themeId} />
      <div className="summary-hero">
        <p className="eyebrow">{snapshot.startDate === snapshot.endDate ? snapshot.startDate : `${snapshot.startDate} — ${snapshot.endDate}`} · {themeName}</p>
        <h2>{content?.headline ?? (snapshot.stats.planned ? "记录已经就绪" : "这段时间还没有计划")}</h2>
        <p className="muted">{content?.overview ?? "生成总结后，DeepSeek 会结合完成情况和你的打卡感想，给出一段温和、具体的回顾。"}</p>
        <div className="stat-grid" style={{ maxWidth: 680 }}><div className="stat-card"><strong className={snapshot.stats.totalScore < 0 ? "score-negative" : ""}>{snapshot.stats.totalScore > 0 ? "+" : ""}{snapshot.stats.totalScore}</strong><span>本期总分</span></div><div className="stat-card"><strong>{snapshot.stats.completedScore > 0 ? "+" : ""}{snapshot.stats.completedScore}</strong><span>完成得分</span></div><div className="stat-card"><strong className={snapshot.stats.incompleteScore < 0 ? "score-negative" : ""}>{snapshot.stats.incompleteScore > 0 ? "+" : ""}{snapshot.stats.incompleteScore}</strong><span>未完成得分</span></div><div className="stat-card"><strong>{snapshot.stats.completionRate}%</strong><span>{snapshot.stats.scoreByDay.some((day) => day.provisional) ? "完成率 · 进行中" : "完成率"}</span></div><div className="stat-card"><strong>{snapshot.stats.completed}/{snapshot.stats.planned}</strong><span>完成 / 计划</span></div><div className="stat-card"><strong>{snapshot.stats.activeDays}</strong><span>活跃天数</span></div></div>
      </div>
      <section className="score-chart"><div className="section-heading"><h2>{period === "day" ? "今日得分" : "本周每日得分"}</h2><span>正分向上，负分向下</span></div><div className={`score-chart-grid ${period === "day" ? "single" : ""}`}>{snapshot.stats.scoreByDay.map((day) => <div className="score-day" key={day.date} title={`${day.date}：${day.score} 分`}><div className="score-bar-wrap"><div className={`score-bar ${day.score < 0 ? "negative" : "positive"}`} style={{ "--score-height": `${Math.min(100, Math.max(8, Math.abs(day.score) * 5))}` } as React.CSSProperties}>{day.score !== 0 && <span>{day.score > 0 ? "+" : ""}{day.score}</span>}</div></div><small>{day.date.slice(5)}{day.provisional ? " · 今" : ""}</small></div>)}</div></section>
      {snapshot.stats.scoreEntries.length > 0 && <section className="score-entries"><div className="section-heading"><h2>得分明细</h2><span>{snapshot.stats.scoreEntries.length} 条记录</span></div><div className="score-entry-list">{snapshot.stats.scoreEntries.slice(0, 30).map((entry, index) => <div className="score-entry" key={`${entry.taskId}-${entry.date}-${index}`}><span>{entry.date.slice(5)}</span><strong>{entry.title}</strong><em className={entry.score < 0 ? "score-negative" : ""}>{entry.score > 0 ? "+" : ""}{entry.score}</em><small>{entry.outcome === "completed" ? "已完成" : "未完成"}</small></div>)}</div></section>}
      {content && <div className="summary-columns">
        <div className="summary-block"><h3>做得不错</h3><ul>{content.highlights.length ? content.highlights.map((item) => <li key={item}>{item}</li>) : <li>继续留下真实的完成记录。</li>}</ul></div>
        <div className="summary-block"><h3>可以调整</h3><ul>{content.improvements.length ? content.improvements.map((item) => <li key={item}>{item}</li>) : <li>暂时没有需要特别调整的地方。</li>}</ul></div>
        <div className="summary-block" style={{ gridColumn: "1 / -1" }}><h3>下一步</h3><p className="muted" style={{ marginBottom: 0 }}>{content.nextAction}</p></div>
      </div>}
      <div style={{ marginTop: 20 }}><GenerateSummary period={period} anchorDate={anchorDate} themeId={themeId} stale={stale} force={Boolean(content && !stale)} /></div>
      {stale && <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>打卡数据已变化，当前展示的是上一次总结。</p>}
    </section>
  </div></main>;
}

async function ThemeSummarySelector({ userId, period, anchorDate, selected }: { userId: string; period: string; anchorDate: string; selected?: string }) {
  const themeRows = await db.select().from(themes).where(and(eq(themes.userId, userId), isNull(themes.archivedAt))).orderBy(asc(themes.sortOrder));
  return <div className="toolbar" style={{ marginBottom: 20 }}><Link className={`button small ${!selected ? "" : "ghost"}`} href={`/summary?period=${period}&date=${anchorDate}`}>全部</Link>{themeRows.map((theme) => <Link key={theme.id} className={`button small ${selected === theme.id ? "" : "ghost"}`} href={`/summary?period=${period}&date=${anchorDate}&theme=${theme.id}`}>{theme.icon} {theme.name}</Link>)}</div>;
}
