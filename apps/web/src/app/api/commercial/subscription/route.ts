import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// Billing Center data source (item 28): produto, plano, valor,
// periodicidade, status, trial, invoices ficam no módulo de AR já existente
// (tenant/billing) — aqui é só a assinatura comercial da Shinã em si.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("platform_subscriptions")
    .select(
      "id, status, plan_key, billing_mode, current_period_start, current_period_end, " +
        "trial_ends_at, cancel_at_period_end, plan_versions(name, price_cents, currency, billing_cycle)",
    )
    .eq("tenant_id", scope.tenantId)
    .eq("product", "platform")
    .neq("status", "cancelled")
    .maybeSingle();
  if (error) return internalError(error);

  return NextResponse.json({ data });
}
