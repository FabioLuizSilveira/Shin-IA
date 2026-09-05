import type { AgentContext } from "../agent-context";
import type { TenantScope } from "@/lib/tenant-context";
import type { ToolResult } from "../tool-types";

export type ActionRiskLevel = "LOW_RISK" | "LOW_RISK_WRITE" | "MEDIUM_RISK" | "HIGH_RISK";

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

// A mutation tool never writes when the model calls it — the agent's tool
// loop calls validate()+summarize() to build a proposal (persisted as an
// agent_action_plans row), and only a separately-authorized confirm
// endpoint ever calls execute(). This is a deliberately different shape
// from the read-only AgentTool (tool-types.ts) rather than a variant of
// it, so a mutation can never accidentally be wired into the read-only
// registry's execute() path, which has no confirmation step at all.
export interface AgentMutationTool<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  riskLevel: ActionRiskLevel;
  /** Tenant permission key required to propose AND to confirm this action
   * — re-checked at both steps, never trusted from the proposal alone. */
  requiredPermission: string;
  requiredFeature?: string;
  /** MEDIUM_RISK/HIGH_RISK plumbing for a future wave — no action wired
   * this round sets this true. When true, the confirm endpoint must see a
   * valid step-up cookie (apps/web/src/lib/auth/require-step-up.ts,
   * already built, never wired to a route before this) before executing. */
  requiresAal2?: boolean;
  /** Checks the args are well-formed and any referenced entity really
   * belongs to this tenant — WITHOUT mutating anything. A failure here
   * means no plan is ever created. */
  validate(args: TArgs, ctx: AgentContext, scope: TenantScope): Promise<ValidationResult>;
  /** Human-readable (pt-BR) description of what this action will do,
   * shown to the user for confirmation before anything happens. */
  summarize(args: TArgs, ctx: AgentContext, scope: TenantScope): Promise<string>;
  /** The real mutation. Only ever invoked by the confirm endpoint. */
  execute(args: TArgs, ctx: AgentContext, scope: TenantScope): Promise<ToolResult>;
}
