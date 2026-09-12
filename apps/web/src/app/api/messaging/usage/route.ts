import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import { getUsageSummary } from "@shina/messaging-platform";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "messaging.analytics.read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  try {
    return NextResponse.json({ data: await getUsageSummary(scope.db, scope.tenantId, since) });
  } catch (err) {
    return internalError(err);
  }
}
