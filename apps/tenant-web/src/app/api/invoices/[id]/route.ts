import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import { createNotification } from "@/lib/notifications/create-notification";

export const dynamic = "force-dynamic";

const TRANSITIONS: Record<string, string[]> = {
  draft: ["issued", "cancelled"],
  issued: ["paid", "overdue", "cancelled"],
  overdue: ["paid", "cancelled"],
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("invoices")
    .select(
      "*, invoice_line_items(id, description, quantity, unit_price_amount, unit_price_currency, sort_order), billing_accounts!inner(id, cycle, organizations!inner(id, name))",
    )
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await getTenantId();
  const body = (await req.json()) as { status?: string };
  const admin = createAdminClient();

  if (body.status) {
    const { data: current } = await admin
      .from("invoices")
      .select("status, total_amount")
      .eq("id", params.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const allowed = TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${current.status}' to '${body.status}'` },
        { status: 422 },
      );
    }

    const statusLabels: Record<string, string> = {
      issued: "emitida",
      paid: "paga",
      overdue: "vencida",
      cancelled: "cancelada",
    };
    const priorities: Record<string, "low" | "normal" | "high" | "critical"> = {
      issued: "normal",
      paid: "normal",
      overdue: "high",
      cancelled: "normal",
    };

    await createNotification({
      tenantId,
      subject: `Fatura ${statusLabels[body.status] ?? body.status}`,
      body: `Fatura no valor de R$ ${Number(current.total_amount).toLocaleString("pt-BR")} foi ${statusLabels[body.status] ?? body.status}.`,
      priority: priorities[body.status] ?? "normal",
    });

    if (body.status === "paid") {
      const updatePayload = {
        status: body.status,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("invoices")
        .update(updatePayload)
        .eq("id", params.id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }
  }

  const { data, error } = await admin
    .from("invoices")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { error } = await admin
    .from("invoices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
