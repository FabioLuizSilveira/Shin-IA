import type { AgentTool } from "../tool-types";
import { createAgentToolRegistry } from "../tool-registry";
import { createHelpTool } from "./help";
import { listAssetsTool } from "./assets";
import { listContractsTool, getContractSignatureStatusTool } from "./contracts";
import { getProductHelpTool, getScreenHelpTool, getFeatureExplanationTool } from "./help-content";
import { getDeepLinkTool } from "./deep-link";

const allTools: AgentTool[] = [];
allTools.push(createHelpTool(() => allTools.map((t) => t.name)));
allTools.push(listAssetsTool, listContractsTool, getContractSignatureStatusTool);
allTools.push(getProductHelpTool, getScreenHelpTool, getFeatureExplanationTool);
allTools.push(getDeepLinkTool);

export function buildAgentToolRegistry() {
  return createAgentToolRegistry(allTools);
}
