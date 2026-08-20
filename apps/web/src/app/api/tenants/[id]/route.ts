import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeSessionClaims } from "@/lib/jwt-claims";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["active", "trialing", "suspended", "cancelled"];
const VALID_PLANS = ["starter", "professional", "enterprise"];

type PlatformGuard = { ok: true; userId: string } | { ok: false; error: string; status: number };

async function requirePlatform(): Promise<PlatformGuard> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Unauthorized", status: 401 };
  const claims = decodeSessionClaims(session.access_token);
  if (!claims.platform_role) return { ok: false, error: "Forbidden", status: 403 };
  return { ok: true, userId: session.user.id };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatform();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, name, slug, plan, status, created_at, metadata")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (tenantError) return internalError(tenantError);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const [branchesRes, usersRes, operationsRes, contractsRes] = await Promise.all([
    admin
      .from("branches")
      .select("id, name, code, active")
      .eq("tenant_id", id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    admin
      .from("user_profiles")
      .select("id, full_name, email, status, last_login_at, created_at")
      .eq("tenant_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("operations")
      .select("id, type, status, scheduled_starts_at")
      .eq("tenant_id", id)
      .is("deleted_at", null)
      .order("scheduled_starts_at", { ascending: false })
      .limit(10),
    admin
      .from("contracts")
      .select("id, type, status, value_amount, value_currency, period_starts_at, period_ends_at")
      .eq("tenant_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const errors = [branchesRes, usersRes, operationsRes, contractsRes]
    .map((r) => r.error)
    .filter(Boolean);
  if (errors.length > 0) {
    return internalError(errors[0]);
  }

  const branches = branchesRes.data ?? [];
  const users = usersRes.data ?? [];
  const operations = operationsRes.data ?? [];
  const contracts = contractsRes.data ?? [];

  const activeContracts = contracts.filter((c) => c.status === "active");

  const metrics = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.status === "active").length,
    totalBranches: branches.length,
    totalContracts: contracts.length,
    activeContractCount: activeContracts.length,
    totalContractValue: activeContracts.reduce((sum, c) => sum + Number(c.value_amount ?? 0), 0),
    totalOperations: operations.length,
    completedOperations: operations.filter((o) => o.status === "completed").length,
    openOperations: operations.filter((o) => o.status === "pending" || o.status === "in_progress")
      .length,
  };

  return NextResponse.json({
    data: { tenant, metrics, branches, users, operations, contracts },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatform();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json()) as { status?: string; plan?: string };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 422 });
    }
    update.status = body.status;
  }
  if (body.plan !== undefined) {
    if (!VALID_PLANS.includes(body.plan)) {
      return NextResponse.json({ error: "invalid plan" }, { status: 422 });
    }
    update.plan = body.plan;
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "status or plan is required" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("tenants").update(update).eq("id", id);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}

// Soft delete only (deleted_at, same convention already used across this
// schema — assets, branches, user_profiles, operations, contracts all use
// it) — never a hard DELETE FROM tenants, which would cascade-orphan every
// related row (contracts, invoices, operations, user_profiles...) with no
// way back. From the product's perspective this is irreversible (the
// tenant disappears from every list, every user in it loses access, no UI
// path undoes it) even though the row itself survives for support/legal
// recovery. Requires the caller to echo the tenant's own slug back as
// confirmation — the same defense-in-depth the UI's "type the name to
// confirm" modal is built around, checked again server-side so this can
// never fire from a stray/replayed request.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatform();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: tenant, error: fetchError } = await admin
    .from("tenants")
    .select("id, slug, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!tenant || tenant.deleted_at) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { slug?: string };
  if (body.slug !== tenant.slug) {
    return NextResponse.json(
      { error: "Confirmação inválida — o slug informado não corresponde ao tenant" },
      { status: 422 },
    );
  }

  const { error } = await admin
    .from("tenants")
    .update({
      deleted_at: new Date().toISOString(),
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return internalError(error);

  void logActivity(admin, {
    tenantId: id,
    actorId: guard.userId,
    entityType: "tenant",
    entityId: id,
    action: "deleted",
  });

  return NextResponse.json({ data: { ok: true } });
}
