import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import type { BillingCycle } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("billing_accounts")
    .select("*, organizations(id, name, type)")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    organization_id?: string;
    cycle?: BillingCycle;
    credit_limit_amount?: number;
    credit_limit_currency?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { organization_id, cycle, credit_limit_amount, credit_limit_currency } = body;
  if (!organization_id || !cycle || credit_limit_amount === undefined || !credit_limit_currency) {
    return NextResponse.json(
      { error: "organization_id, cycle, credit_limit_amount, credit_limit_currency are required" },
      { status: 400 },
    );
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("billing_accounts")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      organization_id,
      cycle,
      credit_limit_amount,
      credit_limit_currency,
      balance_amount: 0,
      balance_currency: credit_limit_currency,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
