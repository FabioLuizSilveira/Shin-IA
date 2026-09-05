import type { AgentMutationTool } from "../types";
import { validateOwnership } from "@/lib/asset-owner-settlement";
import { logActivity } from "@/lib/activity-log";

const VALID_CATEGORIES = ["vehicle", "equipment", "tool", "property", "technology"];

interface Args {
  name?: string;
  category?: string;
  asset_type_id?: string;
  serial_number?: string;
}

// Wraps POST /api/assets' exact validation and insert logic (branch
// auto-assign to the tenant's oldest branch, ownership defaults, activity
// log) — never a parallel implementation of "create an asset." Spec's
// literal LOW_RISK_WRITE "createAsset".
export const createAssetTool: AgentMutationTool<Args> = {
  name: "create_asset",
  description: "Cria um novo ativo (veículo, equipamento, etc.) no tenant.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nome do ativo" },
      category: {
        type: "string",
        description: "Categoria do ativo",
        enum: VALID_CATEGORIES,
      },
      asset_type_id: { type: "string", description: "UUID do tipo de ativo" },
      serial_number: { type: "string", description: "Número de série, opcional" },
    },
    required: ["name", "category", "asset_type_id"],
  },
  riskLevel: "LOW_RISK_WRITE",
  requiredPermission: "tenant.assets.create",
  requiredFeature: "agent.actions.assets",
  async validate(args, _ctx, scope) {
    if (!args.name?.trim() || !args.category || !VALID_CATEGORIES.includes(args.category)) {
      return { ok: false, error: "name and a valid category are required" };
    }
    if (!args.asset_type_id) return { ok: false, error: "asset_type_id is required" };

    const { data: assetType } = await scope.db
      .from("asset_types")
      .select("id")
      .eq("id", args.asset_type_id)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!assetType) return { ok: false, error: "asset_type_id not found for this tenant" };

    const ownership = validateOwnership({});
    if ("error" in ownership) return { ok: false, error: ownership.error };

    const { data: branch } = await scope.db
      .from("branches")
      .select("id")
      .eq("tenant_id", scope.tenantId)
      .limit(1)
      .maybeSingle();
    if (!branch) return { ok: false, error: "tenant has no branch to assign this asset to" };

    return { ok: true };
  },
  async summarize(args) {
    return `Criar ativo "${args.name}" (categoria: ${args.category}${args.serial_number ? `, série: ${args.serial_number}` : ""}).`;
  },
  async execute(args, _ctx, scope) {
    const ownership = validateOwnership({});
    if ("error" in ownership) return { ok: false, error: ownership.error };

    const { data: branch, error: branchError } = await scope.db
      .from("branches")
      .select("id")
      .eq("tenant_id", scope.tenantId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (branchError) return { ok: false, error: branchError.message };
    if (!branch) return { ok: false, error: "tenant has no branch to assign this asset to" };

    const { data: created, error: insertError } = await scope.db
      .from("assets")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: scope.tenantId,
        branch_id: branch.id,
        asset_type_id: args.asset_type_id,
        name: args.name!.trim(),
        serial_number: args.serial_number?.trim() || null,
        category: args.category,
        ownership_type: ownership.ownership_type,
        owner_org_id: ownership.owner_org_id,
        tenant_share_pct: ownership.tenant_share_pct,
      })
      .select("id, name, category")
      .single();
    if (insertError || !created)
      return { ok: false, error: insertError?.message ?? "insert failed" };

    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "asset",
      entityId: created.id as string,
      action: "created",
      metadata: { name: args.name, category: args.category, source: "shina_agent" },
    });

    return { ok: true, data: created };
  },
};
