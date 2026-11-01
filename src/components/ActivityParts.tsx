import { t, locale } from "../lib/language";
import { compareActivityDates } from "../lib/activityOrder";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ACTIVITY_TYPES, activityTypeLabel } from "../lib/activityTypes";
import { localToday } from "../lib/proposals";
import { dateWarningReason, separateDateWarning, separateYearWarning } from "../lib/activityWarning";
import { closeOtherActionMenus } from "../lib/actionMenus";
import type { Activity, Course, FilterProps } from "./types";
import { WarningIcon } from "./WarningIcon";

export function Stat({ label, count }: { label: string; count: number }) {
  return <div className="stat"><span>{t(label)}</span><b>{count}</b></div>;
}

export type ActiveFilter = { key: string; label: string; onRemove: () => void };

export function FilterDisclosure({ children, onReset, className = "", taskCount, hideTaskCount = false, activeFilters = [] }: { children: ReactNode; onReset: () => void; className?: string; taskCount?: number; hideTaskCount?: boolean; activeFilters?: ActiveFilter[] }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const isTaskFilter = taskCount !== undefined;
  return <div className={`filter-disclosure ${className}${open ? " is-open" : ""}`}>
    <div className="filter-disclosure-header">
      <div className="filter-disclosure-controls">
        <button type="button" className={`filter-toggle${isTaskFilter ? " task-filter-toggle" : ""}`} aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(value => !value)}>
          {isTaskFilter
            ? <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" /><path d="M7 3v4M13 8v4M8 13v4" /></svg>
            : <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 4.5h13l-5.2 6.2v4.1l-2.6 1.5v-5.6z" /></svg>}
          {isTaskFilter ? t("Filtros") : t("Filtrar resultados")}
          {isTaskFilter && <svg className={`task-filter-chevron${open ? " is-open" : ""}`} viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>}
        </button>
        {activeFilters.length > 0 && <div className="active-filters" aria-label={t("Filtros activos")}>{activeFilters.map(filter =>
          <button key={filter.key} type="button" className="active-filter" aria-label={`Quitar filtro ${filter.label}`} onClick={filter.onRemove}>
            <span>{filter.label}</span><span className="active-filter-remove" aria-hidden="true">×</span>
          </button>
        )}</div>}
      </div>
      {isTaskFilter && !hideTaskCount && <span className="task-filter-count">{taskCount} {taskCount === 1 ? t("tarea") : t("tareas")}</span>}
    </div>
    <div id={contentId} className="filter-disclosure-content" hidden={!open}>
      <div className="filter-disclosure-fields">{children}</div>
      <div className="filter-disclosure-actions"><button type="button" className="filter-disclosure-clear" onClick={onReset}>{t("↺ Limpiar filtros")}</button></div>
    </div>
  </div>;
}

export function Filters({ courses, courseFilter, setCourseFilter, typeFilter, setTypeFilter, statusFilter, setStatusFilter, from, setFrom, to, setTo, hideStatus = false }: FilterProps & { hideStatus?: boolean }) {
  return <>
    <label>{t("Curso")}<select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}><option value="">{t("Todos los cursos")}</option>{courses.map(course => <option value={course.id} key={course.id}>{course.name}</option>)}</select></label>
    <label>{t("Tipo de entrega")}<select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="">{t("Todos los tipos")}</option>{ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{t(type.label)}</option>)}</select></label>
    {!hideStatus && <label>{t("Estado")}<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as FilterProps["statusFilter"])}><option value="">{t("Todas")}</option><option value="pending">{t("Pendientes")}</option><option value="completed">{t("Hechas")}</option></select></label>}
    <label>{t("Desde")}<span className="task-date-filter"><input type="date" value={from} className={from ? "" : "is-empty"} onChange={e => setFrom(e.target.value)} />{!from && <span className="task-date-placeholder" aria-hidden="true">{t("Fecha inicial")}</span>}</span></label>
    <label>{t("Hasta")}<span className="task-date-filter"><input type="date" value={to} className={to ? "" : "is-empty"} onChange={e => setTo(e.target.value)} />{!to && <span className="task-date-placeholder" aria-hidden="true">{t("Fecha final")}</span>}</span></label>
    {from && to && from > to && <p className="error" role="alert">{t("La fecha inicial debe ser anterior o igual a la final.")}</p>}
  </>;
}

function CompleteTaskCheck({ activity, busy, complete }: { activity: Activity; busy: boolean; complete: (id: string) => void }) {
  const [checking, setChecking] = useState(false);
  const pending = useRef(false);
  async function check() {
    if (busy || pending.current) return;
    pending.current = true;
    setChecking(true);
    try {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) await new Promise<void>(resolve => window.setTimeout(resolve, 180));
      await complete(activity.id);
    } finally {
      pending.current = false;
      setChecking(false);
    }
  }
  return <label className={`activity-check animated-task-check${checking ? " is-checking" : ""}`}>
    <input className="checkmark" type="checkbox" checked={checking} disabled={busy || checking} onChange={() => void check()} aria-label={`Completar ${activity.title}`} aria-busy={checking} />
    <span className="task-check-visual" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7" pathLength="1" /></svg></span>
  </label>;
}

