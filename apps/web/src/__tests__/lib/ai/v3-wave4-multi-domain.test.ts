import { describe, it, expect } from "vitest";
import { resolveGoalType, computeNextBestAction } from "../../../lib/ai/goal-resolver";

// Agent Runtime v3, Wave 4 ("Multi-Domain") — applies the same
// goal-orchestration architecture (already proven for Towing/Transport
// in Wave 2 and Rental in Wave 3) to Maintenance and Inspection, now
// that real domain services exist for both (maintenance-service.ts,
// inspection-service.ts, both extracted this wave from their own HTTP
// routes' previously-inline logic). Pure-function tests only — the live
// end-to-end multi-turn flow is covered by this wave's live
// verification against the real server.

describe("Wave 4 — resolveGoalType (maintenance/inspection)", () => {
  const cases: Array<[string, string | null]> = [
    [
      "esse ônibus está fazendo um barulho estranho, abre uma manutenção",
      "CREATE_MAINTENANCE_REQUEST",
    ],
    ["preciso agendar uma manutenção preventiva", "CREATE_MAINTENANCE_REQUEST"],
    ["esse carro precisa de um conserto", "CREATE_MAINTENANCE_REQUEST"],
    ["faça a vistoria desse carro antes de entregar", "CREATE_INSPECTION"],
    ["preciso de uma inspeção nesse veículo", "CREATE_INSPECTION"],
    ["vamos inspecionar o ônibus antes da viagem", "CREATE_INSPECTION"],
    ["qual o clima hoje?", null],
  ];

  for (const [text, expected] of cases) {
    it(`"${text}" -> ${expected ?? "null"}`, () => {
      expect(resolveGoalType(text)).toBe(expected);
    });
  }
});

describe("Wave 4 — computeNextBestAction (CREATE_MAINTENANCE_REQUEST)", () => {
  it("with nothing known yet asks for the asset first, forcing list_assets", () => {
    const action = computeNextBestAction("CREATE_MAINTENANCE_REQUEST", {});
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") {
      expect(action.missingKey).toBe("assetId");
      expect(action.searchTool).toBe("list_assets");
    }
  });

  it("with asset known asks for the maintenance type next", () => {
    const action = computeNextBestAction("CREATE_MAINTENANCE_REQUEST", { assetId: "asset-1" });
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") expect(action.missingKey).toBe("maintenanceType");
  });

  it("with asset + type known asks for the description next", () => {
    const action = computeNextBestAction("CREATE_MAINTENANCE_REQUEST", {
      assetId: "asset-1",
      maintenanceType: "corrective",
    });
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") expect(action.missingKey).toBe("description");
  });

  it("with all required fields known -> EXECUTE, even without the optional scheduledAt", () => {
    const action = computeNextBestAction("CREATE_MAINTENANCE_REQUEST", {
      assetId: "asset-1",
      maintenanceType: "corrective",
      description: "barulho estranho no motor",
    });
    expect(action).toEqual({ action: "EXECUTE", toolName: "create_maintenance_request" });
  });
});

describe("Wave 4 — computeNextBestAction (CREATE_INSPECTION)", () => {
  it("with nothing known yet asks for the asset first, forcing list_assets", () => {
    const action = computeNextBestAction("CREATE_INSPECTION", {});
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") {
      expect(action.missingKey).toBe("assetId");
      expect(action.searchTool).toBe("list_assets");
    }
  });

  it("with asset known asks for the inspection type next", () => {
    const action = computeNextBestAction("CREATE_INSPECTION", { assetId: "asset-1" });
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") expect(action.missingKey).toBe("inspectionType");
  });

  it("with asset + type known asks for the purpose next", () => {
    const action = computeNextBestAction("CREATE_INSPECTION", {
      assetId: "asset-1",
      inspectionType: "check_out",
    });
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") expect(action.missingKey).toBe("purpose");
  });

  it("with all required fields known -> EXECUTE create_inspection", () => {
    const action = computeNextBestAction("CREATE_INSPECTION", {
      assetId: "asset-1",
      inspectionType: "check_out",
      purpose: "check_out",
    });
    expect(action).toEqual({ action: "EXECUTE", toolName: "create_inspection" });
  });
});
