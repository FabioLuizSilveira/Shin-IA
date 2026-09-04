import type { AgentTool } from "../tool-types";
import { createAgentToolRegistry } from "../tool-registry";
import { createHelpTool } from "./help";
import { listAssetsTool } from "./assets";
import { listContractsTool, getContractSignatureStatusTool } from "./contracts";

const allTools: AgentTool[] = [];
allTools.push(createHelpTool(() => allTools.map((t) => t.name)));
allTools.push(listAssetsTool, listContractsTool, getContractSignatureStatusTool);

export function buildAgentToolRegistry() {
  return createAgentToolRegistry(allTools);
}
