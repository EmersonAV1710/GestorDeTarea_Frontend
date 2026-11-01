import { t } from "../../lib/language";
import { useEffect, useId, useRef, useState, type FormEvent, type DragEvent } from "react";
import { ActivityList, FilterDisclosure, Filters, type ActiveFilter } from "../ActivityParts";
import { orderPendingTasks, orderTasks, type TaskOrder } from "../../lib/activityOrder";
import { createDragAutoScroll } from "../../lib/dragAutoScroll";
import { ACTIVITY_TYPES, activityTypeLabel } from "../../lib/activityTypes";
import { matchesActivityStatus } from "../../lib/activityStatus";
import { localToday, proposalError, type Proposal } from "../../lib/proposals";
import { separateDateWarning, separateYearWarning } from "../../lib/activityWarning";
import type { Activity, FilterProps } from "../types";

type Props = {
  onRefresh?: () => Promise<void>;
  focusedTaskId?: string;
  onTaskOpened?: () => void;
  items: Activity[];
  filters: FilterProps;
  loaded: boolean;
  busy: boolean;
  view: "board" | "list";
  onChangeView: (view: "board" | "list") => void;
  complete: (id: string) => void;
  reopen: (id: string) => void;
  onSave: (id: string, values: Proposal) => Promise<string | null>;
  onCreate: (courseId: string, values: Proposal) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onCourses: () => void;
};

const emptyDraft: Proposal = { title: "", description: "", activity_type: "otro", due_date: null, review_required: false };
const emptyManualDraft: Proposal = { title: "", description: "", due_date: null, review_required: false };

