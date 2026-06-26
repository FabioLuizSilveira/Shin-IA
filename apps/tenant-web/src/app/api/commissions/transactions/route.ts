import { NextResponse, type NextRequest } from "next/server";
import { withPermission, getTenantContext } from "@/lib/with-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const GET = withPermission("commissions:read", async (req) => {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  const admin = createAdminClient();

  let query = admin
    .from("commission_transactions")
    .select(
      "id, resource_id, gross_revenue, commission_amount, bonus_amount, total_amount, currency, status, period_date, created_at",
    )
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count: data?.length ?? 0 });
}) as (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;
