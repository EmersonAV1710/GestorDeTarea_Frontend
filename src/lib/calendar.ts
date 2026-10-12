import type { Activity } from "../components/types";

export type CalendarDay = { date: Date; key: string; day: number; isCurrentMonth: boolean };

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildMonthDays(year: number, month: number): CalendarDay[] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month, 1 - offset + index, 12);
    return { date, key: dateKey(date), day: date.getDate(), isCurrentMonth: date.getMonth() === first.getMonth() && date.getFullYear() === first.getFullYear() };
  });
}

export function groupActivitiesByDate(items: Activity[]): Map<string, Activity[]> {
  const grouped = new Map<string, Activity[]>();
  for (const activity of items) {
    if (!activity.due_date) continue;
    const group = grouped.get(activity.due_date) || [];
    group.push(activity);
    grouped.set(activity.due_date, group);
  }
  for (const group of grouped.values()) {
    group.sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || a.title.localeCompare(b.title, "es"));
  }
  return grouped;
}
