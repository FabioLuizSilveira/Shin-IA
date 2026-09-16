import type { AgentMutationTool } from "../types";
import { createMutationToolRegistry } from "../mutation-registry";
import { markNotificationsReadTool } from "./mark-notifications-read";
import { createAssetTool } from "./create-asset";
import { createOrganizationTool } from "./create-organization";

// MEDIUM_RISK (createMaintenance, generateReport, createContractDraft) and
// HIGH_RISK (sendExternalNotification, requestSignature) are explicitly
// NOT wired this round — only the risk-tier type/plumbing exists
// (ActionRiskLevel, requiresAal2 on AgentMutationTool). create_organization
// added later, same LOW_RISK_WRITE tier as create_asset — the agent had no
// way to register a client/supplier/partner before this, only assets.
const allMutationTools: AgentMutationTool[] = [
  markNotificationsReadTool,
  createAssetTool,
  createOrganizationTool,
];

export function buildMutationToolRegistry() {
  return createMutationToolRegistry(allMutationTools);
}

// Exported so the read-only registry's list_available_tools (tools/index.ts)
// can report mutation tool names too — without this, a model asking "what
// can I do?" only ever saw the read-only half of its own capabilities and
// concluded actions like create_organization didn't exist, even though
// they were present in the tools schema all along.
export const allMutationToolNames: string[] = allMutationTools.map((t) => t.name);
