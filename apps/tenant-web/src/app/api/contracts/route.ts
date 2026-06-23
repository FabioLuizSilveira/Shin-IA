import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import { createNotification } from "@/lib/notifications/create-notification";
import type { Contract, ContractType } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("contracts")
    .select(
      `id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, organization_id,
       organizations!inner(name, type)`,
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contracts: Contract[] = (
    data as unknown as Array<{
      id: string;
      type: ContractType;
      status: Contract["status"];
      value_amount: number;
      value_currency: string;
      period_starts_at: string;
      period_ends_at: string;
      organization_id: string;
      organizations: { name: string; type: string };
    }>
  ).map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    value_amount: row.value_amount,
    value_currency: row.value_currency,
    period_starts_at: row.period_starts_at,
    period_ends_at: row.period_ends_at,
    organization_id: row.organization_id,
    organization_name: row.organizations?.name,
  }));

  return NextResponse.json({ data: contracts });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    organization_id?: string;
    type?: ContractType;
    value_amount?: number;
    value_currency?: string;
    period_starts_at?: string;
    period_ends_at?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { organization_id, type, value_amount, value_currency, period_starts_at, period_ends_at } =
    body;
  if (
    !organization_id ||
    !type ||
    value_amount === undefined ||
    !value_currency ||
    !period_starts_at ||
    !period_ends_at
  ) {
    return NextResponse.json(
      {
        error:
          "organization_id, type, value_amount, value_currency, period_starts_at, period_ends_at are required",
      },
      { status: 400 },
    );
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("contracts")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      organization_id,
      type,
      value_amount,
      value_currency,
      period_starts_at,
      period_ends_at,
    })
    .select(
      "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, organization_id",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await createNotification({
    tenantId,
    subject: "Novo contrato cadastrado",
    body: `Contrato do tipo "${type}" no valor de R$ ${Number(value_amount).toLocaleString("pt-BR")} foi criado.`,
    priority: "high",
  });

  return NextResponse.json({ data }, { status: 201 });
}
