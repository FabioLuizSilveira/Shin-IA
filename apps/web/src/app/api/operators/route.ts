import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const SELECT = "id, full_name, document, phone, email, certifications, status, created_at";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("operators")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
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
    certifications?: unknown[];
  };
  if (!body.full_name?.trim()) {
    return NextResponse.json({ error: "full_name is required" }, { status: 422 });
  }

  const { data: created, error } = await scope.db
    .from("operators")
    .insert({
      tenant_id: scope.tenantId,
      full_name: body.full_name.trim(),
      document: body.document ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      certifications: body.certifications ?? [],
    })
    .select(SELECT)
    .single();
  if (error) return internalError(error);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "operator",
    entityId: created.id,
    action: "created",
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
