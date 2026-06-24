import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/get-tenant-id";

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
    .from("invoices")
    .select("*, billing_accounts!inner(id, cycle, organizations!inner(id, name))")
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
    billing_account_id?: string;
    total_amount?: number;
    total_currency?: string;
    due_date?: string;
    line_items?: Array<{
      description: string;
      quantity: number;
      unit_price_amount: number;
      unit_price_currency: string;
    }>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { billing_account_id, total_amount, total_currency, due_date, line_items } = body;
  if (!billing_account_id || total_amount === undefined || !total_currency || !due_date) {
    return NextResponse.json(
      { error: "billing_account_id, total_amount, total_currency, due_date are required" },
      { status: 400 },
    );
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const invoiceId = crypto.randomUUID();

  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .insert({
      id: invoiceId,
      tenant_id: tenantId,
      billing_account_id,
      total_amount,
      total_currency,
      due_date,
    })
    .select()
    .single();

  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 400 });

  if (line_items && line_items.length > 0) {
    const items = line_items.map((li, idx) => ({
      id: crypto.randomUUID(),
      invoice_id: invoiceId,
      tenant_id: tenantId,
      description: li.description,
      quantity: li.quantity,
      unit_price_amount: li.unit_price_amount,
      unit_price_currency: li.unit_price_currency,
      sort_order: idx,
    }));
    const { error: liError } = await admin.from("invoice_line_items").insert(items);
    if (liError) return NextResponse.json({ error: liError.message }, { status: 400 });
  }

  return NextResponse.json({ data: invoice }, { status: 201 });
}
