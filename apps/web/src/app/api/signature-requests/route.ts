import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { createStudioVersionRepository } from "@/lib/studio-repository";
import { renderContractSignaturePdf } from "@/lib/contract-signature-pdf";
import { getSignatureStatusForContract } from "@/lib/contract-signature-status";
import { createSignatureProvider, createSignatureRequest } from "@shina/signature-platform";
import type { SignerRole, SignerPartyType } from "@shina/signature-platform";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // @react-pdf/renderer needs the Node runtime, not edge

// GET /api/signature-requests?contractId=... — latest signature status for
// a contract, used by the tenant contract-detail UI. Same tenant-scoped
// posture as every other route here; the shared helper also backs the
// customer-portal and mobile read paths so all 3 UIs see identical data.
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const contractId = req.nextUrl.searchParams.get("contractId");
  if (!contractId) {
    return NextResponse.json({ error: "contractId query param is required" }, { status: 400 });
  }

  const { data: contract } = await scope.db
    .from("contracts")
    .select("id")
    .eq("id", contractId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const status = await getSignatureStatusForContract(scope.db, contractId);
  return NextResponse.json({ data: status });
}

// POST /api/signature-requests — starts a real e-signature flow for a
// contract: renders the frozen snapshot as a PDF, creates the envelope
// with whichever provider SIGNATURE_PROVIDER selects (createSignatureProvider,
// @shina/signature-platform), and records the signature_requests/signers
// rows. No tenant_permissions enforcement here (contract_signatures.* was
// seeded in P0's migration but, like every other route in this app today,
// nothing actually checks it yet — a pre-existing platform-wide gap, not
// something this route invents a bespoke fix for). Gated the same way
// api/contracts/[id]'s PATCH route is: authenticated tenant scope,
// non-read-only session.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as {
    contractId?: string;
    signers?: {
      role: SignerRole;
      name: string;
      email: string;
      partyType?: SignerPartyType;
      userId?: string;
      customerId?: string;
      operatorId?: string;
    }[];
  };
  if (!body.contractId || !body.signers?.length) {
    return NextResponse.json({ error: "contractId and signers are required" }, { status: 400 });
  }

  const { data: contract, error: contractError } = await scope.db
    .from("contracts")
    .select("id, organization_id, template_version_id, snapshot_id")
    .eq("id", body.contractId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (contractError) return internalError(contractError);
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (!contract.template_version_id || !contract.snapshot_id) {
    return NextResponse.json(
      { error: "Contract has no generated snapshot yet — nothing to sign" },
      { status: 422 },
    );
  }

  const { data: snapshot, error: snapshotError } = await scope.db
    .from("tenant_contract_snapshots")
    .select("rendered_content, content_hash")
    .eq("id", contract.snapshot_id)
    .maybeSingle();
  if (snapshotError) return internalError(snapshotError);
  if (!snapshot)
    return NextResponse.json({ error: "Contract snapshot not found" }, { status: 404 });

  const [{ data: tenant }, branding] = await Promise.all([
    scope.db.from("tenants").select("name").eq("id", scope.tenantId).maybeSingle(),
    createStudioVersionRepository(scope.db)
      .findLatest("branding", scope.tenantId)
      .catch(() => null),
  ]);
  const brandingConfig = branding?.config as { logoUrl?: string } | undefined;
  const contractNumber = `CTR-${contract.id.slice(0, 8).toUpperCase()}`;

  const pdfBuffer = await renderContractSignaturePdf({
    tenant: { name: tenant?.name ?? "Shinã", logoUrl: brandingConfig?.logoUrl ?? null },
    contract: {
      number: contractNumber,
      renderedContent: snapshot.rendered_content,
      contentHash: snapshot.content_hash,
    },
    generatedAt: new Date().toISOString(),
  });

  const provider = createSignatureProvider();

  try {
    const created = await createSignatureRequest(scope.db, provider, {
      tenantId: scope.tenantId,
      contractId: contract.id,
      contractVersionId: contract.template_version_id,
      snapshotId: contract.snapshot_id,
      documentContent: new Uint8Array(pdfBuffer),
      documentContentType: "application/pdf",
      documentName: `${contractNumber}.pdf`,
      signers: body.signers,
      createdBy: scope.userId,
    });

    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "contract",
      entityId: contract.id,
      action: "signature_requested",
      metadata: { signatureRequestId: created.id, provider: created.provider },
    });
    void createNotification({
      tenantId: scope.tenantId,
      subject: "Assinatura solicitada",
      body: `O contrato ${contractNumber} foi enviado para assinatura eletrônica.`,
      deepLink: { type: "contract", id: contract.id },
    });

    return NextResponse.json({ data: created });
  } catch (err) {
    return internalError(err);
  }
}
