import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/mobile/customer/contracts/[id]/snapshot — web customer
// portal's RLS→API migration (rentals-portal.ts's fetchContractSnapshot +
// fetchDataProcessingLegalBasis, combined into one response since both
// were always fetched together for the same contract-acceptance screen).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id: contractId } = await params;

  const { data: contract } = await context.db
    .from("contracts")
    .select("id, organization_id, snapshot_id")
    .eq("id", contractId)
    .maybeSingle();
  const ownsContract =
    contract && context.organizations.some((o) => o.organizationId === contract.organization_id);
  if (!ownsContract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (!contract.snapshot_id) {
    return NextResponse.json({ error: "No snapshot for this contract" }, { status: 404 });
  }

  const { data: snapshot, error } = await context.db
    .from("tenant_contract_snapshots")
    .select("id, rendered_content, content_hash")
    .eq("id", contract.snapshot_id)
    .single();
  if (error) return internalError(error);

  const { data: requirement } = await context.db
    .from("tenant_contract_requirements")
    .select("data_processing_legal_basis")
    .eq("contract_id", contractId)
    .order("resolved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    data: {
      snapshot,
      dataProcessingLegalBasis: requirement?.data_processing_legal_basis ?? null,
    },
  });
}
