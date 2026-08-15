import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { customerOrganizationIds } from "@/lib/mobile-contracts-scope";
import { auditMobileAction } from "@/lib/mobile-audit";
import { internalError } from "@/lib/api-error";
import {
  hasAcceptedContract,
  resolveBillingRequirement,
  isBillingSatisfied,
  hasApprovedDocuments,
} from "@shina/tenant-contract-engine";

export const dynamic = "force-dynamic";

interface ContractRow {
  id: string;
  tenant_id: string;
  type: string;
  status: string;
  value_amount: number;
  value_currency: string;
  period_starts_at: string;
  period_ends_at: string;
  template_id: string | null;
  template_version_id: string | null;
  snapshot_id: string | null;
  organization_id: string;
  billing_requirement: unknown;
  created_at: string;
}

// Wave 3 Phase A — never returns the editable template, only the immutable
// rendered snapshot (tenant_contract_snapshots.rendered_content) already
// generated when the requirement was resolved. Same IDOR hygiene as every
// other mobile detail route: "not yours" and "doesn't exist" return the same
// 404. allowedActions is a server-computed preview only — the real mutation
// (acceptance) is POST /api/customer-contracts/{id}/accept, reused as-is,
// not reimplemented here (it already re-derives/rejects mismatched
// version/snapshot ids server-side, see recordContractAcceptance).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rawContract, error } = await context.db
    .from("contracts")
    .select(
      "id, tenant_id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, " +
        "template_id, template_version_id, snapshot_id, organization_id, billing_requirement, created_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return internalError(error);

  const contract = rawContract as unknown as ContractRow | null;
  const organizationIds = customerOrganizationIds(context);
  if (!contract || !organizationIds.includes(contract.organization_id)) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const [snapshotResult, versionResult, assetsResult, accepted] = await Promise.all([
    contract.snapshot_id
      ? context.db
          .from("tenant_contract_snapshots")
          .select("id, rendered_content, content_hash, created_at")
          .eq("id", contract.snapshot_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    contract.template_version_id
      ? context.db
          .from("tenant_contract_versions")
          .select("version, effective_at")
          .eq("id", contract.template_version_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    context.db
      .from("contract_assets")
      .select("id, quantity, notes, assets(id, name, category, status)")
      .eq("contract_id", id),
    hasAcceptedContract(context.db, {
      contractId: id,
      partyType: "customer",
      customerId: context.customerId,
    }),
  ]);

  const billing = resolveBillingRequirement(contract);
  const billingSatisfied =
    billing.type === "none" ? true : await isBillingSatisfied(context.db, id);

  const documentsApproved = contract.template_id
    ? await hasApprovedDocuments(context.db, {
        contractId: id,
        templateId: contract.template_id,
        partyType: "customer",
        customerId: context.customerId,
      })
    : true;

  const allowedActions: string[] = ["view"];
  if (contract.template_id && contract.status === "draft" && !accepted) {
    allowedActions.push("accept");
  }
  if (contract.snapshot_id) {
    allowedActions.push("download");
  }

  void auditMobileAction(
    context.db,
    context,
    { action: "contract.viewed", resource: "contract", resourceId: id, result: "allowed" },
    contract.tenant_id,
  );

  return NextResponse.json({
    data: {
      ...contract,
      snapshot: snapshotResult.data ?? null,
      version: versionResult.data?.version ?? null,
      effectiveAt: versionResult.data?.effective_at ?? null,
      assets: assetsResult.data ?? [],
      acceptance: { accepted },
      billing: { ...billing, satisfied: billingSatisfied },
      documents: { allApproved: documentsApproved },
      allowedActions,
    },
  });
}
