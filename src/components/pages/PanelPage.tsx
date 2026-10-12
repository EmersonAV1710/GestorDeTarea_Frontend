import { useEffect, useState } from "react";
import { compareActivityDates } from "../../lib/activityOrder";
import { ACTIVITY_TYPES } from "../../lib/activityTypes";
import { localToday } from "../../lib/proposals";
import { ActivityList, Stat } from "../ActivityParts";
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

export function PanelPage({ items, upcoming, overdue = [], undated = [], busy = false, filters, loaded, complete, onAnalyze, onShowAll }: Props) {
  const [overdueCount, setOverdueCount] = useState(6);
  const [undatedCount, setUndatedCount] = useState(6);
  const [upcomingWeeks, setUpcomingWeeks] = useState<number | null>(1);
  useEffect(() => {
    setOverdueCount(6);setUndatedCount(6);
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
        <button className="clear" type="button" onClick={() => { filters.setCourseFilter(""); filters.setTypeFilter(""); setUpcomingWeeks(1); }}>Limpiar</button>
      </div>
      <ActivityList emptyText="No hay actividades próximas en este plazo con estos filtros." items={ordered} courses={filters.courses} complete={complete} loaded={loaded} busy={busy} />
      {overdue.length > 0 && <section className="panel-task-group" aria-labelledby="overdue-title">
        <h3 id="overdue-title">Vencidas <span className="task-count">{overdue.length}</span></h3>
        <ActivityList items={[...overdue].sort(compareActivityDates).slice(0, overdueCount)} courses={filters.courses} complete={complete} loaded={loaded} busy={busy} />
        {overdueCount < overdue.length && <button type="button" className="action-button" onClick={() => setOverdueCount(count => count + 6)}>Ver más tareas vencidas</button>}
      </section>}
      {undated.length > 0 && <section className="panel-task-group" aria-labelledby="undated-title">
        <h3 id="undated-title">Sin fecha <span className="task-count">{undated.length}</span></h3>
        <ActivityList items={undated.slice(0, undatedCount)} courses={filters.courses} complete={complete} loaded={loaded} busy={busy} />
        {undatedCount < undated.length && <button type="button" className="action-button" onClick={() => setUndatedCount(count => count + 6)}>Ver más tareas sin fecha</button>}
      </section>}
    </section>
  </>;
}
