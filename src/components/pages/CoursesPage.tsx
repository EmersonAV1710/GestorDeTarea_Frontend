import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Empty } from "../ActivityParts";
import { closeOtherActionMenus } from "../../lib/actionMenus";
import type { Activity, Course } from "../types";

type Props = {
  guest?: boolean;
  courses: Course[];
  items: Activity[];
  loaded: boolean;
  busy: boolean;
  error: string;
  onClearError: () => void;
  newCourse: string;
  setNewCourse: (value: string) => void;
  newCourseCode: string;
  setNewCourseCode: (value: string) => void;
  newCourseTerm: string;
  setNewCourseTerm: (value: string) => void;
  editingCourse: Course | null;
  setEditingCourse: (course: Course | null) => void;
  confirmDeactivateId: string;
  setConfirmDeactivateId: (id: string) => void;
  onAdd: (event: FormEvent) => Promise<boolean>;
  onSave: (event: FormEvent) => void;
  onChangeStatus: (course: Course, active: boolean) => Promise<string | null>;
  onDeleteEmpty: (course: Course) => Promise<string | null>;
};

export function CoursesPage({ guest = false, courses, items, loaded, busy, error, onClearError, newCourse, setNewCourse, newCourseCode, setNewCourseCode, newCourseTerm, setNewCourseTerm, editingCourse, setEditingCourse, confirmDeactivateId, setConfirmDeactivateId, onAdd, onSave, onChangeStatus, onDeleteEmpty }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pending = useRef(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const createTitleId = useId();
  const editTitleId = useId();
  const deleting = !!confirmDeleteId;
  const selectedCourse = deleting ? courses.find(course => course.id === confirmDeleteId)
    : courses.find(course => course.id === confirmDeactivateId && course.is_active);
  const visibleCourses = courses.filter(course =>
    (filter === "all" || course.is_active === (filter === "active")) &&
    [course.name, course.code, course.term].some(value => value?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  ).sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedCourse && !dialog?.open) dialog?.showModal();
    if (!selectedCourse && dialog?.open) dialog.close();
  }, [selectedCourse]);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (showCreate && !dialog?.open) dialog?.showModal();
    if (!showCreate && dialog?.open) dialog.close();
  }, [showCreate]);

  useEffect(() => {
    const dialog = editDialogRef.current;
    if (editingCourse && !dialog?.open) dialog?.showModal();
    if (!editingCourse && dialog?.open) dialog.close();
  }, [editingCourse]);

  function cancel() {
    if (busy || pending.current) return;
    setConfirmDeactivateId("");
    setConfirmDeleteId("");
    setConfirmationError("");
  }

  async function confirm() {
    if (!selectedCourse || busy || pending.current) return;
    pending.current = true;
    setConfirmationError("");
    try {
      const error = deleting ? await onDeleteEmpty(selectedCourse) : await onChangeStatus(selectedCourse, false);
      if (error) setConfirmationError(error);
      else if (deleting) setConfirmDeleteId("");
    } finally {
      pending.current = false;
    }
  }

  return <>
    <dialog ref={dialogRef} className="logout-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); cancel(); }} onClose={() => triggerRef.current?.focus()}>
      <h2 id={titleId}>{deleting ? "¿Borrar curso?" : "¿Desactivar curso?"}</h2>
      <p id={descriptionId}>{deleting ? guest ? <>Se borrará <strong>{selectedCourse?.name}</strong> y sus tareas locales. Esta acción no se puede deshacer.</> : <>Se borrará <strong>{selectedCourse?.name}</strong> y cualquier revisión pendiente del curso. Esta acción no se puede deshacer.</>
        : <>Se desactivará <strong>{selectedCourse?.name}</strong>. Sus tareas se conservarán y podrás reactivarlo después.</>}</p>
      {confirmationError && <div className="error" role="alert">{confirmationError}</div>}
      <div className="logout-dialog-actions">
        <button type="button" className="logout-cancel" autoFocus disabled={busy} onClick={cancel}>Cancelar</button>
        <button type="button" className="action-button action-button-danger course-status-confirm" disabled={busy} onClick={() => void confirm()}>{busy ? deleting ? "Borrando…" : "Desactivando…" : deleting ? "Confirmar borrado" : "Confirmar"}</button>
      </div>
    </dialog>
    <dialog id="course-create-dialog" ref={createDialogRef} className="logout-dialog course-create-dialog" aria-labelledby={createTitleId}
      onCancel={event => { if (busy) event.preventDefault(); }}
      onClose={() => { setShowCreate(false); createTriggerRef.current?.focus(); }}>
      <h2 id={createTitleId}>Nuevo curso</h2>
      <p className="muted">Añade los datos del curso. El código y el periodo son opcionales.</p>
      {error && showCreate && <div className="error course-dialog-error" role="alert">{error}</div>}
      <form id="course-create-form" onSubmit={async event => { if (await onAdd(event)) setShowCreate(false); }} className="course-create-form">
        <label>Nombre del curso<input value={newCourse} onChange={event => setNewCourse(event.target.value)} placeholder="Ej. Matemática" required maxLength={160} /></label>
        <label>Código (opcional)<input value={newCourseCode} onChange={event => setNewCourseCode(event.target.value)} placeholder="Ej. MAT-101" maxLength={80} /></label>
        <label>Periodo (opcional)<input value={newCourseTerm} onChange={event => setNewCourseTerm(event.target.value)} placeholder="Ej. 2026-II" maxLength={80} /></label>
        <div className="course-create-actions"><button type="button" className="action-button" disabled={busy} onClick={() => setShowCreate(false)}>Cancelar</button><button className="primary" disabled={busy}>Guardar curso</button></div>
      </form>
    </dialog>
    <dialog id="course-edit-dialog" ref={editDialogRef} className="logout-dialog course-create-dialog" aria-labelledby={editTitleId}
      onCancel={event => { if (busy) event.preventDefault(); }}
      onClose={() => { setEditingCourse(null); editTriggerRef.current?.focus(); }}>
      <h2 id={editTitleId}>Editar curso</h2>
      <p className="muted">Actualiza los datos del curso.</p>
      {error && editingCourse && <div className="error course-dialog-error" role="alert">{error}</div>}
      {editingCourse && <form className="course-edit-form" onSubmit={onSave}>
        <label>Nombre<input placeholder="Ej. Matemática" value={editingCourse.name} onChange={event => setEditingCourse({ ...editingCourse, name: event.target.value })} required maxLength={160} /></label>
        <label>Código (opcional)<input placeholder="Ej. MAT-101" value={editingCourse.code ?? ""} onChange={event => setEditingCourse({ ...editingCourse, code: event.target.value })} maxLength={80} /></label>
        <label>Periodo (opcional)<input placeholder="Ej. 2026-II" value={editingCourse.term ?? ""} onChange={event => setEditingCourse({ ...editingCourse, term: event.target.value })} maxLength={80} /></label>
        <div className="course-edit-actions"><button type="button" className="action-button" disabled={busy} onClick={() => setEditingCourse(null)}>Cancelar</button><button className="primary" disabled={busy}>Guardar cambios</button></div>
      </form>}
    </dialog>
    <section className="panel courses-panel">
      <div className="courses-header">
        <div><h1>Mis cursos</h1><p className="muted">Organiza y administra tus cursos académicos.</p></div>
        <button ref={createTriggerRef} type="button" className="primary" aria-haspopup="dialog" aria-controls="course-create-dialog" onClick={() => { onClearError(); setShowCreate(true); }}><span className="course-new-plus" aria-hidden="true">+</span> Nuevo curso</button>
      </div>
      <div className="courses-toolbar">
        <div className="course-filters" role="group" aria-label="Filtrar cursos">
          <button type="button" className={filter === "all" ? "selected" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Todos <span>{courses.length}</span></button>
          <button type="button" className={filter === "active" ? "selected" : ""} aria-pressed={filter === "active"} onClick={() => setFilter("active")}>Activos</button>
          <button type="button" className={filter === "inactive" ? "selected" : ""} aria-pressed={filter === "inactive"} onClick={() => setFilter("inactive")}>Inactivos</button>
        </div>
        <label className="course-search">Buscar cursos<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, código o periodo" /></label>
      </div>
      <div className="course-list">
        {visibleCourses.map(course => {
          const activityCount = items.filter(item => item.course_id === course.id).length;
          return <div className={`course-card${course.is_active ? "" : " inactive"}`} key={course.id}>
            <div className="course-info"><b>{course.name}</b>{!course.is_active && <span className="course-status">Inactivo</span>}<small>{[course.code, course.term].filter(Boolean).join(" · ") || "Sin código asignado"}</small></div>
            <div className="course-actions">
              <span className="course-count">{activityCount} {activityCount === 1 ? "tarea" : "tareas"}</span>
              <details className="course-menu" onToggle={event => closeOtherActionMenus(event.currentTarget)}><summary aria-label={`Opciones de ${course.name}`} title="Opciones">···</summary><div className="course-menu-options">
              <button type="button" disabled={busy} onClick={event => { onClearError(); editTriggerRef.current = event.currentTarget.closest("details")?.querySelector("summary") ?? null; event.currentTarget.closest("details")?.removeAttribute("open"); setEditingCourse({ ...course }); setConfirmDeactivateId(""); }}>Editar</button>
              {(guest || activityCount === 0) ? <button type="button" className="course-menu-danger" disabled={busy} onClick={event => {
                triggerRef.current = event.currentTarget;
                setConfirmationError("");
                setConfirmDeactivateId("");
                setConfirmDeleteId(course.id);
              }}>Borrar</button> : course.is_active ? <button type="button" className="course-menu-danger" disabled={busy} onClick={event => {
                triggerRef.current = event.currentTarget;
                setConfirmationError("");
                setConfirmDeactivateId(course.id);
              }}>Desactivar</button> : null}
              {!course.is_active && <button type="button" disabled={busy} onClick={() => onChangeStatus(course, true)}>Reactivar</button>}
              </div></details>
            </div>
        </div>;
        })}
        {loaded && !visibleCourses.length && <Empty text={courses.length ? "No hay cursos que coincidan con este filtro." : "Aún no tienes cursos. Añade el primero arriba."} />}
      </div>
    </section>
  </>;
}
