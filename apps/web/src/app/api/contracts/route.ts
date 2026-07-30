import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, organization_id, organizations(name)";

function flattenOrg<T extends { organizations: { name: string } | null }>(
  row: T,
): Omit<T, "organizations"> & { organization_name?: string } {
  const { organizations, ...rest } = row;
  return { ...rest, organization_name: organizations?.name };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("contracts")
    .select(SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: (data as unknown as { organizations: { name: string } | null }[]).map(flattenOrg),
  });
}

const VALID_TYPES = ["service", "rental", "lease", "subscription", "one_time"];

export async function POST(req: NextRequest) {
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

  const body = (await req.json()) as {
    type?: string;
    organization_id?: string;
    value_amount?: number;
    value_currency?: string;
    period_starts_at?: string;
    period_ends_at?: string;
  };

  if (
    !body.type ||
    !VALID_TYPES.includes(body.type) ||
    !body.organization_id ||
    body.value_amount === undefined ||
    !body.period_starts_at ||
    !body.period_ends_at
  ) {
    return NextResponse.json(
      {
        error:
          "type, organization_id, value_amount, period_starts_at and period_ends_at are required",
      },
      { status: 422 },
    );
  }

  if (new Date(body.period_starts_at) >= new Date(body.period_ends_at)) {
    return NextResponse.json(
      { error: "period_starts_at must be before period_ends_at" },
      { status: 422 },
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("contracts")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      organization_id: body.organization_id,
      type: body.type,
      value_amount: body.value_amount,
      value_currency: body.value_currency ?? "BRL",
      period_starts_at: body.period_starts_at,
      period_ends_at: body.period_ends_at,
    })
    .select(SELECT)
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json(
    { data: flattenOrg(created as unknown as { organizations: { name: string } | null }) },
    { status: 201 },
  );
}
