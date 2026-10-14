import { useRef, useState, type DragEvent, type FormEvent, type RefObject } from "react";
import type { PendingReview, SavedDocument } from "../../lib/reviewDraft";
import { FileIcon } from "../FileIcon";
import { ACTIVITY_TYPES } from "../../lib/activityTypes";
import { localToday, type Proposal } from "../../lib/proposals";
import { WarningIcon } from "../WarningIcon";
import type { Course } from "../types";

type Props = {
  preview?: boolean;
  pendingReviews: PendingReview[];
  savedDocuments: SavedDocument[];
  deleteSavedError: string;
  onClearSavedDeleteError: () => void;
  reviewFileName: string;
  reviewCourseId: string;
  onChangeReviewCourse: (courseId: string) => Promise<void>;
  onResumeReview: (review: PendingReview) => void;
  onDeleteReview: (documentId: string) => void;
  onDeleteSavedDocument: (documentId: string) => Promise<boolean>;
  reviewRef: RefObject<HTMLElement | null>;
  uploadFormRef: RefObject<HTMLFormElement | null>;
  courses: Course[];
  activeCourses: Course[];
  uploadCourse: string;
  setUploadCourse: (value: string) => void;
  selectedFileName: string;
  setSelectedFileName: (value: string) => void;
  busy: boolean;
  proposals: Proposal[];
  setProposals: (proposals: Proposal[]) => void;
  docId: string;
  reviewError: string;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (index: number, key: keyof Proposal, value: string) => void;
  onConfirm: () => void;
  onCourses: () => void;
};

export function assignDroppedFile(files: FileList, input: HTMLInputElement): string {
  if (files.length !== 1) throw Error("Arrastra un solo archivo.");
  if (!/\.(pdf|docx|txt)$/i.test(files[0].name)) throw Error("Solo se admiten archivos PDF, DOCX o TXT.");
  input.files = files;
  return files[0].name;
}

export function clearSelectedFile(event: React.MouseEvent<HTMLButtonElement>, input: HTMLInputElement | null, setSelectedFileName: (value: string) => void): void {
  event.preventDefault();
  event.stopPropagation();
  if (input) input.value = "";
  setSelectedFileName("");
  input?.focus();
}

