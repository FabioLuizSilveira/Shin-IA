import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InsightType = "executive_summary" | "anomalies" | "optimization" | "demand_forecast";

interface InsightRequestBody {
  type: InsightType;
}

export async function POST(request: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const supabase = scope.db;
  const tenantId = scope.tenantId;

  let body: InsightRequestBody;
  try {
    body = (await request.json()) as InsightRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.type) {
    return NextResponse.json({ error: "type is required" }, { status: 422 });
  }

  const [opsRes, assetsRes, contractsRes, tenantRes] = await Promise.all([
    supabase
      .from("operations")
      .select("status")
      .eq("tenant_id", tenantId)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("assets").select("status").eq("tenant_id", tenantId),
    supabase
      .from("contracts")
      .select("status, value_amount, period_ends_at")
      .eq("tenant_id", tenantId),
    supabase.from("tenants").select("name").eq("id", tenantId).single(),
  ]);

  const ops = opsRes.data ?? [];
  const assets = assetsRes.data ?? [];
  const contracts = contractsRes.data ?? [];
  const tenantName = (tenantRes.data?.name as string) ?? "Seu tenant";

  // Compute context
  const now = new Date();
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const context = {
    tenantName,
    operations: {
      total: ops.length,
      completed: ops.filter((o) => o.status === "completed").length,
      failed: ops.filter((o) => o.status === "failed" || o.status === "cancelled").length,
      open: ops.filter((o) => o.status === "pending" || o.status === "in_progress").length,
    },
    assets: {
      total: assets.length,
      available: assets.filter((a) => a.status === "available").length,
      inUse: assets.filter((a) => a.status === "in_use").length,
      maintenance: assets.filter((a) => a.status === "maintenance").length,
    },
    contracts: {
      active: contracts.filter((c) => c.status === "active").length,
      totalValue: contracts
        .filter((c) => c.status === "active")
        .reduce((sum, c) => sum + ((c.value_amount as number) ?? 0), 0),
      expiringSoon: contracts.filter((c) => {
        const end = new Date(c.period_ends_at as string);
        return end > now && end < in30Days;
      }).length,
    },
    period: "month" as const,
  };

  // Call Supabase Edge Function — authenticated with the caller's own
  // session token, not the anon key, so the function can verify a real
  // logged-in user is making the request (see ai-insights/index.ts).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const sessionClient = await createClient();
  const {
    data: { session },
  } = await sessionClient.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const fnRes = await fetch(`${supabaseUrl}/functions/v1/ai-insights`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: body.type, context }),
    });

    const json = (await fnRes.json()) as { insight?: string; error?: string; cached?: boolean };

    if (!fnRes.ok || json.error) {
      return NextResponse.json({ error: json.error ?? "Edge function error" }, { status: 502 });
    }

    return NextResponse.json({ insight: json.insight, cached: json.cached ?? false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
