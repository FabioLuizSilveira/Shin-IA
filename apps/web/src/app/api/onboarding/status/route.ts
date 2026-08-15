import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Polled by the onboarding success page (item 34: "success page NÃO ativa
// produto... consultar estado da subscription"). Ownership is checked via
// the checkout_session_references row created for this tenant during
// provisioning (not via JWT tenant_id claim — that claim won't reflect this
// brand-new tenant until the session token is refreshed).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = req.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) return NextResponse.json({ error: "tenant_id is required" }, { status: 422 });

  const admin = createAdminClient();
  const { data: ref, error: refError } = await admin
    .from("checkout_session_references")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (refError) return internalError(refError);
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("status")
    .eq("id", tenantId)
    .single();
  if (tenantError) return internalError(tenantError);

  return NextResponse.json({ data: { tenantStatus: tenant.status, checkoutStatus: ref.status } });
}
