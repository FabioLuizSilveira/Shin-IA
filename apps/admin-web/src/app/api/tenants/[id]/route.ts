import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "@/types/domain";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

// GET /api/tenants/[id] — full tenant detail with metrics
export async function GET(_req: Request, { params }: RouteParams) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const admin = createAdminClient();

  // Parallel fetches
  const [tenantRes, branchRes, usersRes, opsRes, contractsRes] = await Promise.all([
    admin
      .from("tenants")
      .select("id, name, slug, plan, status, created_at, metadata")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),

    admin
      .from("branches")
      .select("id, name, code, city, state, is_active")
      .eq("tenant_id", id)
      .limit(20),

    admin
      .from("user_profiles")
      .select("id, full_name, email, status, last_login_at, created_at")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(50),

    admin
      .from("operations")
      .select("id, type, status, scheduled_starts_at")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(30),

    admin
      .from("contracts")
      .select("id, type, status, value_amount, value_currency, period_starts_at, period_ends_at")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (tenantRes.error || !tenantRes.data) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const tenant = tenantRes.data as Tenant & { metadata?: Record<string, unknown> };
  const branches = branchRes.data ?? [];
  const users = usersRes.data ?? [];
  const operations = opsRes.data ?? [];
  const contracts = contractsRes.data ?? [];

  // Compute metrics
  const activeUsers = users.filter((u) => u.status === "active").length;
  const activeContracts = contracts.filter((c) => c.status === "active");
  const totalContractValue = activeContracts.reduce(
    (sum, c) => sum + (c.value_amount as number),
    0,
  );
  const completedOps = operations.filter((o) => o.status === "completed").length;
  const openOps = operations.filter(
    (o) => o.status === "pending" || o.status === "in_progress",
  ).length;

  return NextResponse.json({
    data: {
      tenant,
      metrics: {
        totalUsers: users.length,
        activeUsers,
        totalBranches: branches.length,
        totalContracts: contracts.length,
        activeContractCount: activeContracts.length,
        totalContractValue,
        totalOperations: operations.length,
        completedOperations: completedOps,
        openOperations: openOps,
      },
      branches,
      users,
      operations,
      contracts,
    },
  });
}

// PATCH /api/tenants/[id] — update status (suspend/reactivate) or plan
export async function PATCH(req: Request, { params }: RouteParams) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  let body: { status?: string; plan?: string };
  try {
    body = (await req.json()) as { status?: string; plan?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (body.status) updates.status = body.status;
  if (body.plan) updates.plan = body.plan;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .update(updates)
    .eq("id", id)
    .select("id, name, slug, plan, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data: data as Tenant });
}
