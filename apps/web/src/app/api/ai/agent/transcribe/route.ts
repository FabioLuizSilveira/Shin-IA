import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { logActivity } from "@/lib/activity-log";
import { AI_AGENT_EVENTS } from "@/lib/ai/audit-events";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST multipart/form-data { audio: File } — transcribes a short voice
// recording via OpenAI's Whisper API and returns only the transcript. The
// audio bytes are never written to disk/storage and never leave this
// request's memory (LGPD: record -> transcribe -> discard). This is a
// SEPARATE credential/provider from the Anthropic-only agent gateway
// (packages/ai-gateway's credentialMode:"shina_only") — voice transcription
// does not run through runAiGateway() and, by explicit product decision,
// does NOT debit AI credits in this phase (only audit-logged for
// observability). The client is expected to follow up with a normal
// POST /api/ai/agent call using the returned transcript as `query`.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  if (!(await isFeatureEnabled(scope, "agent.enabled"))) {
    return NextResponse.json(
      { error: "Shinã ainda não está habilitada para este tenant." },
      { status: 403 },
    );
  }
  if (!(await isFeatureEnabled(scope, "agent.voice.enabled"))) {
    return NextResponse.json(
      { error: "Voz ainda não está habilitada para este tenant." },
      { status: 403 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcrição de voz não configurada no servidor." },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "audio is required (multipart file field)" },
      { status: 400 },
    );
  }

  const started = Date.now();
  const upstreamForm = new FormData();
  upstreamForm.append("file", audio, "recording.m4a");
  upstreamForm.append("model", "whisper-1");

  let transcript: string;
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? `OpenAI transcription failed (${res.status})`);
    }
    const json = (await res.json()) as { text?: string };
    transcript = json.text ?? "";
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha na transcrição" },
      { status: 502 },
    );
  }
  // `audio`/`upstreamForm` go out of scope here — never written anywhere,
  // nothing further to discard explicitly beyond letting GC reclaim them.
  const durationMs = Date.now() - started;

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "ai_agent",
    entityId: crypto.randomUUID(),
    action: AI_AGENT_EVENTS.VOICE_TRANSCRIBED,
    // Never the transcript text itself here — only observability metadata.
    metadata: { durationMs, audioSizeBytes: audio.size },
  });

  return NextResponse.json({ data: { transcript } });
}
