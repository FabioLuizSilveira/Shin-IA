import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto";
import {
  parseJsonResponse,
  AIProviderError,
  runAiGateway,
  DuplicateRequestError,
  AiPolicyError,
  InsufficientCreditsError,
} from "@shina/ai-gateway";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface GeneratedAd {
  headline: string;
  body_copy: string;
  cta: string;
  image_prompt: string;
  variations: { headline: string; body_copy: string; cta: string }[];
}

// GET — list generated ads for the workspace
export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_generated_ads")
      .select("*")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return internalError(error);
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

// POST — generate a new ad with brand context
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as {
      brand_kit_id?: string;
      platform?: string;
      format?: string;
      objective?: string;
      brief?: string;
    };

    if (!body.brief?.trim()) {
      return NextResponse.json({ error: "brief is required" }, { status: 422 });
    }

    const supabase = await createClient();

    // Brand context (optional but strongly recommended)
    let brandContext = "";
    if (body.brand_kit_id) {
      const { data: kit } = await supabase
        .from("mkt_brand_kits")
        .select("*")
        .eq("id", body.brand_kit_id)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (kit) {
        brandContext = [
          `Marca: ${kit.name}`,
          kit.tagline ? `Tagline: ${kit.tagline}` : null,
          kit.description ? `Sobre: ${kit.description}` : null,
          kit.tone_of_voice ? `Tom de voz: ${kit.tone_of_voice}` : null,
          kit.website_url ? `Site: ${kit.website_url}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }

    const system = `Você é um diretor de criação especialista em anúncios de performance para o mercado brasileiro.
Responda SOMENTE com um objeto JSON válido, sem texto adicional, no formato:
{"headline": "...", "body_copy": "...", "cta": "...", "image_prompt": "...", "variations": [{"headline": "...", "body_copy": "...", "cta": "..."}, ...]}
- headline: máximo 40 caracteres, impactante
- body_copy: 1-3 frases persuasivas adequadas à plataforma
- cta: chamada curta para ação
- image_prompt: prompt detalhado em inglês para gerar a imagem do anúncio
- variations: exatamente 3 variações com ângulos diferentes (dor, benefício, prova social)`;

    const prompt = [
      brandContext ? `## Contexto da marca\n${brandContext}` : null,
      `## Plataforma\n${body.platform ?? "meta"}`,
      body.objective ? `## Objetivo da campanha\n${body.objective}` : null,
      `## Briefing\n${body.brief.trim()}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const idempotencyKey = req.headers.get("x-idempotency-key");
    const result = await runAiGateway({
      db: supabase,
      adminDb: createAdminClient(),
      ctx,
      operation: "generate_ad",
      capability: "text",
      entityType: "generated_ad",
      system,
      prompt,
      idempotencyKey,
      credentialMode: "auto",
      product: "mkt",
      decryptByokKey: decryptSecret,
    });
    const ad = parseJsonResponse<GeneratedAd>(result.text);

    const { data: saved, error: saveError } = await supabase
      .from("mkt_generated_ads")
      .insert({
        workspace_id: ctx.workspaceId,
        tenant_id: ctx.tenantId,
        brand_kit_id: body.brand_kit_id ?? null,
        platform: body.platform ?? "meta",
        format: body.format ?? "1080x1080",
        objective: body.objective ?? null,
        brief: body.brief.trim(),
        headline: ad.headline,
        body_copy: ad.body_copy,
        cta: ad.cta,
        image_prompt: ad.image_prompt,
        variations: ad.variations ?? [],
        tokens_used: result.tokensIn + result.tokensOut,
        model_used: result.model,
        created_by: ctx.userId,
      })
      .select("*")
      .single();

    if (saveError) {
      return internalError(saveError);
    }

    // The gateway wrote the usage row before this entity existed — link it
    // now (best-effort, never blocks the response on this).
    await supabase
      .from("ai_gateway_usage")
      .update({ entity_id: saved.id })
      .eq("id", result.usageId);

    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof AiPolicyError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    if (e instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: e.message, code: "insufficient_credits" }, { status: 402 });
    }
    if (e instanceof DuplicateRequestError) {
      return NextResponse.json({ error: e.message, code: "duplicate_request" }, { status: 409 });
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
