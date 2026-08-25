import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { hashContent } from "@shina/inspection-engine";
import { appUrl } from "@/lib/domain";

export const dynamic = "force-dynamic";

const DEFAULT_TTL_DAYS = 7;

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

// GET/POST /api/inspections/:id/report/shares — secure sharing (item 9 of
// the spec). The token is only ever returned once, at creation — the DB
// stores token_hash, never the token itself (same principle as a
// password hash: a DB dump must not become laudo access). Requires
// tenant.inspections.share, separate from view/approve, so it can be
// granted narrowly.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("inspection_report_shares")
    .select("id, created_at, expires_at, revoked_at, last_accessed_at, access_count")
    .eq("inspection_id", id)
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface CreateShareBody {
  expiresInDays?: number;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.share"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: report, error: reportError } = await scope.db
    .from("inspection_reports")
    .select("id")
    .eq("inspection_id", id)
    .eq("tenant_id", scope.tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportError) return internalError(reportError);
  if (!report) {
    return NextResponse.json({ error: "Gere o laudo antes de compartilhar." }, { status: 422 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateShareBody;
  const ttlDays =
    body.expiresInDays && body.expiresInDays > 0 ? body.expiresInDays : DEFAULT_TTL_DAYS;

  const token = generateToken();
  const tokenHash = await hashContent(token);
  const shareId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await scope.db.from("inspection_report_shares").insert({
    id: shareId,
    tenant_id: scope.tenantId,
    report_id: report.id,
    inspection_id: id,
    token_hash: tokenHash,
    created_by: scope.userId,
    expires_at: expiresAt,
  });
  if (insertError) return internalError(insertError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection",
    entityId: id,
    action: "report_shared",
    metadata: { shareId, expiresAt },
  });

  return NextResponse.json(
    {
      data: {
        id: shareId,
        url: appUrl(`/share/inspection-report/${token}`),
        expiresAt,
      },
    },
    { status: 201 },
  );
}
