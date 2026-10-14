import { useEffect, useState } from "react";
import { compareActivityDates } from "../../lib/activityOrder";
import { ACTIVITY_TYPES } from "../../lib/activityTypes";
import { localToday } from "../../lib/proposals";
import { ActivityList, ResetFiltersButton, Stat } from "../ActivityParts";
import type { Activity, FilterProps } from "../types";

type Props = {
  items: Activity[];
  upcoming: Activity[];
  overdue?: Activity[];
  undated?: Activity[];
  busy?: boolean;
  filters: Pick<FilterProps, "courses" | "courseFilter" | "setCourseFilter" | "typeFilter" | "setTypeFilter">;
  loaded: boolean;
  complete: (id: string) => void;
  reopen: (id: string) => void;
  onAnalyze: () => void;
  onShowAll: () => void;
};

export function upcomingWithinWeeks(activities: Activity[], weeks: number | null, today = localToday()): Activity[] {
  if (weeks === null) return activities;
  const end = new Date(`${today}T12:00:00`);
  end.setDate(end.getDate() + weeks * 7);
  const lastDay = localToday(end);
  return activities.filter(activity => activity.due_date && activity.due_date <= lastDay);
}

export function upcomingActivities(activities: Activity[], today = localToday()): Activity[] {
  return activities.filter(activity => activity.due_date && activity.due_date >= today).sort(compareActivityDates);
}

export function PanelPage({ items, upcoming, overdue = [], undated = [], busy = false, filters, loaded, complete, reopen, onAnalyze, onShowAll }: Props) {
  const [overdueCount, setOverdueCount] = useState(6);
  const [showAllUndated, setShowAllUndated] = useState(false);
  const [upcomingWeeks, setUpcomingWeeks] = useState<number | null>(1);
  useEffect(() => {
    setOverdueCount(6);setShowAllUndated(false);
  }, [filters.courseFilter, filters.typeFilter]);
  const ordered = upcomingWithinWeeks(upcoming, upcomingWeeks).sort(compareActivityDates);

  return <>
    <div className="welcome"><div><h1>Panel</h1><p className="muted">Tus actividades de un vistazo.</p></div><button className="primary" onClick={onAnalyze}>Analizar documento</button></div>
    <div className="stats">
      <Stat label="Pendientes" count={items.filter(item => item.status === "pending").length} />
      <Stat label="Próximas" count={ordered.length} />
      <Stat label="Completadas" count={items.filter(item => item.status === "completed").length} />
    </div>
    <section className="panel">
      <div className="section-head"><div><h2>Actividades próximas</h2><p className="muted">Filtra por curso, tipo de entrega y semanas.</p></div><button className="text-button" onClick={onShowAll}>Ver todas</button></div>
      <div className="filters panel-filters">
        <label>Curso<select value={filters.courseFilter} onChange={event => filters.setCourseFilter(event.target.value)}><option value="">Todos los cursos</option>{filters.courses.map(course => <option value={course.id} key={course.id}>{course.name}</option>)}</select></label>
        <label>Tipo de entrega<select value={filters.typeFilter} onChange={event => filters.setTypeFilter(event.target.value)}><option value="">Todos los tipos</option>{ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label>Semanas<select value={upcomingWeeks ?? "all"} onChange={event => setUpcomingWeeks(event.target.value === "all" ? null : Number(event.target.value))}>
          <option value="1">1 semana</option><option value="2">2 semanas</option><option value="4">4 semanas</option><option value="all">Todas</option>
        </select></label>
        <ResetFiltersButton onClick={() => { filters.setCourseFilter(""); filters.setTypeFilter(""); setUpcomingWeeks(1); }} />
      </div>
      <ActivityList emptyText="No hay actividades próximas en este plazo con estos filtros." items={ordered} courses={filters.courses} complete={complete} reopen={reopen} loaded={loaded} busy={busy} />
      {overdue.length > 0 && <section className="panel-task-group" aria-labelledby="overdue-title">
        <header className="task-column-header"><h3 id="overdue-title">Vencidas</h3><span className="task-count">{overdue.length}</span></header>
        <ActivityList items={[...overdue].sort(compareActivityDates).slice(0, overdueCount)} courses={filters.courses} complete={complete} loaded={loaded} busy={busy} />
        {overdueCount < overdue.length && <button type="button" className="action-button" onClick={() => setOverdueCount(count => count + 6)}>Ver más tareas vencidas</button>}
      </section>}
      {undated.length > 0 && <details className="panel-task-group panel-undated" aria-labelledby="undated-title">
        <summary><h3 id="undated-title">Sin fecha</h3><span className="task-count">{undated.length}</span><svg className="panel-undated-chevron" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg></summary>
        <ActivityList items={showAllUndated ? undated : undated.slice(0, 6)} courses={filters.courses} complete={complete} loaded={loaded} busy={busy} />
        {undated.length > 6 && <button type="button" className="action-button" aria-label={showAllUndated ? "Ver menos tareas sin fecha" : "Ver más tareas sin fecha"} aria-expanded={showAllUndated} onClick={() => setShowAllUndated(value => !value)}>{showAllUndated ? "Ver menos" : "Ver más"}</button>}
      </details>}
    </section>
  </>;
}
