import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { provisionPlatformSubscription } from "@/lib/platform-subscription";
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
    // 1. Create tenant — tenants.id has no column default, so the id must
    // be generated here (same as /api/tenants POST does).
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .insert({
        id: crypto.randomUUID(),
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
    // branches has no city/state/type columns — those wizard fields live in
    // the metadata jsonb; the real columns are name/code/active/scope_mode.
    const { error: branchError } = await supabase.from("branches").insert({
      id: crypto.randomUUID(),
      tenant_id: tenant.id,
      name: step2.branchName,
      code: step2.branchCode,
      active: true,
      metadata: { type: "headquarters", city: step2.city, state: step2.state, country: "BR" },
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
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      step3.adminEmail,
      {
        data: {
          full_name: step3.adminFullName,
          tenant_id: tenant.id,
          role: "tenant_admin",
          onboarding: true,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard`,
      },
    );

    if (inviteError) {
      console.error("[onboarding] invite error:", inviteError);
      // Non-fatal: tenant and branch are created, admin invite will be retried via UI
    }

    // 4. Provision the trial subscription row (source of truth for gating)
    if (inviteData?.user?.id) {
      await provisionPlatformSubscription(supabase, {
        authUserId: inviteData.user.id,
        email: step3.adminEmail,
        tenantId: tenant.id,
        planKey: plan,
        status: "trialing",
      });
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
