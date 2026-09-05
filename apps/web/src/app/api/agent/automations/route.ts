import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["daily_summary", "contract_expiry_alert"];

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.automations.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await scope.db
    .from("agent_automations")
    .select(
      "id, name, automation_type, conditions, enabled, last_run_at, last_run_status, created_at",
    )
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface CreateBody {
  name?: string;
  automationType?: string;
  conditions?: Record<string, unknown>;
}

// Created disabled by default — the tenant owner must explicitly flip
// `enabled` via PATCH, matching the spec's "EXPLICITLY ENABLED" wording
// for what's even allowed to run in this wave.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.automations.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.name?.trim() || !body.automationType || !VALID_TYPES.includes(body.automationType)) {
    return NextResponse.json(
      { error: `name and a valid automationType (${VALID_TYPES.join(", ")}) are required` },
      { status: 422 },
    );
  }

  const { data, error } = await scope.db
    .from("agent_automations")
    .insert({
      tenant_id: scope.tenantId,
      owner_user_id: scope.userId,
      name: body.name.trim(),
      automation_type: body.automationType,
      conditions: body.conditions ?? {},
      enabled: false,
    })
    .select("id")
    .single();
  if (error || !data) return internalError(error ?? new Error("insert failed"));

  return NextResponse.json({ data: { id: data.id } }, { status: 201 });
}
