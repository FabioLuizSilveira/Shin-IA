import { describe, it, expect } from "vitest";
import { resolveStructuralOfferedSelection } from "../../../lib/ai/goal-resolver";

// Agent Runtime v3, Wave 5 ("UX + Channels") — spec section 39: a
// rendered chip/card submits the offered option's real id directly,
// never free text re-interpreted by the LLM. resolveStructuralOfferedSelection
// is the server-side half of that contract — it must never trust the
// client's id blindly, only accepting one that's an actual member of
// THIS turn's real offered list (never a stale/forged id from an old
// render). Pure-function tests only — the live end-to-end flow (chip
// tap -> POST with selectedOptionId -> real plan) is covered by this
// wave's live verification against the real server.

describe("Wave 5 — resolveStructuralOfferedSelection", () => {
  const offered = [
    { id: "asset-1", name: "Fiat Mobi" },
    { id: "asset-2", name: "Chevrolet Onix" },
  ];

  it("resolves when the id is a real member of the offered list", () => {
    expect(resolveStructuralOfferedSelection("asset-2", offered)).toEqual({
      status: "RESOLVED",
      id: "asset-2",
    });
  });

  it("never trusts a stale/forged id that isn't in the current offered list", () => {
    expect(resolveStructuralOfferedSelection("asset-99", offered)).toEqual({ status: "NONE" });
  });

  it("returns NONE when there are no offered options at all", () => {
    expect(resolveStructuralOfferedSelection("asset-1", [])).toEqual({ status: "NONE" });
  });

  it("is never ambiguous, unlike the free-text matcher — an exact id match is inherently unique", () => {
    // Two offered options can share a name-token (ambiguous for
    // resolveOfferedSelection's fuzzy text match), but a structural id
    // pick always resolves to exactly the tapped card, never asks again.
    const overlapping = [
      { id: "a", name: "Chevrolet Onix" },
      { id: "b", name: "Chevrolet Onix Plus" },
    ];
    expect(resolveStructuralOfferedSelection("b", overlapping)).toEqual({
      status: "RESOLVED",
      id: "b",
    });
  });
});
