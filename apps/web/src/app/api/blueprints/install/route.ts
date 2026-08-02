import { NextRequest, NextResponse } from "next/server";
import { requireTenantScope, isTenantAdmin } from "@/lib/tenant-context";
import { createBlueprintRuntime } from "@/lib/blueprint-runtime-factory";
import { applyBlueprintToAssetTypes } from "@/lib/apply-blueprint-to-asset-types";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!isTenantAdmin(scope)) {
    return NextResponse.json(
      { error: "Only tenant owners/admins can install blueprints" },
      { status: 403 },
    );
  }

  const body = await request.json();
  if (!body.blueprintId) {
    return NextResponse.json({ error: "blueprintId is required" }, { status: 400 });
  }

  const runtime = createBlueprintRuntime(scope.db);

  let manifest;
  try {
    manifest = runtime.getBlueprint(body.blueprintId);
  } catch {
    return NextResponse.json({ error: `Unknown blueprint "${body.blueprintId}"` }, { status: 404 });
  }

  let instance;
  try {
    instance = await runtime.install(
      scope.tenantId,
      body.blueprintId,
      body.config ?? {},
      scope.userId,
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Install failed" },
      { status: 422 },
    );
  }

  await applyBlueprintToAssetTypes(scope.db, scope.tenantId, manifest);
  await logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "blueprint",
    entityId: body.blueprintId,
    action: "installed",
  });

  return NextResponse.json({ data: instance });
}
