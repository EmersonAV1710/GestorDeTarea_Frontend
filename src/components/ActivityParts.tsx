import { compareActivityDates } from "../lib/activityOrder";
import type { DragEvent } from "react";
import { ACTIVITY_TYPES, activityTypeLabel } from "../lib/activityTypes";
import { localToday } from "../lib/proposals";
import type { Activity, Course, FilterProps } from "./types";

export function Stat({ label, count }: { label: string; count: number }) {
  return <div className="stat"><span>{label}</span><b>{count}</b></div>;
}

export function Filters({ courses, courseFilter, setCourseFilter, typeFilter, setTypeFilter, from, setFrom, to, setTo }: FilterProps) {
  return <div className="filters">
    <label>Curso<select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}><option value="">Todos los cursos</option>{courses.map(course => <option value={course.id} key={course.id}>{course.name}</option>)}</select></label>
    <label>Tipo de entrega<select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="">Todos los tipos</option>{ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
    <label>Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
    <label>Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
    <button className="clear" onClick={() => { setCourseFilter(""); setTypeFilter(""); setFrom(""); setTo(""); }}>Limpiar</button>
    {from && to && from > to && <p className="error" role="alert">La fecha inicial debe ser anterior o igual a la final.</p>}
  </div>;
}

export function ActivityList({ items, courses, complete, loaded, reopen, onEdit, onDelete, busy = false, emptyText, draggable = false, draggingId, onDragStart, onDragEnd }: {
  items: Activity[]; courses: Course[]; complete: (id: string) => void; loaded: boolean;
  reopen?: (id: string) => void; onEdit?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void; busy?: boolean; emptyText?: string;
  draggable?: boolean; draggingId?: string;
  onDragStart?: (activity: Activity, event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
}) {
  if (!loaded) return <div className="empty">Cargando tus actividades…</div>;
  if (!items.length) return <Empty text={emptyText || "No hay actividades para mostrar con estos filtros."} />;
  return <div className="activity-list">{[...items].sort(compareActivityDates).map(activity => <article className={`activity${draggingId === activity.id ? " is-dragging" : ""}`} key={activity.id}
    draggable={draggable && !busy} onDragStart={event => onDragStart?.(activity, event)} onDragEnd={onDragEnd}>
    <label className="activity-check"><input className="checkmark" type="checkbox" checked={activity.status === "completed"} disabled={busy || (activity.status === "completed" && !reopen)} onChange={() => activity.status === "completed" ? reopen?.(activity.id) : complete(activity.id)} aria-label={`${activity.status === "completed" ? "Marcar como pendiente" : "Completar"} ${activity.title}`} /></label>
    <div className="activity-body">
      <b className={activity.status === "completed" ? "finished" : ""}>{activity.title}</b>
      <p>{activity.description || "Sin descripción"}</p>
      <small><span className="activity-type">{activityTypeLabel(activity.activity_type)}</span>{courses.find(course => course.id === activity.course_id)?.name || "Curso"}{activity.status !== "completed" && activity.due_date && activity.due_date < localToday() && <em>Vencida</em>}{activity.review_required && <em>Revisar</em>}</small>
      {(onEdit || onDelete) && <div className="activity-actions">
        {onEdit && <button type="button" className="action-button" disabled={busy} onClick={() => onEdit(activity)} aria-label={`Modificar ${activity.title}`}>Modificar</button>}
        {onDelete && <button type="button" className="action-button action-button-danger" disabled={busy} onClick={() => onDelete(activity)} aria-label={`Borrar ${activity.title}`}>Borrar</button>}
      </div>}
    </div>
    {draggable && <span className="task-drag-handle" aria-hidden="true" title="Arrastrar tarjeta">
      <svg viewBox="0 0 16 20" width="16" height="20" fill="currentColor"><circle cx="5" cy="5" r="1.4" /><circle cx="11" cy="5" r="1.4" /><circle cx="5" cy="10" r="1.4" /><circle cx="11" cy="10" r="1.4" /><circle cx="5" cy="15" r="1.4" /><circle cx="11" cy="15" r="1.4" /></svg>
    </span>}
    <div className="due">{activity.due_date ? new Date(activity.due_date + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "short" }) : "Sin fecha"}</div>
  </article>)}</div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="empty"><p>{text}</p></div>;
}