export function ActivityList({ items, courses, complete, loaded, reopen, onEdit, onDelete, busy = false, emptyText, highlightedId, preserveOrder = false, draggable = false, draggingId, onDragStart, onDragEnd }: {
  items: Activity[]; courses: Course[]; complete: (id: string) => void; loaded: boolean;
  reopen?: (id: string) => void; onEdit?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void; busy?: boolean; emptyText?: string; preserveOrder?: boolean; highlightedId?: string;
  draggable?: boolean; draggingId?: string;
  onDragStart?: (activity: Activity, event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
}) {
  if (!loaded) return <div className="empty">{t("Cargando tus actividades…")}</div>;
  if (!items.length) return <Empty text={emptyText || "No hay actividades para mostrar con estos filtros."} />;
  const today = localToday();
  return <div className="activity-list">{(preserveOrder ? items : [...items].sort(compareActivityDates)).map(activity => {
    const warning = separateYearWarning(activity.description, activity.year_unconfirmed);
    const dateWarning = separateDateWarning(warning.description, activity.date_warning_reason);
    const courseName = courses.find(course => course.id === activity.course_id)?.name || t("Curso");
    const dueDate = activity.due_date ? new Date(activity.due_date + "T12:00:00") : null;
    const dueLabel = dueDate ? `${activity.due_date === today ? t("Hoy") + ", " : ""}${dueDate.toLocaleDateString(locale(), { day: "numeric", month: "long" })}` : t("Sin fecha");
    const dateReason = !activity.due_date ? (dateWarning.reason || dateWarningReason(dateWarning.description, warning.yearUnconfirmed)) : null;
    return <article id={`activity-${activity.id}`} className={`activity activity-kind-${activity.activity_type || "otro"}${draggingId === activity.id ? " is-dragging" : ""}${highlightedId === activity.id ? " is-returned" : ""}`} key={activity.id}
    draggable={draggable && !busy} onDragStart={event => onDragStart?.(activity, event)} onDragEnd={onDragEnd}>
    {activity.status === "completed"
      ? <span className="activity-check"><span className="checkmark completed-checkmark" role="img" aria-label={`Hecha: ${activity.title}`}>✓</span></span>
      : <CompleteTaskCheck activity={activity} busy={busy} complete={complete} />}
    <div className="activity-body">
      <div className="activity-heading"><b className={activity.status === "completed" ? "finished" : ""}>{activity.title}</b>
        <details className="activity-menu" onToggle={event => closeOtherActionMenus(event.currentTarget)}>
          <summary aria-label={`Acciones de ${activity.title}`} title={t("Opciones de la tarea")}>···</summary>
          <div className="activity-menu-options">
            <button type="button" onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); event.currentTarget.closest("article")?.querySelector<HTMLDialogElement>("dialog.activity-details-dialog")?.showModal(); }}>{t("Ver detalles")}</button>
            {activity.status === "completed" && reopen && <button type="button" disabled={busy} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); reopen(activity.id); }} aria-label={`Volver a pendientes: ${activity.title}`}>{t("Volver a pendientes")}</button>}
            {onEdit && <button type="button" disabled={busy} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); onEdit(activity); }} aria-label={`Modificar ${activity.title}`}>{t("Editar")}</button>}
            {onDelete && <button type="button" className="activity-menu-delete" disabled={busy} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); onDelete(activity); }} aria-label={`Borrar ${activity.title}`}>{t("Eliminar")}</button>}
          </div>
        </details>
      </div>
      <p>{dateWarning.description || t("Sin descripción")}</p>
      <small><span className="activity-type">{t(activityTypeLabel(activity.activity_type))}</span>{courseName}{activity.status !== "completed" && activity.due_date && activity.due_date < today && <em>{t("Vencida")}</em>}{activity.review_required && <em>{t("Revisar")}</em>}</small>
    </div>
    {draggable && <span className="task-drag-handle" aria-hidden="true" title={t("Arrastrar tarjeta")}>
      <svg viewBox="0 0 16 20" width="16" height="20" fill="currentColor"><circle cx="5" cy="5" r="1.4" /><circle cx="11" cy="5" r="1.4" /><circle cx="5" cy="10" r="1.4" /><circle cx="11" cy="10" r="1.4" /><circle cx="5" cy="15" r="1.4" /><circle cx="11" cy="15" r="1.4" /></svg>
    </span>}
    <div className="due"><span>{dueLabel}</span>{dateReason && <details className="activity-date-warning"><summary aria-label={`Motivo de la fecha sin confirmar: ${dateReason}`}><WarningIcon size={19} /><span className="activity-date-tooltip" role="tooltip">{dateReason}</span></summary></details>}</div>
    <dialog className="activity-details-dialog" aria-label={`Detalles de ${activity.title}`}>
      <h2>{activity.title}</h2>
      <dl>
        <div><dt>{t("Curso")}</dt><dd>{courseName}</dd></div>
        <div><dt>{t("Tipo")}</dt><dd>{t(activityTypeLabel(activity.activity_type))}</dd></div>
        <div><dt>{t("Fecha")}</dt><dd>{dueDate ? dueDate.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" }) : t("Sin fecha")}</dd></div>
        <div><dt>{t("Estado")}</dt><dd>{activity.status === "completed" ? t("Entregada") : activity.due_date && activity.due_date < today ? t("Vencida") : "Pendiente"}</dd></div>
      </dl>
      <h3>{t("Descripción")}</h3><p>{dateWarning.description || t("Sin descripción")}</p>
      {activity.review_required && <p className="activity-details-review">{t("Esta actividad está pendiente de revisión.")}</p>}
      {warning.yearUnconfirmed && !activity.due_date && <p className="activity-details-review">{t("El año no se especifica explícitamente en el documento. Revisa la fecha de esta actividad.")}</p>}
      <form method="dialog"><button type="submit" className="action-button">{t("Cerrar")}</button></form>
    </dialog>
  </article>})}</div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="empty"><p>{text}</p></div>;
}
