import type { AgentTool } from "../tool-types";

// Trivial tool with no domain dependency — good smoke-test tool for the
// registry/gateway pipeline. Lists whatever tools the model can currently
// see (itself included), so the model can explain its own capabilities to
// the user instead of guessing.
export function createHelpTool(
  getAvailableNames: () => string[],
): AgentTool<Record<string, never>> {
  return {
    name: "list_available_tools",
    description:
      "Lista as ferramentas que a Shinã pode usar nesta conversa, para você explicar o que consegue fazer.",
    inputSchema: { type: "object", properties: {} },
    async execute(_args, _ctx, _scope) {
      return { ok: true, data: { tools: getAvailableNames() } };
    },
  };
}
