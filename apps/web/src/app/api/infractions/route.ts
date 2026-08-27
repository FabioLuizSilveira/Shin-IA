import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { ingestInfraction } from "@/lib/infraction-ingest";
import { createDeadlinesForCase } from "@/lib/infraction-deadlines";
import { ManualInfractionProvider } from "@shina/infractions-engine";
import type { ExternalInfraction, InfractionCaseStatus } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

const SELECT =
  "id, infraction_id, status, asset_id, match_confidence, contract_id, customer_id, operator_id, " +
  "responsible_party_type, responsible_party_id, responsibility_confidence, created_at, updated_at, " +
  "infractions(id, source, auto_number, plate, occurred_at, amount_cents, amount_currency, authority_name, infraction_code)";

// GET /api/infractions — tenant staff list. infraction_cases already
// scoped by tenant_id (never null once matched — see infraction-ingest.ts).
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.infractions.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status") as InfractionCaseStatus | null;
  const assetId = req.nextUrl.searchParams.get("assetId");
  let query = scope.db.from("infraction_cases").select(SELECT).eq("tenant_id", scope.tenantId);
  if (status) query = query.eq("status", status);
  if (assetId) query = query.eq("asset_id", assetId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface ManualInfractionBody {
  plate?: string;
  renavam?: string;
  autoNumber?: string;
  authorityCode?: string;
  authorityName?: string;
  infractionCode?: string;
  description?: string;
  occurredAt?: string;
  location?: string;
  municipality?: string;
  state?: string;
  amountCents?: number;
  dueDate?: string;
  driverIdentificationDeadline?: string;
  defenseDeadline?: string;
  paymentDeadline?: string;
  discountDeadline?: string;
}

// POST /api/infractions — manual entry (item 33 of the spec: usable
// before any official provider exists). Goes through the exact same
// ingestInfraction() path CSV import and a future official adapter will
// use, via ManualInfractionProvider — dedup/matching behavior is
// identical regardless of source.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as ManualInfractionBody;
  if (!body.plate || !body.occurredAt) {
    return NextResponse.json({ error: "plate and occurredAt are required" }, { status: 400 });
  }

  const external: ExternalInfraction = {
    source: "manual",
    externalId: null,
    autoNumber: body.autoNumber ?? null,
    authorityCode: body.authorityCode ?? null,
    authorityName: body.authorityName ?? null,
    infractionCode: body.infractionCode ?? null,
    description: body.description ?? null,
    plate: body.plate,
    renavam: body.renavam ?? null,
    occurredAt: body.occurredAt,
    location: body.location ?? null,
    municipality: body.municipality ?? null,
    state: body.state ?? null,
    amountCents: body.amountCents ?? null,
    amountCurrency: "BRL",
    dueDate: body.dueDate ?? null,
    driverIdentificationDeadline: body.driverIdentificationDeadline ?? null,
    defenseDeadline: body.defenseDeadline ?? null,
    paymentDeadline: body.paymentDeadline ?? null,
    discountDeadline: body.discountDeadline ?? null,
    externalStatus: null,
    rawPayload: {},
  };

  const provider = new ManualInfractionProvider();
  const [normalized] = await provider.fetchInfractions(external);

  try {
    const result = await ingestInfraction(scope.db, normalized, scope.userId, scope.tenantId);

    if (!result.deduplicated) {
      // Deadlines (item 16/17) only make sense once the case has a real
      // tenant — created right after ingest for the manual-entry path,
      // since the tenant is already known here (unlike CSV/official
      // import, where matching may resolve the tenant later).
      const { data: infractionRow } = await scope.db
        .from("infractions")
        .select(
          "driver_identification_deadline, defense_deadline, discount_deadline, payment_deadline",
        )
        .eq("id", result.infractionId)
        .maybeSingle();
      if (infractionRow) {
        await createDeadlinesForCase(scope.db, scope.tenantId, result.caseId, infractionRow).catch(
          () => {},
        );
      }
    }

    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "infraction_case",
      entityId: result.caseId,
      action: result.deduplicated ? "duplicate_ignored" : "created",
      metadata: { matchConfidence: result.matchConfidence, source: "manual" },
    });

    return NextResponse.json({ data: result }, { status: result.deduplicated ? 200 : 201 });
  } catch (err) {
    return internalError(err);
  }
}
