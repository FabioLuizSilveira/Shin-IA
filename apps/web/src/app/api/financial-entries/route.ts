import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, description, category, amount_cents, currency, entry_date, notes, organization_id, organizations(id, name), created_at";

const VALID_TYPES = ["expense", "revenue"];

// A simple general ledger the tenant records manually -- distinct from
// `invoices` (accounts-receivable only, charges issued TO a customer
// organization). Real costs (fuel, parts bought outside a
// maintenance_order, rent) and revenue that never goes through an
// invoice (a cash sale) had nowhere to be recorded before this.
//
// Filters (all optional, combinable): type, category (partial match),
// organization_id, entry_date range (from/to), amount range in reais
// (min_amount/max_amount, converted to cents server-side).
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const params = req.nextUrl.searchParams;
  const type = params.get("type");
  const category = params.get("category");
  const organizationId = params.get("organization_id");
  const from = params.get("from");
  const to = params.get("to");
  const minAmount = params.get("min_amount");
  const maxAmount = params.get("max_amount");

  let query = scope.db
    .from("financial_entries")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null);
  if (type === "expense" || type === "revenue") query = query.eq("type", type);
  if (category?.trim()) {
    // Model/user-supplied text -- strip characters with special meaning
    // in a PostgREST filter string before interpolating, same discipline
    // as list_assets.ts's own query sanitization.
    const safe = category
      .trim()
      .replace(/[,().]/g, " ")
      .trim();
    if (safe) query = query.ilike("category", `%${safe}%`);
  }
  if (organizationId) query = query.eq("organization_id", organizationId);
  if (from) query = query.gte("entry_date", from);
  if (to) query = query.lte("entry_date", to);
  if (minAmount && !Number.isNaN(Number(minAmount))) {
    query = query.gte("amount_cents", Math.round(Number(minAmount) * 100));
  }
  if (maxAmount && !Number.isNaN(Number(maxAmount))) {
    query = query.lte("amount_cents", Math.round(Number(maxAmount) * 100));
  }

  const { data, error } = await query.order("entry_date", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface CreateEntryBody {
  type?: string;
  description?: string;
  category?: string;
  amount?: number;
  currency?: string;
  entry_date?: string;
  notes?: string;
  organization_id?: string;
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateEntryBody | null;
  if (!body?.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  if (!body.amount || !(body.amount > 0)) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  // Never trust a client-supplied id without re-validating it belongs to
  // this same tenant -- same IDOR discipline as every other mutation in
  // this app (e.g. create-rental.ts's own organization check).
  let organizationId: string | null = null;
  if (body.organization_id) {
    const { data: org } = await scope.db
      .from("organizations")
      .select("id")
      .eq("id", body.organization_id)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!org)
      return NextResponse.json(
        { error: "organization_id not found for this tenant" },
        { status: 400 },
      );
    organizationId = org.id as string;
  }

  const amountCents = Math.round(body.amount * 100);
  const { data: created, error } = await scope.db
    .from("financial_entries")
    .insert({
      tenant_id: scope.tenantId,
      type: body.type,
      description: body.description.trim(),
      category: body.category?.trim() || null,
      amount_cents: amountCents,
      currency: body.currency?.trim() || "BRL",
      entry_date: body.entry_date || new Date().toISOString().slice(0, 10),
      notes: body.notes?.trim() || null,
      organization_id: organizationId,
      created_by: scope.userId,
    })
    .select(SELECT)
    .single();
  if (error || !created) return internalError(error ?? new Error("insert failed"));

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "financial_entry",
    entityId: created.id as string,
    action: "created",
    metadata: { type: body.type, amount_cents: amountCents },
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
