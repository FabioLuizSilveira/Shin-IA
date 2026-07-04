import { NextResponse, type NextRequest } from "next/server";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { generateText, parseJsonResponse, AIProviderError } from "@/lib/ai/anthropic";
import { resolveAnthropicKey } from "@/lib/ai/byok";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Strategy {
  target_audience: string;
  key_message: string;
  channels: { channel: string; rationale: string }[];
  funnel: { stage: string; tactic: string }[];
  differentiators: string[];
  expected_kpis: { metric: string; target: string }[];
  risks: string[];
  next_steps: string[];
}

// POST { campaign_id } — AI Director generates a strategy for the campaign
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as { campaign_id?: string };
    if (!body.campaign_id) {
      return NextResponse.json({ error: "campaign_id is required" }, { status: 422 });
    }

    const supabase = await createClient();
    const { data: campaign } = await supabase
      .from("mkt_campaigns")
      .select("*, brand: mkt_brand_kits(*)")
      .eq("id", body.campaign_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

    if (!campaign) {
      return NextResponse.json({ error: "campaign not found" }, { status: 404 });
    }

    const brand = campaign.brand as {
      name?: string;
      description?: string;
      tone_of_voice?: string;
      tagline?: string;
    } | null;

    const system = `Você é o Diretor de Marketing (CMO) da empresa. Analise a campanha e produza uma estratégia completa e acionável para o mercado brasileiro.
Responda SOMENTE com JSON válido:
{"target_audience": "...", "key_message": "...", "channels": [{"channel": "...", "rationale": "..."}], "funnel": [{"stage": "topo|meio|fundo", "tactic": "..."}], "differentiators": ["..."], "expected_kpis": [{"metric": "...", "target": "..."}], "risks": ["..."], "next_steps": ["..."]}`;

    const prompt = [
      brand
        ? `## Marca\n${[brand.name, brand.tagline, brand.description, brand.tone_of_voice].filter(Boolean).join("\n")}`
        : null,
      `## Campanha\nNome: ${campaign.name}\nPlataforma: ${campaign.platform}\nObjetivo: ${campaign.objective ?? "não definido"}\nOrçamento diário: ${campaign.budget_daily ? `R$${campaign.budget_daily}` : "não definido"}`,
      "Gere a estratégia completa.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const started = Date.now();
    const apiKey = await resolveAnthropicKey(ctx.workspaceId);
    const result = await generateText({ system, prompt, maxTokens: 3000, apiKey });
    const strategy = parseJsonResponse<Strategy>(result.text);

    await supabase
      .from("mkt_campaigns")
      .update({ ai_strategy: strategy, updated_at: new Date().toISOString() })
      .eq("id", campaign.id)
      .eq("workspace_id", ctx.workspaceId);

    await supabase.from("mkt_ai_usage").insert({
      workspace_id: ctx.workspaceId,
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      provider: "anthropic",
      model: result.model,
      operation: "strategy",
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      duration_ms: Date.now() - started,
      entity_type: "campaign",
      entity_id: campaign.id,
    });

    return NextResponse.json({ data: strategy });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof AIProviderError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof SyntaxError || (e instanceof Error && e.message.includes("json"))) {
      return NextResponse.json(
        { error: "A IA retornou um formato inesperado. Tente novamente." },
        { status: 502 },
      );
    }
    throw e;
  }
}
