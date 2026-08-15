import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Public catalog read — no tenant exists yet at the point this is called
// (onboarding Step 4 / MKT plan picker before checkout), so there's no
// tenant scope to check. Only published plan_versions are ever exposed.
export async function GET(req: NextRequest) {
  const product = req.nextUrl.searchParams.get("product");
  if (product !== "platform" && product !== "mkt") {
    return NextResponse.json({ error: "product must be 'platform' or 'mkt'" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("plan_versions")
    .select(
      "id, name, price_cents, currency, billing_cycle, trial_days, included_features, plans!inner(product)",
    )
    .eq("status", "published")
    .eq("plans.product", product)
    .order("price_cents", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({
    data: (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      price_cents: p.price_cents,
      currency: p.currency,
      billing_cycle: p.billing_cycle,
      trial_days: p.trial_days,
      included_features: p.included_features,
    })),
  });
}
