import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "year and month (1-12) are required" }, { status: 422 });
  }

  const rangeStart = new Date(year, month - 1, 1).toISOString();
  const rangeEnd = new Date(year, month, 1).toISOString();

  const { data, error } = await scope.db
    .from("operations")
    .select(
      "id, type, status, scheduled_starts_at, scheduled_ends_at, resources(name), assets(name)",
    )
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .gte("scheduled_starts_at", rangeStart)
    .lt("scheduled_starts_at", rangeEnd)
    .order("scheduled_starts_at", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({ data });
}
