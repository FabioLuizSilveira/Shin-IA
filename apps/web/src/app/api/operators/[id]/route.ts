import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    full_name?: string;
    document?: string;
    phone?: string;
    email?: string;
    status?: "active" | "inactive";
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.full_name !== undefined) update.full_name = body.full_name;
  if (body.document !== undefined) update.document = body.document;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.email !== undefined) update.email = body.email;
  if (body.status !== undefined) update.status = body.status;

  const { data, error } = await scope.db
    .from("operators")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .select("id, full_name, document, phone, email, status")
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data });
}
