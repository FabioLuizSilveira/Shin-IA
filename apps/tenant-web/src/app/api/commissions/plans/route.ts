import { NextResponse, type NextRequest } from "next/server";
import { withPermission, getTenantContext } from "@/lib/with-permission";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const GET = withPermission("commissions:read", async (req) => {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("commission_plans")
    .select("id, name, description, calculation_type, base_rate, currency, status, tiers")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});

export const POST = withPermission("commissions:write", async (req) => {
  const ctx = await getTenantContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    description?: string;
    calculationType?: string;
    baseRate?: number;
    currency?: string;
    tiers?: unknown[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || body.baseRate === undefined) {
    return NextResponse.json({ error: "name and baseRate are required" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("commission_plans")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: ctx.tenantId,
      name: body.name,
      description: body.description ?? null,
      calculation_type: body.calculationType ?? "percentage",
      base_rate: body.baseRate,
      currency: body.currency ?? "BRL",
      tiers: body.tiers ?? [],
      status: "draft",
    })
    .select("id, name, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}) as (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;
