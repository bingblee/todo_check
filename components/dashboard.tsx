"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Checkin, Task, Theme } from "@/lib/db/schema";
import { WEEKDAYS, formatChineseDate, isScheduledOn } from "@/lib/dates";
import { archiveTaskAction, archiveThemeAction, reorderTasksAction, reorderThemesAction, saveCheckinNoteAction, saveTaskAction, saveThemeAction, toggleCheckinAction } from "@/app/app/actions";
import { SubmitButton } from "@/components/submit-button";

type DashboardData = { localDate: string; themes: Theme[]; tasks: Task[]; checkins: Checkin[] };
type ModalState =
  | { type: "theme"; item?: Theme }
  | { type: "task"; item?: Task }
  | { type: "task-menu"; item: Task; checkin?: Checkin }
  | { type: "note"; item: Task; checkin: Checkin }
  | null;
type Celebration = { taskTitle: string; score: number; color: string };

const themeColors = ["#73947c", "#b68968", "#8a7ea8", "#6995a6", "#c08a8a", "#9a935e"];
const themeIcons = [
  { value: "✓", label: "通用" }, { value: "☀", label: "日常" }, { value: "✦", label: "成长" },
  { value: "📚", label: "学习" }, { value: "🏃", label: "运动" }, { value: "💼", label: "工作" },
  { value: "💚", label: "健康" }, { value: "📖", label: "阅读" }, { value: "🎨", label: "兴趣" },
  { value: "💰", label: "财务" }, { value: "🏠", label: "家庭" }, { value: "✈️", label: "旅行" },
  { value: "🧘", label: "冥想" }, { value: "🎯", label: "目标" },
];

function previousDate(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - amount);
  return value.toISOString().slice(0, 10);
}

function reorderSubset<T extends { id: string }>(all: T[], orderedIds: string[]) {
  const selected = new Set(orderedIds);
  const byId = new Map(all.map((item) => [item.id, item]));
  let index = 0;
  return all.map((item) => selected.has(item.id) ? (byId.get(orderedIds[index++]) ?? item) : item);
}

