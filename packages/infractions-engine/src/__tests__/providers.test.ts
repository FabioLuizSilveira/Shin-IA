import { describe, it, expect } from "vitest";
import {
  ManualInfractionProvider,
  CsvInfractionProvider,
  NullOfficialProvider,
  NullOfficialProviderError,
} from "../providers.js";
import type { ExternalInfraction } from "../types.js";

function makeInfraction(): ExternalInfraction {
  return {
    source: "manual",
    externalId: null,
    autoNumber: "AUTO-1",
    authorityCode: "DETRAN-SP",
    authorityName: null,
    infractionCode: "7455",
    description: null,
    plate: "ABC1D23",
    renavam: null,
    occurredAt: "2026-08-22T14:37:00Z",
    location: null,
    municipality: null,
    state: null,
    amountCents: 13005,
    amountCurrency: "BRL",
    dueDate: null,
    driverIdentificationDeadline: null,
    defenseDeadline: null,
    paymentDeadline: null,
    discountDeadline: null,
    externalStatus: null,
    rawPayload: {},
  };
}

describe("ManualInfractionProvider", () => {
  it("passes the single record through", async () => {
    const provider = new ManualInfractionProvider();
    const result = await provider.fetchInfractions(makeInfraction());
    expect(result).toHaveLength(1);
    expect(provider.capabilities.supportsPull).toBe(false);
  });
});

describe("CsvInfractionProvider", () => {
  it("passes an array of already-mapped records through", async () => {
    const provider = new CsvInfractionProvider();
    const rows = [makeInfraction(), makeInfraction()];
    const result = await provider.fetchInfractions(rows);
    expect(result).toHaveLength(2);
  });
});

describe("NullOfficialProvider", () => {
  it("rejects with an explicit, typed error instead of fabricating data", async () => {
    const provider = new NullOfficialProvider("senatran");
    await expect(provider.fetchInfractions()).rejects.toThrow(NullOfficialProviderError);
    await expect(provider.fetchInfractions()).rejects.toThrow(/senatran/);
  });
});
