export type Proposal = {
  title: string;
  description: string;
  due_date: string | null;
  review_required: boolean;
  source_excerpt?: string;
};

export function validDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function proposalError(proposals: Proposal[]): string {
  if (!proposals.length || proposals.length > 200) return "Confirma entre 1 y 200 actividades.";
  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    const label = `Actividad ${i + 1}: `;
    if (typeof p.title !== "string" || !p.title.trim() || Array.from(p.title.trim()).length > 240)
      return label + "el título debe tener entre 1 y 240 caracteres.";
    if (typeof p.description !== "string" || Array.from(p.description).length > 5000)
      return label + "la descripción debe tener hasta 5000 caracteres.";
    if (p.due_date !== null && (typeof p.due_date !== "string" || !validDate(p.due_date)))
      return label + "ingresa una fecha válida o déjala vacía.";
    if (typeof p.review_required !== "boolean") return label + "indica si necesita revisión.";
  }
  return "";
}

export function parseAnalysis(value: unknown): {document_id: string; proposals: Proposal[]} {
  if (!value || typeof value !== "object") throw Error("El análisis recibido no es válido.");
  const body = value as Record<string, unknown>;
  if (typeof body.document_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.document_id)
      || !Array.isArray(body.proposals) || body.proposals.length > 200)
    throw Error("El análisis recibido no es válido.");
  const proposals = body.proposals.map((item: unknown) => {
    if (!item || typeof item !== "object") throw Error("La IA devolvió una actividad inválida.");
    const p = item as Proposal;
    const problem = proposalError([p]);
    if (problem || (p.source_excerpt !== undefined && typeof p.source_excerpt !== "string"))
      throw Error(problem || "El fragmento de origen no es válido.");
    return {...p, title: p.title.trim(), review_required: p.review_required || p.due_date === null};
  });
  return {document_id: body.document_id, proposals};
}

export function apiError(body: unknown, fallback: string): string {
  const detail = body && typeof body === "object" ? (body as {detail?: unknown}).detail : null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map(item => typeof item?.msg === "string" ? item.msg : "").filter(Boolean);
    if (messages.length) return messages.join(". ");
  }
  return fallback;
}

export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
