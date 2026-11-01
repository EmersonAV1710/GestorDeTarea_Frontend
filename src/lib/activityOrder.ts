type DatedActivity = { due_date: string | null; title: string; status?: string };

export function compareActivityDates(a: DatedActivity, b: DatedActivity): number {
  if (!a.due_date && b.due_date) return 1;
  if (a.due_date && !b.due_date) return -1;
  return (a.due_date || "").localeCompare(b.due_date || "") ||
    Number(a.status === "completed") - Number(b.status === "completed") || a.title.localeCompare(b.title, "es");
}


export type TaskOrder = "date-asc" | "date-desc" | "title-asc" | "title-desc" | "course";
export function orderTasks<T extends DatedActivity & { course_id: string }>(items: T[], order: TaskOrder, courses: { id: string; name: string }[]): T[] {
  const names = new Map(courses.map(course => [course.id, course.name]));
  return [...items].sort((a, b) => {
    if (order === "title-asc" || order === "title-desc") return (order === "title-asc" ? 1 : -1) * a.title.localeCompare(b.title, "es") || compareActivityDates(a, b);
    if (order === "course") return (names.get(a.course_id) || "").localeCompare(names.get(b.course_id) || "", "es") || compareActivityDates(a, b);
    if (order === "date-desc") {
      if (!a.due_date || !b.due_date) return compareActivityDates(a, b);
      return b.due_date.localeCompare(a.due_date) || compareActivityDates(a, b);
    }
    return compareActivityDates(a, b);
  });
}


export function orderPendingTasks<T extends DatedActivity>(items: T[], today: string): T[] {
  const group = (task: T) => !task.due_date ? 2 : task.due_date >= today ? 0 : 1;
  return [...items].sort((a, b) => {
    const difference = group(a) - group(b);
    if (difference) return difference;
    if (group(a) === 1) return b.due_date!.localeCompare(a.due_date!) || compareActivityDates(a, b);
    return compareActivityDates(a, b);
  });
}
