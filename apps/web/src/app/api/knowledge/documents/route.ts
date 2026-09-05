import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { ingestKnowledgeDocument } from "@/lib/ai/knowledge/ingest";

export const dynamic = "force-dynamic";

// API-only for Wave 5's first cut — no upload UI yet (tracked as an open
// gap in the wave report, same "implementation ready, not fully released"
// posture as everything else gated behind a feature flag).
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.knowledge.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await scope.db
    .from("tenant_knowledge_documents")
    .select("id, title, status, trust_level, content_char_count, error, created_at")
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface CreateBody {
  title?: string;
  content?: string;
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.knowledge.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.title?.trim() || !body.content?.trim()) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  try {
    const result = await ingestKnowledgeDocument(scope, {
      title: body.title,
      content: body.content,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return internalError(err);
  }
}
