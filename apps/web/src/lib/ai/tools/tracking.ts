import type { AgentTool } from "../tool-types";

const DEFAULT_LIMIT = 100;

// Naming note (found during the Wave 4 audit, not assumed): the live schema
// has NO link between `assets` and `resources`/`resource_locations` — they
// are separate, unlinked tables (see mobile-tracking-scope.ts's own
// comment). The spec calls this "getAssetLocation", but there is no
// asset->resource resolution anywhere in the codebase to build one from —
// this tool is keyed on resourceId, matching what the tracking data
// actually is (GET /api/resources/locations, the mobile current/history
// routes), rather than inventing a mapping that doesn't exist.
export const getResourceLocationTool: AgentTool<{ resourceId: string }> = {
  name: "get_resource_location",
  description: "Última localização conhecida de um recurso rastreado (ex: veículo com rastreador).",
  inputSchema: {
    type: "object",
    properties: { resourceId: { type: "string", description: "UUID do recurso" } },
    required: ["resourceId"],
  },
  requiredPermission: "tenant.tracking.view",
  requiredFeature: "agent.tools.tracking",
  async execute(args, _ctx, scope) {
    const { data, error } = await scope.db
      .from("resource_locations")
      .select("resource_id, latitude, longitude, recorded_at, resources(name, type, status)")
      .eq("tenant_id", scope.tenantId)
      .eq("resource_id", args.resourceId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "no location recorded for this resource" };
    return { ok: true, data };
  },
};

export const getTrackingEventsTool: AgentTool<{
  resourceId: string;
  from?: string;
  to?: string;
}> = {
  name: "get_tracking_events",
  description: "Histórico de localizações de um recurso rastreado, em um intervalo de datas.",
  inputSchema: {
    type: "object",
    properties: {
      resourceId: { type: "string", description: "UUID do recurso" },
      from: { type: "string", description: "Data inicial, ISO 8601, opcional" },
      to: { type: "string", description: "Data final, ISO 8601, opcional" },
    },
    required: ["resourceId"],
  },
  requiredPermission: "tenant.tracking.view",
  requiredFeature: "agent.tools.tracking",
  async execute(args, _ctx, scope) {
    let q = scope.db
      .from("resource_locations")
      .select("latitude, longitude, recorded_at, source")
      .eq("tenant_id", scope.tenantId)
      .eq("resource_id", args.resourceId)
      .order("recorded_at", { ascending: false })
      .limit(DEFAULT_LIMIT);
    if (args.from) q = q.gte("recorded_at", args.from);
    if (args.to) q = q.lte("recorded_at", args.to);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? [] };
  },
};
