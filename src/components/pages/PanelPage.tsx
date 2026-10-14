import { useEffect, useState } from "react";
import { compareActivityDates } from "../../lib/activityOrder";
import { ACTIVITY_TYPES, activityTypeLabel } from "../../lib/activityTypes";
import { localToday } from "../../lib/proposals";
import { ActivityList, FilterDisclosure, Stat, type ActiveFilter } from "../ActivityParts";
import type { Activity, FilterProps } from "../types";

type Props = {
  items: Activity[];
  upcoming: Activity[];
  overdue?: Activity[];
  undated?: Activity[];
  pastCompleted?: Activity[];
  busy?: boolean;
  filters: Pick<FilterProps, "courses" | "courseFilter" | "setCourseFilter" | "typeFilter" | "setTypeFilter" | "statusFilter" | "setStatusFilter"> & {
    upcomingWeeks: number | null;
    setUpcomingWeeks: (weeks: number | null) => void;
  };
  loaded: boolean;
  complete: (id: string) => void;
  reopen: (id: string) => void;
  onAnalyze: () => void;
  onShowAll: () => void;
};

export function upcomingWithinWeeks(activities: Activity[], weeks: number | null, today = localToday()): Activity[] {
  if (weeks === null) return activities.filter(activity => activity.due_date && activity.due_date >= today);
  const lastDay = new Date(`${today}T12:00:00`);
  lastDay.setDate(lastDay.getDate() + weeks * 7);
  const end = localToday(lastDay);
  return activities.filter(activity => activity.due_date && activity.due_date >= today && activity.due_date <= end);
}

export function upcomingActivities(activities: Activity[], today = localToday()): Activity[] {
  return activities.filter(activity => activity.due_date && activity.due_date >= today).sort(compareActivityDates);
}

export function PanelPage({ items, upcoming, overdue = [], undated = [], pastCompleted = [], busy = false, filters, loaded, complete, reopen, onAnalyze, onShowAll }: Props) {
  const [overdueCount, setOverdueCount] = useState(6);
  const [showAllUndated, setShowAllUndated] = useState(false);
  useEffect(() => {
    setOverdueCount(6);setShowAllUndated(false);
  }, [filters.courseFilter, filters.typeFilter, filters.statusFilter]);
  const ordered = upcomingWithinWeeks(upcoming, filters.upcomingWeeks).sort(compareActivityDates);
  const activeFilters: ActiveFilter[] = [];
  if (filters.courseFilter) activeFilters.push({ key: "course", label: `Curso: ${filters.courses.find(course => course.id === filters.courseFilter)?.name || "Curso"}`, onRemove: () => filters.setCourseFilter("") });
  if (filters.typeFilter) activeFilters.push({ key: "type", label: `Tipo: ${activityTypeLabel(filters.typeFilter)}`, onRemove: () => filters.setTypeFilter("") });
  if (filters.statusFilter) activeFilters.push({ key: "status", label: `Estado: ${filters.statusFilter === "completed" ? "Hechas" : "Pendientes"}`, onRemove: () => filters.setStatusFilter("") });
  if (filters.upcomingWeeks !== null) activeFilters.push({ key: "weeks", label: `Próximas: ${filters.upcomingWeeks} ${filters.upcomingWeeks === 1 ? "semana" : "semanas"}`, onRemove: () => filters.setUpcomingWeeks(null) });
  function resetFilters() {
    filters.setCourseFilter(""); filters.setTypeFilter(""); filters.setStatusFilter(""); filters.setUpcomingWeeks(null);
  }

  return <>
    <div className="welcome"><div><h1>Panel</h1><p className="muted">Tus actividades de un vistazo.</p></div><button className="primary" onClick={onAnalyze}>Analizar documento</button></div>
    <div className="stats">
      <Stat label="Pendientes" count={items.filter(item => item.status === "pending").length} />
      <Stat label="Próximas" count={ordered.length} />
      <Stat label="Completadas" count={items.filter(item => item.status === "completed").length} />
    </div>
    <section className="panel">
      <div className="section-head"><div><h2>Actividades próximas</h2><p className="muted">Filtra por curso, tipo de entrega, estado y semanas.</p></div><button className="text-button" onClick={onShowAll}>Ver todas</button></div>
      <FilterDisclosure className="panel-filter-disclosure" activeFilters={activeFilters} onReset={resetFilters}>
        <label>Curso<select value={filters.courseFilter} onChange={event => filters.setCourseFilter(event.target.value)}><option value="">Todos los cursos</option>{filters.courses.map(course => <option value={course.id} key={course.id}>{course.name}</option>)}</select></label>
        <label>Tipo de entrega<select value={filters.typeFilter} onChange={event => filters.setTypeFilter(event.target.value)}><option value="">Todos los tipos</option>{ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label>Estado<select value={filters.statusFilter} onChange={event => filters.setStatusFilter(event.target.value as FilterProps["statusFilter"])}><option value="">Todos los estados</option><option value="pending">Pendientes</option><option value="completed">Hechas</option></select></label>
        <label>Próximas entregas<select value={filters.upcomingWeeks ?? "all"} onChange={event => filters.setUpcomingWeeks(event.target.value === "all" ? null : Number(event.target.value))}>
          <option value="1">1 semana</option><option value="2">2 semanas</option><option value="4">4 semanas</option><option value="all">Todas</option>
        </select></label>
      </FilterDisclosure>
      <ActivityList emptyText="No hay actividades próximas en este plazo con estos filtros." items={ordered} courses={filters.courses} complete={complete} reopen={reopen} loaded={loaded} busy={busy} />
      {overdue.length > 0 && <section className="panel-task-group" aria-labelledby="overdue-title">
        <header className="task-column-header"><h3 id="overdue-title">Vencidas</h3><span className="task-count">{overdue.length}</span></header>
        <ActivityList items={[...overdue].sort(compareActivityDates).slice(0, overdueCount)} courses={filters.courses} complete={complete} loaded={loaded} busy={busy} />
        {overdueCount < overdue.length && <button type="button" className="action-button" onClick={() => setOverdueCount(count => count + 6)}>Ver más tareas vencidas</button>}
      </section>}
      {pastCompleted.length > 0 && <section className="panel-task-group" aria-labelledby="past-completed-title">
        <header className="task-column-header"><h3 id="past-completed-title">Hechas anteriores</h3><span className="task-count">{pastCompleted.length}</span></header>
        <ActivityList items={pastCompleted} courses={filters.courses} complete={complete} reopen={reopen} loaded={loaded} busy={busy} />
      </section>}
      {undated.length > 0 && <details className="panel-task-group panel-undated" aria-labelledby="undated-title">
        <summary><h3 id="undated-title">Sin fecha</h3><span className="task-count">{undated.length}</span><svg className="panel-undated-chevron" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg></summary>
        <ActivityList items={showAllUndated ? undated : undated.slice(0, 6)} courses={filters.courses} complete={complete} loaded={loaded} busy={busy} />
        {undated.length > 6 && <button type="button" className="action-button" aria-label={showAllUndated ? "Ver menos tareas sin fecha" : "Ver más tareas sin fecha"} aria-expanded={showAllUndated} onClick={() => setShowAllUndated(value => !value)}>{showAllUndated ? "Ver menos" : "Ver más"}</button>}
      </details>}
    </section>
  </>;
}
