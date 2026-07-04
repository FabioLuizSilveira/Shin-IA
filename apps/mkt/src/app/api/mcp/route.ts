import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { MKT_MCP_TOOLS, validateDraftRequest } from "@shina/marketing-ai";

export const dynamic = "force-dynamic";

// MCP Server (Streamable HTTP, JSON-RPC 2.0).
// Auth: Authorization: Bearer <supabase access token> — RLS applies normally.
// Invariant: mutating tools only create drafts; nothing is ever published here.

const PROTOCOL_VERSION = "2025-03-26";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function bearerClient(token: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

export async function POST(req: NextRequest) {
  let rpc: JsonRpcRequest;
  try {
    rpc = (await req.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  // Protocol handshake methods work without auth
  if (rpc.method === "initialize") {
    return rpcResult(rpc.id, {
      protocolVersion: PROTOCOL_VERSION,
      serverInfo: { name: "shina-marketing-ia", version: "1.0.0" },
      capabilities: { tools: {} },
    });
  }
  if (rpc.method === "notifications/initialized" || rpc.method === "ping") {
    return rpcResult(rpc.id, {});
  }

  if (rpc.method === "tools/list") {
    return rpcResult(rpc.id, {
      tools: MKT_MCP_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  }

  if (rpc.method !== "tools/call") {
    return rpcError(rpc.id, -32601, `Method not found: ${rpc.method}`);
  }

  // ── tools/call requires auth ────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return rpcError(rpc.id, -32001, "Unauthorized: send Authorization: Bearer <token>");
  }

  const supabase = bearerClient(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return rpcError(rpc.id, -32001, "Unauthorized: invalid token");

  const tenantId = (user.app_metadata as { tenant_id?: string }).tenant_id;
  if (!tenantId) return rpcError(rpc.id, -32001, "No tenant associated with this user");

  const { data: workspace } = await supabase
    .from("mkt_workspaces")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!workspace) return rpcError(rpc.id, -32002, "No workspace found for this tenant");

  const params = rpc.params as { name?: string; arguments?: Record<string, unknown> };
  const toolName = params?.name;
  const args = params?.arguments ?? {};
  const agentId = `mcp:${req.headers.get("user-agent")?.slice(0, 40) ?? "unknown"}`;

  const toolText = (payload: unknown) => ({
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  });

  try {
    switch (toolName) {
      case "list_campaigns": {
        let query = supabase
          .from("mkt_campaigns")
          .select("id, name, platform, objective, budget_daily, status, start_date")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (typeof args.platform === "string") query = query.eq("platform", args.platform);
        if (typeof args.status === "string") query = query.eq("status", args.status);
        const { data, error } = await query;
        if (error) return rpcError(rpc.id, -32000, error.message);
        return rpcResult(rpc.id, toolText({ campaigns: data }));
      }

      case "get_performance": {
        let query = supabase
          .from("mkt_ads")
          .select("id, campaign_id, headline, status, performance, synced_at")
          .eq("workspace_id", workspace.id)
          .limit(100);
        if (typeof args.campaign_id === "string") query = query.eq("campaign_id", args.campaign_id);
        const { data, error } = await query;
        if (error) return rpcError(rpc.id, -32000, error.message);
        return rpcResult(rpc.id, toolText({ ads: data }));
      }

      case "search_ad_library": {
        let query = supabase
          .from("mkt_ad_library_entries")
          .select("id, brand_name, platform, headline, body_copy, cta, landing_url")
          .eq("workspace_id", workspace.id)
          .limit(typeof args.limit === "number" ? Math.min(args.limit, 50) : 20);
        if (typeof args.brand === "string") query = query.ilike("brand_name", `%${args.brand}%`);
        if (typeof args.platform === "string") query = query.eq("platform", args.platform);
        if (typeof args.keywords === "string") {
          query = query.or(`headline.ilike.%${args.keywords}%,body_copy.ilike.%${args.keywords}%`);
        }
        const { data, error } = await query;
        if (error) return rpcError(rpc.id, -32000, error.message);
        return rpcResult(rpc.id, toolText({ ads: data }));
      }

      case "list_drafts_pending_approval": {
        const { data, error } = await supabase
          .from("mkt_drafts")
          .select("id, entity_type, action, payload, created_at")
          .eq("workspace_id", workspace.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (error) return rpcError(rpc.id, -32000, error.message);
        return rpcResult(rpc.id, toolText({ pending_drafts: data }));
      }

      case "generate_ad_copy": {
        return rpcResult(
          rpc.id,
          toolText({
            note: "Use the web app generator (or POST /api/generate) for brand-aware AI copy. This MCP tool returns the brief structure to fill.",
            required: { platform: args.platform, objective: args.objective, product: args.product },
          }),
        );
      }

      case "create_campaign_draft":
      case "create_ad_draft":
      case "update_budget_draft":
      case "pause_campaign_draft": {
        const draftSpec: Record<string, { entityType: "campaign" | "ad"; action: string }> = {
          create_campaign_draft: { entityType: "campaign", action: "create" },
          create_ad_draft: { entityType: "ad", action: "create" },
          update_budget_draft: { entityType: "campaign", action: "budget_change" },
          pause_campaign_draft: { entityType: "campaign", action: "pause" },
        };
        const spec = draftSpec[toolName];

        const validation = validateDraftRequest({
          entityType: spec.entityType,
          action: spec.action as "create" | "budget_change" | "pause",
          payload: args,
          requestedBy: user.id,
          agentId,
        });
        if (!validation.ok) return rpcError(rpc.id, -32000, validation.reason);

        const { data: draft, error } = await supabase
          .from("mkt_drafts")
          .insert({
            workspace_id: workspace.id,
            tenant_id: tenantId,
            entity_type: spec.entityType,
            entity_id: typeof args.campaign_id === "string" ? args.campaign_id : null,
            action: spec.action,
            payload: args,
            requested_by: user.id,
            agent_id: agentId,
          })
          .select("id")
          .single();
        if (error) return rpcError(rpc.id, -32000, error.message);

        await supabase.from("mkt_audit_trail").insert({
          workspace_id: workspace.id,
          tenant_id: tenantId,
          user_id: user.id,
          agent_id: agentId,
          action: `draft_${spec.action}_requested`,
          entity_type: spec.entityType,
          entity_id: draft.id,
          payload: args,
        });

        return rpcResult(
          rpc.id,
          toolText({
            draft_id: draft.id,
            status: "pending",
            message:
              "Draft created. A human must approve it in the Approvals center before anything is published.",
          }),
        );
      }

      default:
        return rpcError(rpc.id, -32602, `Unknown tool: ${toolName}`);
    }
  } catch (e) {
    return rpcError(rpc.id, -32000, e instanceof Error ? e.message : "Internal error");
  }
}

// GET returns server info for discovery / health checks
export async function GET() {
  return NextResponse.json({
    name: "shina-marketing-ia",
    protocol: "mcp",
    protocolVersion: PROTOCOL_VERSION,
    transport: "streamable-http",
    tools: MKT_MCP_TOOLS.map((t) => t.name),
    auth: "Authorization: Bearer <supabase access token>",
  });
}
