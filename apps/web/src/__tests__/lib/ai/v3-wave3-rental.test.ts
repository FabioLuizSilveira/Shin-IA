import { describe, it, expect } from "vitest";
import {
  resolveGoalType,
  computeNextBestAction,
  resolveOfferedSelection,
} from "../../../lib/ai/goal-resolver";

// Agent Runtime v3, Wave 3 ("Rental Reference Flow") — wires the real
// Rental domain (Wave 2.5's rental-service.ts) into the Goal Resolver +
// Workflow Orchestrator, plus the new offered-option selection mechanism
// needed for the canonical "O Mobi" step. Pure-function tests only —
// the live end-to-end multi-turn flow is covered by this wave's live
// verification against the real server.

describe("Wave 3 — resolveGoalType (rental)", () => {
  const cases: Array<[string, string | null]> = [
    ["preciso alugar um carro para o Eduardo", "CREATE_RENTAL"],
    ["quero fazer uma locação de veículo", "CREATE_RENTAL"],
    ["pode locar um veículo para esse cliente?", "CREATE_RENTAL"],
    ["quanto custa alugar esse carro por uma semana?", "CREATE_RENTAL"],
    ["qual o clima hoje?", null],
  ];

  for (const [text, expected] of cases) {
    it(`"${text}" -> ${expected ?? "null"}`, () => {
      expect(resolveGoalType(text)).toBe(expected);
    });
  }
});

describe("Wave 3 — computeNextBestAction (CREATE_RENTAL)", () => {
  it("with nothing known yet asks for the customer first (in requirement order)", () => {
    const action = computeNextBestAction("CREATE_RENTAL", {});
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") expect(action.missingKey).toBe("customerOrganizationId");
  });

  it("with customer known but no asset asks for the vehicle next, forcing list_assets", () => {
    const action = computeNextBestAction("CREATE_RENTAL", {
      customerOrganizationId: "org-1",
    });
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") {
      expect(action.missingKey).toBe("assetId");
      expect(action.searchTool).toBe("list_assets");
    }
  });

  it("with customer + asset known but no dates asks for the pickup date next", () => {
    const action = computeNextBestAction("CREATE_RENTAL", {
      customerOrganizationId: "org-1",
      assetId: "asset-1",
    });
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") expect(action.missingKey).toBe("scheduledStartsAt");
  });

  it("with all required fields known -> EXECUTE create_rental", () => {
    const action = computeNextBestAction("CREATE_RENTAL", {
      customerOrganizationId: "org-1",
      assetId: "asset-1",
      scheduledStartsAt: "2026-09-18T09:00:00Z",
      scheduledEndsAt: "2026-09-19T18:00:00Z",
    });
    expect(action).toEqual({ action: "EXECUTE", toolName: "create_rental" });
  });
});

describe("Wave 3 — resolveOfferedSelection (the canonical 'O Mobi' step)", () => {
  const offered = [
    { id: "asset-1", name: "Fiat Mobi" },
    { id: "asset-2", name: "Chevrolet Onix" },
    { id: "asset-3", name: "Chevrolet Onix Plus" },
  ];

  it("resolves an unambiguous name match", () => {
    expect(resolveOfferedSelection("o Fiat Mobi mesmo", offered)).toEqual({
      status: "RESOLVED",
      id: "asset-1",
    });
  });

  it("is case-insensitive", () => {
    expect(resolveOfferedSelection("FIAT MOBI", offered)).toEqual({
      status: "RESOLVED",
      id: "asset-1",
    });
  });

  it("returns AMBIGUOUS when the text matches more than one offered name (e.g. 'Chevrolet Onix Plus' also contains 'Chevrolet Onix') — never guesses", () => {
    const result = resolveOfferedSelection("prefiro o Chevrolet Onix Plus", offered);
    expect(result.status).toBe("AMBIGUOUS");
    if (result.status === "AMBIGUOUS") {
      expect(result.candidates.map((c) => c.id).sort()).toEqual(["asset-2", "asset-3"]);
    }
  });

  it("resolves a PARTIAL name match — the actual canonical flow's 'O Mobi' step never repeats the full catalog name back", () => {
    expect(resolveOfferedSelection("o Mobi mesmo", offered)).toEqual({
      status: "RESOLVED",
      id: "asset-1",
    });
  });

  it("a partial match against a word shared with another offered option ('Onix' also matches 'Onix Plus') asks, never guesses", () => {
    const result = resolveOfferedSelection("quero o Onix", offered);
    expect(result.status).toBe("AMBIGUOUS");
    if (result.status === "AMBIGUOUS") {
      expect(result.candidates.map((c) => c.id).sort()).toEqual(["asset-2", "asset-3"]);
    }
  });

  it("returns NONE when nothing in the message matches any offered option", () => {
    expect(resolveOfferedSelection("prefiro outro modelo", offered)).toEqual({ status: "NONE" });
  });

  it("returns NONE immediately when there were no offered options at all", () => {
    expect(resolveOfferedSelection("o Mobi", [])).toEqual({ status: "NONE" });
  });
});
