import { t } from "../lib/language";
export function Toast({ kind, message, onClose }: { kind: "success" | "error"; message: string; onClose: () => void }) {
  return <div className={`toast toast-${kind}`} role={kind === "error" ? "alert" : "status"}>
    <p>{message}</p><button type="button" onClick={onClose} aria-label={t("Cerrar notificación")} title={t("Cerrar notificación")}>×</button>
  </div>;
}
