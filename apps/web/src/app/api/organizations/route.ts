import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT =
  "id, name, trade_name, document, type, email, phone, address_city, address_state, address_country, active, created_at";

export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const activeOnly = new URL(req.url).searchParams.get("activeOnly") === "1";

  let query = scope.db
    .from("organizations")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null);
  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query.order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

const VALID_TYPES = ["customer", "supplier", "partner", "internal"];

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const tenantId = scope.tenantId;

  const body = (await req.json()) as {
    name?: string;
    trade_name?: string;
    document?: string;
    type?: string;
    email?: string;
    phone?: string;
    address_city?: string;
    address_state?: string;
  };

  if (
    !body.name?.trim() ||
    !body.document?.trim() ||
    !body.type ||
    !VALID_TYPES.includes(body.type) ||
    !body.address_city?.trim() ||
    !body.address_state?.trim()
  ) {
    return NextResponse.json(
      { error: "name, document, type, address_city and address_state are required" },
      { status: 422 },
    );
  }

  const { data: created, error: insertError } = await scope.db
    .from("organizations")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      name: body.name.trim(),
      trade_name: body.trade_name?.trim() || null,
      document: body.document.trim(),
      type: body.type,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      address_city: body.address_city.trim(),
      address_state: body.address_state.trim(),
    })
    .select(SELECT)
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ data: created }, { status: 201 });
}
