import { describe, it, expect } from "vitest";
import { resolveGoalType, computeNextBestAction } from "../../../lib/ai/goal-resolver";

// Agent Runtime v3, Wave 2 ("Workflow Orchestration") — validated
// against Towing and Passenger Transport per explicit user decision
// (real domain services already exist for these two; Rental does not
// yet, see this wave's report). Pure-function tests only here — the
// live end-to-end multi-turn flow is covered by this wave's live
// verification against the real server.

describe("Wave 2 — resolveGoalType", () => {
  const cases: Array<[string, string | null]> = [
    ["mande um guincho para esse cliente", "CREATE_TOWING_REQUEST"],
    ["preciso de um reboque agora", "CREATE_TOWING_REQUEST"],
    ["o carro quebrou, preciso rebocar", "CREATE_TOWING_REQUEST"],
    ["Preciso de um ônibus para 46 pessoas amanhã às 7", "CREATE_TRANSPORT_REQUEST"],
    ["preciso de uma van para o evento", "CREATE_TRANSPORT_REQUEST"],
    ["transporte de passageiros pra sexta", "CREATE_TRANSPORT_REQUEST"],
    ["30 passageiros para o evento de sábado", "CREATE_TRANSPORT_REQUEST"],
    ["qual o clima hoje?", null],
    ["quantos ativos eu tenho?", null],
  ];

  for (const [text, expected] of cases) {
    it(`"${text}" -> ${expected ?? "null"}`, () => {
      expect(resolveGoalType(text)).toBe(expected);
    });
  }
});

describe("Wave 2 — computeNextBestAction", () => {
  it("CREATE_TRANSPORT_REQUEST with nothing known yet asks for the vehicle first (in requirement order)", () => {
    const action = computeNextBestAction("CREATE_TRANSPORT_REQUEST", {});
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") {
      expect(action.missingKey).toBe("vehicleAssetId");
      expect(action.hint).toBeTruthy();
    }
  });

  it("CREATE_TRANSPORT_REQUEST with vehicle known but no dates asks for the start date next", () => {
    const action = computeNextBestAction("CREATE_TRANSPORT_REQUEST", {
      vehicleAssetId: "asset-1",
    });
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") expect(action.missingKey).toBe("scheduledStartsAt");
  });

  it("CREATE_TRANSPORT_REQUEST with all REQUIRED fields known -> EXECUTE, even without the optional passengerCount", () => {
    const action = computeNextBestAction("CREATE_TRANSPORT_REQUEST", {
      vehicleAssetId: "asset-1",
      scheduledStartsAt: "2026-09-18T10:00:00Z",
      scheduledEndsAt: "2026-09-18T18:00:00Z",
    });
    expect(action).toEqual({ action: "EXECUTE", toolName: "create_transport_request" });
  });

  it("CREATE_TOWING_REQUEST with all required fields known -> EXECUTE", () => {
    const action = computeNextBestAction("CREATE_TOWING_REQUEST", {
      towTruckAssetId: "asset-2",
      scheduledStartsAt: "2026-09-18T10:00:00Z",
      scheduledEndsAt: "2026-09-18T12:00:00Z",
    });
    expect(action).toEqual({ action: "EXECUTE", toolName: "create_towing_request" });
  });

  it("a previously-known field is never re-requested even if a later required field is still missing (never ask twice, applied to slots)", () => {
    const action = computeNextBestAction("CREATE_TOWING_REQUEST", {
      towTruckAssetId: "asset-2",
      // scheduledStartsAt still missing
    });
    expect(action.action).toBe("ASK_USER");
    if (action.action === "ASK_USER") {
      expect(action.missingKey).toBe("scheduledStartsAt");
      expect(action.missingKey).not.toBe("towTruckAssetId");
    }
  });
});
