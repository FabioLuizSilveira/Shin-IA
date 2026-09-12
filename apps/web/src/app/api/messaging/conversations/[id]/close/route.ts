import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { closeConversation } from "@shina/messaging-platform";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Sessão somente leitura" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "messaging.conversation.close"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await closeConversation(scope.db, { tenantId: scope.tenantId, conversationId: id });
    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "messaging_conversation",
      entityId: id,
      action: MESSAGING_AUDIT_EVENTS.CONVERSATION_CLOSED,
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return internalError(err);
  }
}
