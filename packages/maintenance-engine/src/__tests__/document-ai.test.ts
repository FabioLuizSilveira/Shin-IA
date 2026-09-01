import { describe, it, expect } from "vitest";
import { sanitizeDocumentDraft, computeExtractionCompleteness } from "../document-ai.js";

describe("sanitizeDocumentDraft", () => {
  it("passes through a fully valid draft unchanged", () => {
    const draft = sanitizeDocumentDraft({
      documentDate: "2026-05-14",
      supplierName: "Oficina do João",
      totalAmountCents: 45000,
      description: "Troca de pastilhas de freio",
    });
    expect(draft).toEqual({
      documentDate: "2026-05-14",
      supplierName: "Oficina do João",
      totalAmountCents: 45000,
      description: "Troca de pastilhas de freio",
    });
  });

  it("nulls out a malformed date instead of guessing", () => {
    expect(sanitizeDocumentDraft({ documentDate: "14/05/2026" }).documentDate).toBeNull();
    expect(sanitizeDocumentDraft({ documentDate: "not a date" }).documentDate).toBeNull();
    expect(sanitizeDocumentDraft({ documentDate: 20260514 }).documentDate).toBeNull();
  });

  it("nulls out a negative or non-finite amount", () => {
    expect(sanitizeDocumentDraft({ totalAmountCents: -100 }).totalAmountCents).toBeNull();
    expect(sanitizeDocumentDraft({ totalAmountCents: Infinity }).totalAmountCents).toBeNull();
    expect(sanitizeDocumentDraft({ totalAmountCents: "45000" }).totalAmountCents).toBeNull();
  });

  it("rounds a fractional amount rather than rejecting it", () => {
    expect(sanitizeDocumentDraft({ totalAmountCents: 450.6 }).totalAmountCents).toBe(451);
  });

  it("trims whitespace-only strings down to null", () => {
    expect(sanitizeDocumentDraft({ supplierName: "   " }).supplierName).toBeNull();
    expect(sanitizeDocumentDraft({ description: "" }).description).toBeNull();
  });

  it("drops unknown keys and never lets them leak into the draft shape", () => {
    const draft = sanitizeDocumentDraft({
      documentDate: "2026-05-14",
      maliciousField: "DROP TABLE maintenance_orders",
      __proto__: { polluted: true },
    });
    expect(Object.keys(draft).sort()).toEqual(
      ["description", "documentDate", "supplierName", "totalAmountCents"].sort(),
    );
    expect((draft as unknown as Record<string, unknown>).maliciousField).toBeUndefined();
  });

  it("returns an all-null draft for non-object input (null, array, string, garbage)", () => {
    const allNull = {
      documentDate: null,
      supplierName: null,
      totalAmountCents: null,
      description: null,
    };
    expect(sanitizeDocumentDraft(null)).toEqual(allNull);
    expect(sanitizeDocumentDraft(undefined)).toEqual(allNull);
    expect(sanitizeDocumentDraft("not json")).toEqual(allNull);
    expect(sanitizeDocumentDraft([1, 2, 3])).toEqual(allNull);
  });
});

describe("computeExtractionCompleteness", () => {
  it("is 0 when nothing was extracted", () => {
    expect(
      computeExtractionCompleteness({
        documentDate: null,
        supplierName: null,
        totalAmountCents: null,
        description: null,
      }),
    ).toBe(0);
  });

  it("is 1 when every field was extracted", () => {
    expect(
      computeExtractionCompleteness({
        documentDate: "2026-05-14",
        supplierName: "Oficina",
        totalAmountCents: 1000,
        description: "Serviço",
      }),
    ).toBe(1);
  });

  it("is a fraction proportional to how many fields were found", () => {
    expect(
      computeExtractionCompleteness({
        documentDate: "2026-05-14",
        supplierName: null,
        totalAmountCents: 1000,
        description: null,
      }),
    ).toBe(0.5);
  });
});
