import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";
import { sanitizePostgrestFilterValue } from "@/lib/postgrest-filter";

export const dynamic = "force-dynamic";

// Backs the ⌘K command menu's search-as-you-type — was calling this exact
// path already, but the route never existed (confirmed 0 results, silently,
// forever). Tenant-scoped, capped at 5 rows per entity so one query never
// pulls a large result set for a UI that only shows a handful anyway.
const LIMIT = 5;

export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({
      data: { operations: [], assets: [], contracts: [], organizations: [] },
    });
  }
  const term = `%${sanitizePostgrestFilterValue(q)}%`;

  const [operationsByResource, operationsByAsset, assets, contracts, organizations] =
    await Promise.all([
      // !inner is not optional here — a plain (default, left-join) embed
      // filters what's INSIDE the nested object/array, not which parent
      // rows come back at all, so .filter("resources.name", ...) alone
      // silently returned every operation regardless of match (confirmed
      // live: searching "onix" returned all 5 unrelated maintenance rows).
      // !inner turns the embed into a real join the top-level filter can
      // restrict on.
      scope.db
        .from("operations")
        .select("id, type, status, scheduled_starts_at, resources!inner(name)")
        .eq("tenant_id", scope.tenantId)
        .is("deleted_at", null)
        .filter("resources.name", "ilike", term)
        .limit(LIMIT),
      scope.db
        .from("operations")
        .select("id, type, status, scheduled_starts_at, assets!inner(name)")
        .eq("tenant_id", scope.tenantId)
        .is("deleted_at", null)
        .filter("assets.name", "ilike", term)
        .limit(LIMIT),
      scope.db
        .from("assets")
        .select("id, name, category, status, serial_number")
        .eq("tenant_id", scope.tenantId)
        .is("deleted_at", null)
        .or(`name.ilike.${term},serial_number.ilike.${term}`)
        .limit(LIMIT),
      scope.db
        .from("contracts")
        .select("id, type, status, value_amount, value_currency, organizations!inner(name)")
        .eq("tenant_id", scope.tenantId)
        .is("deleted_at", null)
        .filter("organizations.name", "ilike", term)
        .limit(LIMIT),
      scope.db
        .from("organizations")
        .select("id, name, type, document, address_city")
        .eq("tenant_id", scope.tenantId)
        .is("deleted_at", null)
        .ilike("name", term)
        .limit(LIMIT),
    ]);

  for (const r of [operationsByResource, operationsByAsset, assets, contracts, organizations]) {
    if (r.error) return internalError(r.error);
  }

  const seen = new Set<string>();
  const operations = [...(operationsByResource.data ?? []), ...(operationsByAsset.data ?? [])]
    .filter((op) => (seen.has(op.id) ? false : (seen.add(op.id), true)))
    .slice(0, LIMIT)
    .map((op) => ({
      id: op.id,
      type: op.type,
      status: op.status,
      scheduled_starts_at: op.scheduled_starts_at,
      resources: (op as { resources?: { name: string } | null }).resources ?? null,
    }));

  return NextResponse.json({
    data: {
      operations,
      assets: assets.data ?? [],
      contracts: (contracts.data ?? []).map((c) => ({ ...c, organizations: c.organizations })),
      organizations: organizations.data ?? [],
    },
  });
}
