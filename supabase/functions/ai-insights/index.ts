import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

type InsightType = "executive_summary" | "anomalies" | "optimization" | "demand_forecast";

interface InsightRequest {
  type: InsightType;
  context: {
    tenantName: string;
    operations?: { total: number; completed: number; failed: number; open: number };
    assets?: { total: number; available: number; inUse: number; maintenance: number };
    contracts?: { active: number; totalValue: number; expiringSoon: number };
    period?: "week" | "month" | "quarter";
  };
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: AnthropicMessage[];
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  error?: { message: string };
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o AI Advisor da plataforma Shinã — especialista em inteligência operacional para frotas e mobilidade.
Responda sempre em português do Brasil. Seja direto, objetivo e orientado a ação.
Use bullet points e estruture bem a resposta. Máximo de 3 parágrafos ou 5-7 bullet points por seção.
Não mencione que você é uma IA ou Claude. Foque 100% nos dados e insights do negócio.`;

function buildPrompt(req: InsightRequest): string {
  const { type, context } = req;
  const period = context.period ?? "week";
  const periodLabel = period === "week" ? "semana" : period === "month" ? "mês" : "trimestre";

  switch (type) {
    case "executive_summary": {
      const ops = context.operations;
      const assets = context.assets;
      const contracts = context.contracts;

      return `Gere um resumo executivo para o tenant "${context.tenantName}" referente à última ${periodLabel}:

Dados operacionais:
${ops ? `- Operações totais: ${ops.total} | Concluídas: ${ops.completed} | Falhas: ${ops.failed} | Em aberto: ${ops.open}` : "- Sem dados de operações"}
${assets ? `- Frota: ${assets.total} ativos | Disponíveis: ${assets.available} | Em uso: ${assets.inUse} | Manutenção: ${assets.maintenance}` : "- Sem dados de frota"}
${contracts ? `- Contratos ativos: ${contracts.active} | Valor total: R$ ${contracts.totalValue.toLocaleString("pt-BR")} | Vencendo em breve: ${contracts.expiringSoon}` : "- Sem dados de contratos"}

Forneça:
1. Situação geral (1 parágrafo)
2. Principais conquistas da ${periodLabel}
3. Pontos de atenção prioritários
4. Top 3 ações recomendadas para a próxima ${periodLabel}`;
    }

    case "anomalies": {
      const ops = context.operations;
      const assets = context.assets;

      return `Analise possíveis anomalias operacionais para o tenant "${context.tenantName}":

Dados:
${ops ? `- Taxa de falha: ${ops.total > 0 ? ((ops.failed / ops.total) * 100).toFixed(1) : 0}% (${ops.failed}/${ops.total} operações)` : "- Sem dados de operações"}
${ops ? `- Taxa de conclusão: ${ops.total > 0 ? ((ops.completed / ops.total) * 100).toFixed(1) : 0}%` : ""}
${assets ? `- Taxa de manutenção na frota: ${assets.total > 0 ? ((assets.maintenance / assets.total) * 100).toFixed(1) : 0}% (${assets.maintenance}/${assets.total})` : "- Sem dados de frota"}

Identifique:
1. Padrões anômalos detectados (baseado nas taxas acima)
2. Impacto estimado no negócio
3. Ações corretivas recomendadas`;
    }

    case "optimization": {
      const assets = context.assets;
      const ops = context.operations;

      return `Gere sugestões de otimização para o tenant "${context.tenantName}":

Situação atual:
${assets ? `- Utilização da frota: ${assets.total > 0 ? ((assets.inUse / assets.total) * 100).toFixed(0) : 0}%` : "- Sem dados de frota"}
${ops ? `- Operações abertas: ${ops.open} | Eficiência: ${ops.total > 0 ? ((ops.completed / ops.total) * 100).toFixed(0) : 0}%` : "- Sem dados de operações"}

Forneça 5 sugestões práticas de otimização:
- Para cada sugestão: o que fazer, por que fazer, impacto esperado.`;
    }

    case "demand_forecast": {
      const ops = context.operations;

      return `Com base nos dados do tenant "${context.tenantName}", gere uma previsão de demanda para os próximos 7 dias:

Base histórica (${periodLabel} atual):
${ops ? `- Volume médio: ${ops.total} operações | Taxa de crescimento estimada: calcule baseado nos dados` : "- Sem histórico suficiente para previsão precisa"}

Forneça:
1. Estimativa de volume de operações para os próximos 7 dias
2. Picos de demanda esperados (dias da semana)
3. Recursos recomendados para o período
4. Alertas de capacidade`;
    }

    default:
      return `Gere insights operacionais para o tenant "${context.tenantName}".`;
  }
}

// ─── Claude API call ──────────────────────────────────────────────────────────

async function callClaude(
  prompt: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!apiKey) {
    // Dev mode fallback
    return {
      text: `**[Modo desenvolvimento — ANTHROPIC_API_KEY não configurada]**\n\nInsight simulado para: "${prompt.slice(0, 80)}..."`,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const body: AnthropicRequest = {
    model: "claude-3-5-haiku-20241022",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as AnthropicResponse;

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Anthropic API error: ${res.status}`);
  }

  const text = json.content.find((c) => c.type === "text")?.text ?? "";
  return {
    text,
    inputTokens: json.usage.input_tokens,
    outputTokens: json.usage.output_tokens,
  };
}

// ─── Cache (in-memory per function instance, ~1h TTL) ─────────────────────────

const cache = new Map<string, { text: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(req: InsightRequest): string {
  return `${req.type}:${JSON.stringify(req.context)}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let payload: InsightRequest;
  try {
    payload = (await req.json()) as InsightRequest;
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload.type || !payload.context?.tenantName) {
    return Response.json(
      { error: "Missing required fields: type, context.tenantName" },
      { status: 422 },
    );
  }

  // Check cache
  const key = cacheKey(payload);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[ai-insights] cache hit: ${payload.type}`);
    return Response.json({ insight: cached.text, cached: true }, { status: 200 });
  }

  try {
    const prompt = buildPrompt(payload);
    console.log(
      `[ai-insights] calling Claude for type=${payload.type}, tenant=${payload.context.tenantName}`,
    );

    const result = await callClaude(prompt);

    // Store in cache
    cache.set(key, { text: result.text, expiresAt: Date.now() + CACHE_TTL_MS });

    console.log(`[ai-insights] done: ${result.inputTokens}in + ${result.outputTokens}out tokens`);

    return Response.json(
      {
        insight: result.text,
        cached: false,
        usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("[ai-insights] error:", msg);
    return Response.json({ error: msg }, { status: 502 });
  }
});
