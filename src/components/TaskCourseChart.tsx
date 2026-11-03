import { t } from "../lib/language";
import type { Activity, Course } from "./types";

export function TaskCourseChart({ items, courses, loaded }: { items: Activity[]; courses: Course[]; loaded: boolean }) {
  const counts = new Map<string, { pending: number; completed: number }>();
  for (const item of items) {
    const row = counts.get(item.course_id) || { pending: 0, completed: 0 };
    if (item.status === "completed") row.completed += 1;
    else row.pending += 1;
    counts.set(item.course_id, row);
  }
  const rows = [...counts].map(([id, count]) => ({ id, name: courses.find(course => course.id === id)?.name || t("Curso"), ...count }))
    .sort((a, b) => (b.pending + b.completed) - (a.pending + a.completed) || a.name.localeCompare(b.name));
  const maximum = Math.max(1, ...rows.map(row => row.pending + row.completed));
  return <section className="panel task-course-chart task-chart-vertical" aria-labelledby="task-chart-title">
    <header className="section-head"><div><span className="progress-kicker">{t("Tu actividad")}</span><h2 id="task-chart-title">{t("Tareas por curso")}</h2><p className="muted">{t("Compara tus pendientes y completadas en cada curso.")}</p></div>
      <div className="task-chart-legend" aria-hidden="true"><span><i className="chart-pending chart-pending-legend" />{t("Pendientes")}</span><span><i className="chart-completed" />{t("Completadas")}</span></div>
    </header>
    {!loaded ? <p className="muted" role="status">{t("Cargando…")}</p> : !rows.length ? <p className="task-chart-empty muted">{t("Tus tareas aparecerán aquí cuando agregues actividades a tus cursos.")}</p> : <>
      <div className="task-chart-plot-scroll" tabIndex={0} role="region" aria-label={t("Tareas por curso")}><dl className="task-chart-rows">{rows.map(row => <div className="task-chart-row" key={row.id}>
        <dt title={row.name}><span className="chart-course-name">{row.name}<small>{row.pending + row.completed} {t("tareas")}</small></span></dt>
        <dd aria-label={`${row.name}: ${row.pending} ${t("Pendientes")}, ${row.completed} ${t("Completadas")}`}>
          <span className="task-chart-track" aria-hidden="true" title={`${row.pending} ${t("Pendientes")}, ${row.completed} ${t("Completadas")}`}>
            <span className="task-chart-bar" style={{ height: `${(row.pending + row.completed) / maximum * 100}%` }}>
              <span className="chart-pending" style={{ flex: row.pending }}>{row.pending > 0 && <span>{row.pending}</span>}</span>
              <span className="chart-completed" style={{ flex: row.completed }}>{row.completed > 0 && <span>{row.completed}</span>}</span>
            </span>
          </span><strong className="chart-completion-rate" title={t("completado")} aria-hidden="true">{Math.round(row.completed / (row.pending + row.completed) * 100)}<small>%</small></strong>
        </dd>
      </div>)}</dl></div>
    </>}
  </section>;
}
