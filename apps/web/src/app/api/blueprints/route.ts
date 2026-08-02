import { NextResponse } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";
import { createBlueprintRuntime } from "@/lib/blueprint-runtime-factory";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const runtime = createBlueprintRuntime(scope.db);
  return NextResponse.json({ data: runtime.listBlueprints() });
}
