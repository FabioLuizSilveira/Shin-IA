import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";

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
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("contracts")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: (data as unknown as { organizations: { name: string } | null }[]).map(flattenOrg),
  });
}

const VALID_TYPES = ["service", "rental", "lease", "subscription", "one_time"];

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const tenantId = scope.tenantId;

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

  const { data: created, error: insertError } = await scope.db
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

  void logActivity(scope.db, {
    tenantId,
    actorId: scope.userId,
    entityType: "contract",
    entityId: created.id,
    action: "created",
    metadata: { type: body.type, organization_id: body.organization_id },
  });
  void createNotification({
    tenantId,
    subject: "Novo contrato criado",
    body: `Um contrato de ${body.type} foi criado.`,
  });

  return NextResponse.json(
    { data: flattenOrg(created as unknown as { organizations: { name: string } | null }) },
    { status: 201 },
  );
}
