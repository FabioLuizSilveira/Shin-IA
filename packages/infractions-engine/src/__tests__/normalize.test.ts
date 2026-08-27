import { describe, it, expect } from "vitest";
import { normalizePlate, normalizeRenavam } from "../normalize.js";

describe("normalizePlate", () => {
  it("strips separators and uppercases", () => {
    expect(normalizePlate("abc-1d23")).toBe("ABC1D23");
    expect(normalizePlate("ABC 1D23")).toBe("ABC1D23");
    expect(normalizePlate("ABC1D23")).toBe("ABC1D23");
  });
});

describe("normalizeRenavam", () => {
  it("strips non-digits", () => {
    expect(normalizeRenavam("123.456.789-00")).toBe("12345678900");
  });
});
