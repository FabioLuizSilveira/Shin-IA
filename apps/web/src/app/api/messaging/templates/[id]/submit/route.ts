import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { submitTemplateForApproval } from "@shina/messaging-platform";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";

export const dynamic = "force-dynamic";

// Flips the LOCAL status to "submitted" only — see template-service.ts's
// own comment: real submission to Meta's template-creation endpoint is not
// implemented yet (payload shape not verified against current docs).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Sessão somente leitura" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "messaging.template.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const template = await submitTemplateForApproval(scope.db, {
      tenantId: scope.tenantId,
      templateId: id,
    });
    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "messaging_template",
      entityId: id,
      action: MESSAGING_AUDIT_EVENTS.TEMPLATE_SUBMITTED,
    });
    return NextResponse.json({ data: template });
  } catch (err) {
    return internalError(err);
  }
}
