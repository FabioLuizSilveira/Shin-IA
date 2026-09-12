import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import {
  getConsentHistory,
  grantConsent,
  revokeConsent,
  type ConsentPurpose,
} from "@shina/messaging-platform";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";

export const dynamic = "force-dynamic";

const VALID_PURPOSES: ConsentPurpose[] = ["operational", "transactional", "support", "marketing"];

export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "messaging.conversation.read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const personId = req.nextUrl.searchParams.get("personId");
  if (!personId) return NextResponse.json({ error: "personId é obrigatório" }, { status: 422 });
  try {
    return NextResponse.json({ data: await getConsentHistory(scope.db, scope.tenantId, personId) });
  } catch (err) {
    return internalError(err);
  }
}

interface ConsentBody {
  action?: "grant" | "revoke";
  personId?: string;
  purpose?: ConsentPurpose;
  source?: string;
}

// LGPD (spec section 14): grant/revoke never infer across purposes — each
// write is its own row, nothing is ever overwritten in place, and every
// change is audited (CONSENT_GRANTED/CONSENT_REVOKED).
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Sessão somente leitura" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "messaging.conversation.reply"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as ConsentBody | null;
  if (!body?.personId || !body.purpose || !VALID_PURPOSES.includes(body.purpose) || !body.source) {
    return NextResponse.json(
      { error: `personId, purpose (${VALID_PURPOSES.join("|")}) e source são obrigatórios` },
      { status: 422 },
    );
  }

  try {
    const record =
      body.action === "revoke"
        ? await revokeConsent(scope.db, {
            tenantId: scope.tenantId,
            personId: body.personId,
            purpose: body.purpose,
            source: body.source,
          })
        : await grantConsent(scope.db, {
            tenantId: scope.tenantId,
            personId: body.personId,
            purpose: body.purpose,
            source: body.source,
          });

    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "communication_consent",
      entityId: record.id,
      action:
        body.action === "revoke"
          ? MESSAGING_AUDIT_EVENTS.CONSENT_REVOKED
          : MESSAGING_AUDIT_EVENTS.CONSENT_GRANTED,
      metadata: { personId: body.personId, purpose: body.purpose },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    return internalError(err);
  }
}
