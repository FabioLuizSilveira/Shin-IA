import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";
import {
  toolGetAssetHealthScore,
  toolGetAssetAnomalies,
  toolGetAssetPredictiveRisk,
  toolGetAssetMaintenanceHistory,
  toolGetOpenRecommendations,
  toolGetFleetOverview,
} from "@/lib/maintenance-copilot-tools";

export const dynamic = "force-dynamic";

// AI Copilot (Etapa 13) — the mandatory architecture, enforced by
// construction:
//
//   User question -> this route (permission + tenant scope resolved
//   from the caller's own session, never from the request body) ->
//   a FIXED, whitelisted set of pre-approved query functions ->
//   structured JSON -> handed to the LLM, which only ever explains it.
//
// TOOLS below is the entire whitelist. There is no tool that accepts a
// SQL string, a table name, or a raw filter -- every tool takes at most
// an assetId, already validated by the tool function itself against
// scope.tenantId before it ever queries anything. The LLM cannot expand
// this set: TOOL_HANDLERS is a closed Record, an unrecognized tool name
// from the model is treated as a no-op with an explicit error result
// (defensive, not expected to ever trigger since Claude only ever picks
// from the schema it was given).
const TOOLS = [
  {
    name: "get_asset_health_score",
    description: "Score de saúde 0-100 de um ativo específico, com o detalhamento de deduções.",
    input_schema: {
      type: "object",
      properties: { assetId: { type: "string", description: "UUID do ativo" } },
      required: ["assetId"],
    },
  },
  {
    name: "get_asset_anomalies",
    description: "Anomalias detectadas no histórico de manutenção de um ativo específico.",
    input_schema: {
      type: "object",
      properties: { assetId: { type: "string", description: "UUID do ativo" } },
      required: ["assetId"],
    },
  },
  {
    name: "get_asset_predictive_risk",
    description:
      "Estimativa de risco (não é previsão de falha) de um ativo específico, baseada em saúde, anomalias e proximidade de preventiva.",
    input_schema: {
      type: "object",
      properties: { assetId: { type: "string", description: "UUID do ativo" } },
      required: ["assetId"],
    },
  },
  {
    name: "get_asset_maintenance_history",
    description:
      "Histórico consolidado de manutenção de um ativo: custo total, ordens recentes, componentes reincidentes, próximas preventivas.",
    input_schema: {
      type: "object",
      properties: { assetId: { type: "string", description: "UUID do ativo" } },
      required: ["assetId"],
    },
  },
  {
    name: "get_open_recommendations",
    description:
      "Recomendações pendentes de manutenção, opcionalmente filtradas por um ativo específico.",
    input_schema: {
      type: "object",
      properties: { assetId: { type: "string", description: "UUID do ativo (opcional)" } },
    },
  },
  {
    name: "get_fleet_overview",
    description:
      "Visão geral da frota inteira do tenant: total de ativos, ordens abertas, custo de manutenção dos últimos 30 dias.",
    input_schema: { type: "object", properties: {} },
  },
] as const;

const SYSTEM_PROMPT = `Você é o Copiloto de Manutenção da plataforma Shinã.

REGRAS OBRIGATÓRIAS:
- Você só pode obter informações através das ferramentas (tools) fornecidas. Nunca invente dados, nunca acesse ou mencione acessar o banco de dados diretamente, nunca gere SQL.
- Toda afirmação sobre dados reais deve vir literalmente do resultado de uma ferramenta chamada nesta conversa.
- Se as ferramentas disponíveis não derem informação suficiente para responder, diga isso claramente em vez de adivinhar.
- Nunca decida ou execute uma ação (como aprovar, agendar ou aceitar algo) -- você só explica e recomenda; qualquer decisão real é feita por um humano na interface do Shinã.
- Responda em português do Brasil, de forma direta e objetiva.`;

type ToolName = (typeof TOOLS)[number]["name"];

interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface AnthropicTextBlock {
  type: "text";
  text: string;
}
type AnthropicContentBlock = AnthropicToolUseBlock | AnthropicTextBlock;

const MAX_TURNS = 4;

// Same two-transport resolution as requireTenantScope() -- a bearer
// caller (mobile app, API scripts) must not silently fall through to a
// bare 401 the way a cookie-only lookup would (caught live in the
// Document AI round for the same shape of route).
async function resolveAccessToken(): Promise<string | null> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice("bearer ".length).trim();
  }
  const sessionClient = await createClient();
  const {
    data: { session },
  } = await sessionClient.auth.getSession();
  return session?.access_token ?? null;
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.ai_use"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { question?: string };
  if (!body.question?.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  // Closed dispatch table -- assetId always comes from the model's tool
  // call, but every handler re-validates it against scope.tenantId before
  // touching the database (see maintenance-copilot-tools.ts), so a
  // cross-tenant assetId the model was never given still can't leak data.
  const TOOL_HANDLERS: Record<ToolName, (input: Record<string, unknown>) => Promise<unknown>> = {
    get_asset_health_score: (input) => toolGetAssetHealthScore(scope, String(input.assetId ?? "")),
    get_asset_anomalies: (input) => toolGetAssetAnomalies(scope, String(input.assetId ?? "")),
    get_asset_predictive_risk: (input) =>
      toolGetAssetPredictiveRisk(scope, String(input.assetId ?? "")),
    get_asset_maintenance_history: (input) =>
      toolGetAssetMaintenanceHistory(scope, String(input.assetId ?? "")),
    get_open_recommendations: (input) =>
      toolGetOpenRecommendations(scope, input.assetId ? String(input.assetId) : undefined),
    get_fleet_overview: () => toolGetFleetOverview(scope),
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const accessToken = await resolveAccessToken();
  if (!accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: body.question },
  ];
  const toolCallLog: { tool: string; input: unknown }[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let fnRes: Response;
    try {
      fnRes = await fetch(`${supabaseUrl}/functions/v1/maintenance-copilot`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ system: SYSTEM_PROMPT, messages, tools: TOOLS }),
      });
    } catch {
      return NextResponse.json({ error: "Copilot service unavailable" }, { status: 502 });
    }
    const json = (await fnRes.json().catch(() => ({}))) as {
      content?: AnthropicContentBlock[];
      stopReason?: string;
      error?: string;
    };
    if (!fnRes.ok || json.error) {
      return NextResponse.json({ error: json.error ?? "Copilot error" }, { status: 502 });
    }

    const content = json.content ?? [];
    if (json.stopReason !== "tool_use") {
      const text = content
        .filter((c): c is AnthropicTextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return NextResponse.json({ data: { answer: text, toolCalls: toolCallLog } });
    }

    messages.push({ role: "assistant", content });

    const toolResults: unknown[] = [];
    for (const block of content) {
      if (block.type !== "tool_use") continue;
      const handler = TOOL_HANDLERS[block.name as ToolName];
      const result = handler
        ? await handler(block.input)
        : { error: `unknown tool "${block.name}"` };
      toolCallLog.push({ tool: block.name, input: block.input });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return NextResponse.json(
    { error: "Copilot exceeded the maximum number of tool-use turns" },
    { status: 502 },
  );
}
