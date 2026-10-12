type DatedActivity = { due_date: string | null; title: string; status?: string };

export function compareActivityDates(a: DatedActivity, b: DatedActivity): number {
  if (!a.due_date && b.due_date) return 1;
  if (a.due_date && !b.due_date) return -1;
  return (a.due_date || "").localeCompare(b.due_date || "") ||
    Number(a.status === "completed") - Number(b.status === "completed") || a.title.localeCompare(b.title, "es");
}
