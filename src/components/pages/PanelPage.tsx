import { locale, t } from "../../lib/language";
import { useEffect, useId, useState } from "react";
import { compareActivityDates } from "../../lib/activityOrder";
import { localToday } from "../../lib/proposals";
import { TaskCourseChart } from "../TaskCourseChart";
import type { Activity, FilterProps } from "../types";

type Props = {
  username: string;
  onOpenTask: (id: string) => void;
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

export function PanelPage({ items, filters, loaded, onAnalyze, onShowAll, username, onOpenTask }: Props) {
  const ringMaskId = useId();
  const progressSummaryId = useId();
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setHour(new Date().getHours());
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, []);
  const greeting = hour === null ? t("Hola") : hour < 6 || hour >= 19 ? t("Buenas noches") : hour < 12 ? t("Buenos días") : t("Buenas tardes");
  const completed = items.filter(item => item.status === "completed").length;
  const total = items.length;
  const percent = total ? Math.round(completed / total * 100) : 0;
  const pending = items.filter(item => item.status !== "completed");
  const upcomingTasks = upcomingActivities(pending).slice(0, 4);
  const late = pending.filter(item => item.due_date && item.due_date < localToday()).length;
  return <div className="panel-overview">
    <div className="welcome"><div><h1>{greeting}, {username}.</h1><p className="muted">{t("Tus actividades de un vistazo.")}</p></div><button className="primary" onClick={onAnalyze}>{t("Analizar documento")}</button></div>
    <div className="panel-summary-grid">
      <section className="panel panel-ring-card" aria-labelledby="progress-title">
        <div><span className="progress-kicker">{t("Paso a paso")}</span><h2 id="progress-title">{t("Mi progreso")}</h2></div>
        <div className="panel-progress-interactive"><div className="panel-progress-ring" tabIndex={0} aria-describedby={progressSummaryId} role="progressbar" aria-label={t("Progreso de tareas completadas")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <defs><mask id={ringMaskId}><circle className="ring-reveal" cx="100" cy="100" r="82" pathLength="100" stroke="white" strokeDasharray={`${percent} 100`}/></mask></defs>
            <circle className="ring-track" cx="100" cy="100" r="82"/>
            <g mask={`url(#${ringMaskId})`}>
              <circle className="ring-value" cx="100" cy="100" r="82"/>
              {loaded && percent > 0 && <g className="ring-sparkles"><g className="ring-lines-orbit">
                {Array.from({ length: 64 }, (_, index) => {
                  const angle = index * Math.PI / 32;
                  const x = 100 + 82 * Math.cos(angle);
                  const y = 100 + 82 * Math.sin(angle);
                  return <line key={index} className="ring-horizontal-line" x1={x} y1={y - 2.2} x2={x} y2={y + 2.2} />;
                })}
              </g></g>}
            </g>
          </svg>
          <div><strong>{loaded ? `${percent}%` : "—"}</strong><span>{t("completado")}</span></div>
        </div>
        <div id={progressSummaryId} className="panel-progress-tooltip" role="tooltip">
          <strong>{t("Resumen de tareas")}</strong>
          <dl>{[
            { kind: "total", label: t("Total de tareas"), count: total },
            { kind: "completed", label: t("Completadas"), count: completed },
            { kind: "pending", label: t("Pendientes"), count: pending.length },
            { kind: "overdue", label: t("Vencidas"), count: late },
          ].map(({ kind, label, count }) => <div key={kind} data-task-kind={kind}><dt>{label}</dt><dd>{loaded ? count : "\u2014"}</dd></div>)}</dl>
        </div></div>
        <p className="muted">{loaded ? `${completed} ${t("de")} ${total} ${t("tareas completadas")}` : t("Cargando…")}</p>
      </section>
      <section className="panel panel-upcoming-card" aria-labelledby="upcoming-title">
        <div className="section-head"><div><span className="progress-kicker">{t("Tu agenda")}</span><h2 id="upcoming-title">{t("Actividades próximas")}</h2></div><button className="text-button" onClick={onShowAll}>{t("Ver todas")}</button></div>
        {!loaded ? <p className="muted" role="status">{t("Cargando…")}</p> : upcomingTasks.length ? <div className="panel-task-previews">{upcomingTasks.map(activity => <button type="button" className="panel-task-preview" key={activity.id} onClick={() => onOpenTask(activity.id)} aria-label={`${t("Ver detalles")}: ${activity.title}`}>
          <span className="panel-preview-mark" aria-hidden="true"/><span className="panel-preview-copy"><strong>{activity.title}</strong><span>{filters.courses.find(course => course.id === activity.course_id)?.name || t("Curso")}</span></span>
          <time dateTime={activity.due_date!}>{new Date(`${activity.due_date}T12:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short" })}</time><span aria-hidden="true">↗</span>
        </button>)}</div> : <div className="panel-agenda-empty"><span aria-hidden="true">↗</span><h3>{t("Tu agenda está despejada")}</h3><p className="muted">{t("No tienes tareas pendientes con una fecha próxima.")}</p></div>}
      </section>
    </div>
    <section className="panel panel-count-card" aria-labelledby="task-summary-title"><span id="task-summary-title" className="progress-kicker">{t("Resumen general")}</span><dl className="panel-task-counts">{[[t("Total de tareas"),total],[t("Pendientes"),pending.length],[t("Completadas"),completed],[t("Vencidas"),late]].map(([label,count]) => <div key={label}><dt>{label}</dt><dd>{loaded ? count : "—"}</dd></div>)}</dl></section>
    <TaskCourseChart items={items} courses={filters.courses} loaded={loaded} />
  </div>;
}
