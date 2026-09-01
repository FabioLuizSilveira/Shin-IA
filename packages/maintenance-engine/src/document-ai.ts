// Document AI (Etapa 12, P1) — the sanitization/scoring half that can be
// pure and unit-tested; the actual model call lives in a Supabase Edge
// Function (extract-maintenance-document), same split as everywhere else
// in this module (DB/IO stays out of the package).

export interface MaintenanceDocumentDraft {
  documentDate: string | null;
  supplierName: string | null;
  totalAmountCents: number | null;
  description: string | null;
}

const DRAFT_FIELDS = ["documentDate", "supplierName", "totalAmountCents", "description"] as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Anti-hallucination safeguard (Etapa 12's explicit requirement): never
// trust a model's raw JSON response as-is, even when it parses. Strips
// unknown keys, coerces each field to its expected type or null, and
// never invents a value that wasn't literally present in the model's own
// output -- a malformed/wrong-typed field becomes null, not a guess.
export function sanitizeDocumentDraft(raw: unknown): MaintenanceDocumentDraft {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const documentDate =
    typeof obj.documentDate === "string" && ISO_DATE_RE.test(obj.documentDate)
      ? obj.documentDate
      : null;

  const supplierName =
    typeof obj.supplierName === "string" && obj.supplierName.trim().length > 0
      ? obj.supplierName.trim()
      : null;

  const totalAmountCents =
    typeof obj.totalAmountCents === "number" &&
    Number.isFinite(obj.totalAmountCents) &&
    obj.totalAmountCents >= 0
      ? Math.round(obj.totalAmountCents)
      : null;

  const description =
    typeof obj.description === "string" && obj.description.trim().length > 0
      ? obj.description.trim()
      : null;

  return { documentDate, supplierName, totalAmountCents, description };
}

// Deterministic completeness proxy -- deliberately NOT a self-reported
// "confidence" score from the model (those are themselves prone to
// confabulation: a model asked to rate its own certainty will produce a
// plausible-sounding number whether or not it means anything). This is
// just "how many of the extractable fields did the model actually find
// something for", 0-1, computed from data already sanitized above.
export function computeExtractionCompleteness(draft: MaintenanceDocumentDraft): number {
  const filled = DRAFT_FIELDS.filter((f) => draft[f] !== null).length;
  return filled / DRAFT_FIELDS.length;
}
