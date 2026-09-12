import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import { getConversation, listMessages } from "@shina/messaging-platform";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "messaging.conversation.read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const conversation = await getConversation(scope.db, scope.tenantId, id);
    if (!conversation)
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    const messages = await listMessages(scope.db, scope.tenantId, id);
    return NextResponse.json({ data: { conversation, messages } });
  } catch (err) {
    return internalError(err);
  }
}
