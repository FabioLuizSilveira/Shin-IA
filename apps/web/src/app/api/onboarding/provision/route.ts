import { NextResponse, type NextRequest } from "next/server";
import { checkProvisioningReadiness } from "@shina/commercial-platform";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, isTenantAdmin } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { runOnboardingProvisioning } from "@/lib/onboarding-provisioning";

export const dynamic = "force-dynamic";

const FLAG = "onboarding.discovery";

interface Body {
  action?: "check" | "run";
  commercialConfigurationId?: string;
  correlationId?: string;
}

// WAVE 4 — PROVISIONING. `check` returns the gate status; `run` executes the
// orchestrator (blueprint install + feature flags + config freeze). The gate
// (checkProvisioningReadiness) refuses to run before the contract is settled.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await isFeatureEnabled(scope, FLAG))) {
    return NextResponse.json({ error: "Discovery não habilitado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.commercialConfigurationId) {
    return NextResponse.json({ error: "commercialConfigurationId é obrigatório" }, { status: 422 });
  }

  try {
    if ((body.action ?? "check") === "check") {
      const readiness = await checkProvisioningReadiness(scope.db, {
        tenantId: scope.tenantId,
        commercialConfigurationId: body.commercialConfigurationId,
      });
      return NextResponse.json({ data: readiness });
    }

    // action === "run"
    if (isReadOnlyScope(scope)) {
      return NextResponse.json({ error: "Sessão somente leitura" }, { status: 403 });
    }
    if (!isTenantAdmin(scope)) {
      return NextResponse.json(
        { error: "Apenas owner/admin do tenant pode provisionar" },
        { status: 403 },
      );
    }
    const result = await runOnboardingProvisioning(scope.db, {
      tenantId: scope.tenantId,
      commercialConfigurationId: body.commercialConfigurationId,
      correlationId: body.correlationId ?? null,
      actorId: scope.userId,
    });
    return NextResponse.json({ data: result }, { status: result.ok ? 200 : 422 });
  } catch (err) {
    return internalError(err);
  }
}
