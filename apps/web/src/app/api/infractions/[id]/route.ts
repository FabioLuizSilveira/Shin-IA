import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// GET /api/infractions/:id — full case detail. :id is the
// infraction_cases.id (not infractions.id) — that's what every other
// route in this module addresses, since the case is the operational
// object staff interacts with.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.infractions.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: infractionCase, error } = await scope.db
    .from("infraction_cases")
    .select("*, infractions(*), assets(id, name, plate, renavam)")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (error) return internalError(error);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const [
    { data: evidence },
    { data: deadlines },
    { data: disputes },
    { data: driverIdentifications },
    { data: defenses },
    { data: payments },
    { data: documents },
  ] = await Promise.all([
    scope.db
      .from("infraction_evidence")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    scope.db
      .from("infraction_deadlines")
      .select("*")
      .eq("case_id", id)
      .order("due_at", { ascending: true }),
    scope.db
      .from("infraction_disputes")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    scope.db.from("infraction_driver_identifications").select("*").eq("case_id", id),
    scope.db
      .from("infraction_defenses")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    scope.db
      .from("infraction_payments")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    scope.db
      .from("infraction_documents")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    data: {
      case: infractionCase,
      evidence: evidence ?? [],
      deadlines: deadlines ?? [],
      disputes: disputes ?? [],
      driverIdentifications: driverIdentifications ?? [],
      defenses: defenses ?? [],
      payments: payments ?? [],
      documents: documents ?? [],
    },
  });
}
