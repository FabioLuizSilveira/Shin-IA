import { NextResponse } from "next/server";
import { requireTenantScope, isTenantAdmin } from "@/lib/tenant-context";
import { createBlueprintRuntime } from "@/lib/blueprint-runtime-factory";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!isTenantAdmin(scope)) {
    return NextResponse.json(
      { error: "Only tenant owners/admins can uninstall blueprints" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const runtime = createBlueprintRuntime(scope.db);

  try {
    await runtime.uninstall(scope.tenantId, id);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Uninstall failed" },
      { status: 422 },
    );
  }

  await logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "blueprint",
    entityId: id,
    action: "uninstalled",
  });

  return NextResponse.json({ ok: true });
}
