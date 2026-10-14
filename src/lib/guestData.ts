import type { Activity, Course } from "../components/types";
import { proposalError, validDate, type Proposal } from "./proposals";
import { ACTIVITY_TYPES } from "./activityTypes";

const DATA_KEY = "tarevia_guest_data_v1";
const MODE_KEY = "tarevia_guest_mode";

export type GuestData = { courses: Course[]; activities: Activity[] };
export const emptyGuestData = (): GuestData => ({ courses: [], activities: [] });

function storageError(): Error {
  return Error("No se pudo acceder al almacenamiento local. Revisa los permisos o el espacio disponible en el navegador.");
}

function isCourse(value: unknown): value is Course {
  if (!value || typeof value !== "object") return false;
  const course = value as Partial<Course>;
  return typeof course.id === "string" && !!course.id && typeof course.name === "string" && !!course.name.trim() && course.name.length <= 160
    && (course.code === null || (typeof course.code === "string" && course.code.length <= 80))
    && (course.term === null || (typeof course.term === "string" && course.term.length <= 80)) && typeof course.is_active === "boolean";
}

function isActivity(value: unknown): value is Activity {
  if (!value || typeof value !== "object") return false;
  const activity = value as Partial<Activity>;
  return typeof activity.id === "string" && !!activity.id && typeof activity.course_id === "string" && !!activity.course_id
    && typeof activity.title === "string" && !!activity.title.trim() && activity.title.length <= 240
    && typeof activity.description === "string" && activity.description.length <= 5000
    && (activity.due_date === null || (typeof activity.due_date === "string" && validDate(activity.due_date)))
    && (activity.status === "pending" || activity.status === "completed")
    && typeof activity.review_required === "boolean"
    && (activity.activity_type === undefined || ACTIVITY_TYPES.some(type => type.value === activity.activity_type));
}

export function readGuestData(storage: Storage): GuestData {
  let raw: string | null;
  try { raw = storage.getItem(DATA_KEY); } catch { throw storageError(); }
  if (!raw) return emptyGuestData();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw Error("Los datos locales del invitado están dañados. No se sobrescribirán."); }
  if (!value || typeof value !== "object") throw Error("Los datos locales del invitado no son válidos. No se sobrescribirán.");
  const data = value as Partial<GuestData>;
  if (!Array.isArray(data.courses) || !Array.isArray(data.activities)
    || data.courses.length > 500 || data.activities.length > 5000
    || !data.courses.every(isCourse) || !data.activities.every(isActivity)
    || data.activities.some(activity => !data.courses!.some(course => course.id === activity.course_id))) {
    throw Error("Los datos locales del invitado no son válidos. No se sobrescribirán.");
  }
  return { courses: data.courses, activities: data.activities };
}

export function saveGuestData(storage: Storage, data: GuestData): void {
  try { storage.setItem(DATA_KEY, JSON.stringify(data)); } catch { throw storageError(); }
}

export function isGuestMode(storage: Storage): boolean {
  try { return storage.getItem(MODE_KEY) === "1"; } catch { return false; }
}

export function setGuestMode(storage: Storage, enabled: boolean): void {
  try { if (enabled) storage.setItem(MODE_KEY, "1"); else storage.removeItem(MODE_KEY); }
  catch { throw storageError(); }
}

export function guestId(): string {
  return globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function addGuestCourse(data: GuestData, name: string, code: string, term: string): GuestData {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 160) throw Error("Ingresa un nombre de curso válido.");
  if (code.trim().length > 80 || term.trim().length > 80) throw Error("El código y el período deben tener hasta 80 caracteres.");
  if (data.courses.some(course => course.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw Error("Ya existe un curso con ese nombre.");
  return { ...data, courses: [...data.courses, { id: guestId(), name: cleanName, code: code.trim() || null, term: term.trim() || null, is_active: true }] };
}

export function updateGuestCourse(data: GuestData, updated: Course): GuestData {
  if (!data.courses.some(course => course.id === updated.id)) throw Error("Curso no encontrado.");
  const name = updated.name.trim();
  if (!name || name.length > 160) throw Error("Ingresa un nombre de curso válido.");
  if ((updated.code?.trim().length || 0) > 80 || (updated.term?.trim().length || 0) > 80) throw Error("El código y el período deben tener hasta 80 caracteres.");
  if (data.courses.some(course => course.id !== updated.id && course.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error("Ya existe un curso con ese nombre.");
  return { ...data, courses: data.courses.map(course => course.id === updated.id ? { ...updated, name, code: updated.code?.trim() || null, term: updated.term?.trim() || null } : course) };
}

export function deleteGuestCourse(data: GuestData, id: string): GuestData {
  if (!data.courses.some(course => course.id === id)) throw Error("Curso no encontrado.");
  return { courses: data.courses.filter(course => course.id !== id), activities: data.activities.filter(activity => activity.course_id !== id) };
}

export function createGuestActivity(data: GuestData, courseId: string, values: Proposal): GuestData {
  const course = data.courses.find(course => course.id === courseId);
  if (!course?.is_active) throw Error("Selecciona un curso activo.");
  const problem = proposalError([values]);
  if (problem) throw Error(problem);
  const activity: Activity = {
    id: guestId(), course_id: courseId, title: values.title.trim(), description: values.description,
    activity_type: values.activity_type || "otro", due_date: values.due_date,
    status: values.status === "completed" ? "completed" : "pending",
    review_required: values.review_required || !values.due_date,
    date_warning_reason: values.due_date ? "" : values.date_warning_reason || "",
    year_unconfirmed: !!values.year_unconfirmed && !values.due_date,
  };
  return { ...data, activities: [activity, ...data.activities] };
}

export function updateGuestActivity(data: GuestData, id: string, values: Proposal): GuestData {
  if (!data.activities.some(activity => activity.id === id)) throw Error("Tarea no encontrada.");
  const problem = proposalError([values]);
  if (problem) throw Error(problem);
  return { ...data, activities: data.activities.map(activity => activity.id === id ? {
    ...activity, title: values.title.trim(), description: values.description,
    activity_type: values.activity_type || "otro", due_date: values.due_date,
    status: values.status === "completed" ? "completed" : "pending",
    review_required: values.review_required || !values.due_date,
    date_warning_reason: values.due_date ? "" : values.date_warning_reason || "",
    year_unconfirmed: !!values.year_unconfirmed && !values.due_date,
  } : activity) };
}

export function changeGuestActivityStatus(data: GuestData, id: string, status: "pending" | "completed"): GuestData {
  if (!data.activities.some(activity => activity.id === id)) throw Error("Tarea no encontrada.");
  return { ...data, activities: data.activities.map(activity => activity.id === id ? { ...activity, status } : activity) };
}

export function deleteGuestActivity(data: GuestData, id: string): GuestData {
  if (!data.activities.some(activity => activity.id === id)) throw Error("Tarea no encontrada.");
  return { ...data, activities: data.activities.filter(activity => activity.id !== id) };
}
