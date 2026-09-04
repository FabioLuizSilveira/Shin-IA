import type { AgentContext } from "./agent-context";
import type { TenantScope } from "@/lib/tenant-context";

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

// AgentTool.execute() never receives tenantId as part of `args` — enforced
// at registration time by assertNoTenantIdField() below, not just by
// convention. Every tool call is re-scoped internally via scope.tenantId
// (through requireTenantScope()-derived repositories/queries), matching
// spec section 4: "tenantId não é tool argument". `ctx` carries the
// authorization-relevant metadata (permissions/entitlements/etc — what a
// tool is ALLOWED to do); `scope` carries the actual tenant-scoped db
// client (how a tool queries) — same split maintenance-copilot-tools.ts
// already uses (its tools take the whole TenantScope, not a stripped
// context), kept here rather than smuggling a client inside AgentContext.
export interface AgentTool<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  /** JSON Schema — passed straight through to the model as an
   * Anthropic `input_schema` (see @shina/ai-gateway's AnthropicToolDefinition). */
  inputSchema: Record<string, unknown>;
  /** Tenant permission key required to see/use this tool — checked against
   * AgentContext.permissions. Omit for tools with no permission gate
   * (e.g. help). */
  requiredPermission?: string;
  /** Feature-flag key required to see/use this tool — checked via
   * isFeatureEnabled(). Omit for tools always available once registered. */
  requiredFeature?: string;
  execute(args: TArgs, ctx: AgentContext, scope: TenantScope): Promise<ToolResult>;
}

export function assertNoTenantIdField(tool: AgentTool): void {
  const properties = (tool.inputSchema as { properties?: Record<string, unknown> }).properties;
  if (properties && "tenantId" in properties) {
    throw new Error(
      `AgentTool "${tool.name}": inputSchema declares a "tenantId" field — tenantId must never be a tool argument, it always comes from AgentContext`,
    );
  }
}
