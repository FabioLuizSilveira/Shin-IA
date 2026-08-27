import { describe, it, expect } from "vitest";
import { buildDedupKey } from "../dedup.js";
import type { ExternalInfraction } from "../types.js";

function makeInfraction(overrides: Partial<ExternalInfraction> = {}): ExternalInfraction {
  return {
    source: "csv_import",
    externalId: null,
    autoNumber: "AUTO-1",
    authorityCode: "DETRAN-SP",
    authorityName: null,
    infractionCode: "7455",
    description: null,
    plate: "abc-1d23",
    renavam: null,
    occurredAt: "2026-08-22T14:37:00Z",
    location: null,
    municipality: null,
    state: null,
    amountCents: null,
    amountCurrency: "BRL",
    dueDate: null,
    driverIdentificationDeadline: null,
    defenseDeadline: null,
    paymentDeadline: null,
    discountDeadline: null,
    externalStatus: null,
    rawPayload: {},
    ...overrides,
  };
}

describe("buildDedupKey", () => {
  it("uses external_id when present", () => {
    const key = buildDedupKey(makeInfraction({ externalId: "ext-123" }));
    expect(key).toEqual({ kind: "external_id", source: "csv_import", externalId: "ext-123" });
  });

  it("falls back to auto_number+plate+occurred_at+authority when no external_id", () => {
    const key = buildDedupKey(makeInfraction());
    expect(key).toEqual({
      kind: "fallback",
      source: "csv_import",
      autoNumber: "AUTO-1",
      plate: "ABC1D23",
      occurredAt: "2026-08-22T14:37:00Z",
      authorityCode: "DETRAN-SP",
    });
  });

  it("fallback key is stable regardless of plate formatting", () => {
    const a = buildDedupKey(makeInfraction({ plate: "ABC-1D23" }));
    const b = buildDedupKey(makeInfraction({ plate: "abc1d23" }));
    expect(a).toEqual(b);
  });
});
