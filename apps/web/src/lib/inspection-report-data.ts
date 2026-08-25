import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStudioVersionRepository } from "@/lib/studio-repository";
import type { InspectionPdfInput } from "@/lib/inspection-pdf";

const MEDIA_BUCKET = "inspection-media";
const SIGNED_URL_TTL_SECONDS = 900; // long enough to cover PDF render + embed

function formatResponseValue(r: {
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_json: { label?: string } | null;
}): string {
  if (r.value_json?.label) return r.value_json.label;
  if (r.value_boolean !== null && r.value_boolean !== undefined)
    return r.value_boolean ? "Sim" : "Não";
  if (r.value_number !== null && r.value_number !== undefined) return String(r.value_number);
  return r.value_text ?? "—";
}

// Assembles the full PDF input from a report row's tenant_id/inspection_id
// — always sourced from inspection_reports.rendered_content's structural
// shape (the same snapshot the report route already generates), never
// from a fresh live query of mutable inspection state. Shared by the
// staff, customer, and public share-token PDF routes so all three render
// byte-identical documents for the same reportId.
export async function buildInspectionPdfInput(
  db: SupabaseClient,
  reportId: string,
): Promise<InspectionPdfInput | null> {
  const { data: report } = await db
    .from("inspection_reports")
    .select("id, tenant_id, inspection_id, version, content_hash, generated_at, verification_token")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return null;

  const { data: inspection } = await db
    .from("inspections")
    .select(
      "id, asset_id, contract_id, operator_id, customer_id, template_id, type, status, started_at, completed_at, linked_inspection_id",
    )
    .eq("id", report.inspection_id)
    .maybeSingle();
  if (!inspection) return null;

  const [{ data: tenant }, { data: asset }, { data: operator }] = await Promise.all([
    db.from("tenants").select("name").eq("id", report.tenant_id).maybeSingle(),
    inspection.asset_id
      ? db
          .from("assets")
          .select("name, category, serial_number")
          .eq("id", inspection.asset_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    inspection.operator_id
      ? db.from("operators").select("full_name").eq("id", inspection.operator_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let contract: InspectionPdfInput["contract"] = null;
  if (inspection.contract_id) {
    const { data: contractRow } = await db
      .from("contracts")
      .select("id, organization_id, period_starts_at, period_ends_at")
      .eq("id", inspection.contract_id)
      .maybeSingle();
    if (contractRow) {
      let customerName: string | null = null;
      if (inspection.customer_id) {
        const { data: customer } = await db
          .from("rental_customers")
          .select("full_name")
          .eq("id", inspection.customer_id)
          .maybeSingle();
        customerName = customer?.full_name ?? null;
      }
      if (!customerName) {
        const { data: org } = await db
          .from("organizations")
          .select("name")
          .eq("id", contractRow.organization_id)
          .maybeSingle();
        customerName = org?.name ?? null;
      }
      contract = {
        number: contractRow.id.slice(0, 8).toUpperCase(),
        customerName,
        period: `${new Date(contractRow.period_starts_at).toLocaleDateString("pt-BR")} — ${new Date(contractRow.period_ends_at).toLocaleDateString("pt-BR")}`,
      };
    }
  }

  const studioVersions = createStudioVersionRepository(db);
  const branding = await studioVersions.findLatest("branding", report.tenant_id).catch(() => null);
  const brandingConfig = branding?.config as { companyName?: string; logoUrl?: string } | undefined;

  const [
    { data: sections },
    { data: responses },
    { data: mediaRows },
    { data: findingRows },
    { data: signatureRows },
  ] = await Promise.all([
    db
      .from("inspection_template_sections")
      .select("id, title, sort_order, inspection_template_items(id, label, field_type, sort_order)")
      .eq("template_id", inspection.template_id)
      .order("sort_order", { ascending: true }),
    db
      .from("inspection_responses")
      .select("item_id, value_text, value_number, value_boolean, value_json, notes")
      .eq("inspection_id", inspection.id),
    db
      .from("inspection_media")
      .select("id, item_id, storage_path, captured_at")
      .eq("inspection_id", inspection.id)
      .order("sort_order", { ascending: true })
      .limit(24),
    db
      .from("inspection_findings")
      .select("location_on_asset, description, severity, status, preexisting_finding_id")
      .eq("inspection_id", inspection.id),
    db
      .from("inspection_signatures")
      .select("signer_type, user_id, customer_id, operator_id, signed_at, acceptance_method")
      .eq("inspection_id", inspection.id)
      .order("signed_at", { ascending: true }),
  ]);

  const itemLabelById = new Map<string, string>();
  const responseByItem = new Map((responses ?? []).map((r) => [r.item_id, r]));
  const templateSections = (sections ?? []).map((s) => {
    const items = (
      (
        s as unknown as {
          inspection_template_items: {
            id: string;
            label: string;
            field_type: string;
            sort_order: number;
          }[];
        }
      ).inspection_template_items ?? []
    )
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((it) => {
        itemLabelById.set(it.id, it.label);
        const r = responseByItem.get(it.id);
        return {
          label: it.label,
          fieldType: it.field_type,
          response: r ? formatResponseValue(r) : "—",
          notes: r?.notes ?? null,
        };
      });
    return { title: s.title, items };
  });

  const admin = createAdminClient();
  const media = await Promise.all(
    (mediaRows ?? []).map(async (m) => {
      const { data: signed } = await admin.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(m.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        id: m.id,
        itemLabel: m.item_id ? (itemLabelById.get(m.item_id) ?? null) : null,
        capturedAt: m.captured_at,
        signedUrl: signed?.signedUrl ?? null,
      };
    }),
  );

  // BEFORE×AFTER: only meaningful when this inspection is a check-out
  // linked to a check-in (item 13/14 of the spec — always matched by
  // template_item, never by upload order).
  let beforeAfter: InspectionPdfInput["beforeAfter"] = [];
  if (inspection.linked_inspection_id) {
    const { data: comparisons } = await db
      .from("inspection_comparisons")
      .select("item_id, before_value, after_value, differs")
      .eq("before_inspection_id", inspection.linked_inspection_id)
      .eq("after_inspection_id", inspection.id);
    beforeAfter = (comparisons ?? []).map((c) => ({
      itemLabel: itemLabelById.get(c.item_id) ?? c.item_id,
      before: c.before_value ? JSON.stringify(c.before_value) : null,
      after: c.after_value ? JSON.stringify(c.after_value) : null,
      differs: c.differs,
    }));
  }

  const signerNameCache = new Map<string, string>();
  const signatures = await Promise.all(
    (signatureRows ?? []).map(async (s) => {
      let name = "—";
      if (s.signer_type === "operator" && s.operator_id) {
        const cacheKey = `op:${s.operator_id}`;
        if (!signerNameCache.has(cacheKey)) {
          const { data } = await db
            .from("operators")
            .select("full_name")
            .eq("id", s.operator_id)
            .maybeSingle();
          signerNameCache.set(cacheKey, data?.full_name ?? "Operador");
        }
        name = signerNameCache.get(cacheKey)!;
      } else if (s.signer_type === "customer" && s.customer_id) {
        const cacheKey = `cu:${s.customer_id}`;
        if (!signerNameCache.has(cacheKey)) {
          const { data } = await db
            .from("rental_customers")
            .select("full_name")
            .eq("id", s.customer_id)
            .maybeSingle();
          signerNameCache.set(cacheKey, data?.full_name ?? "Cliente");
        }
        name = signerNameCache.get(cacheKey)!;
      } else {
        name = "Equipe";
      }
      return {
        signerType: s.signer_type,
        signerName: name,
        signedAt: s.signed_at,
        method: s.acceptance_method,
      };
    }),
  );

  return {
    reportId: report.id,
    version: report.version,
    contentHash: report.content_hash,
    generatedAt: report.generated_at,
    verificationToken: report.verification_token,
    tenant: {
      name: brandingConfig?.companyName ?? tenant?.name ?? "Shinã",
      logoUrl: brandingConfig?.logoUrl ?? null,
    },
    inspection: {
      id: inspection.id,
      type: inspection.type,
      status: inspection.status,
      startedAt: inspection.started_at,
      completedAt: inspection.completed_at,
    },
    asset: asset
      ? {
          name: asset.name,
          category: asset.category ?? null,
          identifier: asset.serial_number ?? null,
        }
      : null,
    contract,
    operator: operator ? { fullName: operator.full_name } : null,
    template: { sections: templateSections },
    media,
    beforeAfter,
    findings: (findingRows ?? []).map((f) => ({
      location: f.location_on_asset,
      description: f.description,
      severity: f.severity,
      status: f.status,
      preexisting: f.preexisting_finding_id !== null,
    })),
    signatures,
  };
}
