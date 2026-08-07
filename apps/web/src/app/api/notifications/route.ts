import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// notifications.status here doubles as delivery status ('pending'/'sent') AND
// read state ('read') — matches the column's existing notification_status
// enum (see supabase/migrations/20260016000000_notifications.sql), not a
// new field. GET returns the whole tenant's broadcast inbox (see
// create-notification.ts for why there's no per-recipient targeting yet).
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("notifications")
    .select("id, subject, body, priority, status, created_at")
    .eq("tenant_id", scope.tenantId)
    .eq("channel", "in_app")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const body = (await req.json()) as { ids?: string[]; all?: boolean };

  let query = scope.db
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("tenant_id", scope.tenantId);

  if (body.all) {
    query = query.neq("status", "read");
  } else if (body.ids && body.ids.length > 0) {
    query = query.in("id", body.ids);
  } else {
    return NextResponse.json({ error: "ids or all is required" }, { status: 422 });
  }

  const { error } = await query;
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
