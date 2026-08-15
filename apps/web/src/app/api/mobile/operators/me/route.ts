import { NextResponse } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Wave 2 Phase D — self-context endpoint for an operator identity, mirroring
// api/mobile/customers/me: only context.operatorId is ever used (resolved
// server-side from auth.uid() by requireMobileContext(), never a
// client-supplied id). Tenant staff already list operators via the existing
// /api/operators route (reused, not duplicated) — operators can't use it
// themselves because requireTenantScope() rejects operator identities
// structurally (no tenant_id claim), same as every other api/mobile/* route.
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile, error: profileError } = await context.db
    .from("operators")
    .select("id, full_name, document, phone, email, certifications, status, created_at")
    .eq("id", context.operatorId)
    .maybeSingle();
  if (profileError) return internalError(profileError);
  if (!profile) return NextResponse.json({ error: "Operator not found" }, { status: 404 });

  const { data: assignments, error: assignmentsError } = await context.db
    .from("operator_assignments")
    .select("id, operation_id, asset_id, role, assigned_at, status")
    .eq("operator_id", context.operatorId)
    .order("assigned_at", { ascending: false });
  if (assignmentsError) return internalError(assignmentsError);

  return NextResponse.json({
    data: {
      profile,
      assignments: assignments ?? [],
    },
  });
}