export function TasksPage({ onRefresh, focusedTaskId, onTaskOpened, items, filters, loaded, busy, view, onChangeView, complete, reopen, onSave, onCreate, onDelete, onCourses }: Props) {
  const [returningTaskId, setReturningTaskId] = useState("");
  const [highlightedTaskId, setHighlightedTaskId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refreshPending = useRef(false);
  async function refreshTasks() {
    if (busy || refreshPending.current || !onRefresh) return;
    refreshPending.current = true;setRefreshing(true);
    try { await onRefresh(); setPendingPage(1); setListPage(1); }
    finally { refreshPending.current = false;setRefreshing(false); }
  }
  const [selection, setSelection] = useState<{ mode: "edit" | "delete"; activity: Activity } | null>(null);
  const [draft, setDraft] = useState<Proposal>(emptyDraft);
  const [taskOrder, setTaskOrder] = useState<TaskOrder>("date-asc");
  const [pendingPage, setPendingPage] = useState(1);
  const [donePage, setDonePage] = useState(1);
  const [listPage, setListPage] = useState(1);
  const [showCompleted, setShowCompleted] = useState(false);
  const completedDialogRef = useRef<HTMLDialogElement>(null);
  const completedTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = completedDialogRef.current;
    if (showCompleted && !dialog?.open) dialog?.showModal();
    if (!showCompleted && dialog?.open) dialog.close();
  }, [showCompleted]);
  const [showCreate, setShowCreate] = useState(false);
  const [manualCourse, setManualCourse] = useState("");
  const [manualDraft, setManualDraft] = useState<Proposal>(emptyManualDraft);
  const [manualError, setManualError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const [dropTarget, setDropTarget] = useState<"pending" | "completed" | null>(null);
  const [dragSupported, setDragSupported] = useState(true);
  const draggedIdRef = useRef("");
  const autoScrollRef = useRef<ReturnType<typeof createDragAutoScroll> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const viewButtonRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const createPending = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const visibleItems = orderPendingTasks(items.filter(item => matchesActivityStatus(item.status, filters.statusFilter)), localToday());
  const pendingTasks = visibleItems.filter(item => item.status !== "completed");
  const doneTasks = orderTasks(visibleItems.filter(item => item.status === "completed"), taskOrder, filters.courses);

  const filterKey = JSON.stringify([filters.courseFilter, filters.typeFilter, filters.statusFilter, filters.from, filters.to, taskOrder]);
  useEffect(() => { setPendingPage(1); setDonePage(1); setListPage(1); }, [filterKey]);
  const pendingPages = Math.max(1, Math.ceil(pendingTasks.length / 10));
  const donePages = Math.max(1, Math.ceil(doneTasks.length / 10));
  const listPages = Math.max(1, Math.ceil(visibleItems.length / 10));
  const currentPendingPage = Math.min(pendingPage, pendingPages);
  const currentDonePage = Math.min(donePage, donePages);
  const focusedIndex = focusedTaskId ? visibleItems.findIndex(item => item.id === focusedTaskId) : -1;
  const currentListPage = focusedIndex >= 0 ? Math.floor(focusedIndex / 10) + 1 : Math.min(listPage, listPages);
  useEffect(() => {
    setPendingPage(page => Math.min(page, pendingPages));
    setDonePage(page => Math.min(page, donePages));
    setListPage(page => Math.min(page, listPages));
  }, [pendingPages, donePages, listPages]);
  useEffect(() => {
    if (!focusedTaskId) return;
    const article = document.getElementById(`activity-${focusedTaskId}`);
    const dialog = article?.querySelector<HTMLDialogElement>("dialog.activity-details-dialog");
    if (dialog) {
      if (view === "list") setListPage(currentListPage);
      article?.scrollIntoView({ block: "center" });
      if (!dialog.open) dialog.showModal();
      onTaskOpened?.();
    }
  }, [focusedTaskId, onTaskOpened, items, currentListPage, view]);
  useEffect(() => {
    if (!returningTaskId) return;
    const index = pendingTasks.findIndex(task => task.id === returningTaskId);
    if (index < 0) return;
    setPendingPage(Math.floor(index / 10) + 1);
    setListPage(Math.floor(visibleItems.findIndex(task => task.id === returningTaskId) / 10) + 1);
    setHighlightedTaskId(returningTaskId);
    setReturningTaskId("");
  }, [returningTaskId, items, filterKey]);
  useEffect(() => {
    if (!highlightedTaskId || showCompleted) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`activity-${highlightedTaskId}`)?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
    const timer = window.setTimeout(() => setHighlightedTaskId(""), 2400);
    return () => { window.cancelAnimationFrame(frame);window.clearTimeout(timer); };
  }, [highlightedTaskId, currentPendingPage, currentListPage, showCompleted]);
  function returnToPending(id: string) {
    if (busy) return;
    setReturningTaskId(id);
    reopen(id);
  }
  const activeCourses = filters.courses.filter(course => course.is_active);
  const activeFilters: ActiveFilter[] = [];
  if (filters.courseFilter) activeFilters.push({ key: "course", label: `${t("Curso")}: ${filters.courses.find(course => course.id === filters.courseFilter)?.name || t("Curso")}`, onRemove: () => filters.setCourseFilter("") });
  if (filters.typeFilter) activeFilters.push({ key: "type", label: `${t("Tipo")}: ${t(activityTypeLabel(filters.typeFilter))}`, onRemove: () => filters.setTypeFilter("") });
  if (filters.from) activeFilters.push({ key: "from", label: `${t("Desde")}: ${filters.from.split("-").reverse().join("/")}`, onRemove: () => filters.setFrom("") });
  if (filters.to) activeFilters.push({ key: "to", label: `${t("Hasta")}: ${filters.to.split("-").reverse().join("/")}`, onRemove: () => filters.setTo("") });

  function openCreate() {
    setManualCourse("");
    setManualDraft({ ...emptyManualDraft });
    setManualError("");
    setShowCreate(true);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || createPending.current) return;
    const problem = !activeCourses.some(course => course.id === manualCourse) ? t("Selecciona un curso activo.")
      : !manualDraft.activity_type ? t("Selecciona un tipo de entrega.") : proposalError([manualDraft]);
    if (problem) { setManualError(problem); return; }
    createPending.current = true;
    setManualError("");
    try {
      const error = await onCreate(manualCourse, { ...manualDraft, title: manualDraft.title.trim(),
        review_required: manualDraft.review_required || !manualDraft.due_date,
        status: manualDraft.due_date && manualDraft.due_date < localToday() && manualDraft.status === "completed" ? "completed" : "pending" });
      if (error) setManualError(error);
      else { setShowCreate(false); setManualDraft({ ...emptyManualDraft }); }
    } catch (error) {
      setManualError(error instanceof Error ? error.message : t("No se pudo añadir la tarea. Inténtalo de nuevo."));
    } finally {
      createPending.current = false;
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selection && !dialog?.open) dialog?.showModal();
    if (!selection && dialog?.open) dialog.close();
  }, [selection]);

  function open(activity: Activity, mode: "edit" | "delete") {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const warning = separateYearWarning(activity.description, activity.year_unconfirmed);
    const dateWarning = separateDateWarning(warning.description, activity.date_warning_reason);
    setDraft({ title: activity.title, description: dateWarning.description, date_warning_reason: dateWarning.reason, activity_type: activity.activity_type || "otro",
      due_date: activity.due_date, review_required: activity.review_required || !activity.due_date,
      year_unconfirmed: warning.yearUnconfirmed && !activity.due_date,
      status: activity.status === "completed" ? "completed" : "pending" });
    setDialogError("");
    setSelection({ mode, activity });
  }

  function close() {
    if (busy || pending.current) return;
    setSelection(null);
    setDialogError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || busy || pending.current) return;
    const problem = selection.mode === "edit" ? proposalError([draft]) : "";
    if (problem) { setDialogError(problem); return; }
    pending.current = true;
    setDialogError("");
    try {
      const error = selection.mode === "edit"
        ? await onSave(selection.activity.id, { ...draft, title: draft.title.trim(), review_required: draft.review_required || !draft.due_date })
        : await onDelete(selection.activity.id);
      if (error) setDialogError(error);
      else setSelection(null);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : t("No se pudo guardar el cambio. Inténtalo de nuevo."));
    } finally {
      pending.current = false;
    }
  }

  useEffect(() => () => autoScrollRef.current?.stop(), []);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktopPointer = window.matchMedia("(min-width: 821px) and (pointer: fine)");
    const updateDragSupport = () => {
      setDragSupported(desktopPointer.matches);
      if (!desktopPointer.matches) clearDrag();
    };
    updateDragSupport();
    desktopPointer.addEventListener("change", updateDragSupport);
    return () => desktopPointer.removeEventListener("change", updateDragSupport);
  }, []);

  function clearDrag() {
    autoScrollRef.current?.stop();
    draggedIdRef.current = "";
    setDraggingId("");
    setDropTarget(null);
  }

  function startDrag(activity: Activity, event: DragEvent<HTMLElement>) {
    if (busy || view !== "board" || !dragSupported) { event.preventDefault(); return; }
    event.dataTransfer.setData("application/x-tarevia-activity", activity.id);
    event.dataTransfer.effectAllowed = "move";
    draggedIdRef.current = activity.id;
    setDraggingId(activity.id);
    if (!autoScrollRef.current) autoScrollRef.current = createDragAutoScroll(window);
    autoScrollRef.current.start(event.clientY);
  }

  function dragOver(event: DragEvent<HTMLElement>, target: "pending" | "completed") {
    if (!draggedIdRef.current || busy) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(target);
  }

  function dropActivity(event: DragEvent<HTMLElement>, target: "pending" | "completed") {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-tarevia-activity");
    const activity = id === draggedIdRef.current ? items.find(item => item.id === id) : undefined;
    clearDrag();
    if (!activity || busy || view !== "board" || activity.status === target) return;
    if (target === "completed") complete(activity.id);
    else reopen(activity.id);
  }

  function leaveColumn(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
  }

  const listProps = { preserveOrder: true, courses: filters.courses, loaded, busy, complete, reopen: returnToPending, highlightedId: highlightedTaskId,
    draggable: view === "board" && dragSupported, draggingId, onDragStart: startDrag, onDragEnd: clearDrag,
    onEdit: (activity: Activity) => open(activity, "edit"), onDelete: (activity: Activity) => open(activity, "delete") };

  return <>
    <div className="page-title task-page-title"><div><h1>{t("Mis tareas")}</h1><p className="muted">{t("Organiza tus pendientes y las actividades que ya hiciste.")}</p></div>
      <div className="task-title-actions">{view === "board" && <button type="button" className="action-button" ref={completedTriggerRef} aria-haspopup="dialog" aria-expanded={showCompleted} aria-controls="completed-tasks-dialog" onClick={() => setShowCompleted(true)}>{t("Mostrar hechas")}</button>}<button ref={view === "board" ? viewButtonRef : undefined} type="button" className="primary" disabled={busy} onClick={openCreate}>{t("Añadir tarea")}</button>{view === "list" && <button ref={viewButtonRef} type="button" className="action-button" onClick={() => onChangeView("board")}>{t("Ver pendientes y hechas")}</button>}</div>
    </div>
    {showCreate && <section className="panel manual-task-panel" aria-labelledby="manual-task-title">
      <h2 id="manual-task-title">{t("Nueva tarea")}</h2>
      {activeCourses.length ? <form className="stack" onSubmit={event => void submitCreate(event)}>
        <div className="manual-task-fields">
          <label>{t("Curso")}<select value={manualCourse} required disabled={busy} onChange={event => setManualCourse(event.target.value)}><option value="" disabled>{t("Selecciona un curso")}</option>{activeCourses.map(course => <option value={course.id} key={course.id}>{course.name}</option>)}</select></label>
          <label>{t("Tipo de entrega")}<select value={manualDraft.activity_type || ""} required disabled={busy} onChange={event => setManualDraft({ ...manualDraft, activity_type: event.target.value as Proposal["activity_type"] })}><option value="" disabled>{t("Selecciona un tipo de entrega")}</option>{ACTIVITY_TYPES.map(type => <option value={type.value} key={type.value}>{t(type.label)}</option>)}</select></label>
        </div>
        <label>{t("Título")}<input autoFocus required maxLength={240} placeholder={t("Ej. Entregar informe")} value={manualDraft.title} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, title: event.target.value })} /></label>
        <label>{t("Descripción")}<textarea rows={3} maxLength={5000} placeholder={t("Detalles de la tarea")} value={manualDraft.description} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, description: event.target.value })} /></label>
        {!manualDraft.due_date && <label>{t("Motivo de la fecha sin confirmar (opcional)")}<input maxLength={1000} value={manualDraft.date_warning_reason || ""} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, date_warning_reason: event.target.value })} /></label>}
        <div className="manual-task-fields"><label>{t("Fecha de entrega")}<input type="date" value={manualDraft.due_date || ""} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, due_date: event.target.value || null,
          review_required: event.target.value ? manualDraft.review_required : true,
          status: !event.target.value || event.target.value >= localToday() ? "pending" : manualDraft.status || "pending" })} /></label>
          {manualDraft.due_date && manualDraft.due_date < localToday() && <label>{t("Estado")}<select value={manualDraft.status || "pending"} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, status: event.target.value as Proposal["status"] })}><option value="pending">{t("Vencida")}</option><option value="completed">{t("Entregada")}</option></select></label>}
        </div>
        <label className="check task-review"><input type="checkbox" checked={manualDraft.review_required || !manualDraft.due_date} disabled={busy || !manualDraft.due_date} onChange={event => setManualDraft({ ...manualDraft, review_required: event.target.checked })} />{t("Pendiente de revisión")}</label>
        {manualError && <p className="error" role="alert">{manualError}</p>}
        <div className="manual-task-actions"><button type="button" className="action-button" disabled={busy} onClick={() => { setShowCreate(false); setManualError(""); }}>{t("Cancelar")}</button><button type="submit" className="primary" disabled={busy || !activeCourses.some(course => course.id === manualCourse) || !manualDraft.activity_type || !manualDraft.title.trim()}>{busy ? "Guardando…" : t("Guardar tarea")}</button></div>
      </form> : <p className="muted">{t("Para añadir una tarea, primero")} <button type="button" className="text-button" onClick={onCourses}>{t("crea o activa un curso")}</button>.</p>}
    </section>}
    <section className="task-filters" aria-label={t("Filtros de tareas")}>
      <FilterDisclosure className="task-filter-disclosure" hideTaskCount taskCount={visibleItems.length} activeFilters={activeFilters} onReset={() => { filters.setCourseFilter(""); filters.setTypeFilter(""); filters.setStatusFilter(""); filters.setFrom(""); filters.setTo(""); }}>
        <Filters {...filters} hideStatus />
      </FilterDisclosure>
    </section>
    {view === "board" ? <div className="task-board completed-hidden">
      <section className={`panel task-column${dropTarget === "pending" ? " is-drop-target" : ""}`} aria-labelledby="pending-tasks-title"
        onDragOver={event => dragOver(event, "pending")} onDragLeave={leaveColumn} onDrop={event => dropActivity(event, "pending")}>
        <header className="task-column-header"><h2 id="pending-tasks-title">{t("Pendientes")} <span className="pending-inline-count">{pendingTasks.length}</span></h2><button type="button" className={`task-refresh-button${refreshing ? " is-refreshing" : ""}`} onClick={() => void refreshTasks()} disabled={busy || refreshing} aria-label={t("Actualizar tareas")} title={t("Actualizar tareas")} aria-busy={refreshing}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 4v6h-6"/><path d="M4 20v-6h6"/><path d="M4.9 9a7.5 7.5 0 0 1 12.4-3L20 10M4 14l2.7 4A7.5 7.5 0 0 0 19.1 15"/></svg>
      </button></header>
        <ActivityList {...listProps} items={pendingTasks.slice((currentPendingPage - 1) * 10, currentPendingPage * 10)} emptyText={t("No hay tareas pendientes con estos filtros.")} />
        <TaskPagination label={t("Pendientes")} page={currentPendingPage} pages={pendingPages} total={pendingTasks.length} busy={busy} onChange={setPendingPage} />
      </section>

    </div> : <section className="panel all-tasks-panel" aria-labelledby="all-tasks-title">
      <h2 id="all-tasks-title">{filters.statusFilter === "pending" ? t("Tareas pendientes") : filters.statusFilter === "completed" ? t("Tareas hechas") : t("Todas las tareas")}</h2><ActivityList {...listProps} items={visibleItems.slice((currentListPage - 1) * 10, currentListPage * 10)} /><TaskPagination label={t("Todas las tareas")} page={currentListPage} pages={listPages} total={visibleItems.length} busy={busy} onChange={setListPage} />
    </section>}
    {view === "board" && <dialog ref={completedDialogRef} id="completed-tasks-dialog" className="completed-tasks-dialog" aria-labelledby="done-tasks-title"
      onCancel={event => { event.preventDefault(); setShowCompleted(false); }}
      onClose={() => { setShowCompleted(false); completedTriggerRef.current?.focus(); }}
      onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setShowCompleted(false); } }}>
      <section className={`panel task-column${dropTarget === "completed" ? " is-drop-target" : ""}`} id="completed-tasks-column" aria-labelledby="done-tasks-title"
        onDragOver={event => dragOver(event, "completed")} onDragLeave={leaveColumn} onDrop={event => dropActivity(event, "completed")}>
        <header className="task-column-header"><h2 id="done-tasks-title">{t("Hechas")}</h2><div className="completed-dialog-actions"><span className="task-count">{doneTasks.length}</span><button type="button" className="calendar-agenda-close" aria-label={t("Cerrar")} onClick={() => setShowCompleted(false)}>×</button></div></header>
        <TaskOrderSelect value={taskOrder} onChange={setTaskOrder} />
        <ActivityList {...listProps} items={doneTasks.slice((currentDonePage - 1) * 10, currentDonePage * 10)} emptyText={t("Aquí aparecerán las tareas que completes.")} />
        <TaskPagination label={t("Hechas")} page={currentDonePage} pages={donePages} total={doneTasks.length} busy={busy} onChange={setDonePage} />
      </section>
    </dialog>}
    <dialog ref={dialogRef} className={`logout-dialog task-dialog${selection?.mode === "edit" ? " task-edit-dialog" : ""}`} aria-labelledby={titleId}
      aria-describedby={selection?.mode === "delete" ? descriptionId : undefined}
      onCancel={event => { event.preventDefault(); close(); }} onClose={() => { if (triggerRef.current?.isConnected) triggerRef.current.focus(); else viewButtonRef.current?.focus(); }}>
      <h2 id={titleId}>{selection?.mode === "delete" ? t("¿Borrar tarea?") : t("Modificar tarea")}</h2>
      <form className="stack" onSubmit={event => void submit(event)}>
        {selection?.mode === "edit" ? <>
          <label>{t("Título")}<input placeholder={t("Ej. Entrega del proyecto final")} value={draft.title} autoFocus required maxLength={240} disabled={busy} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>{t("Descripción")}<textarea placeholder={t("Describe la actividad y lo que debes entregar")} value={draft.description} rows={3} maxLength={5000} disabled={busy} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
          {!draft.due_date && <label>{t("Motivo de la fecha sin confirmar (opcional)")}<input maxLength={1000} value={draft.date_warning_reason || ""} disabled={busy} onChange={event => setDraft({ ...draft, date_warning_reason: event.target.value })} /></label>}
          <div className="task-edit-fields">
            <label>{t("Tipo de entrega")}<select value={draft.activity_type || "otro"} disabled={busy} onChange={event => setDraft({ ...draft, activity_type: event.target.value as Proposal["activity_type"] })}>{ACTIVITY_TYPES.map(type => <option value={type.value} key={type.value}>{t(type.label)}</option>)}</select></label>
            <label>{t("Fecha")}<input type="date" value={draft.due_date || ""} disabled={busy} onChange={event => setDraft({ ...draft, due_date: event.target.value || null, review_required: event.target.value ? draft.review_required : true, year_unconfirmed: event.target.value ? false : draft.year_unconfirmed })} /></label>
            {draft.due_date && draft.due_date < localToday() && <label>{t("Estado")}<select value={draft.status || "pending"} disabled={busy} onChange={event => setDraft({ ...draft, status: event.target.value as Proposal["status"] })}><option value="pending">{t("Vencida")}</option><option value="completed">{t("Entregada")}</option></select></label>}
          </div>
          <label className="check task-review"><input type="checkbox" checked={draft.review_required} disabled={busy || !draft.due_date} onChange={event => setDraft({ ...draft, review_required: event.target.checked })} />{t("Pendiente de revisión")}</label>
        </> : <p id={descriptionId}>{t("Se borrará")} <strong>{selection?.activity.title}</strong>{t(". Esta acción no se puede deshacer. Si era la última actividad de un documento, también se quitará su registro.")}</p>}
        {dialogError && <div className="error" role="alert">{dialogError}</div>}
        <div className="logout-dialog-actions">
          <button type="button" className="logout-cancel" autoFocus={selection?.mode === "delete"} disabled={busy} onClick={close}>{t("Cancelar")}</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? (selection?.mode === "delete" ? "Borrando…" : "Guardando…") : selection?.mode === "delete" ? t("Confirmar borrado") : t("Guardar cambios")}</button>
        </div>
      </form>
    </dialog>
  </>;
}


