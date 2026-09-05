import type { AgentTool } from "../tool-types";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";

// Same SELECT/queries as GET /api/inspections/[id]/route.ts. That route has
// no hasTenantPermission() gate at all today (only requireTenantScope()) —
// this tool still requires tenant.inspections.view (a real, already-seeded
// catalog key, see supabase/migrations/20260098000000_inspection_engine.sql)
// per the agent platform's own permission-scoped invariant.
const SELECT =
  "id, asset_id, contract_id, operation_id, customer_id, operator_id, responsible_user_id, template_id, type, status, linked_inspection_id, started_at, completed_at, created_at, updated_at";

export const getInspectionTool: AgentTool<{ inspectionId: string }> = {
  name: "get_inspection",
  description:
    "Detalhes de uma vistoria específica: respostas do checklist, mídia, achados (findings) e disputas.",
  inputSchema: {
    type: "object",
    properties: { inspectionId: { type: "string", description: "UUID da vistoria" } },
    required: ["inspectionId"],
  },
  requiredPermission: "tenant.inspections.view",
  requiredFeature: "agent.tools.inspections",
  async execute(args, _ctx, scope) {
    const { data: inspection, error } = await scope.db
      .from("inspections")
      .select(SELECT)
      .eq("id", args.inspectionId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!inspection) return { ok: false, error: "inspection not found" };

    const [
      { data: responses, error: responsesError },
      { data: findings, error: findingsError },
      { data: disputes, error: disputesError },
    ] = await Promise.all([
      scope.db
        .from("inspection_responses")
        .select("id, item_id, value_text, value_number, value_boolean, value_json, notes")
        .eq("inspection_id", args.inspectionId),
      scope.db
        .from("inspection_findings")
        .select("id, item_id, description, severity, status, ai_suggested, maintenance_order_id")
        .eq("inspection_id", args.inspectionId),
      scope.db
        .from("inspection_disputes")
        .select("id, item_id, description, status, resolution_notes, created_at")
        .eq("inspection_id", args.inspectionId)
        .order("created_at", { ascending: false }),
    ]);
    if (responsesError) return { ok: false, error: responsesError.message };
    if (findingsError) return { ok: false, error: findingsError.message };
    if (disputesError) return { ok: false, error: disputesError.message };

    const repo = createInspectionTemplateRepository(scope.db);
    const template = await repo.getHydratedTemplateById(inspection.template_id);

    return {
      ok: true,
      data: {
        inspection,
        template,
        responses: responses ?? [],
        findings: findings ?? [],
        disputes: disputes ?? [],
      },
    };
  },
};

export const getInspectionFindingsTool: AgentTool<{ inspectionId: string }> = {
  name: "get_inspection_findings",
  description: "Lista os achados (findings) registrados em uma vistoria específica.",
  inputSchema: {
    type: "object",
    properties: { inspectionId: { type: "string", description: "UUID da vistoria" } },
    required: ["inspectionId"],
  },
  requiredPermission: "tenant.inspections.view",
  requiredFeature: "agent.tools.inspections",
  async execute(args, _ctx, scope) {
    // Confirm the inspection belongs to this tenant BEFORE reading its
    // findings — inspection_findings itself has no tenant_id column, so
    // this check is the only thing standing between an inspectionId from
    // another tenant and that tenant's findings.
    const { data: inspection } = await scope.db
      .from("inspections")
      .select("id")
      .eq("id", args.inspectionId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!inspection) return { ok: false, error: "inspection not found" };

    const { data, error } = await scope.db
      .from("inspection_findings")
      .select(
        "id, item_id, description, severity, status, ai_suggested, overlay_region, maintenance_order_id, estimated_cost_amount, approved_cost_amount",
      )
      .eq("inspection_id", args.inspectionId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },
};
