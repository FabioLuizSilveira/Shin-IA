import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Public catalog read — same plan_versions table apps/web reads from,
// filtered to product "mkt". Replaces the old hardcoded PLANS array in
// signup/page.tsx + PLAN_PRICE_ENV map (Fase C: MKT now goes through the
// same plan_versions-backed flow as Platform, instead of its own ad hoc
// pricing source).
export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plan_versions")
    .select(
      "id, name, price_cents, currency, billing_cycle, trial_days, included_features, plans!inner(product, key)",
    )
    .eq("status", "published")
    .eq("plans.product", "mkt")
    .order("price_cents", { ascending: true });
  if (error) {
    console.error("[commercial/plans]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    data: (data ?? []).map((p) => ({
      id: p.id,
      key: (p as unknown as { plans: { key: string } }).plans.key,
      name: p.name,
      price_cents: p.price_cents,
      currency: p.currency,
      billing_cycle: p.billing_cycle,
      trial_days: p.trial_days,
      included_features: p.included_features,
    })),
  });
}