function TaskPagination({ label, page, pages, total, busy, onChange }: { label: string; page: number; pages: number; total: number; busy: boolean; onChange: (page: number) => void }) {
  if (total <= 10) return null;
  return <nav className="task-pagination" aria-label={`${t("Paginación")}: ${label}`}>
    <span className="task-pagination-range" aria-live="polite">{(page - 1) * 10 + 1}–{Math.min(page * 10, total)} {t("de")} {total}</span>
    <div><button type="button" className="action-button" disabled={busy || page === 1} onClick={() => onChange(page - 1)} aria-label={`${t("Página anterior")}: ${label}`}>‹</button>
    <span>{page} / {pages}</span>
    <button type="button" className="action-button" disabled={busy || page === pages} onClick={() => onChange(page + 1)} aria-label={`${t("Página siguiente")}: ${label}`}>›</button></div>
  </nav>;
}


function TaskOrderSelect({ value, onChange }: { value: TaskOrder; onChange: (value: TaskOrder) => void }) {
  return <label className="task-order-select">{t("Ordenar por")}<select value={value} onChange={event => onChange(event.target.value as TaskOrder)}>
    <option value="date-asc">{t("Más antiguo")}</option>
    <option value="date-desc">{t("Más reciente")}</option>
    <option value="title-asc">{t("Título: A a Z")}</option>
    <option value="title-desc">{t("Título: Z a A")}</option>
    <option value="course">{t("Curso: A a Z")}</option>
  </select></label>;
}
