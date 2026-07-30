import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceDetail } from "@/types/domain";

export const dynamic = "force-dynamic";

const SELECT =
  "id, billing_account_id, status, total_amount, total_currency, due_date, paid_at, created_at, billing_accounts(id, cycle, organizations(id, name))";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const { data: lineItems, error: itemsError } = await supabase
    .from("invoice_line_items")
    .select("id, description, quantity, unit_price_amount, unit_price_currency, sort_order")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const detail: InvoiceDetail = {
    ...(invoice as unknown as InvoiceDetail),
    invoice_line_items: lineItems ?? [],
  };
  return NextResponse.json({ data: detail });
}

// Manual transitions — for payments settled outside Stripe (bank transfer,
// boleto, etc). The Stripe webhook drives issued/overdue -> paid separately
// when a checkout session actually completes.
const MANUAL_TRANSITIONS: Record<string, string[]> = {
  draft: ["issued", "cancelled"],
  issued: ["paid", "overdue", "cancelled"],
  overdue: ["paid", "cancelled"],
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { status?: string };
  if (!body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const { data: current, error: fetchError } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const allowed = MANUAL_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `cannot transition from ${current.status} to ${body.status}` },
      { status: 422 },
    );
  }

  const update: Record<string, unknown> = {
    status: body.status,
    updated_at: new Date().toISOString(),
  };
  if (body.status === "paid") update.paid_at = new Date().toISOString();

  const { error: updateError } = await supabase.from("invoices").update(update).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ data: { ok: true } });
}