function applyStoredOrder<T extends { id: string; sortOrder: number }>(items: T[], order: string[]) {
  return [...items].sort((a, b) => {
    const aIndex = order.indexOf(a.id);
    const bIndex = order.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) return a.sortOrder - b.sortOrder;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

export function Dashboard({ user, data }: { user: { username: string; role: "admin" | "user" }; data: DashboardData }) {
  const [selectedThemeId, setSelectedThemeId] = useState(data.themes[0]?.id ?? "");
  const [modal, setModal] = useState<ModalState>(null);
  const [themeOrder, setThemeOrder] = useState(() => data.themes.map((item) => item.id));
  const [taskOrder, setTaskOrder] = useState(() => data.tasks.map((item) => item.id));
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const orderedThemes = applyStoredOrder(data.themes, themeOrder);
  const orderedTasks = applyStoredOrder(data.tasks, taskOrder);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectedTheme = orderedThemes.find((theme) => theme.id === selectedThemeId) ?? orderedThemes[0];
  const completedTaskIds = useMemo(() => new Set(data.checkins.map((item) => item.taskId)), [data.checkins]);
  const todayCheckins = useMemo(() => new Map(data.checkins.filter((item) => item.localDate === data.localDate).map((item) => [item.taskId, item])), [data]);
  const visibleTasks = orderedTasks.filter((task) => {
    if (task.themeId !== selectedTheme?.id) return false;
    if (task.type === "habit") return isScheduledOn(task, data.localDate);
    return !completedTaskIds.has(task.id) || todayCheckins.has(task.id);
  });
  const habits = visibleTasks.filter((task) => task.type === "habit");
  const oneTime = visibleTasks.filter((task) => task.type === "one_time");
  const completed = visibleTasks.filter((task) => todayCheckins.has(task.id)).length;
  const percent = visibleTasks.length ? Math.round((completed / visibleTasks.length) * 100) : 0;

  const activeDates = new Set(data.checkins.map((item) => item.localDate));
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    if (!activeDates.has(previousDate(data.localDate, i))) break;
    streak++;
  }

  function handleThemeDrag({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedThemes.findIndex((item) => item.id === active.id);
    const newIndex = orderedThemes.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedThemes, oldIndex, newIndex);
    setThemeOrder(next.map((item) => item.id));
    void reorderThemesAction(next.map((item) => item.id));
  }

  function handleTaskReorder(orderedIds: string[]) {
    setTaskOrder(reorderSubset(orderedTasks, orderedIds).map((item) => item.id));
    if (selectedTheme) void reorderTasksAction(selectedTheme.id, orderedIds);
  }

  return <main className="app-shell">
    <aside className="panel sidebar">
      <div className="brand"><span className="brand-mark">✓</span><span>拾光清单</span></div>
      <div className="nav-label">我的主题</div>
      <DndContext id="themes" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleThemeDrag}>
        <SortableContext items={orderedThemes.map((theme) => theme.id)} strategy={rectSortingStrategy}>
          <div className="theme-list">{orderedThemes.map((theme) => <SortableTheme key={theme.id} theme={theme} active={theme.id === selectedTheme?.id} select={() => setSelectedThemeId(theme.id)} />)}</div>
        </SortableContext>
      </DndContext>
      <button className="theme-button add-theme" onClick={() => setModal({ type: "theme" })}><span className="theme-dot" style={{ "--theme-color": "#bbb7ad" } as CSSProperties}>＋</span><span>新建主题</span></button>
      <div className="sidebar-footer"><Link href="/summary" className="nav-link">◫　打卡总结</Link><Link href="/settings" className="nav-link">⚙　设置</Link></div>
    </aside>

    <section className="panel main-panel">
      <div className="top-row">
        <div><p className="eyebrow">{formatChineseDate(data.localDate)}</p><h1 className="date-title">今天，稳稳向前</h1><p className="muted">你好，{user.username}。完成一点，也值得被记录。</p></div>
        {selectedTheme && <div className="toolbar"><button className="button ghost small" onClick={() => setModal({ type: "theme", item: selectedTheme })}>编辑主题</button><button className="button small" onClick={() => setModal({ type: "task" })}>＋ 新任务</button></div>}
      </div>
      {!selectedTheme ? <div className="empty-state"><h3>从一个主题开始</h3><p>比如阅读、运动或工作，然后把目标变成每日打卡。</p><button className="button" onClick={() => setModal({ type: "theme" })}>创建主题</button></div> : <>
        <TaskSection title="习惯打卡" subtitle={`${habits.filter((task) => todayCheckins.has(task.id)).length}/${habits.length}`} tasks={habits} theme={selectedTheme} todayCheckins={todayCheckins} localDate={data.localDate} onMenu={(item, checkin) => setModal({ type: "task-menu", item, checkin })} onReorder={handleTaskReorder} onCompleted={(result) => result.status === "completed" && setCelebration({ taskTitle: result.taskTitle ?? "任务", score: result.awardedScore ?? 0, color: selectedTheme.color })} />
        <TaskSection title="一次性任务" subtitle={`${oneTime.filter((task) => todayCheckins.has(task.id)).length}/${oneTime.length}`} tasks={oneTime} theme={selectedTheme} todayCheckins={todayCheckins} localDate={data.localDate} onMenu={(item, checkin) => setModal({ type: "task-menu", item, checkin })} onReorder={handleTaskReorder} onCompleted={(result) => result.status === "completed" && setCelebration({ taskTitle: result.taskTitle ?? "任务", score: result.awardedScore ?? 0, color: selectedTheme.color })} />
        {visibleTasks.length === 0 && <div className="empty-state"><h3>今天很轻盈</h3><p>当前主题还没有需要完成的任务。</p></div>}
      </>}
    </section>

    <aside className="panel right-panel">
      <h2 style={{ marginBottom: 5 }}>今日进度</h2><p className="muted" style={{ fontSize: 13 }}>专注当下的小小一步</p>
      <div className="progress-ring" style={{ "--value": percent } as CSSProperties}><div className="progress-value">{percent}%<small>已完成</small></div></div>
      <div className="stat-grid"><div className="stat-card"><strong>{completed}</strong><span>今日完成</span></div><div className="stat-card"><strong>{visibleTasks.length}</strong><span>计划任务</span></div><div className="stat-card"><strong>{streak}</strong><span>连续打卡</span></div><div className="stat-card"><strong>{data.themes.length}</strong><span>活跃主题</span></div></div>
      <Link href="/summary" className="button" style={{ width: "100%" }}>打开打卡总结　→</Link><div className="quote-card">不追求一次做到很多，只让今天比昨天多留下一点痕迹。</div>
    </aside>

    {modal?.type === "theme" && <ThemeModal item={modal.item} close={() => setModal(null)} />}
    {modal?.type === "task" && selectedTheme && <TaskModal item={modal.item} themes={data.themes} defaultThemeId={selectedTheme.id} close={() => setModal(null)} />}
    {modal?.type === "task-menu" && <TaskMenu item={modal.item} checkin={modal.checkin} close={() => setModal(null)} edit={() => setModal({ type: "task", item: modal.item })} addNote={() => modal.checkin && setModal({ type: "note", item: modal.item, checkin: modal.checkin })} />}
    {modal?.type === "note" && <NoteModal item={modal.item} checkin={modal.checkin} localDate={data.localDate} close={() => setModal(null)} />}
    {celebration && <CelebrationModal celebration={celebration} close={() => setCelebration(null)} />}
  </main>;
}

