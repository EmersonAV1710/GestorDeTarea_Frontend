export type ActivityStatusFilter = "" | "pending" | "completed";

export function matchesActivityStatus(status: string, filter: ActivityStatusFilter): boolean {
  return !filter || (filter === "completed" ? status === "completed" : status !== "completed");
}
