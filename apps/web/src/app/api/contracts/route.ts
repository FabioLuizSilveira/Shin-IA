import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import {
  TenantContractRequirementResolver,
  ContractTemplateEngine,
  createContractSnapshot,
} from "@shina/tenant-contract-engine";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, organization_id, organizations(name)";

function flattenOrg<T extends { organizations: { name: string } | null }>(
  row: T,
): Omit<T, "organizations"> & { organization_name?: string } {
  const { organizations, ...rest } = row;
  return { ...rest, organization_name: organizations?.name };
}

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("contracts")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({
    data: (data as unknown as { organizations: { name: string } | null }[]).map(flattenOrg),
  });
}

const VALID_TYPES = ["service", "rental", "lease", "subscription", "one_time"];

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  const tenantId = scope.tenantId;

  const body = (await req.json()) as {
    type?: string;
    organization_id?: string;
    value_amount?: number;
    value_currency?: string;
    period_starts_at?: string;
    period_ends_at?: string;
    // Optional — when present, resolves and snapshots the applicable
    // dynamic contract (Fase E). Without it, behaves exactly as before
    // (a contract with no legal template attached, same as pre-existing rows).
    blueprint_id?: string;
    insurance_included?: boolean;
    tracking_enabled?: boolean;
    security_deposit_cents?: number;
    consumer_relationship?: "consumer" | "business" | "undetermined";
    data_processing_legal_basis?:
      | "consent"
      | "contract_performance"
      | "legitimate_interest"
      | "legal_obligation"
      | "not_applicable";
    billing_requirement?: {
      type: "deposit" | "full_payment" | "invoice" | "none";
      amount_cents?: number;
      currency?: string;
    };
  };

  if (
    !body.type ||
    !VALID_TYPES.includes(body.type) ||
    !body.organization_id ||
    body.value_amount === undefined ||
    !body.period_starts_at ||
    !body.period_ends_at
  ) {
    return NextResponse.json(
      {
        error:
          "type, organization_id, value_amount, period_starts_at and period_ends_at are required",
      },
      { status: 422 },
    );
  }

  if (new Date(body.period_starts_at) >= new Date(body.period_ends_at)) {
    return NextResponse.json(
      { error: "period_starts_at must be before period_ends_at" },
      { status: 422 },
    );
  }

  const { data: created, error: insertError } = await scope.db
    .from("contracts")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      organization_id: body.organization_id,
      type: body.type,
      value_amount: body.value_amount,
      value_currency: body.value_currency ?? "BRL",
      period_starts_at: body.period_starts_at,
      period_ends_at: body.period_ends_at,
      billing_requirement: body.billing_requirement ?? {},
    })
    .select(SELECT)
    .single();
  if (insertError) return internalError(insertError);

  // Resolve + snapshot the dynamic contract (Fase E) — never a universal
  // contract, always driven by the blueprint the caller declares. Contract
  // stays "draft" (its default) until the customer accepts it.
  if (body.blueprint_id) {
    try {
      const requirement = await TenantContractRequirementResolver.resolve(scope.db, {
        tenantId,
        partyType: "customer",
        blueprintId: body.blueprint_id,
        operatorRequired: false,
        operatorIncluded: false,
        trackingEnabled: !!body.tracking_enabled,
        insuranceType: body.insurance_included ? "standard" : null,
        consumerRelationship: body.consumer_relationship,
        dataProcessingLegalBasis: body.data_processing_legal_basis,
        contractId: created.id,
      });

      const rendered = await ContractTemplateEngine.render(scope.db, {
        templateId: requirement.templateId,
        context: {
          insuranceIncluded: !!body.insurance_included,
          trackingEnabled: !!body.tracking_enabled,
          securityDeposit: body.security_deposit_cents ?? 0,
          consumerRelationship: requirement.consumerRelationship,
          variables: {
            security_deposit_amount: body.security_deposit_cents
              ? (body.security_deposit_cents / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })
              : "N/A",
          },
        },
      });

      const snapshot = await createContractSnapshot(scope.db, {
        tenantId,
        contractId: created.id,
        templateVersionId: requirement.versionId,
        renderedContent: rendered.renderedContent,
        contentHash: rendered.contentHash,
      });

      await scope.db
        .from("contracts")
        .update({
          template_id: requirement.templateId,
          template_version_id: requirement.versionId,
          snapshot_id: snapshot.id,
        })
        .eq("id", created.id);

      void logActivity(scope.db, {
        tenantId,
        actorId: scope.userId,
        entityType: "contract",
        entityId: created.id,
        action: "contract.presented",
        metadata: { blueprint_id: body.blueprint_id, template_id: requirement.templateId },
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Falha ao resolver contrato aplicável." },
        { status: 422 },
      );
    }
  }

  void logActivity(scope.db, {
    tenantId,
    actorId: scope.userId,
    entityType: "contract",
    entityId: created.id,
    action: "created",
    metadata: { type: body.type, organization_id: body.organization_id },
  });
  void createNotification({
    tenantId,
    subject: "Novo contrato criado",
    body: `Um contrato de ${body.type} foi criado.`,
  });

  return NextResponse.json(
    { data: flattenOrg(created as unknown as { organizations: { name: string } | null }) },
    { status: 201 },
  );
}
