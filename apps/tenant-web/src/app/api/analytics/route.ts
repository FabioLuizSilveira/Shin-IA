import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TENANT_ID = process.env.DEMO_TENANT_ID!;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Parallel queries
  const [opsResult, assetsResult, contractsResult] = await Promise.all([
    admin.from("operations").select("status").eq("tenant_id", TENANT_ID).is("deleted_at", null),
    admin
      .from("assets")
      .select("status, category")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null),
    admin
      .from("contracts")
      .select("status, value_amount, value_currency")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null),
  ]);

  const ops = opsResult.data ?? [];
  const assets = assetsResult.data ?? [];
  const contracts = contractsResult.data ?? [];

  // Operations by status
  const opsByStatus = {
    pending: ops.filter((o) => o.status === "pending").length,
    in_progress: ops.filter((o) => o.status === "in_progress").length,
    completed: ops.filter((o) => o.status === "completed").length,
    cancelled: ops.filter((o) => o.status === "cancelled").length,
    failed: ops.filter((o) => o.status === "failed").length,
  };

  // Assets by status
  const assetsByStatus = {
    available: assets.filter((a) => a.status === "available").length,
    in_use: assets.filter((a) => a.status === "in_use").length,
    maintenance: assets.filter((a) => a.status === "maintenance").length,
    decommissioned: assets.filter((a) => a.status === "decommissioned").length,
  };

  // Assets by category
  const assetsByCategory = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1;
    return acc;
  }, {});

  // Contracts revenue
  const activeContracts = contracts.filter((c) => c.status === "active");
  const totalRevenue = activeContracts.reduce((s, c) => s + Number(c.value_amount), 0);
  const avgContractValue = activeContracts.length > 0 ? totalRevenue / activeContracts.length : 0;

  // Contracts by status
  const contractsByStatus = {
    draft: contracts.filter((c) => c.status === "draft").length,
    active: contracts.filter((c) => c.status === "active").length,
    expired: contracts.filter((c) => c.status === "expired").length,
    terminated: contracts.filter((c) => c.status === "terminated").length,
  };

  return NextResponse.json({
    data: {
      operations: {
        total: ops.length,
        byStatus: opsByStatus,
        completionRate: ops.length > 0 ? Math.round((opsByStatus.completed / ops.length) * 100) : 0,
      },
      assets: {
        total: assets.length,
        byStatus: assetsByStatus,
        byCategory: assetsByCategory,
        utilizationRate:
          assets.length > 0 ? Math.round((assetsByStatus.in_use / assets.length) * 100) : 0,
      },
      contracts: {
        total: contracts.length,
        byStatus: contractsByStatus,
        totalRevenue,
        avgContractValue,
        activeCount: activeContracts.length,
      },
    },
  });
}
