import { describe, expect, it } from "vitest";
import { hashContent } from "./hash.js";

describe("hashContent", () => {
  it("is deterministic for the same content", async () => {
    const a = await hashContent("hello world");
    const b = await hashContent("hello world");
    expect(a).toBe(b);
  });

  it("differs when content changes by even one character", async () => {
    const a = await hashContent("hello world");
    const b = await hashContent("hello world.");
    expect(a).not.toBe(b);
  });

  it("returns a 64-char lowercase hex string (SHA-256)", async () => {
    const hash = await hashContent("VehicleRentalAgreement v1");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
