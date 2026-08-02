import { NextResponse, type NextRequest } from "next/server";
import { StudioError } from "@shina/studio";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { createStudioRuntime, isStudioType } from "@/lib/studio-runtime-factory";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isStudioType(type))
    return NextResponse.json({ error: "Unknown studio type" }, { status: 404 });

  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { changelog?: string };

  const runtime = createStudioRuntime(scope.db);
  try {
    const version = await runtime.publish(type, scope.tenantId, scope.userId, body.changelog);

    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "studio_config",
      entityId: version.id,
      action: "published",
      metadata: { studio_type: type, version: version.version },
    });

    return NextResponse.json({ data: version }, { status: 201 });
  } catch (err) {
    if (err instanceof StudioError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to publish" },
      { status: 500 },
    );
  }
}
