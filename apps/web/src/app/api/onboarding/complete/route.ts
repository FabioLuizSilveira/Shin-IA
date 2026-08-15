import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { provisionTenant } from "@/lib/tenant-provisioning";
import { appUrl } from "@/lib/domain";
import { clientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import type {
  OnboardingStep1,
  OnboardingStep2,
  OnboardingStep3,
  OnboardingStep4,
  OnboardingStep5,
  BlueprintId,
} from "@/types/onboarding";

interface OnboardingPayload {
  step1: OnboardingStep1;
  step2: OnboardingStep2;
  step3: OnboardingStep3;
  step4: OnboardingStep4;
  step5: OnboardingStep5;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const PLAN_FOR_BLUEPRINT: Record<BlueprintId, string> = {
  mobility_urban: "professional",
  logistics_truck: "professional",
  agriculture_field: "starter",
  construction_fleet: "professional",
  generic: "starter",
};

// Login-first now (Unified Commercial Flow) — the onboarding wizard's Step 0
// authenticates before any company/contract data is collected, so this route
// requires a real session and is NOT in middleware.ts's APP_PUBLIC_PATHS
// anymore (only the /onboarding *page* itself stays public, so an
// unauthenticated visitor can land there and see the login step).
// Still shares provisionTenant() with the platform-staff "create tenant"
// action (/api/tenants POST) — see that file's comment.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  let body: OnboardingPayload;
  try {
    body = (await request.json()) as OnboardingPayload;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { step1, step2, step3, step4, step5 } = body;

  if (!step1?.companyName || !step1?.cnpj || !step1?.segment) {
    return NextResponse.json({ error: "Dados da empresa incompletos." }, { status: 422 });
  }
  if (!step2?.branchName || !step2?.branchCode || !step2?.city || !step2?.state) {
    return NextResponse.json({ error: "Dados da sede incompletos." }, { status: 422 });
  }
  if (!step3?.blueprintId) {
    return NextResponse.json({ error: "Blueprint não selecionado." }, { status: 422 });
  }
  if (!step4?.planVersionId) {
    return NextResponse.json({ error: "Plano não selecionado." }, { status: 422 });
  }
  if (!step5?.representativeName || !step5?.representativeRole) {
    return NextResponse.json({ error: "Dados do representante incompletos." }, { status: 422 });
  }
  if (!step5.declaredAuthority || !step5.contractAccepted) {
    return NextResponse.json(
      { error: "É necessário declarar poderes e aceitar o contrato." },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  const tenantSlug = generateSlug(step1.companyName);
  const plan = PLAN_FOR_BLUEPRINT[step3.blueprintId];

  try {
    const result = await provisionTenant(admin, {
      name: step1.companyName,
      slug: tenantSlug,
      plan,
      status: "trialing",
      branchName: step2.branchName,
      branchCode: step2.branchCode,
      branchMetadata: { type: "headquarters", city: step2.city, state: step2.state, country: "BR" },
      tenantMetadata: {
        cnpj: step1.cnpj,
        segment: step1.segment,
        website: step1.website ?? null,
        blueprint: step3.blueprintId,
        onboarding_completed_at: new Date().toISOString(),
      },
      adminEmail: user.email ?? "",
      adminFullName: step5.representativeName,
      inviteRedirectTo: appUrl("/dashboard"),
      commercial: {
        userId: user.id,
        email: user.email ?? "",
        planVersionId: step4.planVersionId,
        representative: {
          name: step5.representativeName,
          role: step5.representativeRole,
          document: step5.representativeDocument,
          declaredAuthority: step5.declaredAuthority,
        },
        request: {
          ipAddress: clientIp(request),
          userAgent: request.headers.get("user-agent"),
        },
        successUrlBase: appUrl("/onboarding/success"),
        cancelUrl: appUrl("/onboarding"),
      },
    });

    if (!result.checkoutUrl) {
      return NextResponse.json(
        { error: "Não foi possível iniciar o pagamento. Tente novamente." },
        { status: 500 },
      );
    }

    void logActivity(admin, {
      tenantId: result.tenantId,
      actorId: user.id,
      entityType: "tenant",
      entityId: result.tenantId,
      action: "checkout.created",
    });

    return NextResponse.json(
      { success: true, tenantId: result.tenantId, checkoutUrl: result.checkoutUrl },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("[onboarding] provisioning error:", err);
    const message = err instanceof Error ? err.message : "Erro interno. Tente novamente.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
