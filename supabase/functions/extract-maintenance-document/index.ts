import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Document AI (Etapa 12, P1) — upload -> extraction -> human-confirmed
// draft -> record. This function only ever does the extraction step: it
// downloads one document from the private maintenance-documents bucket,
// asks Claude to read it, and returns a sanitized draft. It never writes
// to maintenance_orders and never marks anything "confirmed" -- that's
// the API route's job after a human reviews the draft.
//
// Model choice: claude-3-5-haiku-20241022 (used by ai-insights, the only
// other Claude call in this repo) is text-only -- it can't read an image
// or PDF. This function needs real document/vision understanding, so it
// uses claude-sonnet-5 instead. Worth the extra cost per the spec's own
// "human always reviews before anything is trusted" requirement -- a
// weaker model here would just mean a worse first draft, not a
// correctness problem, but a text-only model would mean no extraction at
// all.

interface AnthropicContentBlock {
  type: "text" | "image" | "document";
  text?: string;
  source?: { type: "base64"; media_type: string; data: string };
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  error?: { message: string };
}

const SYSTEM_PROMPT = `Você é um extrator de dados estruturados de documentos de manutenção (orçamentos, notas fiscais, recibos, ordens de serviço).

REGRAS OBRIGATÓRIAS:
- Extraia APENAS informações que estão literal e claramente presentes e legíveis no documento.
- Se um campo não estiver claramente presente ou legível, retorne null para esse campo.
- NUNCA invente, estime, arredonde de forma especulativa ou infira um valor que não esteja escrito no documento.
- Responda SOMENTE com um objeto JSON válido, sem nenhum texto antes ou depois, sem markdown, no formato exato:
{"documentDate": "YYYY-MM-DD ou null", "supplierName": "string ou null", "totalAmountCents": number_inteiro_em_centavos ou null, "description": "string breve ou null"}`;

function decodeJwtTenantId(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.tenant_id === "string" ? json.tenant_id : null;
  } catch {
    return null;
  }
}

async function callClaude(base64: string, mediaType: string): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const isPdf = mediaType === "application/pdf";
  const content: AnthropicContentBlock[] = [
    {
      type: isPdf ? "document" : "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    },
    { type: "text", text: "Extraia os dados deste documento de manutenção conforme as regras." },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    }),
  });

  const json = (await res.json()) as AnthropicResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Anthropic API error: ${res.status}`);
  }
  return json.content.find((c) => c.type === "text")?.text ?? "";
}

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

  // Same auth posture as ai-insights: resolve to a real logged-in user,
  // never trust the bare anon key.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Missing Authorization header" }, { status: 401 });

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // auth.getUser() does not reflect the tenant_id claim injected by this
  // project's custom access-token hook (known gap, documented elsewhere
  // in this repo) -- decode it from the JWT itself instead, and use it
  // for a defense-in-depth path check. The Next.js route that calls this
  // function already tenant-scoped the document lookup before ever
  // reaching here; this is a second, independent check, not the only one.
  const tenantId = decodeJwtTenantId(token);
  if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { storagePath?: string; mimeType?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { storagePath, mimeType } = payload;
  if (!storagePath || !mimeType) {
    return Response.json({ error: "storagePath and mimeType are required" }, { status: 400 });
  }
  if (!storagePath.startsWith(`${tenantId}/`)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: fileBlob, error: downloadError } = await admin.storage
    .from("maintenance-documents")
    .download(storagePath);
  if (downloadError || !fileBlob) {
    return Response.json({ error: "Could not read the document" }, { status: 404 });
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  try {
    const text = await callClaude(base64, mimeType);
    // The model was instructed to return JSON-only, but never trusted
    // blindly: an unparseable response is treated as a failed extraction,
    // never as a reason to guess. sanitizeDocumentDraft() (the second,
    // type-level line of defense) runs on the Next.js side once this
    // response comes back, not here -- this function's contract is just
    // "best-effort raw JSON or an explicit failure".
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "Model did not return valid JSON", raw: text },
        { status: 502 },
      );
    }
    return Response.json({ draft: raw, model: "claude-sonnet-5" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: msg }, { status: 502 });
  }
});
