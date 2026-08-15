import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBillingProvider } from "@shina/billing-platform";
import { createCommercialCheckout, hasAcceptedCurrentContract } from "@shina/commercial-platform";

// Fase C (Unified Commercial Flow): now goes through the same
// createCommercialCheckout() orchestration Platform uses — was previously a
// hand-rolled Stripe session with no contract gate at all. Requires the MKT
// contract to already be accepted (see /api/commercial/accept); returns 403
// with acceptance_required so the signup page can show that step first.
//
// 14-day refund guarantee stays as subscription metadata handled by the
// webhook (unchanged — see api/webhooks/stripe/route.ts).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login antes de continuar." }, { status: 401 });
  }

  const { plan } = (await request.json()) as { plan?: string };
  if (!plan) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: planVersion, error: planError } = await admin
    .from("plan_versions")
    .select("id, plans!inner(product, key)")
    .eq("status", "published")
    .eq("plans.product", "mkt")
    .eq("plans.key", plan)
    .maybeSingle();
  if (planError || !planVersion) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const accepted = await hasAcceptedCurrentContract(admin, {
    tenantId: null,
    userId: user.id,
    product: "mkt",
  });
  if (!accepted) {
    return NextResponse.json(
      { error: "acceptance_required", planVersionId: planVersion.id },
      { status: 403 },
    );
  }

  const { data: acceptance } = await admin
    .from("contract_acceptances")
    .select("id, commercial_terms_snapshot_id")
    .eq("user_id", user.id)
    .is("tenant_id", null)
    .eq("product", "mkt")
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!acceptance) {
    return NextResponse.json(
      { error: "acceptance_required", planVersionId: planVersion.id },
      { status: 403 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_MKT_URL ?? "http://localhost:3003";
  const billingProvider = createBillingProvider(admin);

  try {
    const { url } = await createCommercialCheckout(admin, billingProvider, {
      tenantId: null,
      userId: user.id,
      email: user.email ?? "",
      product: "mkt",
      planVersionId: planVersion.id,
      contractAcceptanceId: acceptance.id,
      commercialTermsSnapshotId: acceptance.commercial_terms_snapshot_id,
      successUrl: `${appUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/signup?plan=${plan}`,
      extraMetadata: { refundEligibleUntil: String(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Não foi possível iniciar o checkout." }, { status: 500 });
  }
}
