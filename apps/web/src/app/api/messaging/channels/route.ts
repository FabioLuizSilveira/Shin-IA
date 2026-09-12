import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getEntitlements } from "@shina/commercial-platform";
import { createMessagingChannel, listMessagingChannels } from "@shina/messaging-platform";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";

export const dynamic = "force-dynamic";

const FLAG = "messaging.whatsapp.enabled";

// WAVE 1 — MessagingChannel management. Real Embedded Signup is blocked
// (no registered Meta App configured — see MetaWhatsAppProvider's own
// comment); this only creates the PENDING channel row. Connecting it to a
// real WABA/phone number happens via
// POST /api/messaging/channels/[id]/connect-manual until Embedded Signup
// is wired.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "messaging.channel.read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const channels = await listMessagingChannels(scope.db, scope.tenantId);
    return NextResponse.json({ data: channels });
  } catch (err) {
    return internalError(err);
  }
}

interface CreateBody {
  branchId?: string | null;
  purpose?: string | null;
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Sessão somente leitura" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "messaging.channel.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isFeatureEnabled(scope, FLAG))) {
    return NextResponse.json(
      { error: "WhatsApp ainda não habilitado para este tenant" },
      { status: 403 },
    );
  }
  const entitlements = await getEntitlements(scope.db, {
    tenantId: scope.tenantId,
    product: "platform",
  });
  if (!entitlements.features.includes("messaging_whatsapp")) {
    return NextResponse.json(
      { error: "Plano atual não inclui mensageria WhatsApp" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  try {
    const channel = await createMessagingChannel(scope.db, {
      tenantId: scope.tenantId,
      branchId: body.branchId ?? null,
      purpose: body.purpose ?? null,
    });
    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "messaging_channel",
      entityId: channel.id,
      action: MESSAGING_AUDIT_EVENTS.WHATSAPP_CONNECTION_STARTED,
    });
    return NextResponse.json({ data: channel }, { status: 201 });
  } catch (err) {
    return internalError(err);
  }
}
