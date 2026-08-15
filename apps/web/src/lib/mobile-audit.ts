import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activity-log";
import type { MobileContext } from "@/lib/mobile-context";

export interface MobileAuditEntry {
  requestId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  result: "allowed" | "denied" | "error";
  metadata?: Record<string, unknown>;
}

// Wave 0.9 — every sensitive mobile action should produce an audit trail.
// Reuses tenant_activity_log via logActivity() (the same mechanism every
// other mutation in this codebase already writes to) rather than inventing
// a parallel mobile-specific log table.
//
// tenant_user and operator contexts always have a real tenant_id to audit
// against. customer contexts can span multiple tenants (rental_customer_
// organizations is N:N), so the caller must say which tenant the action
// concerned (tenantIdOverride) — there's no single "the" tenant to infer.
// unprovisioned contexts have no tenant at all: by construction nothing
// sensitive is reachable for them (see mobile-context.ts), so there is
// nothing tenant-scoped to log here — this is a documented limitation, not
// an oversight, and matches the "não fazer" instruction against inventing
// new infrastructure this wave (no new audit table for the tenant-less
// case).
export async function auditMobileAction(
  db: SupabaseClient,
  context: MobileContext,
  entry: MobileAuditEntry,
  tenantIdOverride?: string,
): Promise<void> {
  const tenantId =
    tenantIdOverride ??
    (context.userType === "tenant_user" || context.userType === "operator"
      ? context.tenantId
      : null);

  if (!tenantId) {
    console.warn("[mobile-audit] no tenant to audit against, skipping tenant_activity_log", {
      userType: context.userType,
      action: entry.action,
      resource: entry.resource,
    });
    return;
  }

  await logActivity(db, {
    tenantId,
    actorId: context.userId,
    entityType: entry.resource,
    entityId: entry.resourceId ?? "unknown",
    action: entry.action,
    metadata: {
      userType: context.userType,
      result: entry.result,
      requestId: entry.requestId,
      ...entry.metadata,
    },
  });
}
