import { NextResponse, type NextRequest } from "next/server";
import { StudioError, type AnyStudioConfig } from "@shina/studio";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { createStudioRuntime, isStudioType } from "@/lib/studio-runtime-factory";

export const dynamic = "force-dynamic";

// Generic route serving all 10 studio types — see
// supabase/migrations/20260058000000_studio.sql for why one implementation
// covers branding/workflow/rule/access_control/dashboard/forms/blueprint/
// integration/notification/commercial.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isStudioType(type))
    return NextResponse.json({ error: "Unknown studio type" }, { status: 404 });

  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const runtime = createStudioRuntime(scope.db);
  const [draft, published] = await Promise.all([
    runtime.getDraft(type, scope.tenantId),
    runtime.getPublished(type, scope.tenantId),
  ]);

  return NextResponse.json({ data: { draft, published } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isStudioType(type))
    return NextResponse.json({ error: "Unknown studio type" }, { status: 404 });

  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { config?: AnyStudioConfig };
  if (!body.config) return NextResponse.json({ error: "config is required" }, { status: 422 });

  const runtime = createStudioRuntime(scope.db);
  try {
    const draft = await runtime.saveDraft(type, scope.tenantId, body.config, scope.userId);
    return NextResponse.json({ data: draft });
  } catch (err) {
    if (err instanceof StudioError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save draft" },
      { status: 500 },
    );
  }
}
