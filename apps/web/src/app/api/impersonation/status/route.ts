import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeSessionClaims } from "@/lib/jwt-claims";
import { getActiveImpersonation } from "@/lib/impersonation";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ data: null });

  const claims = decodeSessionClaims(session.access_token);
  if (!claims.platform_role) return NextResponse.json({ data: null });

  const impersonation = await getActiveImpersonation(session.user.id);
  if (!impersonation) return NextResponse.json({ data: null });

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", impersonation.tenantId)
    .maybeSingle();

  return NextResponse.json({
    data: {
      tenantId: impersonation.tenantId,
      tenantName: tenant?.name ?? "Tenant",
      accessMode: impersonation.accessMode,
      reason: impersonation.reason,
      startedAt: impersonation.startedAt,
      maxDurationMinutes: impersonation.maxDurationMinutes,
    },
  });
}
