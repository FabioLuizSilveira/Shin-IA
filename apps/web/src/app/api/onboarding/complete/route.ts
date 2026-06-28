import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
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
    .replace(/[\u0300-\u036f]/g, "")
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

export async function POST(request: NextRequest) {
  let body: OnboardingPayload;

  try {
    body = (await request.json()) as OnboardingPayload;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { step1, step2, step3, step4 } = body;

  // Basic server-side validation
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

  // Build Supabase server client (service role for admin operations)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, serviceKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  const tenantSlug = generateSlug(step1.companyName);
  const plan = PLAN_FOR_BLUEPRINT[step4.blueprintId];

  try {
    // 1. Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        name: step1.companyName,
        slug: tenantSlug,
        plan,
        status: "trialing",
        metadata: {
          cnpj: step1.cnpj,
          segment: step1.segment,
          website: step1.website ?? null,
          blueprint: step4.blueprintId,
          onboarding_completed_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      console.error("[onboarding] tenant insert error:", tenantError);
      return NextResponse.json(
        { error: "Erro ao criar tenant. Verifique se o nome da empresa já está em uso." },
        { status: 409 },
      );
    }

    // 2. Create main branch
    const { error: branchError } = await supabase.from("branches").insert({
      tenant_id: tenant.id,
      name: step2.branchName,
      code: step2.branchCode,
      type: "headquarters",
      city: step2.city,
      state: step2.state,
      country: "BR",
      is_active: true,
    });

    if (branchError) {
      console.error("[onboarding] branch insert error:", branchError);
      // Roll back tenant on branch failure
      await supabase.from("tenants").delete().eq("id", tenant.id);
      return NextResponse.json(
        { error: "Erro ao criar sede. Verifique o código da filial." },
        { status: 409 },
      );
    }

    // 3. Invite admin user via Supabase Auth
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(step3.adminEmail, {
      data: {
        full_name: step3.adminFullName,
        tenant_id: tenant.id,
        role: "tenant_admin",
        onboarding: true,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard`,
    });

    if (inviteError) {
      console.error("[onboarding] invite error:", inviteError);
      // Non-fatal: tenant and branch are created, admin invite will be retried via UI
    }

    return NextResponse.json(
      {
        success: true,
        tenantId: tenant.id,
        slug: tenantSlug,
        plan,
        inviteSent: !inviteError,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("[onboarding] unexpected error:", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
