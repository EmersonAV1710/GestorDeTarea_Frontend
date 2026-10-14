import { useEffect, useId, useRef } from "react";

export function AuthRequiredDialog({ open, onClose, onLogin, onRegister }: {
  open: boolean; onClose: () => void; onLogin: () => void; onRegister: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return <dialog ref={dialogRef} className="logout-dialog auth-required-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
    <h2 id={titleId}>Inicia sesión para continuar</h2>
    <p id={descriptionId}>Esta función está disponible para usuarios con una cuenta. Inicia sesión o crea una cuenta para acceder a todas las herramientas de Tarevia.</p>
    <div className="auth-required-actions">
      <button type="button" className="logout-cancel" onClick={onClose}>Ahora no</button>
      <button type="button" className="action-button" onClick={onRegister}>Crear cuenta</button>
      <button type="button" className="primary" onClick={onLogin}>Iniciar sesión</button>
    </div>
  </dialog>;
}
