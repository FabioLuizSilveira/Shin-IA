import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isTenantAdmin, isReadOnlyScope } from "@/lib/tenant-context";
import { updateSubscriptionCreditCard, isAsaasConfigured } from "@/lib/asaas/client";

export const dynamic = "force-dynamic";

// Fase E: the card-replacement half of the tenant-facing manage-subscription
// UI (the other half is /api/commercial/cancel). Card fields arrive here
// once, are forwarded to Asaas immediately, and are never logged or
// persisted anywhere in this app — req.json()'s parsed object is the only
// place they ever exist in this process.
export async function POST(req: NextRequest) {
  if (!isAsaasConfigured) {
    return NextResponse.json({ error: "Asaas not configured" }, { status: 503 });
  }

  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope) || !isTenantAdmin(scope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const required = [
    "holderName",
    "number",
    "expiryMonth",
    "expiryYear",
    "ccv",
    "holderCpfCnpj",
    "postalCode",
    "addressNumber",
    "phone",
  ] as const;
  const missing = required.filter((key) => !body?.[key]);
  if (!body || missing.length > 0) {
    return NextResponse.json(
      { error: `Campos obrigatórios ausentes: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const { data: sub, error: subError } = await scope.db
    .from("platform_subscriptions")
    .select("id, billing_mode, gateway_subscription_id, platform_customers(email)")
    .eq("tenant_id", scope.tenantId)
    .eq("product", "platform")
    .neq("status", "cancelled")
    .maybeSingle();
  if (subError) return internalError(subError);
  if (!sub)
    return NextResponse.json({ error: "Nenhuma assinatura ativa encontrada." }, { status: 404 });
  if (sub.billing_mode !== "card") {
    return NextResponse.json(
      { error: "Assinaturas fora do fluxo de cartão não têm cartão para atualizar." },
      { status: 422 },
    );
  }
  if (!sub.gateway_subscription_id) {
    return NextResponse.json({ error: "Assinatura sem id de gateway." }, { status: 422 });
  }
  const customerEmail = (sub.platform_customers as unknown as { email: string | null } | null)
    ?.email;

  const remoteIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  try {
    await updateSubscriptionCreditCard({
      gatewaySubscriptionId: sub.gateway_subscription_id,
      remoteIp,
      card: {
        holderName: body.holderName,
        number: body.number,
        expiryMonth: body.expiryMonth,
        expiryYear: body.expiryYear,
        ccv: body.ccv,
      },
      holderInfo: {
        name: body.holderName,
        email: customerEmail ?? body.holderEmail ?? "",
        cpfCnpj: body.holderCpfCnpj,
        postalCode: body.postalCode,
        addressNumber: body.addressNumber,
        phone: body.phone,
      },
    });
    return NextResponse.json({ data: { updated: true } });
  } catch (err) {
    return internalError(err);
  }
}
