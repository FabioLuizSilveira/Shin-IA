import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { getMessagingChannel, markChannelConnected } from "@shina/messaging-platform";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";

export const dynamic = "force-dynamic";

interface ConnectManualBody {
  externalBusinessAccountId?: string;
  externalPhoneNumberId?: string;
  externalAccountId?: string | null;
  displayPhoneNumber?: string | null;
  displayName?: string | null;
  accessToken?: string;
}

// WAVE 1 — the INTERIM connection path while Embedded Signup is blocked
// (spec section 38: no registered Meta App exists in this environment).
// A tenant admin obtains the WABA/phone-number IDs + a system-user access
// token directly through Meta Business Suite and pastes them here. The
// access token NEVER appears in the response — it's written straight to
// messaging_channel_credentials (server-side only, no RLS select policy
// at all) and the route only ever returns the canonical MessagingChannel.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Sessão somente leitura" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "messaging.channel.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as ConnectManualBody | null;
  if (!body?.externalBusinessAccountId || !body.externalPhoneNumberId || !body.accessToken) {
    return NextResponse.json(
      { error: "externalBusinessAccountId, externalPhoneNumberId e accessToken são obrigatórios" },
      { status: 422 },
    );
  }

  const existing = await getMessagingChannel(scope.db, { tenantId: scope.tenantId, channelId: id });
  if (!existing) return NextResponse.json({ error: "Canal não encontrado" }, { status: 404 });

  try {
    const connected = await markChannelConnected(
      scope.db,
      id,
      {
        externalBusinessAccountId: body.externalBusinessAccountId,
        externalPhoneNumberId: body.externalPhoneNumberId,
        externalAccountId: body.externalAccountId ?? null,
        displayPhoneNumber: body.displayPhoneNumber ?? null,
        displayName: body.displayName ?? null,
      },
      body.accessToken,
    );
    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "messaging_channel",
      entityId: connected.id,
      action: MESSAGING_AUDIT_EVENTS.WHATSAPP_CHANNEL_CONNECTED,
      metadata: { externalPhoneNumberId: connected.externalPhoneNumberId },
    });
    return NextResponse.json({ data: connected });
  } catch (err) {
    return internalError(err);
  }
}
