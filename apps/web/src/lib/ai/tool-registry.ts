import type { AgentContext } from "./agent-context";
import type { TenantScope } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { AgentTool, ToolResult } from "./tool-types";
import { assertNoTenantIdField } from "./tool-types";
import type { OpenAiToolDefinition } from "@shina/ai-gateway";

// Defense-in-depth chokepoint: AgentContext -> Tool Registry ->
// AuthorizationService (permission + feature-flag check here) -> the tool's
// own execute() (which re-scopes by ctx.tenantId against the real
// tenant-scoped repository/query, same discipline as
// maintenance-copilot-tools.ts). No single layer is trusted alone.
export class AgentToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    assertNoTenantIdField(tool);
    if (this.tools.has(tool.name)) {
      throw new Error(`AgentToolRegistry: tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Tools visible to the model for this request — filtered by permission
   * and feature flag. A tool the model was never shown can't be "denied";
   * TOOL_DENIED is reserved for a tool the model somehow still names that
   * isn't in this list (defensive, not expected to trigger). */
  async listAvailable(scope: TenantScope, ctx: AgentContext): Promise<AgentTool[]> {
    const available: AgentTool[] = [];
    for (const tool of this.tools.values()) {
      if (tool.requiredPermission && !ctx.permissions.includes(tool.requiredPermission)) continue;
      if (tool.requiredFeature && !(await isFeatureEnabled(scope, tool.requiredFeature))) continue;
      available.push(tool);
    }
    return available;
  }

  toDefinitions(tools: AgentTool[]): OpenAiToolDefinition[] {
    return tools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
  }

  /** Executes a tool by name against an ALREADY-computed available list
   * (from listAvailable()) — a name outside that list is denied, never
   * looked up in the full registry, so a permission/flag check can't be
   * bypassed by the model naming a tool it was never shown. */
  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: AgentContext,
    scope: TenantScope,
    available: AgentTool[],
  ): Promise<ToolResult> {
    const tool = available.find((t) => t.name === name);
    if (!tool) return { ok: false, error: `tool "${name}" is not available in this context` };
    if ("tenantId" in args) {
      return { ok: false, error: "tenantId is not a valid tool argument" };
    }
    return tool.execute(args, ctx, scope);
  }
}

export function createAgentToolRegistry(tools: AgentTool[]): AgentToolRegistry {
  const registry = new AgentToolRegistry();
  for (const tool of tools) registry.register(tool);
  return registry;
}
