import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const BLOCKING_STATUSES = ["pending", "in_progress"];

// availableFrom/availableUntil (both required together) filter out resources
// with a conflicting operation in that window — same overlap logic as
// lib/resource-availability.ts, used here to let the operation form only
// offer resources that are actually free, instead of failing after submit.
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const availableFrom = req.nextUrl.searchParams.get("availableFrom");
  const availableUntil = req.nextUrl.searchParams.get("availableUntil");

  const { data, error } = await scope.db
    .from("resources")
    .select("id, name, type, status, asset_id, created_at")
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) return internalError(error);

  if (!availableFrom || !availableUntil) {
    return NextResponse.json({ data });
  }

  const { data: conflicting, error: conflictError } = await scope.db
    .from("operations")
    .select("resource_id")
    .eq("tenant_id", scope.tenantId)
    .in("status", BLOCKING_STATUSES)
    .is("deleted_at", null)
    .lt("scheduled_starts_at", availableUntil)
    .gt("scheduled_ends_at", availableFrom);
  if (conflictError) return internalError(conflictError);

  const busyIds = new Set((conflicting ?? []).map((r) => r.resource_id));
  return NextResponse.json({ data: (data ?? []).filter((r) => !busyIds.has(r.id)) });
}

const VALID_TYPES = ["human", "vehicle", "equipment", "virtual"];

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const tenantId = scope.tenantId;

  const body = (await req.json()) as { name?: string; type?: string };
  if (!body.name?.trim() || !body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "name and type are required" }, { status: 422 });
  }

  const { data: branch, error: branchError } = await scope.db
    .from("branches")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (branchError) return internalError(branchError);
  if (!branch) {
    return NextResponse.json(
      { error: "Tenant has no branch to assign this resource to" },
      { status: 422 },
    );
  }

  const { data: created, error: insertError } = await scope.db
    .from("resources")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branch.id,
      name: body.name.trim(),
      type: body.type,
    })
    .select("id, name, type, status, created_at")
    .single();
  if (insertError) return internalError(insertError);

  return NextResponse.json({ data: created }, { status: 201 });
}
