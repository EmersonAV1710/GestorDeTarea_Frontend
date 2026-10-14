import { useRef, useState } from "react";
import { ActivityList, FilterDisclosure, type ActiveFilter } from "../ActivityParts";
import type { Activity, Course, FilterProps } from "../types";
import { ACTIVITY_TYPES, activityTypeLabel, matchesActivityType } from "../../lib/activityTypes";
import { matchesActivityStatus } from "../../lib/activityStatus";
import { buildMonthDays, dateKey, groupActivitiesByDate } from "../../lib/calendar";

type Props = {
  items: Activity[];
  courses: Course[];
  loaded: boolean;
  busy: boolean;
  complete: (id: string) => void;
  reopen: (id: string) => void;
};

const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const fullDate = new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function CalendarPage({ items, courses, loaded, busy, complete, reopen }: Props) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1, 12); });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const agendaRef = useRef<HTMLDialogElement>(null);
  const [courseFilter, setCourseFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterProps["statusFilter"]>("");
  const today = dateKey(new Date());
  const filtered = items.filter(item => (!courseFilter || item.course_id === courseFilter) && matchesActivityType(item.activity_type, typeFilter)
    && matchesActivityStatus(item.status, statusFilter));
  const grouped = groupActivitiesByDate(filtered);
  const days = buildMonthDays(month.getFullYear(), month.getMonth());
  const selectedActivities = grouped.get(selectedDate) || [];
  const undated = filtered.filter(item => !item.due_date);
  const selectedDay = days.find(day => day.key === selectedDate);
  const selectedDateLabel = selectedDay ? fullDate.format(selectedDay.date) : selectedDate;
  const monthLabel = month.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  const listProps = { courses, loaded, busy, complete, reopen };
  const activeFilters: ActiveFilter[] = [];
  if (courseFilter) activeFilters.push({ key: "course", label: `Curso: ${courses.find(course => course.id === courseFilter)?.name || "Curso"}`, onRemove: () => setCourseFilter("") });
  if (typeFilter) activeFilters.push({ key: "type", label: `Tipo: ${activityTypeLabel(typeFilter)}`, onRemove: () => setTypeFilter("") });
  if (statusFilter) activeFilters.push({ key: "status", label: `Estado: ${statusFilter === "completed" ? "Hechas" : "Pendientes"}`, onRemove: () => setStatusFilter("") });

  function moveMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1, 12);
    setMonth(next);
    setSelectedDate(dateKey(next));
  }

  function selectDay(date: Date) {
    setSelectedDate(dateKey(date));
    if (!agendaRef.current?.open) agendaRef.current?.showModal();
    if (date.getMonth() !== month.getMonth() || date.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    }
  }

  return <>
    <div className="page-title calendar-page-title"><div><h1>Calendario</h1><p className="muted">Consulta las fechas de tus tareas, proyectos y exámenes.</p></div></div>
    {!loaded ? <div className="empty">Cargando tus actividades…</div> : <>
      <section className="panel calendar-panel" aria-labelledby="calendar-month-title">
        <header className="calendar-toolbar">
          <h2 id="calendar-month-title" aria-live="polite">{monthLabel}</h2>
          <div className="calendar-controls">
            <button type="button" className="logout-cancel" aria-label="Mes anterior" onClick={() => moveMonth(-1)}><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 5-5 5 5 5" /></svg></button>
            <button type="button" className="logout-cancel" onClick={() => selectDay(new Date())}>Hoy</button>
            <button type="button" className="logout-cancel" aria-label="Mes siguiente" onClick={() => moveMonth(1)}><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg></button>
          </div>
        </header>
        <FilterDisclosure className="calendar-filter-disclosure" activeFilters={activeFilters} onReset={() => { setCourseFilter(""); setTypeFilter(""); setStatusFilter(""); }}>
          <label>Curso<select value={courseFilter} onChange={event => setCourseFilter(event.target.value)}><option value="">Todos los cursos</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
          <label>Tipo de entrega<select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="">Todos los tipos</option>{ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label>Estado<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as FilterProps["statusFilter"])}><option value="">Todos los estados</option><option value="pending">Pendientes</option><option value="completed">Hechas</option></select></label>
        </FilterDisclosure>
        <div className="calendar-weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
        <div className="calendar-days">
          {days.map(day => {
            const activities = grouped.get(day.key) || [];
            return <button key={day.key} type="button" className={`calendar-day${day.isCurrentMonth ? "" : " outside-month"}${day.key === today ? " is-today" : ""}`}
              aria-pressed={day.key === selectedDate} aria-current={day.key === today ? "date" : undefined}
              aria-label={`${fullDate.format(day.date)}. ${activities.length} ${activities.length === 1 ? "actividad" : "actividades"}${day.key === today ? ". Hoy" : ""}`}
              onClick={() => selectDay(day.date)}>
              <span className="calendar-day-number">{day.day}</span>
              <span className="calendar-events" aria-hidden="true">{activities.slice(0, 2).map(activity => <span key={activity.id} className={`calendar-event${activity.status === "completed" ? " completed" : ""}`} title={activity.title}>{activity.title}</span>)}
                {activities.length > 2 && <span className="calendar-more">+{activities.length - 2} más</span>}
              </span>
              {activities.length > 0 && <span className="calendar-mobile-count" aria-hidden="true">{activities.length}</span>}
            </button>;
          })}
        </div>
        <p className="calendar-hint">Selecciona un día para ver sus actividades. Las tareas tachadas ya están hechas.</p>
      </section>
      <dialog ref={agendaRef} className="logout-dialog calendar-agenda" aria-labelledby="calendar-day-title">
        <div className="calendar-agenda-header">
          <h2 id="calendar-day-title">{selectedDateLabel.charAt(0).toLocaleUpperCase("es-CR") + selectedDateLabel.slice(1)}</h2>
          <button type="button" className="calendar-agenda-close" aria-label="Cerrar actividades del día" onClick={() => agendaRef.current?.close()}>×</button>
        </div>
        <p className="muted">{selectedActivities.length} {selectedActivities.length === 1 ? "actividad" : "actividades"}</p>
        <ActivityList {...listProps} items={selectedActivities} emptyText="No hay actividades para este día con los filtros seleccionados." />
      </dialog>
      {undated.length > 0 && <details className="panel calendar-undated">
        <summary>Actividades sin fecha <span className="task-count">{undated.length}</span></summary>
        <p className="calendar-hint">Asigna una fecha desde <strong>Mis tareas</strong> para verlas en el calendario.</p>
        <ActivityList {...listProps} items={undated} />
      </details>}
    </>}
  </>;
}
