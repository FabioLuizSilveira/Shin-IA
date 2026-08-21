import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { getMktContext, MktContextError } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const PROVIDERS = [
  "anthropic",
  "openai",
  "gemini",
  "deepseek",
  "mistral",
  "groq",
  "openrouter",
  "ollama",
] as const;

// GET — list providers with masked keys
export async function GET() {
  try {
    const ctx = await getMktContext();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mkt_ai_providers")
      .select(
        "id, provider, default_model, base_url, is_active, is_default, monthly_limit_usd, api_key_enc, created_at, updated_at, last_validated_at",
      )
      .eq("workspace_id", ctx.workspaceId)
      .order("provider");
    if (error) return internalError(error);

    const masked = (data ?? []).map((p) => ({
      ...p,
      api_key_enc: undefined,
      has_key: Boolean(p.api_key_enc),
    }));
    return NextResponse.json({ data: masked });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

// POST — upsert a provider config (api key encrypted at rest)
export async function POST(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const body = (await req.json()) as {
      provider?: string;
      api_key?: string;
      default_model?: string;
      base_url?: string;
      is_default?: boolean;
      monthly_limit_usd?: number;
    };

    if (!body.provider || !PROVIDERS.includes(body.provider as (typeof PROVIDERS)[number])) {
      return NextResponse.json({ error: "invalid provider" }, { status: 422 });
    }

    const supabase = await createClient();
    const record: Record<string, unknown> = {
      workspace_id: ctx.workspaceId,
      tenant_id: ctx.tenantId,
      provider: body.provider,
      default_model: body.default_model ?? null,
      base_url: body.base_url ?? null,
      is_default: body.is_default ?? false,
      monthly_limit_usd: body.monthly_limit_usd ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (body.api_key?.trim()) {
      record.api_key_enc = await encryptSecret(body.api_key.trim());
    }

    const { data, error } = await supabase
      .from("mkt_ai_providers")
      .upsert(record, { onConflict: "workspace_id,provider" })
      .select("id, provider")
      .single();

    if (error) return internalError(error);
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getMktContext();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 422 });

    const supabase = await createClient();
    const { error } = await supabase
      .from("mkt_ai_providers")
      .delete()
      .eq("id", id)
      .eq("workspace_id", ctx.workspaceId);
    if (error) return internalError(error);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MktContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
