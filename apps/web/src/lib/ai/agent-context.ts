import { cookies } from "next/headers";
import type { TenantScope } from "@/lib/tenant-context";
import { getEffectiveTenantPermissions } from "@/lib/tenant-context";
import { getEntitlements, listOperationProfiles } from "@shina/commercial-platform";
import { getCreditBalance } from "@shina/ai-gateway";
import { MFA_COOKIE_NAME, verifyMfaCookie } from "@/lib/auth/mfa-cookie";
import { ensureDefaultAgentWorkspace } from "./workspace";

// The Shinã Agent's entire security boundary starts here. Every field is
// derived exclusively from server-resolved state (TenantScope, permission
// tables, entitlements, the credit ledger) — nothing is ever read from a
// request body/query param, and there is no field a tool or the LLM can
// set. tenantId in particular has exactly one legitimate source
// (requireTenantScope()'s TenantScope) and no code path here or in the
// tool registry accepts it as an argument.
export interface AgentContext {
  tenantId: string;
  userId: string;
  tenantRole: string | null;
  permissions: string[];
  entitlements: { active: boolean; features: string[]; planKey: string | null };
  persona: string | null;
  authenticationLevel: "AAL1" | "AAL2";
  currentModule: string | null;
  currentResource: { type: string; id: string } | null;
  aiBudget: { balance: number; currency: "credits" };
  /** WAVE 5 (Multi-Operation Business Architecture v2) — every ACTIVE OperationProfile id this tenant runs (Wave 1), resolved server-side from operation_profiles — never caller/LLM-supplied, same boundary discipline as tenantId. A tool must check a target operation against this list before acting; the LLM never invents an operation that isn't here. */
  availableOperationIds: string[];
  /** The operation the agent was invoked in the context of (e.g. the Trips page), if any — a caller-supplied HINT like currentModule/currentResource, not a security boundary by itself; a tool still validates against availableOperationIds. */
  currentOperationId: string | null;
  /** Internal — the synthetic per-tenant workspace id the AI Gateway ledger
   * uses. Not part of the AgentContext's public/tool-facing surface. */
  workspaceId: string;
}

// tenantRole is the closest existing concept to "persona" — Wave 1 doesn't
// introduce a separate persona table, this just labels the role for the
// system prompt (e.g. "tenant_admin" vs "operator").
function derivePersona(tenantRole: string | null): string | null {
  return tenantRole;
}

async function deriveAuthenticationLevel(userId: string): Promise<"AAL1" | "AAL2"> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MFA_COOKIE_NAME)?.value;
  if (!token) return "AAL1";
  const verified = await verifyMfaCookie(token, userId);
  return verified ? "AAL2" : "AAL1";
}

export async function buildAgentContext(
  scope: TenantScope,
  opts: {
    currentModule?: string | null;
    currentResource?: { type: string; id: string } | null;
    currentOperationId?: string | null;
  } = {},
): Promise<AgentContext> {
  const workspaceId = await ensureDefaultAgentWorkspace(scope.db, scope.tenantId);

  const [permissions, entitlements, balance, authenticationLevel, operationProfiles] =
    await Promise.all([
      getEffectiveTenantPermissions(scope),
      getEntitlements(scope.db, { tenantId: scope.tenantId, product: "platform" }),
      getCreditBalance(scope.db, workspaceId),
      deriveAuthenticationLevel(scope.userId),
      listOperationProfiles(scope.db, scope.tenantId),
    ]);

  const availableOperationIds = operationProfiles
    .filter((p) => p.status === "active")
    .map((p) => p.id);
  // A caller-supplied currentOperationId that isn't actually one of this
  // tenant's active operations is dropped, never trusted as-is — the LLM
  // never invents an Operation (spec section 37).
  const currentOperationId =
    opts.currentOperationId && availableOperationIds.includes(opts.currentOperationId)
      ? opts.currentOperationId
      : null;

  return {
    tenantId: scope.tenantId,
    userId: scope.userId,
    tenantRole: scope.tenantRole,
    permissions,
    entitlements,
    persona: derivePersona(scope.tenantRole),
    authenticationLevel,
    currentModule: opts.currentModule ?? null,
    currentResource: opts.currentResource ?? null,
    aiBudget: { balance, currency: "credits" },
    availableOperationIds,
    currentOperationId,
    workspaceId,
  };
}