function SortableTheme({ theme, active, select }: { theme: Theme; active: boolean; select: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: theme.id });
  return <div ref={setNodeRef} className={`theme-button sortable-row ${active ? "active" : ""} ${isDragging ? "dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button className="theme-select" onClick={select}><span className="theme-dot" style={{ "--theme-color": theme.color } as CSSProperties}>{theme.icon}</span><span>{theme.name}</span></button>
    <button className="drag-handle" aria-label={`拖动调整 ${theme.name} 的顺序`} {...attributes} {...listeners}>⠿</button>
  </div>;
}

function TaskSection({ title, subtitle, tasks, theme, todayCheckins, localDate, onMenu, onReorder, onCompleted }: { title: string; subtitle: string; tasks: Task[]; theme: Theme; todayCheckins: Map<string, Checkin>; localDate: string; onMenu: (task: Task, checkin?: Checkin) => void; onReorder: (ids: string[]) => void; onCompleted: (result: { status: "completed" | "undone"; taskTitle?: string; awardedScore?: number }) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  if (!tasks.length) return null;
  function handleDrag({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex((item) => item.id === active.id);
    const newIndex = tasks.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(tasks, oldIndex, newIndex).map((item) => item.id));
  }
  return <section className="task-section"><div className="section-heading"><h2>{title}</h2><span>{subtitle} 完成</span></div>
    <DndContext id={`tasks-${theme.id}-${title}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDrag}><SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}><div className="task-list">{tasks.map((task) => <SortableTask key={task.id} task={task} theme={theme} checkin={todayCheckins.get(task.id)} localDate={localDate} openMenu={() => onMenu(task, todayCheckins.get(task.id))} onCompleted={onCompleted} />)}</div></SortableContext></DndContext>
  </section>;
}

