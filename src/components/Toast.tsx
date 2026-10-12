export function Toast({ kind, message, onClose }: { kind: "success" | "error"; message: string; onClose: () => void }) {
  return <div className={`toast toast-${kind}`} role={kind === "error" ? "alert" : "status"}>
    <p>{message}</p><button type="button" onClick={onClose} aria-label="Cerrar notificación" title="Cerrar notificación">×</button>
  </div>;
}
