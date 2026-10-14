import { compareActivityDates } from "../lib/activityOrder";
import type { DragEvent } from "react";
import { ACTIVITY_TYPES, activityTypeLabel } from "../lib/activityTypes";
import { localToday } from "../lib/proposals";
import { dateWarningReason, separateDateWarning, separateYearWarning } from "../lib/activityWarning";
import { closeOtherActionMenus } from "../lib/actionMenus";
import type { Activity, Course, FilterProps } from "./types";
import { WarningIcon } from "./WarningIcon";

export function Stat({ label, count }: { label: string; count: number }) {
  return <div className="stat"><span>{label}</span><b>{count}</b></div>;
}

export function ResetFiltersButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="clear filter-reset" aria-label="Restablecer filtros" title="Restablecer filtros" onClick={onClick}>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 11a7.5 7.5 0 1 1 1.7 5.9" /><path d="M4.5 5.5V11H10" />
    </svg>
  </button>;
}

export function Filters({ courses, courseFilter, setCourseFilter, typeFilter, setTypeFilter, from, setFrom, to, setTo }: FilterProps) {
  return <div className="filters">
    <label>Curso<select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}><option value="">Todos los cursos</option>{courses.map(course => <option value={course.id} key={course.id}>{course.name}</option>)}</select></label>
    <label>Tipo de entrega<select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="">Todos los tipos</option>{ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
    <label>Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
    <label>Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
    <ResetFiltersButton onClick={() => { setCourseFilter(""); setTypeFilter(""); setFrom(""); setTo(""); }} />
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
  const today = localToday();
  return <div className="activity-list">{[...items].sort(compareActivityDates).map(activity => {
    const warning = separateYearWarning(activity.description, activity.year_unconfirmed);
    const dateWarning = separateDateWarning(warning.description, activity.date_warning_reason);
    const courseName = courses.find(course => course.id === activity.course_id)?.name || "Curso";
    const dueDate = activity.due_date ? new Date(activity.due_date + "T12:00:00") : null;
    const dueLabel = dueDate ? `${activity.due_date === today ? "Hoy, " : ""}${dueDate.toLocaleDateString("es", { day: "numeric", month: "long" })}` : "Sin fecha";
    const dateReason = !activity.due_date ? (dateWarning.reason || dateWarningReason(dateWarning.description, warning.yearUnconfirmed)) : null;
    return <article className={`activity${draggingId === activity.id ? " is-dragging" : ""}`} key={activity.id}
    draggable={draggable && !busy} onDragStart={event => onDragStart?.(activity, event)} onDragEnd={onDragEnd}>
    {activity.status === "completed"
      ? <span className="activity-check"><span className="checkmark completed-checkmark" role="img" aria-label={`Hecha: ${activity.title}`}>✓</span></span>
      : <label className="activity-check"><input className="checkmark" type="checkbox" checked={false} disabled={busy} onChange={() => complete(activity.id)} aria-label={`Completar ${activity.title}`} /></label>}
    <div className="activity-body">
      <div className="activity-heading"><b className={activity.status === "completed" ? "finished" : ""}>{activity.title}</b>
        <details className="activity-menu" onToggle={event => closeOtherActionMenus(event.currentTarget)}>
          <summary aria-label={`Acciones de ${activity.title}`} title="Opciones de la tarea">···</summary>
          <div className="activity-menu-options">
            <button type="button" onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); event.currentTarget.closest("article")?.querySelector<HTMLDialogElement>("dialog.activity-details-dialog")?.showModal(); }}>Ver detalles</button>
            {activity.status === "completed" && reopen && <button type="button" disabled={busy} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); reopen(activity.id); }} aria-label={`Volver a pendientes: ${activity.title}`}>Volver a pendientes</button>}
            {onEdit && <button type="button" disabled={busy} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); onEdit(activity); }} aria-label={`Modificar ${activity.title}`}>Editar</button>}
            {onDelete && <button type="button" className="activity-menu-delete" disabled={busy} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); onDelete(activity); }} aria-label={`Borrar ${activity.title}`}>Eliminar</button>}
          </div>
        </details>
      </div>
      <p>{dateWarning.description || "Sin descripción"}</p>
      <small><span className="activity-type">{activityTypeLabel(activity.activity_type)}</span>{courseName}{activity.status !== "completed" && activity.due_date && activity.due_date < today && <em>Vencida</em>}{activity.review_required && <em>Revisar</em>}</small>
    </div>
    {draggable && <span className="task-drag-handle" aria-hidden="true" title="Arrastrar tarjeta">
      <svg viewBox="0 0 16 20" width="16" height="20" fill="currentColor"><circle cx="5" cy="5" r="1.4" /><circle cx="11" cy="5" r="1.4" /><circle cx="5" cy="10" r="1.4" /><circle cx="11" cy="10" r="1.4" /><circle cx="5" cy="15" r="1.4" /><circle cx="11" cy="15" r="1.4" /></svg>
    </span>}
    <div className="due"><span>{dueLabel}</span>{dateReason && <details className="activity-date-warning"><summary aria-label={`Motivo de la fecha sin confirmar: ${dateReason}`}><WarningIcon size={19} /><span className="activity-date-tooltip" role="tooltip">{dateReason}</span></summary></details>}</div>
    <dialog className="activity-details-dialog" aria-label={`Detalles de ${activity.title}`}>
      <h2>{activity.title}</h2>
      <dl>
        <div><dt>Curso</dt><dd>{courseName}</dd></div>
        <div><dt>Tipo</dt><dd>{activityTypeLabel(activity.activity_type)}</dd></div>
        <div><dt>Fecha</dt><dd>{dueDate ? dueDate.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "Sin fecha"}</dd></div>
        <div><dt>Estado</dt><dd>{activity.status === "completed" ? "Entregada" : activity.due_date && activity.due_date < today ? "Vencida" : "Pendiente"}</dd></div>
      </dl>
      <h3>Descripción</h3><p>{dateWarning.description || "Sin descripción"}</p>
      {activity.review_required && <p className="activity-details-review">Esta actividad está pendiente de revisión.</p>}
      {warning.yearUnconfirmed && !activity.due_date && <p className="activity-details-review">El año no se especifica explícitamente en el documento. Revisa la fecha de esta actividad.</p>}
      <form method="dialog"><button type="submit" className="action-button">Cerrar</button></form>
    </dialog>
  </article>})}</div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="empty"><p>{text}</p></div>;
}
