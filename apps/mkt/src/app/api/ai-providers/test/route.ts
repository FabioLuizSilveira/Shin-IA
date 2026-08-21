import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { generateText, AIProviderError } from "@/lib/ai/anthropic";

export const dynamic = "force-dynamic";

const RATE_LIMIT_SECONDS = 10;

// POST { provider } — validates the workspace's stored BYOK credential with
// a minimal real call, never returns the credential or the provider's raw
// error body (item 18: authenticated, workspace-scoped, rate-limited,
// audited; no sensitive detail leaked to the client).
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as { provider?: string };
    if (body.provider !== "anthropic") {
      // Only the Anthropic path has a real client implementation today —
      // see docs/ai/AI_PROVIDER_STRATEGY.md's "not implemented" list.
      return NextResponse.json(
        { error: "Validação em tempo real só está disponível para Anthropic nesta versão." },
        { status: 501 },
      );
    }

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("mkt_ai_providers")
      .select("id, api_key_enc, default_model, last_validated_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("provider", "anthropic")
      .maybeSingle();
    if (error) return internalError(error);
    if (!row?.api_key_enc) {
      return NextResponse.json(
        { error: "Nenhuma chave conectada para este provedor." },
        { status: 404 },
      );
    }

    if (row.last_validated_at) {
      const elapsedSec = (Date.now() - new Date(row.last_validated_at).getTime()) / 1000;
      if (elapsedSec < RATE_LIMIT_SECONDS) {
        return NextResponse.json(
          {
            error: `Aguarde ${Math.ceil(RATE_LIMIT_SECONDS - elapsedSec)}s antes de validar novamente.`,
          },
          { status: 429 },
        );
      }
    }

    let apiKey: string;
    try {
      apiKey = await decryptSecret(row.api_key_enc);
    } catch {
      return NextResponse.json({ error: "Chave corrompida — reconecte." }, { status: 422 });
    }

    let ok = true;
    let reason: string | undefined;
    try {
      await generateText({
        system: "Responda apenas com a palavra: ok",
        prompt: "ping",
        maxTokens: 5,
        model: row.default_model ?? undefined,
        apiKey,
      });
    } catch (e) {
      ok = false;
      // Deliberately generic — never forward the provider's raw error text
      // (could contain account/billing detail) to the client.
      reason = e instanceof AIProviderError && e.status === 401 ? "invalid_key" : "provider_error";
    }

    await supabase
      .from("mkt_ai_providers")
      .update({ last_validated_at: new Date().toISOString(), is_active: ok })
      .eq("id", row.id);

    await supabase.from("mkt_audit_trail").insert({
      workspace_id: ctx.workspaceId,
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      action: "ai_provider.test_connection",
      entity_type: "mkt_ai_providers",
      entity_id: row.id,
      payload: { provider: "anthropic", ok, reason: reason ?? null },
    });

    return NextResponse.json({ data: { ok, reason } });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
