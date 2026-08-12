import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const SELECT = "id, sender_role, body, created_at, read_by_tenant_at, read_by_platform_at";

// Tenant<->platform support thread (see 20260071000000_support_messages_and_auto_notify.sql).
// One thread per tenant — not per-topic/ticket, matches the scale of a
// small operator team talking to Shinã support.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("support_messages")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { body?: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 422 });
  }

  const now = new Date().toISOString();
  const { data, error } = await scope.db
    .from("support_messages")
    .insert({
      tenant_id: scope.tenantId,
      sender_role: "tenant",
      sender_user_id: scope.userId,
      body: body.body.trim(),
      read_by_tenant_at: now,
      read_by_platform_at: null,
    })
    .select(SELECT)
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data }, { status: 201 });
}

// Marks every platform->tenant message as read — called when the tenant
// opens the support thread.
export async function PATCH() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { error } = await scope.db
    .from("support_messages")
    .update({ read_by_tenant_at: new Date().toISOString() })
    .eq("tenant_id", scope.tenantId)
    .eq("sender_role", "platform")
    .is("read_by_tenant_at", null);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
