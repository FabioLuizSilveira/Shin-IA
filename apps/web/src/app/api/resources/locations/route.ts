import { NextResponse } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

interface LocationRow {
  resource_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  resources: { name: string; type: string; status: string } | null;
}

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  // No DISTINCT ON via the JS client — pull recent rows ordered newest-first
  // and keep only the first (latest) one seen per resource_id.
  const { data, error } = await scope.db
    .from("resource_locations")
    .select("resource_id, latitude, longitude, recorded_at, resources(name, type, status)")
    .eq("tenant_id", scope.tenantId)
    .order("recorded_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const latest: Array<{
    resource_id: string;
    resource_name: string | null;
    resource_type: string | null;
    resource_status: string | null;
    latitude: number;
    longitude: number;
    recorded_at: string;
  }> = [];

  for (const row of (data ?? []) as unknown as LocationRow[]) {
    if (seen.has(row.resource_id)) continue;
    seen.add(row.resource_id);
    latest.push({
      resource_id: row.resource_id,
      resource_name: row.resources?.name ?? null,
      resource_type: row.resources?.type ?? null,
      resource_status: row.resources?.status ?? null,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      recorded_at: row.recorded_at,
    });
  }

  return NextResponse.json({ data: latest });
}
