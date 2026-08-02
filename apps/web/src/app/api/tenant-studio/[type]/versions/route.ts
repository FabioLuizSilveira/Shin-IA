import { NextResponse, type NextRequest } from "next/server";
import { StudioError } from "@shina/studio";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { createStudioRuntime, isStudioType } from "@/lib/studio-runtime-factory";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isStudioType(type))
    return NextResponse.json({ error: "Unknown studio type" }, { status: 404 });

  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const runtime = createStudioRuntime(scope.db);
  const history = await runtime.getVersionHistory(type, scope.tenantId);
  return NextResponse.json({ data: history });
}

// Reverting publishes a NEW version with the target's config (StudioRuntime's
// own semantics) — history is append-only, nothing is overwritten.
export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isStudioType(type))
    return NextResponse.json({ error: "Unknown studio type" }, { status: 404 });

  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { version_id?: string };
  if (!body.version_id)
    return NextResponse.json({ error: "version_id is required" }, { status: 422 });

  const runtime = createStudioRuntime(scope.db);
  try {
    const reverted = await runtime.revertToVersion(
      type,
      scope.tenantId,
      body.version_id,
      scope.userId,
    );
    return NextResponse.json({ data: reverted }, { status: 201 });
  } catch (err) {
    if (err instanceof StudioError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to revert" },
      { status: 500 },
    );
  }
}