export function AnalyzePage({ preview = false, pendingReviews, savedDocuments, deleteSavedError, onClearSavedDeleteError, reviewFileName, reviewCourseId, onChangeReviewCourse, onResumeReview, onDeleteReview, onDeleteSavedDocument, reviewRef, uploadFormRef, courses, activeCourses, uploadCourse, setUploadCourse, selectedFileName, setSelectedFileName, busy, proposals, setProposals, docId, reviewError, onUpload, onEdit, onConfirm, onCourses }: Props) {
  const [draggingFile, setDraggingFile] = useState(false);
  const [uploadFileError, setUploadFileError] = useState("");
  const dragDepth = useRef(0);
  function dragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (busy) return;
    dragDepth.current += 1;
    setDraggingFile(true);
  }
  function dragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDraggingFile(false);
  }
  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDraggingFile(false);
    if (busy) return;
    const input = uploadFormRef.current?.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) return;
    try {
      setSelectedFileName(assignDroppedFile(event.dataTransfer.files, input));
      setUploadFileError("");
    } catch (error) {
      input.value = "";
      setSelectedFileName("");
      setUploadFileError(error instanceof Error ? error.message : "No se pudo seleccionar el archivo.");
    }
  }
  function removeSelectedFile(event: React.MouseEvent<HTMLButtonElement>) {
    if (busy) return;
    const input = uploadFormRef.current?.querySelector<HTMLInputElement>('input[type="file"]');
    clearSelectedFile(event, input || null, setSelectedFileName);
    setUploadFileError("");
  }

  function selectFileForReview(review: PendingReview) {
    if (busy) return;
    setUploadCourse(review.course_id);
    setSelectedFileName("");
    const input = uploadFormRef.current?.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) {
      input.value = "";
      input.click();
    }
  }

  return <>
    <div className="page-title upload-title"><div><h1>Analizar documento</h1><p className="muted">{preview ? "Vista previa. Inicia sesión para analizar documentos." : "Sube un PDF, Word o TXT y revisa las tareas."}</p></div>
      <button id="saved-documents-trigger" type="button" className="action-button" aria-haspopup="dialog" aria-controls="saved-documents-dialog" onClick={event => event.currentTarget.ownerDocument.querySelector<HTMLDialogElement>("#saved-documents-dialog")?.showModal()}>Documentos guardados ({savedDocuments.length})</button>
    </div>
    <dialog id="saved-documents-dialog" className="logout-dialog saved-documents-dialog" aria-labelledby="saved-documents-title" onClose={event => event.currentTarget.ownerDocument.getElementById("saved-documents-trigger")?.focus()}>
      <div className="saved-documents-header"><h2 id="saved-documents-title">Documentos guardados ({savedDocuments.length})</h2><button id="saved-documents-close" type="button" className="action-button" onClick={event => event.currentTarget.closest<HTMLDialogElement>("dialog")?.close()}>Cerrar</button></div>
      {savedDocuments.length ? <div className="saved-document-list">{savedDocuments.map(document =>
        <div className="saved-document" key={document.document_id}>
          <FileIcon filename={document.filename} />
          <div><strong>{document.filename}</strong><small>{courses.find(course => course.id === document.course_id)?.name || "Curso"} · {document.activity_count} {document.activity_count === 1 ? "actividad" : "actividades"}</small></div>
          <button id={`delete-saved-trigger-${document.document_id}`} type="button" className="action-button action-button-danger" disabled={busy} aria-haspopup="dialog" aria-controls={`delete-saved-dialog-${document.document_id}`} aria-label={`Borrar documento ${document.filename}`} onClick={event => {
            onClearSavedDeleteError();
            event.currentTarget.ownerDocument.querySelector<HTMLDialogElement>(`#delete-saved-dialog-${document.document_id}`)?.showModal();
          }}>Borrar</button>
          <dialog id={`delete-saved-dialog-${document.document_id}`} className="logout-dialog saved-document-delete-dialog" aria-labelledby={`delete-saved-title-${document.document_id}`} aria-describedby={`delete-saved-description-${document.document_id}`} onClose={event => {
            onClearSavedDeleteError();
            const ownerDocument = event.currentTarget.ownerDocument;
            (ownerDocument.getElementById(`delete-saved-trigger-${document.document_id}`) || ownerDocument.getElementById("saved-documents-close"))?.focus();
          }}>
            <h2 id={`delete-saved-title-${document.document_id}`}>¿Borrar documento?</h2>
            <p id={`delete-saved-description-${document.document_id}`}>Se borrará <strong>{document.filename}</strong> y {document.activity_count === 1 ? "la tarea asociada" : `las ${document.activity_count} tareas asociadas`}. Esta acción no se puede deshacer.</p>
            {deleteSavedError && <p className="error" role="alert">{deleteSavedError}</p>}
            <div className="logout-dialog-actions">
              <button type="button" className="logout-cancel" autoFocus disabled={busy} onClick={event => event.currentTarget.closest<HTMLDialogElement>("dialog")?.close()}>Cancelar</button>
              <button type="button" className="action-button action-button-danger" disabled={busy} onClick={async event => {
                const dialog = event.currentTarget.closest<HTMLDialogElement>("dialog");
                if(await onDeleteSavedDocument(document.document_id) && dialog?.isConnected && dialog.open)dialog.close();
              }}>{busy ? "Borrando…" : "Confirmar borrado"}</button>
            </div>
          </dialog>
        </div>
      )}</div> : <p className="muted saved-documents-empty">Aún no hay documentos con actividades guardadas.</p>}
    </dialog>
    <section className="panel upload-panel">
      {pendingReviews.length > 0 && <details className="pending-reviews">
        <summary>Revisiones pendientes ({pendingReviews.length})</summary>
        {pendingReviews.map(review => {
          const courseActive = activeCourses.some(course => course.id === review.course_id);
          return <div className={`pending-review${docId === review.document_id ? " is-active" : ""}`} key={review.document_id}>
            <div><strong>{review.filename}</strong><small>{courses.find(course => course.id === review.course_id)?.name || "Curso"}{review.proposals.length ? ` · ${review.proposals.length} actividades` : courseActive ? " · selecciona el mismo archivo para analizarlo de nuevo" : " · reactiva el curso para analizarlo de nuevo"}</small></div>
            <div className="pending-review-actions">
              <button type="button" className="action-button" disabled={busy} onClick={() => review.proposals.length ? onResumeReview(review) : courseActive ? selectFileForReview(review) : onCourses()}>
                {review.proposals.length ? docId === review.document_id ? "Ver revisión" : "Retomar revisión" : courseActive ? "Seleccionar archivo" : "Reactivar curso"}
              </button>
              <button type="button" className="upload-file-remove" disabled={busy} aria-label={`Quitar revisión ${review.filename}`} title="Quitar revisión" onClick={() => onDeleteReview(review.document_id)}>
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
              </button>
            </div>
          </div>;
        })}
      </details>}
      <form ref={uploadFormRef} onSubmit={onUpload} className="stack"><fieldset disabled={busy} className="upload-fields">
        <label>Curso para el documento nuevo<select name="course_id" required value={uploadCourse} onChange={event => setUploadCourse(event.target.value)}><option value="">Selecciona un curso</option>{activeCourses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
        {!activeCourses.length && !preview && <p className="upload-help">Para analizar un documento <button type="button" className="text-button" onClick={onCourses}>{courses.length ? "reactiva un curso" : "añade un curso"}</button>.</p>}
        <label className={`upload-zone${draggingFile ? " is-dragging" : ""}`} onDragEnter={dragEnter} onDragOver={event => { event.preventDefault(); if (!busy) event.dataTransfer.dropEffect = "copy"; }} onDragLeave={dragLeave} onDrop={dropFile}>
          <span>{draggingFile ? "Suelta el archivo aquí" : selectedFileName ? "Documento seleccionado" : "Selecciona o arrastra un archivo PDF, DOCX o TXT"}</span>
          <input name="file" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" aria-label="Seleccionar archivo PDF, DOCX o TXT" onChange={event => { setSelectedFileName(event.target.files?.[0]?.name || ""); setUploadFileError(""); }} required />
          {selectedFileName ? <span className="upload-file-card" role="status" aria-atomic="true">
            <FileIcon filename={selectedFileName} />
            <span className="upload-file-details">
              <strong title={selectedFileName}>{selectedFileName}</strong>
            </span>
            <button type="button" className="upload-file-remove" disabled={busy} aria-label="Quitar archivo seleccionado" title="Quitar archivo" onClick={removeSelectedFile}>
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </button>
          </span> : <small>Ningún archivo seleccionado</small>}
          <span className="upload-select-button" aria-hidden="true">{selectedFileName ? "Cambiar archivo" : "Examinar"}</span>
          <small>Texto legible · máximo 15 MB</small>
        </label>
        {uploadFileError && <p className="error" role="alert">{uploadFileError}</p>}
        <button className="primary" disabled={busy || (!preview && !activeCourses.length)}>{busy ? "Analizando documento…" : "Analizar documento"}</button>
      </fieldset></form>
      {proposals.length > 0 && <section ref={reviewRef} className="review" aria-labelledby="review-heading" tabIndex={-1}>
        <div className="section-head"><div><h2 id="review-heading">Revisa las propuestas</h2>{reviewFileName && <p className="review-filename">{reviewFileName}</p>}<p className="muted">Edita o descarta antes de guardar.</p></div></div>
        {proposals.some(proposal => proposal.year_unconfirmed && !proposal.due_date) && <p className="year-warning-summary" role="status"><WarningIcon />Hay actividades con el año sin confirmar. Revisa sus fechas antes de guardarlas.</p>}
        {proposals.some(proposal => !proposal.year_unconfirmed && !proposal.due_date) && <p className="year-warning-summary" role="status"><WarningIcon />Hay actividades sin fecha confirmada. Revisa sus fechas antes de guardarlas.</p>}
        <label className="review-course">Curso de esta revisión<select value={reviewCourseId} disabled={busy} onChange={event => void onChangeReviewCourse(event.target.value)}>{courses.map(course => <option key={course.id} value={course.id} disabled={!course.is_active}>{course.name}{course.is_active ? "" : " (inactivo)"}</option>)}</select></label>
        {proposals.map((proposal, index) => <fieldset className="proposal" key={index} disabled={busy}>
          <p className="proposal-heading">Propuesta {index + 1}</p>
          <input placeholder="Ej. Entrega del proyecto final" aria-label={`Título de la actividad ${index + 1}`} required maxLength={240} value={proposal.title} onChange={event => onEdit(index, "title", event.target.value)} />
          <textarea placeholder="Describe la actividad y lo que debes entregar" aria-label={`Descripción de la actividad ${index + 1}`} maxLength={5000} value={proposal.description} onChange={event => onEdit(index, "description", event.target.value)} />
          {!proposal.due_date && !proposal.year_unconfirmed && <label>Motivo de la fecha sin confirmar<input maxLength={1000} value={proposal.date_warning_reason || ""} onChange={event => onEdit(index, "date_warning_reason", event.target.value)} /></label>}
          {proposal.source_excerpt && <blockquote className="source-excerpt"><small>Fragmento del documento</small><p>{proposal.source_excerpt}</p></blockquote>}
          {proposal.source_excerpt === "" && <p className="review-help source-unverified">Encontramos esta posible actividad, pero no pudimos localizar una cita exacta en el documento. Dejamos la fecha vacía para que revises los datos antes de guardarla.</p>}
          {proposal.year_unconfirmed && !proposal.due_date && <p className="year-warning" role="alert"><strong><WarningIcon />Año sin confirmar</strong><span>El documento indica una fecha, pero no permite identificar el año con seguridad. Elige la fecha completa si la conoces; de lo contrario, esta actividad se guardará sin fecha y pendiente de revisión.</span></p>}
          {!proposal.year_unconfirmed && !proposal.due_date && <p className="year-warning" role="alert"><strong><WarningIcon />Fecha sin confirmar</strong><span>Comprueba el día, el mes y el año antes de guardar. Si no los conoces, la actividad quedará sin fecha y pendiente de revisión.</span></p>}
          <div className="proposal-fields"><label>Tipo de entrega<select value={proposal.activity_type || "otro"} onChange={event => onEdit(index, "activity_type", event.target.value)}>{ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label>Fecha<input type="date" value={proposal.due_date || ""} onChange={event => onEdit(index, "due_date", event.target.value)} /></label><label className="check"><input type="checkbox" disabled={!proposal.due_date} checked={proposal.review_required} onChange={event => onEdit(index, "review_required", String(event.target.checked))} /> Pendiente de revisión</label><button className="remove" onClick={() => setProposals(proposals.filter((_, position) => position !== index))}>Descartar</button></div>
          {proposal.due_date && proposal.due_date < localToday() && <div className="proposal-past-date"><span>Esta fecha ya pasó. ¿Cómo quedó la actividad?</span><label>Estado<select value={proposal.status || "pending"} onChange={event => onEdit(index, "status", event.target.value)}><option value="pending">Vencida</option><option value="completed">Entregada</option></select></label></div>}
        </fieldset>)}
        <p className="review-help"><strong>Pendiente de revisión</strong> conserva un aviso para comprobar la fecha o los datos. No impide guardar. Sin fecha, se marca automáticamente. Si ya verificaste la información y hay una fecha, puedes desmarcarlo.</p>
        {reviewError && <p role="alert" className="error">{reviewError}</p>}
        <button className="primary" disabled={busy || !docId || !proposals.length || !!reviewError} onClick={onConfirm}>Confirmar y guardar {proposals.length} actividades</button>
      </section>}
    </section>
  </>;
}
