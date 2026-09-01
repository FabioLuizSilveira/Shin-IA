import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// AI Copilot (Etapa 13) — mandatory architecture per the spec: User -> AI
// query layer -> permission+tenant scope -> pre-approved tools/query-
// functions -> structured data -> LLM explanation-only, NEVER free SQL
// generation against production.
//
// This function is deliberately a thin, dumb proxy: it forwards a
// message history + a tool schema to Claude and returns Claude's raw
// response. It has NO database access beyond identifying the caller, and
// it never executes a tool itself -- tool execution happens exclusively
// in the Next.js route (api/maintenance/copilot/route.ts), which is the
// only place tenant-scoped queries run. This function could not leak
// cross-tenant data even if compromised, because it never touches
// tenant data at all.

interface AnthropicResponse {
  content: unknown[];
  stop_reason?: string;
  error?: { message: string };
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

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 502 });
  }

  let payload: { system?: string; messages?: unknown[]; tools?: unknown[] };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload.messages || !Array.isArray(payload.messages)) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: payload.system ?? "",
      messages: payload.messages,
      tools: payload.tools ?? [],
    }),
  });

  const json = (await res.json()) as AnthropicResponse;
  if (!res.ok || json.error) {
    return Response.json(
      { error: json.error?.message ?? `Anthropic API error: ${res.status}` },
      { status: 502 },
    );
  }

  return Response.json({ content: json.content, stopReason: json.stop_reason });
});
