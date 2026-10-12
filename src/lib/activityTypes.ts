export const ACTIVITY_TYPES = [
  { value: "tarea", label: "Tarea" },
  { value: "proyecto", label: "Proyecto" },
  { value: "examen", label: "Examen" },
  { value: "exposicion", label: "Exposición" },
  { value: "laboratorio", label: "Laboratorio" },
  { value: "lectura", label: "Lectura" },
  { value: "otro", label: "Otro" },
] as const;

export type ActivityType = typeof ACTIVITY_TYPES[number]["value"];

export function activityTypeLabel(value?: string): string {
  return ACTIVITY_TYPES.find(type => type.value === value)?.label || "Otro";
}

export function matchesActivityType(value: string | undefined, filter: string): boolean {
  return !filter || (value || "otro") === filter;
}
