import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";
import { createBlueprintRuntime } from "@/lib/blueprint-runtime-factory";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const runtime = createBlueprintRuntime(scope.db);
  const { data, error } = await scope.db
    .from("blueprint_instances")
    .select("*")
    .eq("tenant_id", scope.tenantId)
    .order("installed_at", { ascending: false });
  if (error) return internalError(error);

  const instances = (data ?? []).map((row) => ({
    id: row.id,
    blueprintId: row.blueprint_id,
    blueprintVersion: row.blueprint_version,
    status: row.status,
    installedAt: row.installed_at,
    manifest: (() => {
      try {
        return runtime.getBlueprint(row.blueprint_id);
      } catch {
        return null;
      }
    })(),
  }));

  return NextResponse.json({ data: instances });
}
