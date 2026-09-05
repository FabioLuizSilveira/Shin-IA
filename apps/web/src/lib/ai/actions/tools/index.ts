import type { AgentMutationTool } from "../types";
import { createMutationToolRegistry } from "../mutation-registry";
import { markNotificationsReadTool } from "./mark-notifications-read";
import { createAssetTool } from "./create-asset";

// MEDIUM_RISK (createMaintenance, generateReport, createContractDraft) and
// HIGH_RISK (sendExternalNotification, requestSignature) are explicitly
// NOT wired this round — only the risk-tier type/plumbing exists
// (ActionRiskLevel, requiresAal2 on AgentMutationTool). Only these two
// LOW_RISK/LOW_RISK_WRITE actions are real, per the scoped decision for
// this pass.
const allMutationTools: AgentMutationTool[] = [markNotificationsReadTool, createAssetTool];

export function buildMutationToolRegistry() {
  return createMutationToolRegistry(allMutationTools);
}
