import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, description, category, amount_cents, currency, entry_date, notes, created_at";

const VALID_TYPES = ["expense", "revenue"];

// A simple general ledger the tenant records manually -- distinct from
// `invoices` (accounts-receivable only, charges issued TO a customer
// organization). Real costs (fuel, parts bought outside a
// maintenance_order, rent) and revenue that never goes through an
// invoice (a cash sale) had nowhere to be recorded before this.
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const type = req.nextUrl.searchParams.get("type");
  let query = scope.db
    .from("financial_entries")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null);
  if (type === "expense" || type === "revenue") query = query.eq("type", type);

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
