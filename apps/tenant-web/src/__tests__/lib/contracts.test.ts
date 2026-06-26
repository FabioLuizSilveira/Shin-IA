import { describe, it, expect } from "vitest";
import {
  isExpired,
  computeRemainingDays,
  computeTotalContractValue,
  filterByStatus,
  sortByEndDate,
} from "../../lib/contracts.js";
import type { Contract } from "../../lib/types.js";

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "c1",
    clientName: "Acme",
    startDate: "2024-01-01",
    endDate: "2099-12-31",
    status: "active",
    totalValue: 5000,
    ...overrides,
  };
}

describe("isExpired", () => {
  it("returns true for past end date", () => {
    expect(isExpired(makeContract({ endDate: "2020-01-01" }))).toBe(true);
  });

  it("returns false for future end date", () => {
    expect(isExpired(makeContract({ endDate: "2099-12-31" }))).toBe(false);
  });
});

describe("computeRemainingDays", () => {
  it("returns 0 for expired contract", () => {
    expect(computeRemainingDays(makeContract({ endDate: "2020-01-01" }))).toBe(0);
  });

  it("returns positive value for future contract", () => {
    expect(computeRemainingDays(makeContract({ endDate: "2099-12-31" }))).toBeGreaterThan(0);
  });
});

describe("computeTotalContractValue", () => {
  it("returns 0 for empty", () => {
    expect(computeTotalContractValue([])).toBe(0);
  });

  it("sums totalValue", () => {
    const contracts = [
      makeContract({ totalValue: 1000 }),
      makeContract({ id: "c2", totalValue: 2000 }),
    ];
    expect(computeTotalContractValue(contracts)).toBe(3000);
  });
});

describe("filterByStatus", () => {
  it("filters active contracts", () => {
    const contracts = [
      makeContract({ status: "active" }),
      makeContract({ id: "c2", status: "expired" }),
    ];
    expect(filterByStatus(contracts, "active")).toHaveLength(1);
  });

  it("returns empty when no match", () => {
    expect(filterByStatus([makeContract()], "draft")).toHaveLength(0);
  });
});

describe("sortByEndDate", () => {
  it("sorts ascending by end date", () => {
    const contracts = [
      makeContract({ id: "c2", endDate: "2030-06-01" }),
      makeContract({ id: "c1", endDate: "2025-01-01" }),
    ];
    const sorted = sortByEndDate(contracts);
    expect(sorted[0]?.id).toBe("c1");
    expect(sorted[1]?.id).toBe("c2");
  });

  it("does not mutate original", () => {
    const contracts = [
      makeContract({ endDate: "2030-01-01" }),
      makeContract({ id: "c2", endDate: "2025-01-01" }),
    ];
    sortByEndDate(contracts);
    expect(contracts[0]?.endDate).toBe("2030-01-01");
  });
});
