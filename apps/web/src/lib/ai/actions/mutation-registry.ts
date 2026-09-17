import { createHash } from "node:crypto";
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
  /** Wave 3 -- structured field-by-field breakdown for the confirmation
   * UI, from the tool's describeFields() or the generic fallback below. */
  fields: { label: string; value: string }[];
  /** Wave 3 -- true when propose() found an existing pending plan with
   * the same payload instead of creating a new one. */
  isDuplicate?: boolean;
}

/** Content signature over tool + tenant + canonicalized args, used to
 * detect the same proposal arriving twice across separate requests (a
 * re-pasted screenshot, a client retry) -- deliberately NOT scoped to a
 * single turn loop, that's route.ts's separate seenCalls guard. Key
 * order in `args` must not affect the hash, so keys are sorted first. */
function computePayloadHash(
  toolName: string,
  tenantId: string,
  args: Record<string, unknown>,
): string {
  const sortedArgs = Object.keys(args)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = args[key];
      return acc;
    }, {});
  return createHash("sha256")
    .update(`${toolName}:${tenantId}:${JSON.stringify(sortedArgs)}`)
    .digest("hex");
}

/** Fallback for tools that don't implement describeFields() -- raw
 * key/value pairs from args, skipping empty/undefined values so an
 * unset optional field doesn't show up as a blank row. */
function defaultDescribeFields(args: Record<string, unknown>): { label: string; value: string }[] {
  return Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({
      label: key,
      value: Array.isArray(value) ? value.join(", ") : String(value),
    }));
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
    // Agent Runtime v3, Wave 1 -- optional so every existing caller
    // (tests included) keeps working unchanged; only route.ts passes a
    // real one once a conversationId exists for the request.
    conversationId?: string,
    // Agent Runtime v3, Wave 2 -- links this plan back to the goal whose
    // NextBestAction=EXECUTE proposed it, so the confirm route can mark
    // the goal COMPLETED once the mutation actually succeeds.
    goalId?: string,
  ): Promise<{ ok: true; plan: ProposedPlan } | { ok: false; error: string }> {
    const tool = available.find((t) => t.name === name);
    if (!tool)
      return { ok: false, error: `mutation tool "${name}" is not available in this context` };
    if ("tenantId" in args) return { ok: false, error: "tenantId is not a valid tool argument" };

    const payloadHash = computePayloadHash(tool.name, scope.tenantId, args);

    // Wave 3 duplicate detection -- same check-before-insert shape as
    // packages/ai-gateway/src/gateway.ts's idempotencyKey check. A match
    // returns the EXISTING plan (still ok:true) rather than an error, so
    // the model just relays "already pending" instead of getting stuck.
    const { data: existing } = await scope.db
      .from("agent_action_plans")
      .select("id, tool_name, risk_level, summary, args")
      .eq("tenant_id", scope.tenantId)
      .eq("tool_name", tool.name)
      .eq("payload_hash", payloadHash)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (existing) {
      const existingArgs = existing.args as Record<string, unknown>;
      const fields = tool.describeFields
        ? await tool.describeFields(existingArgs, ctx, scope)
        : defaultDescribeFields(existingArgs);
      return {
        ok: true,
        plan: {
          id: existing.id as string,
          toolName: existing.tool_name as string,
          riskLevel: existing.risk_level as string,
          summary: existing.summary as string,
          args: existingArgs,
          fields,
          isDuplicate: true,
        },
      };
    }

    const validation = await tool.validate(args, ctx, scope);
    if (!validation.ok) return { ok: false, error: validation.error ?? "invalid arguments" };

    const summary = await tool.summarize(args, ctx, scope);
    const fields = tool.describeFields
      ? await tool.describeFields(args, ctx, scope)
      : defaultDescribeFields(args);

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
        payload_hash: payloadHash,
        conversation_id: conversationId ?? null,
        goal_id: goalId ?? null,
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
        fields,
      },
    };
  }
}

export function createMutationToolRegistry(tools: AgentMutationTool[]): MutationToolRegistry {
  const registry = new MutationToolRegistry();
  for (const tool of tools) registry.register(tool);
  return registry;
}
