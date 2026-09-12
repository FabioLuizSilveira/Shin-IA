import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getEntitlements } from "@shina/commercial-platform";
import { generateCopilotSuggestion } from "@/lib/ai/messaging-copilot";
import { newCorrelationId } from "@/lib/audit-event";

export const dynamic = "force-dynamic";

// WAVE 4 — COPILOT suggestion (spec section 19). Read-only: never sends,
// never calls a mutation tool. Gated on BOTH agent.enabled (this is the
// Shinã Agent applied to a new channel, not a separate AI feature) and
// messaging.whatsapp.enabled.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "messaging.conversation.reply"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await isFeatureEnabled(scope, "agent.enabled"))) {
    return NextResponse.json(
      { error: "Shinã ainda não está habilitada para este tenant." },
      { status: 403 },
    );
  }
  if (!(await isFeatureEnabled(scope, "messaging.whatsapp.enabled"))) {
    return NextResponse.json({ error: "Mensageria WhatsApp não habilitada." }, { status: 403 });
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

  try {
    const result = await generateCopilotSuggestion(scope.db, {
      tenantId: scope.tenantId,
      conversationId: id,
      correlationId: newCorrelationId(),
    });
    if (!result.suggested) {
      return NextResponse.json(
        { error: result.reason ?? "não foi possível gerar sugestão" },
        { status: 422 },
      );
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return internalError(err);
  }
}
