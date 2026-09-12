import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { getEntitlements } from "@shina/commercial-platform";
import { getConversation, getMessagingChannel, sendOutboundText } from "@shina/messaging-platform";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";
import { createConfiguredMessagingProvider } from "@/lib/messaging-provider-factory";

export const dynamic = "force-dynamic";

interface ReplyBody {
  body?: string;
}

// WAVE 2 — the ONE path a tenant user has to reply in the Inbox. Goes
// straight through sendOutboundText -> MessagingPolicyEngine (spec section
// 13) — this route never talks to the provider directly. A human reply is
// always "operational" purpose (never marketing) since it's a direct,
// one-to-one response to something the contact said.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Sessão somente leitura" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "messaging.conversation.reply"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as ReplyBody | null;
  if (!body?.body?.trim()) {
    return NextResponse.json({ error: "body é obrigatório" }, { status: 422 });
  }

  try {
    const conversation = await getConversation(scope.db, scope.tenantId, id);
    if (!conversation)
      return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
    const channel = await getMessagingChannel(scope.db, {
      tenantId: scope.tenantId,
      channelId: conversation.messagingChannelId,
    });
    if (!channel) return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });

    const entitlements = await getEntitlements(scope.db, {
      tenantId: scope.tenantId,
      product: "platform",
    });

    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "messaging_conversation",
      entityId: conversation.id,
      action: MESSAGING_AUDIT_EVENTS.MESSAGE_SEND_REQUESTED,
    });

    const result = await sendOutboundText(scope.db, createConfiguredMessagingProvider(scope.db), {
      channel,
      conversationId: conversation.id,
      toExternalId: conversation.externalConversationKey ?? "",
      body: body.body.trim(),
      personId: conversation.customerId ?? conversation.contactId,
      purpose: "operational",
      entitlementActive: entitlements.features.includes("messaging_whatsapp"),
      senderUserId: scope.userId,
    });

    if (result.policy.decision === "BLOCK") {
      return NextResponse.json(
        { error: "Envio bloqueado pela política", policy: result.policy },
        { status: 422 },
      );
    }

    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "messaging_conversation",
      entityId: conversation.id,
      action: MESSAGING_AUDIT_EVENTS.MESSAGE_SENT,
      metadata: { messageId: result.messageId },
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    return internalError(err);
  }
}
