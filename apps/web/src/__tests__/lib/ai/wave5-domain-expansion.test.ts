import { describe, it, expect } from "vitest";
import { listAssetsTool, getAssetTool } from "../../../lib/ai/tools/assets";
import { listContractsTool } from "../../../lib/ai/tools/contracts";
import { getMaintenanceDueTool } from "../../../lib/ai/tools/maintenance";
import { getInfractionsTool } from "../../../lib/ai/tools/infractions";
import { getResourceLocationTool } from "../../../lib/ai/tools/tracking";
import { getInvoicesTool } from "../../../lib/ai/tools/billing";
import { generateBasicReportTool } from "../../../lib/ai/tools/reporting";
import { searchTenantKnowledgeTool } from "../../../lib/ai/tools/knowledge";
import { getInspectionTool } from "../../../lib/ai/tools/inspections";
import { getAssetHealthScoreTool } from "../../../lib/ai/tools/intelligence";
import { createAssetTool } from "../../../lib/ai/actions/tools/create-asset";
import { markNotificationsReadTool } from "../../../lib/ai/actions/tools/mark-notifications-read";
import { filterToolsByIntent } from "../../../lib/ai/capability-router";

// Agent Runtime Architecture v2, Wave 5 (spec section 52 — progressive
// domain migration) — annotates every remaining read tool (and the 2
// remaining mutation tools) with real Tool Registry v2 metadata, so the
// Capability Router (Wave 2) can do REAL narrowing for these domains
// instead of falling back to the wide unannotated set — the exact gap
// Wave 4's live test exposed for ASSET.
describe("Wave 5 — domain metadata on previously-unannotated tools", () => {
  it("one representative tool per newly-annotated domain carries real metadata", () => {
    expect(listAssetsTool.domain).toBe("ASSET");
    expect(getAssetTool.domain).toBe("ASSET");
    expect(listContractsTool.domain).toBe("CONTRACT");
    expect(getMaintenanceDueTool.domain).toBe("MAINTENANCE");
    expect(getInfractionsTool.domain).toBe("INFRACTION");
    expect(getResourceLocationTool.domain).toBe("TRACKING");
    expect(getInvoicesTool.domain).toBe("BILLING");
    expect(generateBasicReportTool.domain).toBe("REPORTING");
    expect(searchTenantKnowledgeTool.domain).toBe("KNOWLEDGE");
    expect(getInspectionTool.domain).toBe("INSPECTION");
    expect(getAssetHealthScoreTool.domain).toBe("INTELLIGENCE");
    expect(createAssetTool.domain).toBe("ASSET");
    expect(createAssetTool.intents).toEqual(["CREATE"]);
    expect(markNotificationsReadTool.domain).toBe("NOTIFICATION");
    expect(markNotificationsReadTool.intents).toEqual(["MANAGE"]);
  });
});

describe("Wave 5 — real narrowing for ASSET against real tool metadata (the exact gap Wave 4 caught)", () => {
  it("an ASSET/LIST classification now narrows to the ASSET-domain tools, not the wide unannotated fallback", () => {
    // Mirrors the shape route.ts builds (name + domain + intents from
    // the real, already-IAM-filtered AgentTool/AgentMutationTool
    // objects) without going through the IAM gate itself — that gate is
    // covered by tool-registry.test.ts/mutation-registry.test.ts
    // already; this test isolates the Capability Router's own narrowing
    // decision over real tool metadata.
    const combined = [
      { name: listAssetsTool.name, domain: listAssetsTool.domain, intents: listAssetsTool.intents },
      { name: getAssetTool.name, domain: getAssetTool.domain, intents: getAssetTool.intents },
      {
        name: listContractsTool.name,
        domain: listContractsTool.domain,
        intents: listContractsTool.intents,
      },
      {
        name: getInvoicesTool.name,
        domain: getInvoicesTool.domain,
        intents: getInvoicesTool.intents,
      },
      { name: "list_available_tools" },
    ];

    const result = filterToolsByIntent(
      combined,
      { domain: "ASSET", intent: "LIST", confidence: "HIGH", method: "deterministic" },
      new Set(["list_available_tools"]),
    );

    expect(result.isFallback).toBe(false);
    expect(result.candidatesAfterFilter).toBeLessThan(result.candidatesBeforeFilter);
    const names = result.candidates.map((c) => c.name);
    expect(names).toContain("list_assets");
    // The exact contamination Wave 4's live test implicitly relied on
    // NOT happening once real domains are annotated: an unrelated
    // domain's tool must not leak into an ASSET-narrowed set.
    expect(names).not.toContain("list_contracts");
    expect(names).not.toContain("get_invoices");
  });
});
