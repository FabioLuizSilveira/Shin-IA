import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: tenants } = await admin
    .from("tenants")
    .select("status, plan, created_at")
    .is("deleted_at", null);

  const t = tenants ?? [];

  return NextResponse.json({
    data: {
      total: t.length,
      byStatus: {
        active: t.filter((x) => x.status === "active").length,
        trialing: t.filter((x) => x.status === "trialing").length,
        suspended: t.filter((x) => x.status === "suspended").length,
        cancelled: t.filter((x) => x.status === "cancelled").length,
      },
      byPlan: {
        starter: t.filter((x) => x.plan === "starter").length,
        professional: t.filter((x) => x.plan === "professional").length,
        enterprise: t.filter((x) => x.plan === "enterprise").length,
      },
    },
  });
}
