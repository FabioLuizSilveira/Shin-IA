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

interface CloneResult {
  detected_layout: {
    structure: string;
    visual_style: string;
    text_elements: string[];
    color_scheme: string;
  };
  adapted_headline: string;
  adapted_body: string;
  adapted_cta: string;
  image_prompt: string;
  notes: string;
}

export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_cloned_ads")
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

export async function POST(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as {
      source_url?: string;
      brand_kit_id?: string;
      product_description?: string;
    };

    if (!body.source_url?.trim()) {
      return NextResponse.json({ error: "source_url is required" }, { status: 422 });
    }
    let sourceUrl: URL;
    try {
      sourceUrl = new URL(body.source_url.trim());
      if (sourceUrl.protocol !== "https:" && sourceUrl.protocol !== "http:") throw new Error();
    } catch {
      return NextResponse.json(
        { error: "source_url must be a valid http(s) URL" },
        { status: 422 },
      );
    }

    const supabase = await createClient();

    let brandContext = "uma marca genérica";
    if (body.brand_kit_id) {
      const { data: kit } = await supabase
        .from("mkt_brand_kits")
        .select("*")
        .eq("id", body.brand_kit_id)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (kit) {
        const colors = (kit.palette as { name: string; hex: string }[] | null)
          ?.map((c) => `${c.name} (${c.hex})`)
          .join(", ");
        brandContext = [
          `Marca: ${kit.name}`,
          kit.tagline ? `Tagline: ${kit.tagline}` : null,
          kit.description ? `Sobre: ${kit.description}` : null,
          kit.tone_of_voice ? `Tom de voz: ${kit.tone_of_voice}` : null,
          colors ? `Cores da marca: ${colors}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }

    const system = `Você é um diretor de arte especialista em engenharia reversa de anúncios de performance.
Analise o anúncio de referência na imagem e adapte-o para a marca do usuário, mantendo a estrutura visual e o ângulo persuasivo que fazem o anúncio funcionar — mas trocando textos, cores e produto pela identidade da marca.
Responda SOMENTE com JSON válido:
{"detected_layout": {"structure": "descrição da composição", "visual_style": "estilo visual", "text_elements": ["elementos de texto detectados"], "color_scheme": "esquema de cores do original"}, "adapted_headline": "...", "adapted_body": "...", "adapted_cta": "...", "image_prompt": "prompt detalhado em inglês para recriar o layout com a identidade da nova marca", "notes": "o que faz este anúncio funcionar e o que foi adaptado"}`;

    const prompt = [
      `## Marca do usuário\n${brandContext}`,
      body.product_description ? `## Produto/oferta a promover\n${body.product_description}` : null,
      `Analise o anúncio da imagem e gere a adaptação.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const idempotencyKey = req.headers.get("x-idempotency-key");
    const result = await runAiGateway({
      db: supabase,
      adminDb: createAdminClient(),
      ctx,
      operation: "clone_ad",
      capability: "vision",
      entityType: "cloned_ad",
      system,
      prompt,
      imageUrl: sourceUrl.toString(),
      idempotencyKey,
      credentialMode: "auto",
      product: "mkt",
      decryptByokKey: decryptSecret,
    });
    const clone = parseJsonResponse<CloneResult>(result.text);

    const { data: saved, error: saveError } = await supabase
      .from("mkt_cloned_ads")
      .insert({
        workspace_id: ctx.workspaceId,
        tenant_id: ctx.tenantId,
        brand_kit_id: body.brand_kit_id ?? null,
        source_type: "url",
        source_url: sourceUrl.toString(),
        detected_layout: clone.detected_layout ?? {},
        adapted_headline: clone.adapted_headline,
        adapted_body: clone.adapted_body,
        adapted_cta: clone.adapted_cta,
        image_prompt: clone.image_prompt,
        notes: clone.notes ?? null,
        tokens_used: result.tokensIn + result.tokensOut,
        model_used: result.model,
        created_by: ctx.userId,
      })
      .select("*")
      .single();

    if (saveError) return internalError(saveError);

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
