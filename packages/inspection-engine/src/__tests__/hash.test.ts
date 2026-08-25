import { describe, it, expect } from "vitest";
import { hashContent } from "../hash.js";

describe("hashContent", () => {
  it("produces a stable 64-char hex SHA-256 digest", async () => {
    const hash = await hashContent("test content");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashContent("test content")).toBe(hash);
  });

  it("produces a different hash for different content", async () => {
    expect(await hashContent("a")).not.toBe(await hashContent("b"));
  });
});
