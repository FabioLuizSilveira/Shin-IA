import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionTenant } from "@/lib/tenant-provisioning";
import { appUrl } from "@/lib/domain";
import type {
  OnboardingStep1,
  OnboardingStep2,
  OnboardingStep3,
  OnboardingStep4,
  BlueprintId,
} from "@/types/onboarding";

interface OnboardingPayload {
  step1: OnboardingStep1;
  step2: OnboardingStep2;
  step3: OnboardingStep3;
  step4: OnboardingStep4;
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

// Public self-serve signup entry point (no auth required — this path is in
// middleware.ts's APP_PUBLIC_PATHS by design). Shares provisionTenant() with
// the platform-staff "create tenant" action (/api/tenants POST) — see that
// file's comment for what this unification fixed.
export async function POST(request: NextRequest) {
  let body: OnboardingPayload;

  try {
    body = (await request.json()) as OnboardingPayload;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { step1, step2, step3, step4 } = body;

  if (!step1?.companyName || !step1?.cnpj || !step1?.segment) {
    return NextResponse.json({ error: "Dados da empresa incompletos." }, { status: 422 });
  }
  if (!step2?.branchName || !step2?.branchCode || !step2?.city || !step2?.state) {
    return NextResponse.json({ error: "Dados da sede incompletos." }, { status: 422 });
  }
  if (!step3?.adminEmail || !step3?.adminFullName) {
    return NextResponse.json({ error: "Dados do administrador incompletos." }, { status: 422 });
  }
  if (!step4?.blueprintId) {
    return NextResponse.json({ error: "Blueprint não selecionado." }, { status: 422 });
  }

  const admin = createAdminClient();
  const tenantSlug = generateSlug(step1.companyName);
  const plan = PLAN_FOR_BLUEPRINT[step4.blueprintId];

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
        blueprint: step4.blueprintId,
        onboarding_completed_at: new Date().toISOString(),
      },
      adminEmail: step3.adminEmail,
      adminFullName: step3.adminFullName,
      inviteRedirectTo: appUrl("/dashboard"),
    });

    return NextResponse.json(
      {
        success: true,
        tenantId: result.tenantId,
        slug: result.slug,
        plan,
        inviteSent: result.inviteSent,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("[onboarding] provisioning error:", err);
    const message = err instanceof Error ? err.message : "Erro interno. Tente novamente.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
