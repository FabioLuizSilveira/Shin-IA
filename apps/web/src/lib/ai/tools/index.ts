import type { AgentTool } from "../tool-types";
import { createAgentToolRegistry } from "../tool-registry";
import { createHelpTool } from "./help";
import {
  listAssetsTool,
  getAssetTool,
  getAssetAvailabilityTool,
  getAssetHistoryTool,
} from "./assets";
import {
  listContractsTool,
  getContractSignatureStatusTool,
  getContractTool,
  getContractsExpiringTool,
  getCustomerContractsTool,
} from "./contracts";
import {
  getMaintenanceDueTool,
  getMaintenanceOrderTool,
  getMaintenanceHistoryTool,
  getMaintenanceCostTool,
} from "./maintenance";
import { getProductHelpTool, getScreenHelpTool, getFeatureExplanationTool } from "./help-content";
import { getDeepLinkTool } from "./deep-link";
import { getInspectionTool, getInspectionFindingsTool } from "./inspections";
import { searchCustomersTool, getCustomerTool } from "./customers";
import { getInfractionsTool } from "./infractions";
import { getResourceLocationTool, getTrackingEventsTool } from "./tracking";
import { getInvoicesTool, getBillingSummaryTool } from "./billing";
import { generateBasicReportTool } from "./reporting";

const allTools: AgentTool[] = [];
allTools.push(createHelpTool(() => allTools.map((t) => t.name)));
allTools.push(listAssetsTool, getAssetTool, getAssetAvailabilityTool, getAssetHistoryTool);
allTools.push(
  listContractsTool,
  getContractSignatureStatusTool,
  getContractTool,
  getContractsExpiringTool,
  getCustomerContractsTool,
);
allTools.push(
  getMaintenanceDueTool,
  getMaintenanceOrderTool,
  getMaintenanceHistoryTool,
  getMaintenanceCostTool,
);
allTools.push(getProductHelpTool, getScreenHelpTool, getFeatureExplanationTool);
allTools.push(getDeepLinkTool);
allTools.push(getInspectionTool, getInspectionFindingsTool);
allTools.push(searchCustomersTool, getCustomerTool);
allTools.push(getInfractionsTool);
allTools.push(getResourceLocationTool, getTrackingEventsTool);
allTools.push(getInvoicesTool, getBillingSummaryTool);
allTools.push(generateBasicReportTool);

export function buildAgentToolRegistry() {
  return createAgentToolRegistry(allTools);
}
