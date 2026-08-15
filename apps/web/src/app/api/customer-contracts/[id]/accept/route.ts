import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordContractAcceptance } from "@shina/tenant-contract-engine";
import { clientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";
import { ensureContractInvoice } from "@/lib/contract-billing";

export const dynamic = "force-dynamic";

// Customer-facing acceptance endpoint — session-authenticated (rental
// customer, not tenant staff), so this deliberately does NOT use
// requireTenantScope(). Authorization is manual here (mirrors the RLS chain
// already used for rental_customers: rental_customer_organizations ->
// rental_customers -> auth.uid()) because the write itself goes through the
// service-role client, which bypasses RLS and needs its own check.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: contractId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { dataProcessingConsent?: boolean };

  const admin = createAdminClient();

  const { data: customer } = await admin
    .from("rental_customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: "Cadastro de cliente não encontrado." }, { status: 403 });
  }

  const { data: contract } = await admin
    .from("contracts")
    .select(
      "id, tenant_id, organization_id, status, template_id, template_version_id, snapshot_id, billing_requirement",
    )
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) {
    return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  }
  if (!contract.template_id || !contract.template_version_id || !contract.snapshot_id) {
    return NextResponse.json(
      { error: "Este contrato não possui um requisito jurídico dinâmico associado." },
      { status: 422 },
    );
  }

  const { data: link } = await admin
    .from("rental_customer_organizations")
    .select("id")
    .eq("rental_customer_id", customer.id)
    .eq("organization_id", contract.organization_id)
    .maybeSingle();
  if (!link) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: snapshot } = await admin
    .from("tenant_contract_snapshots")
    .select("content_hash")
    .eq("id", contract.snapshot_id)
    .single();
  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot do contrato não encontrado." }, { status: 500 });
  }

  // The legal basis is Tenant-configured, resolved when the requirement was
  // computed — never inferred here. Only when it's actually "consent" does
  // the client's checkbox get recorded as a real consent.
  const { data: requirement } = await admin
    .from("tenant_contract_requirements")
    .select("data_processing_legal_basis")
    .eq("contract_id", contractId)
    .order("resolved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const consentedDataProcessing =
    requirement?.data_processing_legal_basis === "consent" && body.dataProcessingConsent === true;

  try {
    const result = await recordContractAcceptance(admin, {
      tenantId: contract.tenant_id,
      partyType: "customer",
      userId: user.id,
      customerId: customer.id,
      contractId: contract.id,
      contractVersionId: contract.template_version_id,
      snapshotId: contract.snapshot_id,
      documentHash: snapshot.content_hash,
      acceptanceMethod: "clickwrap",
      consentedDataProcessing,
      request: { ipAddress: clientIp(req), userAgent: req.headers.get("user-agent") },
    });

    await admin.from("contracts").update({ status: "active" }).eq("id", contract.id);
    await ensureContractInvoice(admin, contract);

    void logActivity(admin, {
      tenantId: contract.tenant_id,
      actorId: user.id,
      entityType: "contract",
      entityId: contract.id,
      action: "contract.accepted",
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao registrar aceite.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
