import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Empty } from "../ActivityParts";
import type { Activity, Course } from "../types";

type Props = {
  courses: Course[];
  items: Activity[];
  loaded: boolean;
  busy: boolean;
  newCourse: string;
  setNewCourse: (value: string) => void;
  editingCourse: Course | null;
  setEditingCourse: (course: Course | null) => void;
  confirmDeactivateId: string;
  setConfirmDeactivateId: (id: string) => void;
  onAdd: (event: FormEvent) => void;
  onSave: (event: FormEvent) => void;
  onChangeStatus: (course: Course, active: boolean) => Promise<string | null>;
  onDeleteEmpty: (course: Course) => Promise<string | null>;
};

export function CoursesPage({ courses, items, loaded, busy, newCourse, setNewCourse, editingCourse, setEditingCourse, confirmDeactivateId, setConfirmDeactivateId, onAdd, onSave, onChangeStatus, onDeleteEmpty }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pending = useRef(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const deleting = !!confirmDeleteId;
  const selectedCourse = deleting ? courses.find(course => course.id === confirmDeleteId)
    : courses.find(course => course.id === confirmDeactivateId && course.is_active);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedCourse && !dialog?.open) dialog?.showModal();
    if (!selectedCourse && dialog?.open) dialog.close();
  }, [selectedCourse]);

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
      <p id={descriptionId}>{deleting ? <>Se borrará <strong>{selectedCourse?.name}</strong> y cualquier revisión pendiente del curso. Esta acción no se puede deshacer.</>
        : <>Se desactivará <strong>{selectedCourse?.name}</strong>. Sus tareas se conservarán y podrás reactivarlo después.</>}</p>
      {confirmationError && <div className="error" role="alert">{confirmationError}</div>}
      <div className="logout-dialog-actions">
        <button type="button" className="logout-cancel" autoFocus disabled={busy} onClick={cancel}>Cancelar</button>
        <button type="button" className={deleting ? "action-button action-button-danger course-delete-confirm" : "primary"} disabled={busy} onClick={() => void confirm()}>{busy ? deleting ? "Borrando…" : "Desactivando…" : deleting ? "Confirmar borrado" : "Confirmar"}</button>
      </div>
    </dialog>
    <div className="page-title"><div><h1>Mis cursos</h1><p className="muted">Edita tus cursos, borra los vacíos o desactiva los que tienen tareas.</p></div></div>
    <section className="panel">
      <form onSubmit={onAdd} className="inline-form">
        <label className="course-name-field">Nombre del curso<input value={newCourse} onChange={event => setNewCourse(event.target.value)} placeholder="Ej. Matemática" required maxLength={160} /></label>
        <button className="primary" disabled={busy}>Añadir curso</button>
      </form>
      <div className="course-list">
        {[...courses].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)).map(course => {
          const activityCount = items.filter(item => item.course_id === course.id).length;
          return <div className={`course-card${course.is_active ? "" : " inactive"}`} key={course.id}>
          {editingCourse?.id === course.id ? <form className="course-edit-form" onSubmit={onSave}>
            <label>Nombre<input placeholder="Ej. Matemática" value={editingCourse.name} onChange={event => setEditingCourse({ ...editingCourse, name: event.target.value })} required maxLength={160} /></label>
            <label>Código (opcional)<input placeholder="Ej. MAT-101" value={editingCourse.code ?? ""} onChange={event => setEditingCourse({ ...editingCourse, code: event.target.value })} maxLength={80} /></label>
            <label>Periodo (opcional)<input placeholder="Ej. 2026-II" value={editingCourse.term ?? ""} onChange={event => setEditingCourse({ ...editingCourse, term: event.target.value })} maxLength={80} /></label>
            <div className="course-edit-actions"><button className="primary" disabled={busy}>Guardar cambios</button><button type="button" className="action-button" disabled={busy} onClick={() => setEditingCourse(null)}>Cancelar</button></div>
          </form> : <>
            <div className="course-info"><b>{course.name}</b>{!course.is_active && <span className="course-status">Inactivo</span>}{(course.code || course.term) && <small>{[course.code, course.term].filter(Boolean).join(" · ")}</small>}</div>
            <div className="course-actions">
              <span className="course-count">{activityCount} {activityCount === 1 ? "tarea" : "tareas"}</span>
              <button type="button" className="action-button" disabled={busy} onClick={() => { setEditingCourse({ ...course }); setConfirmDeactivateId(""); }}>Editar</button>
              {activityCount === 0 ? <button type="button" className="action-button action-button-danger" disabled={busy} onClick={event => {
                triggerRef.current = event.currentTarget;
                setConfirmationError("");
                setConfirmDeactivateId("");
                setConfirmDeleteId(course.id);
              }}>Borrar</button> : course.is_active ? <button type="button" className="action-button action-button-danger" disabled={busy} onClick={event => {
                triggerRef.current = event.currentTarget;
                setConfirmationError("");
                setConfirmDeactivateId(course.id);
              }}>Desactivar</button> : <button type="button" className="action-button" disabled={busy} onClick={() => onChangeStatus(course, true)}>Reactivar</button>}
              {!course.is_active && activityCount === 0 && <button type="button" className="action-button" disabled={busy} onClick={() => onChangeStatus(course, true)}>Reactivar</button>}
            </div>
          </>}
        </div>;
        })}
        {loaded && !courses.length && <Empty text="Aún no tienes cursos. Añade el primero arriba." />}
      </div>
    </section>
  </>;
}