function SortableTask({ task, theme, checkin, localDate, openMenu, onCompleted }: { task: Task; theme: Theme; checkin?: Checkin; localDate: string; openMenu: () => void; onCompleted: (result: { status: "completed" | "undone"; taskTitle?: string; awardedScore?: number }) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return <article ref={setNodeRef} className={`task-card ${checkin ? "completed" : ""} ${isDragging ? "dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button className="drag-handle task-drag" aria-label={`拖动调整 ${task.title} 的顺序`} {...attributes} {...listeners}>⠿</button>
    <CheckinButton taskId={task.id} localDate={localDate} checkin={checkin} color={theme.color} onCompleted={onCompleted} />
    <div><div className="task-title">{task.title}</div><div className="task-meta"><span>完成 {task.completionScore > 0 ? "+" : ""}{task.completionScore} · 未完成 {task.incompleteScore > 0 ? "+" : ""}{task.incompleteScore}</span>{task.description && <span>{task.description}</span>}{task.dueDate && <span>截止 {task.dueDate.slice(5).replace("-", "/")}</span>}{task.type === "habit" && <span>{task.recurrenceMask === 127 ? "每天" : WEEKDAYS.filter((_, i) => task.recurrenceMask & (1 << i)).map((d) => `周${d}`).join("、")}</span>}{checkin?.note && <span>已记录感想</span>}</div></div>
    <button className="icon-button" onClick={openMenu} aria-label={`${task.title} 更多操作`}>···</button>
  </article>;
}

export function CheckinButton({ taskId, localDate, checkin, color, onCompleted }: { taskId: string; localDate: string; checkin?: Checkin; color: string; onCompleted: (result: { status: "completed" | "undone"; taskTitle?: string; awardedScore?: number }) => void }) {
  const [pending, startTransition] = useTransition();
  function toggle() {
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("localDate", localDate);
    startTransition(async () => onCompleted(await toggleCheckinAction(formData)));
  }
  return <button type="button" className={`check-button ${checkin ? "checked" : ""}`} style={{ "--task-color": color } as CSSProperties} aria-label={checkin ? "撤销打卡" : "完成任务"} disabled={pending} onClick={toggle}>{checkin ? "✓" : ""}</button>;
}

export function CelebrationModal({ celebration, close }: { celebration: Celebration; close: () => void }) {
  const phrases = ["太棒了，稳稳拿下！", "又向目标靠近一步！", "今天的你，值得这枚勋章。", "小小一步，也闪闪发光。", "保持这个节奏，继续发光！"];
  // Keep the first render deterministic so this client component can be safely
  // rendered in the server-generated page without a hydration mismatch.
  const phrase = phrases[celebration.taskTitle.length % phrases.length];
  useEffect(() => { const timer = window.setTimeout(close, 3000); return () => window.clearTimeout(timer); }, [close]);
  return <div className="celebration-backdrop" role="status" aria-live="polite" onClick={(event) => event.target === event.currentTarget && close()}>
    <section className="celebration-card" style={{ "--celebration-color": celebration.color } as CSSProperties}>
      <div className="celebration-particles" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--particle-index": index } as CSSProperties}>✦</i>)}</div>
      <button className="celebration-close" onClick={close} aria-label="关闭鼓励">×</button>
      <div className="medal"><span>✓</span></div>
      <p className="eyebrow">CHECKED IN</p><h2>{phrase}</h2><p className="celebration-task">{celebration.taskTitle}</p>
      <div className="celebration-score">本次得分 <strong>{celebration.score > 0 ? "+" : ""}{celebration.score}</strong></div>
      <div className="celebration-timer" aria-label="3 秒后自动关闭" />
    </section>
  </div>;
}

function ThemeModal({ item, close }: { item?: Theme; close: () => void }) {
  async function submit(formData: FormData) { await saveThemeAction(formData); close(); }
  return <Modal title={item ? "编辑主题" : "新建主题"} close={close}><form action={submit} className="stack">
    {item && <input type="hidden" name="id" value={item.id} />}
    <label className="field">主题名称<input className="input" name="name" defaultValue={item?.name} placeholder="例如：阅读计划" required maxLength={30} /></label>
    <div className="field">选择场景图标<div className="icon-grid">{themeIcons.map((icon) => <label className="icon-option" key={icon.value} title={icon.label}><input type="radio" name="icon" value={icon.value} defaultChecked={(item?.icon ?? "✓") === icon.value} /><span><b>{icon.value}</b><small>{icon.label}</small></span></label>)}</div></div>
    <div className="field">主题颜色<div className="weekday-row">{themeColors.map((color) => <label className="weekday-option" key={color}><input type="radio" name="color" value={color} defaultChecked={(item?.color ?? themeColors[0]) === color} /><span style={{ background: color, color: "white", borderColor: color }}>✓</span></label>)}</div></div>
    <div className="form-actions"><button type="button" className="button ghost" onClick={close}>取消</button><SubmitButton>保存主题</SubmitButton></div>
  </form>{item && <form action={async (formData) => { await archiveThemeAction(formData); close(); }} onSubmit={(event) => !confirm("归档主题后，其任务将不再显示。确定继续？") && event.preventDefault()} style={{ marginTop: 18 }}><input type="hidden" name="id" value={item.id} /><button className="button danger small">归档主题</button></form>}</Modal>;
}

function TaskModal({ item, themes, defaultThemeId, close }: { item?: Task; themes: Theme[]; defaultThemeId: string; close: () => void }) {
  const [type, setType] = useState<"habit" | "one_time">((item?.type ?? "habit") as "habit" | "one_time");
  const [error, setError] = useState("");
  async function submit(formData: FormData) {
    setError("");
    const result = await saveTaskAction(formData);
    if (result.ok) close(); else setError(result.error ?? "保存失败");
  }
  return <Modal title={item ? "编辑任务" : "新建任务"} close={close}><form action={submit} className="stack">
    {item && <input type="hidden" name="id" value={item.id} />}
    <label className="field">任务名称<input className="input" name="title" defaultValue={item?.title} placeholder="今天想完成什么？" required maxLength={80} autoFocus /></label>
    <label className="field">所属主题<select className="select" name="themeId" defaultValue={item?.themeId ?? defaultThemeId}>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.icon} {theme.name}</option>)}</select></label>
    <label className="field">类型<select className="select" name="type" value={type} onChange={(event) => setType(event.target.value as "habit" | "one_time")}><option value="habit">重复习惯</option><option value="one_time">一次性任务</option></select></label>
    {type === "habit" ? <div className="field">重复日期<div className="weekday-row">{WEEKDAYS.map((day, index) => <label className="weekday-option" key={day}><input type="checkbox" name={`day-${index}`} defaultChecked={item?.type === "habit" ? Boolean(item.recurrenceMask & (1 << index)) : true} /><span>周{day}</span></label>)}</div></div> : <label className="field">截止日期（可选）<input className="input" name="dueDate" type="date" defaultValue={item?.dueDate ?? ""} /></label>}
    <div className="score-fields"><label className="field">完成得分<input className="input" name="completionScore" type="number" min={-999} max={999} step={1} defaultValue={item?.completionScore ?? 10} required /></label><label className="field">未完成得分<input className="input" name="incompleteScore" type="number" min={-999} max={999} step={1} defaultValue={item?.incompleteScore ?? 0} required /></label></div>
    <p className="muted score-help">每个执行日都会按结果计分，允许使用负分。</p>
    <label className="field">任务说明（可选）<textarea className="textarea" name="description" defaultValue={item?.description} maxLength={300} placeholder="记录任务目标、要求或完成标准" /></label>
    {error && <div className="error">{error}</div>}
    <div className="form-actions"><button type="button" className="button ghost" onClick={close}>取消</button><SubmitButton pendingText="保存中…">保存任务</SubmitButton></div>
  </form></Modal>;
}

function TaskMenu({ item, checkin, close, edit, addNote }: { item: Task; checkin?: Checkin; close: () => void; edit: () => void; addNote: () => void }) {
  return <Modal title="任务操作" close={close} compact><div className="menu-list">
    <button className="menu-item" onClick={edit}><span>✎</span><div><strong>编辑任务</strong><small>修改名称、类型和任务说明</small></div></button>
    {checkin ? <button className="menu-item" onClick={addNote}><span>◌</span><div><strong>{checkin.note ? "编辑打卡感想" : "记录打卡感想"}</strong><small>这段内容会参与 AI 总结</small></div></button> : <div className="menu-item disabled"><span>◌</span><div><strong>打卡感想</strong><small>完成任务后即可记录</small></div></div>}
    <form action={async (formData) => { await archiveTaskAction(formData); close(); }} onSubmit={(event) => !confirm("确定归档这个任务？历史打卡仍会保留。") && event.preventDefault()}><input type="hidden" name="id" value={item.id} /><button className="menu-item danger-row"><span>⌫</span><div><strong>归档任务</strong><small>不再出现在今日列表</small></div></button></form>
  </div></Modal>;
}

function NoteModal({ item, checkin, localDate, close }: { item: Task; checkin: Checkin; localDate: string; close: () => void }) {
  async function submit(formData: FormData) { await saveCheckinNoteAction(formData); close(); }
  return <Modal title="记录打卡感想" close={close} compact><p className="muted">{item.title}</p><form action={submit} className="stack"><input type="hidden" name="taskId" value={item.id} /><input type="hidden" name="localDate" value={localDate} /><label className="field">今天的感受或收获<textarea className="textarea" name="note" defaultValue={checkin.note} placeholder="写下一句真实的感受（可选）" maxLength={500} autoFocus /></label><div className="form-actions"><button type="button" className="button ghost" onClick={close}>取消</button><SubmitButton>保存感想</SubmitButton></div></form></Modal>;
}

function Modal({ title, close, compact, children }: { title: string; close: () => void; compact?: boolean; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className={`modal ${compact ? "modal-compact" : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="关闭">×</button></div>{children}</section></div>;
}
