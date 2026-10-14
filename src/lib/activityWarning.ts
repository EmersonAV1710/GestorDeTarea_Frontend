const legacyYearWarning = /\s*El año no se especifica(?: explícitamente)? en el texto(?:, por lo que la fecha debe revisarse)?\.\s*$/i;

export function separateYearWarning(description: string, yearUnconfirmed = false) {
  const legacy = legacyYearWarning.test(description);
  return {
    description: legacy ? description.replace(legacyYearWarning, "").trim() : description,
    yearUnconfirmed: yearUnconfirmed || legacy,
  };
}

const legacyDateWarning = /(?:^|\s)((?:Fechas? alternativas? entre|La fecha (?:depende|varía)|Las fechas? (?:dependen|varían)|Hay (?:dos|varias) fechas|Fechas? (?:contradictorias?|por confirmar)|La fecha no se (?:especifica|indica))[^.!?]*[.!?]?)\s*$/i;

export function separateDateWarning(description: string, reason = "") {
  const match = description.match(legacyDateWarning);
  return {
    description: match ? description.slice(0, match.index ?? 0).trim() : description,
    reason: reason || match?.[1]?.trim() || "",
  };
}

export function dateWarningReason(description: string, yearUnconfirmed: boolean): string {
  if (yearUnconfirmed) return "El año no se especifica en el texto.";

  const sentences = description.match(/[^.!?]+(?:[.!?]+|$)/g)?.map(sentence => sentence.trim()) || [];
  const uncertainty = /fecha|día|grupo|turno|sección|semana|calendario/i;
  const explanation = /según|depende|alternativ|contradic|distint|diferent|ambigu|posibl|por confirmar|sin confirmar|no se especifica|no se indica|revisar|varía/i;
  const reasons = sentences.filter(sentence => uncertainty.test(sentence) &&
    (explanation.test(sentence) || /\bgrupo\b.*\bgrupo\b/i.test(sentence)));

  return reasons.slice(-2).join(" ") || "No hay una fecha confirmada para esta actividad. Revisa sus datos.";
}
