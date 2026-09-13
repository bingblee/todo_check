export const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;

export function localDateInTimeZone(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isScheduledOn(task: { type: "habit" | "one_time"; recurrenceMask: number }, localDate: string) {
  if (task.type === "one_time") return true;
  const jsDay = new Date(`${localDate}T12:00:00Z`).getUTCDay();
  const mondayIndex = (jsDay + 6) % 7;
  return (task.recurrenceMask & (1 << mondayIndex)) !== 0;
}

export function getPeriodRange(period: "day" | "week", anchorDate: string) {
  if (period === "day") return { startDate: anchorDate, endDate: anchorDate };
  const anchor = new Date(`${anchorDate}T12:00:00Z`);
  const mondayOffset = (anchor.getUTCDay() + 6) % 7;
  const start = new Date(anchor);
  start.setUTCDate(anchor.getUTCDate() - mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export function eachDate(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (cursor <= end) {
    dates.push(isoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatChineseDate(localDate: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long", timeZone: "UTC" }).format(new Date(`${localDate}T12:00:00Z`));
}
