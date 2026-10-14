import { useEffect, useId, useRef, useState, type FormEvent, type DragEvent } from "react";
import { ActivityList, FilterDisclosure, Filters, type ActiveFilter } from "../ActivityParts";
import { createDragAutoScroll } from "../../lib/dragAutoScroll";
import { ACTIVITY_TYPES, activityTypeLabel } from "../../lib/activityTypes";
import { matchesActivityStatus } from "../../lib/activityStatus";
import { localToday, proposalError, type Proposal } from "../../lib/proposals";
import { separateDateWarning, separateYearWarning } from "../../lib/activityWarning";
import type { Activity, FilterProps } from "../types";

type Props = {
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

export function TasksPage({ items, filters, loaded, busy, view, onChangeView, complete, reopen, onSave, onCreate, onDelete, onCourses }: Props) {
  const [selection, setSelection] = useState<{ mode: "edit" | "delete"; activity: Activity } | null>(null);
  const [draft, setDraft] = useState<Proposal>(emptyDraft);
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
  const visibleItems = items.filter(item => matchesActivityStatus(item.status, filters.statusFilter));
  const pendingTasks = visibleItems.filter(item => item.status !== "completed");
  const doneTasks = visibleItems.filter(item => item.status === "completed");
  const activeCourses = filters.courses.filter(course => course.is_active);
  const activeFilters: ActiveFilter[] = [];
  if (filters.courseFilter) activeFilters.push({ key: "course", label: `Curso: ${filters.courses.find(course => course.id === filters.courseFilter)?.name || "Curso"}`, onRemove: () => filters.setCourseFilter("") });
  if (filters.typeFilter) activeFilters.push({ key: "type", label: `Tipo: ${activityTypeLabel(filters.typeFilter)}`, onRemove: () => filters.setTypeFilter("") });
  if (filters.statusFilter) activeFilters.push({ key: "status", label: `Estado: ${filters.statusFilter === "completed" ? "Hechas" : "Pendientes"}`, onRemove: () => filters.setStatusFilter("") });
  if (filters.from) activeFilters.push({ key: "from", label: `Desde: ${filters.from.split("-").reverse().join("/")}`, onRemove: () => filters.setFrom("") });
  if (filters.to) activeFilters.push({ key: "to", label: `Hasta: ${filters.to.split("-").reverse().join("/")}`, onRemove: () => filters.setTo("") });

  function openCreate() {
    setManualCourse("");
    setManualDraft({ ...emptyManualDraft });
    setManualError("");
    setShowCreate(true);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || createPending.current) return;
    const problem = !activeCourses.some(course => course.id === manualCourse) ? "Selecciona un curso activo."
      : !manualDraft.activity_type ? "Selecciona un tipo de entrega." : proposalError([manualDraft]);
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
      setManualError(error instanceof Error ? error.message : "No se pudo añadir la tarea. Inténtalo de nuevo.");
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
      setDialogError(error instanceof Error ? error.message : "No se pudo guardar el cambio. Inténtalo de nuevo.");
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

  const listProps = { courses: filters.courses, loaded, busy, complete, reopen,
    draggable: view === "board" && dragSupported, draggingId, onDragStart: startDrag, onDragEnd: clearDrag,
    onEdit: (activity: Activity) => open(activity, "edit"), onDelete: (activity: Activity) => open(activity, "delete") };

  return <>
    <div className="page-title task-page-title"><div><h1>Mis tareas</h1><p className="muted">Organiza tus pendientes y las actividades que ya hiciste.</p></div>
      <div className="task-title-actions"><button type="button" className="primary" disabled={busy} onClick={openCreate}>Añadir tarea</button><button ref={viewButtonRef} type="button" className="action-button" onClick={() => onChangeView(view === "board" ? "list" : "board")}>{view === "board" ? "Ver todas las tareas" : "Ver pendientes y hechas"}</button></div>
    </div>
    {showCreate && <section className="panel manual-task-panel" aria-labelledby="manual-task-title">
      <h2 id="manual-task-title">Nueva tarea</h2>
      {activeCourses.length ? <form className="stack" onSubmit={event => void submitCreate(event)}>
        <div className="manual-task-fields">
          <label>Curso<select value={manualCourse} required disabled={busy} onChange={event => setManualCourse(event.target.value)}><option value="" disabled>Selecciona un curso</option>{activeCourses.map(course => <option value={course.id} key={course.id}>{course.name}</option>)}</select></label>
          <label>Tipo de entrega<select value={manualDraft.activity_type || ""} required disabled={busy} onChange={event => setManualDraft({ ...manualDraft, activity_type: event.target.value as Proposal["activity_type"] })}><option value="" disabled>Selecciona un tipo de entrega</option>{ACTIVITY_TYPES.map(type => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label>
        </div>
        <label>Título<input autoFocus required maxLength={240} placeholder="Ej. Entregar informe" value={manualDraft.title} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, title: event.target.value })} /></label>
        <label>Descripción<textarea rows={3} maxLength={5000} placeholder="Detalles de la tarea" value={manualDraft.description} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, description: event.target.value })} /></label>
        {!manualDraft.due_date && <label>Motivo de la fecha sin confirmar (opcional)<input maxLength={1000} value={manualDraft.date_warning_reason || ""} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, date_warning_reason: event.target.value })} /></label>}
        <div className="manual-task-fields"><label>Fecha de entrega<input type="date" value={manualDraft.due_date || ""} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, due_date: event.target.value || null,
          review_required: event.target.value ? manualDraft.review_required : true,
          status: !event.target.value || event.target.value >= localToday() ? "pending" : manualDraft.status || "pending" })} /></label>
          {manualDraft.due_date && manualDraft.due_date < localToday() && <label>Estado<select value={manualDraft.status || "pending"} disabled={busy} onChange={event => setManualDraft({ ...manualDraft, status: event.target.value as Proposal["status"] })}><option value="pending">Vencida</option><option value="completed">Entregada</option></select></label>}
        </div>
        <label className="check task-review"><input type="checkbox" checked={manualDraft.review_required || !manualDraft.due_date} disabled={busy || !manualDraft.due_date} onChange={event => setManualDraft({ ...manualDraft, review_required: event.target.checked })} />Pendiente de revisión</label>
        {manualError && <p className="error" role="alert">{manualError}</p>}
        <div className="manual-task-actions"><button type="button" className="action-button" disabled={busy} onClick={() => { setShowCreate(false); setManualError(""); }}>Cancelar</button><button type="submit" className="primary" disabled={busy || !activeCourses.some(course => course.id === manualCourse) || !manualDraft.activity_type || !manualDraft.title.trim()}>{busy ? "Guardando…" : "Guardar tarea"}</button></div>
      </form> : <p className="muted">Para añadir una tarea, primero <button type="button" className="text-button" onClick={onCourses}>crea o activa un curso</button>.</p>}
    </section>}
    <section className="task-filters" aria-label="Filtros de tareas">
      <FilterDisclosure className="task-filter-disclosure" taskCount={visibleItems.length} activeFilters={activeFilters} onReset={() => { filters.setCourseFilter(""); filters.setTypeFilter(""); filters.setStatusFilter(""); filters.setFrom(""); filters.setTo(""); }}>
        <Filters {...filters} />
      </FilterDisclosure>
    </section>
    {view === "board" ? <div className="task-board">
      <section className={`panel task-column${dropTarget === "pending" ? " is-drop-target" : ""}`} aria-labelledby="pending-tasks-title"
        onDragOver={event => dragOver(event, "pending")} onDragLeave={leaveColumn} onDrop={event => dropActivity(event, "pending")}>
        <header className="task-column-header"><h2 id="pending-tasks-title">Pendientes</h2><span className="task-count">{pendingTasks.length}</span></header>
        <ActivityList {...listProps} items={pendingTasks} emptyText="No hay tareas pendientes con estos filtros." />
      </section>
      <section className={`panel task-column${dropTarget === "completed" ? " is-drop-target" : ""}`} aria-labelledby="done-tasks-title"
        onDragOver={event => dragOver(event, "completed")} onDragLeave={leaveColumn} onDrop={event => dropActivity(event, "completed")}>
        <header className="task-column-header"><h2 id="done-tasks-title">Hechas</h2><span className="task-count">{doneTasks.length}</span></header>
        <ActivityList {...listProps} items={doneTasks} emptyText="Aquí aparecerán las tareas que completes." />
      </section>
    </div> : <section className="panel" aria-labelledby="all-tasks-title">
      <h2 id="all-tasks-title">{filters.statusFilter === "pending" ? "Tareas pendientes" : filters.statusFilter === "completed" ? "Tareas hechas" : "Todas las tareas"}</h2><ActivityList {...listProps} items={visibleItems} />
    </section>}
    <dialog ref={dialogRef} className={`logout-dialog task-dialog${selection?.mode === "edit" ? " task-edit-dialog" : ""}`} aria-labelledby={titleId}
      aria-describedby={selection?.mode === "delete" ? descriptionId : undefined}
      onCancel={event => { event.preventDefault(); close(); }} onClose={() => { if (triggerRef.current?.isConnected) triggerRef.current.focus(); else viewButtonRef.current?.focus(); }}>
      <h2 id={titleId}>{selection?.mode === "delete" ? "¿Borrar tarea?" : "Modificar tarea"}</h2>
      <form className="stack" onSubmit={event => void submit(event)}>
        {selection?.mode === "edit" ? <>
          <label>Título<input placeholder="Ej. Entrega del proyecto final" value={draft.title} autoFocus required maxLength={240} disabled={busy} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Descripción<textarea placeholder="Describe la actividad y lo que debes entregar" value={draft.description} rows={3} maxLength={5000} disabled={busy} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
          {!draft.due_date && <label>Motivo de la fecha sin confirmar (opcional)<input maxLength={1000} value={draft.date_warning_reason || ""} disabled={busy} onChange={event => setDraft({ ...draft, date_warning_reason: event.target.value })} /></label>}
          <div className="task-edit-fields">
            <label>Tipo de entrega<select value={draft.activity_type || "otro"} disabled={busy} onChange={event => setDraft({ ...draft, activity_type: event.target.value as Proposal["activity_type"] })}>{ACTIVITY_TYPES.map(type => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label>
            <label>Fecha<input type="date" value={draft.due_date || ""} disabled={busy} onChange={event => setDraft({ ...draft, due_date: event.target.value || null, review_required: event.target.value ? draft.review_required : true, year_unconfirmed: event.target.value ? false : draft.year_unconfirmed })} /></label>
            {draft.due_date && draft.due_date < localToday() && <label>Estado<select value={draft.status || "pending"} disabled={busy} onChange={event => setDraft({ ...draft, status: event.target.value as Proposal["status"] })}><option value="pending">Vencida</option><option value="completed">Entregada</option></select></label>}
          </div>
          <label className="check task-review"><input type="checkbox" checked={draft.review_required} disabled={busy || !draft.due_date} onChange={event => setDraft({ ...draft, review_required: event.target.checked })} />Pendiente de revisión</label>
        </> : <p id={descriptionId}>Se borrará <strong>{selection?.activity.title}</strong>. Esta acción no se puede deshacer. Si era la última actividad de un documento, también se quitará su registro.</p>}
        {dialogError && <div className="error" role="alert">{dialogError}</div>}
        <div className="logout-dialog-actions">
          <button type="button" className="logout-cancel" autoFocus={selection?.mode === "delete"} disabled={busy} onClick={close}>Cancelar</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? (selection?.mode === "delete" ? "Borrando…" : "Guardando…") : selection?.mode === "delete" ? "Confirmar borrado" : "Guardar cambios"}</button>
        </div>
      </form>
    </dialog>
  </>;
}
