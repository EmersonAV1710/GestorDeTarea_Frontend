import { parseAnalysis, type Proposal } from "./proposals";

export type PendingReview = { document_id: string; course_id: string; filename: string; proposals: Proposal[] };
export type SavedDocument = { document_id: string; course_id: string; filename: string; activity_count: number };

export function parseSavedDocuments(value: unknown): SavedDocument[] {
  if (!Array.isArray(value)) throw Error("No se pudieron recuperar los documentos guardados.");
  return value.map(item => {
    if (!item || typeof item.document_id !== "string" || typeof item.course_id !== "string" ||
        typeof item.filename !== "string" || typeof item.activity_count !== "number" ||
        !Number.isInteger(item.activity_count) || item.activity_count < 1)
      throw Error("El documento guardado recibido no es válido.");
    return { document_id: item.document_id, course_id: item.course_id,
      filename: item.filename, activity_count: item.activity_count };
  });
}

function key(username: string, documentId: string): string {
  return `tarevia-review:${username.toLowerCase()}:${documentId}`;
}

export function parsePendingReviews(value: unknown): PendingReview[] {
  if (!Array.isArray(value)) throw Error("No se pudieron recuperar las revisiones pendientes.");
  return value.map(item => {
    if (!item || typeof item.course_id !== "string" || typeof item.filename !== "string") throw Error("La revisión recibida no es válida.");
    return { ...parseAnalysis(item), course_id: item.course_id, filename: item.filename };
  });
}

export function restoreReviewDraft(review: PendingReview, username: string): PendingReview {
  try {
    const proposals = JSON.parse(sessionStorage.getItem(key(username, review.document_id)) || "null");
    if (Array.isArray(proposals) && proposals.length > 0 && proposals.length <= 200 && proposals.every(p => p &&
      typeof p.title === "string" && typeof p.description === "string" &&
      (p.due_date === null || typeof p.due_date === "string") && typeof p.review_required === "boolean")) {
      const normalized = parseAnalysis({ document_id: review.document_id,
        proposals: proposals.map(proposal => ({ ...proposal, title: proposal.title.trim() || "Borrador" })) }).proposals;
      return { ...review, proposals: normalized.map((proposal, index) => ({ ...proposal, title: proposals[index].title })) };
    }
  } catch {}
  return review;
}

export function storeReviewDraft(review: PendingReview, username: string): void {
  try { sessionStorage.setItem(key(username, review.document_id), JSON.stringify(review.proposals)); } catch {}
}

export function clearReviewDraft(documentId: string, username: string): void {
  try { sessionStorage.removeItem(key(username, documentId)); } catch {}
}
