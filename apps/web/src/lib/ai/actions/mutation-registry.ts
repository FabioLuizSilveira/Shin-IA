import type { AgentContext } from "../agent-context";
import type { TenantScope } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { AgentMutationTool } from "./types";
import type { OpenAiToolDefinition } from "@shina/ai-gateway";

export interface ProposedPlan {
  id: string;
  toolName: string;
  riskLevel: string;
  summary: string;
  args: Record<string, unknown>;
}

// Mirrors AgentToolRegistry's defense-in-depth shape (permission+flag
// filter → re-checked chokepoint) but for mutations: propose() is the
// only thing the model's tool loop ever calls — it validates, summarizes,
// and persists a pending plan, never touching real data. The actual
// execute() only runs from confirmExecution(), called by the separate
// confirm route after its own fresh permission check.
export class MutationToolRegistry {
  private tools = new Map<string, AgentMutationTool>();

  register(tool: AgentMutationTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`MutationToolRegistry: tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  async listAvailable(scope: TenantScope, ctx: AgentContext): Promise<AgentMutationTool[]> {
    const available: AgentMutationTool[] = [];
    for (const tool of this.tools.values()) {
      if (!ctx.permissions.includes(tool.requiredPermission)) continue;
      if (tool.requiredFeature && !(await isFeatureEnabled(scope, tool.requiredFeature))) continue;
      available.push(tool);
    }
    return available;
  }

  toDefinitions(tools: AgentMutationTool[]): OpenAiToolDefinition[] {
    return tools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
  }

  get(name: string): AgentMutationTool | undefined {
    return this.tools.get(name);
  }

  /** Validates args, builds a summary, and inserts a pending plan row —
   * never mutates real data. Returns an error string (never throws) for
   * an invalid proposal, so the model can see it and ask the user to
   * correct their request instead of a plan silently never appearing. */
  async propose(
    name: string,
    args: Record<string, unknown>,
    ctx: AgentContext,
    scope: TenantScope,
    available: AgentMutationTool[],
  ): Promise<{ ok: true; plan: ProposedPlan } | { ok: false; error: string }> {
    const tool = available.find((t) => t.name === name);
    if (!tool)
      return { ok: false, error: `mutation tool "${name}" is not available in this context` };
    if ("tenantId" in args) return { ok: false, error: "tenantId is not a valid tool argument" };

    const validation = await tool.validate(args, ctx, scope);
    if (!validation.ok) return { ok: false, error: validation.error ?? "invalid arguments" };

    const summary = await tool.summarize(args, ctx, scope);

    const { data, error } = await scope.db
      .from("agent_action_plans")
      .insert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        tool_name: tool.name,
        risk_level: tool.riskLevel,
        requires_aal2: tool.requiresAal2 ?? false,
        args,
        summary,
      })
      .select("id")
      .single();
    if (error || !data)
      return { ok: false, error: error?.message ?? "failed to create action plan" };

    return {
      ok: true,
      plan: {
        id: data.id as string,
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        summary,
        args,
      },
    };
  }
}

export function createMutationToolRegistry(tools: AgentMutationTool[]): MutationToolRegistry {
  const registry = new MutationToolRegistry();
  for (const tool of tools) registry.register(tool);
  return registry;
}
