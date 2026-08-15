import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { resolveOperationsVisibility } from "@/lib/mobile-operations-scope";
import { hasTenantPermission } from "@/lib/tenant-context";
import { ALLOWED_TRANSITIONS, resolveOperationContractId } from "@/lib/operation-transitions";
import { OperationContractGate } from "@shina/tenant-contract-engine";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, status, scheduled_starts_at, scheduled_ends_at, started_at, completed_at, description, " +
  "resource_id, asset_id, resources(id, name, type, status), assets(id, name, category, status)";

interface OperationDetailRow {
  id: string;
  type: string;
  status: string;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
  started_at: string | null;
  completed_at: string | null;
  description: string | null;
  resource_id: string | null;
  asset_id: string | null;
  resources: { id: string; name: string; type: string; status: string } | null;
  assets: { id: string; name: string; category: string; status: string } | null;
}

// Wave 2 Phase B — allowedActions is always a server-computed *preview*,
// never a decision the mobile app makes: PATCH /api/operations/{id}
// re-validates the exact same state machine, permission, and contract gate
// independently on every mutation attempt (this endpoint's response is
// advisory-only, used to grey out buttons, nothing more).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType === "unprovisioned") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = context.db.from("operations").select(SELECT).eq("id", id).is("deleted_at", null);

  if (context.userType === "tenant_user") {
    query = query.eq("tenant_id", context.tenantId);
  } else {
    const visibility = await resolveOperationsVisibility(context);
    const ids = visibility?.kind === "ids" ? visibility.operationIds : [];
    if (!ids.includes(id)) {
      // Same response whether the row doesn't exist or belongs to someone
      // else — never distinguish "not yours" from "doesn't exist" (IDOR
      // hygiene: don't confirm existence of another tenant/customer's data).
      return NextResponse.json({ error: "Operation not found" }, { status: 404 });
    }
  }

  const { data: rawOperation, error } = await query.maybeSingle();
  if (error) return internalError(error);
  if (!rawOperation) return NextResponse.json({ error: "Operation not found" }, { status: 404 });
  const operation = rawOperation as unknown as OperationDetailRow;

  // Customer/operator identities have no route to mutate an operation
  // (view-only per Wave 2 Phase D) — allowedActions is always empty for
  // them, not because of a permission check but because no mutation
  // capability exists for these userTypes at all.
  let allowedActions: string[] = [];
  let contractGateReasons: string[] = [];

  if (context.userType === "tenant_user") {
    const candidates = ALLOWED_TRANSITIONS[operation.status] ?? [];
    const canWrite = await hasTenantPermission(context, "operations:write");
    if (canWrite) {
      allowedActions = candidates;
      if (candidates.includes("in_progress")) {
        const contractId = await resolveOperationContractId(context.db, id);
        const gate = await OperationContractGate.check(context.db, { contractId });
        if (gate.blocked) {
          allowedActions = allowedActions.filter((a) => a !== "in_progress");
          contractGateReasons = gate.reasons;
        }
      }
    }
  }

  // Tracking summary — last known position only (no history this wave, per
  // the audit's own confirmed gap MOB-003, deliberately not built here).
  let trackingSummary: { latitude: number; longitude: number; recordedAt: string } | null = null;
  if (operation.resource_id) {
    const { data: lastPosition } = await context.db
      .from("resource_locations")
      .select("latitude, longitude, recorded_at")
      .eq("resource_id", operation.resource_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastPosition) {
      trackingSummary = {
        latitude: lastPosition.latitude,
        longitude: lastPosition.longitude,
        recordedAt: lastPosition.recorded_at,
      };
    }
  }

  return NextResponse.json({
    data: {
      ...operation,
      allowedActions,
      contractGate:
        contractGateReasons.length > 0 ? { blocked: true, reasons: contractGateReasons } : null,
      trackingSummary,
    },
  });
}
