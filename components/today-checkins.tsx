"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Checkin, Task, Theme } from "@/lib/db/schema";
import { isScheduledOn, formatChineseDate } from "@/lib/dates";
import { CelebrationModal, CheckinButton } from "@/components/dashboard";

type TodayData = { localDate: string; themes: Theme[]; tasks: Task[]; checkins: Checkin[] };
type Celebration = { taskTitle: string; score: number; color: string };

export function TodayCheckins({ data }: { data: TodayData }) {
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [checkins, setCheckins] = useState(() => new Map(data.checkins.filter((item) => item.localDate === data.localDate).map((item) => [item.taskId, item])));
  const todayCheckins = checkins;
  const groups = useMemo(() => data.themes.map((theme) => ({
    theme,
    tasks: data.tasks.filter((task) => task.themeId === theme.id && (task.type === "habit" ? isScheduledOn(task, data.localDate) : (!task.dueDate || task.dueDate >= data.localDate || todayCheckins.has(task.id)))),
  })).filter((group) => group.tasks.length), [data, todayCheckins]);
  const total = groups.reduce((sum, group) => sum + group.tasks.length, 0);
  const completed = groups.reduce((sum, group) => sum + group.tasks.filter((task) => todayCheckins.has(task.id)).length, 0);
  const score = groups.reduce((sum, group) => sum + group.tasks.reduce((groupScore, task) => groupScore + (todayCheckins.has(task.id) ? (todayCheckins.get(task.id)?.awardedScore ?? task.completionScore) : task.incompleteScore), 0), 0);

  return <main className="content-page today-page"><div className="content-wrap">
    <header className="page-nav"><div className="brand"><span className="brand-mark">✓</span><span>拾光清单</span></div><div className="inline-actions"><span className="today-count">{completed}/{total} 已完成</span><Link href="/app" className="button ghost small">返回主题</Link></div></header>
    <section className="page-card today-card">
      <div className="today-hero"><div><p className="eyebrow">TODAY CHECK-IN</p><h1 className="date-title">今日打卡</h1><p className="muted">{formatChineseDate(data.localDate)} · 把注意力放回正在发生的每一件小事。</p></div><div className="today-progress"><strong>{completed}</strong><span>/ {total} 项完成</span></div></div>
      <div className="today-stats"><div className="today-stat"><strong>{completed}</strong><span>已完成</span></div><div className="today-stat"><strong>{Math.max(0, total - completed)}</strong><span>待完成</span></div><div className="today-stat"><strong className={score < 0 ? "score-negative" : ""}>{score > 0 ? "+" : ""}{score}</strong><span>今日得分</span></div><div className="today-stat"><strong>{groups.length}</strong><span>涉及主题</span></div></div>
      {groups.length ? <div className="today-groups">{groups.map(({ theme, tasks }) => <section className="today-group" key={theme.id}>
        <div className="today-group-label"><span className="theme-dot" style={{ "--theme-color": theme.color } as React.CSSProperties}>{theme.icon}</span><span>{theme.name}</span><small>{tasks.filter((task) => todayCheckins.has(task.id)).length}/{tasks.length}</small></div>
        <div className="today-task-list">{tasks.map((task) => <article className={`today-task ${todayCheckins.has(task.id) ? "completed" : ""}`} key={task.id}>
          <CheckinButton taskId={task.id} localDate={data.localDate} checkin={todayCheckins.get(task.id)} color={theme.color} onCompleted={(result) => { setCheckins((current) => { const next = new Map(current); if (result.status === "completed") next.set(task.id, { id: `optimistic-${task.id}`, userId: "", taskId: task.id, localDate: data.localDate, note: "", awardedScore: result.awardedScore ?? task.completionScore, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); else next.delete(task.id); return next; }); if (result.status === "completed") setCelebration({ taskTitle: result.taskTitle ?? task.title, score: result.awardedScore ?? 0, color: theme.color }); }} />
          <div className="today-task-copy"><strong>{task.title}</strong>{task.description && <span>{task.description}</span>}</div>
          <div className="today-task-score">完成 {task.completionScore > 0 ? "+" : ""}{task.completionScore}</div>
        </article>)}</div>
      </section>)}</div> : <div className="empty-state"><h3>今天没有安排</h3><p>回到主题页，添加一个值得记录的小任务吧。</p><Link className="button" href="/app">去添加任务</Link></div>}
    </section>
    {celebration && <CelebrationModal celebration={celebration} close={() => setCelebration(null)} />}
  </div></main>;
}
