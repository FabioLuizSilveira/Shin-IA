import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface UpcomingOperation {
  id: string;
  type: string;
  status: string;
  scheduled_starts_at: string;
  resource_name: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant associated with this user" }, { status: 403 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const [opsRes, upcomingRes, assetsRes, contractsRes, invoicesRes] = await Promise.all([
    supabase.from("operations").select("status, created_at").eq("tenant_id", tenantId),
    supabase
      .from("operations")
      .select("id, type, status, scheduled_starts_at, resources(name)")
      .eq("tenant_id", tenantId)
      .gte("scheduled_starts_at", now.toISOString())
      .order("scheduled_starts_at", { ascending: true })
      .limit(5),
    supabase.from("assets").select("status").eq("tenant_id", tenantId),
    supabase
      .from("contracts")
      .select("status, value_amount, period_ends_at")
      .eq("tenant_id", tenantId),
    supabase
      .from("invoices")
      .select("status, total_amount, paid_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
  ]);

  const errors = [opsRes, upcomingRes, assetsRes, contractsRes, invoicesRes]
    .map((r) => r.error)
    .filter(Boolean);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0]?.message }, { status: 500 });
  }

  const ops = opsRes.data ?? [];
  const assets = assetsRes.data ?? [];
  const contracts = contractsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];

  const upcomingOperations: UpcomingOperation[] = (upcomingRes.data ?? []).map((op) => {
    const resource = op.resources as unknown as { name: string } | null;
    return {
      id: op.id,
      type: op.type,
      status: op.status,
      scheduled_starts_at: op.scheduled_starts_at,
      resource_name: resource?.name ?? null,
    };
  });

  const activeOperations = ops.filter((o) => o.status === "in_progress").length;

  const availableAssets = assets.filter((a) => a.status === "available").length;
  const totalAssets = assets.length;

  const activeContracts = contracts.filter((c) => c.status === "active");
  const activeContractsValue = activeContracts.reduce(
    (sum, c) => sum + Number(c.value_amount ?? 0),
    0,
  );
  const contractsExpiringSoon = contracts.filter((c) => {
    if (c.status !== "active") return false;
    const end = new Date(c.period_ends_at as string);
    return end >= now && end.toISOString() < in30Days;
  }).length;

  const outstandingInvoices = invoices
    .filter((i) => i.status === "issued" || i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.total_amount), 0);
  const paidThisMonth = invoices
    .filter((i) => i.status === "paid" && i.paid_at && i.paid_at >= monthStart)
    .reduce((sum, i) => sum + Number(i.total_amount), 0);

  return NextResponse.json({
    data: {
      activeOperations,
      upcomingOperations,
      assets: { available: availableAssets, total: totalAssets },
      contracts: {
        active: activeContracts.length,
        totalValue: activeContractsValue,
        expiringSoon: contractsExpiringSoon,
      },
      invoices: { outstanding: outstandingInvoices, paidThisMonth },
    },
  });
}
