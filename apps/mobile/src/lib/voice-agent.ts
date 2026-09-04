import { supabase } from "./supabase";

const API_BASE = (process.env.EXPO_PUBLIC_SHINAIA_API_URL ?? "").replace(/\/$/, "");

class VoiceAgentError extends Error {}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AgentReply {
  text: string;
  toolsUsed: string[];
  creditsConsumed: number;
}

/** Uploads a recorded audio file (local URI from expo-audio's
 * recorder.uri) for transcription, then submits the transcript as a
 * normal Shinã Agent text query. Two round trips, not one endpoint —
 * mirrors the server side's own separation (transcription never runs
 * through the credit-metered agent gateway). */
export async function transcribeVoice(audioUri: string): Promise<string> {
  if (!API_BASE) throw new VoiceAgentError("EXPO_PUBLIC_SHINAIA_API_URL is not configured");
  const headers = await authHeader();

  const form = new FormData();
  // React Native's fetch FormData accepts this {uri,name,type} shape
  // directly (not a real Blob) — same convention already used wherever
  // this app uploads a file (inspection photo capture).
  form.append("audio", {
    uri: audioUri,
    name: "recording.m4a",
    type: "audio/m4a",
  } as unknown as Blob);

  const res = await fetch(`${API_BASE}/api/ai/agent/transcribe`, {
    method: "POST",
    headers,
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { transcript: string };
    error?: string;
  };
  if (!res.ok || json.error) throw new VoiceAgentError(json.error ?? "Falha na transcrição");
  return json.data?.transcript ?? "";
}

export async function askAgent(query: string): Promise<AgentReply> {
  if (!API_BASE) throw new VoiceAgentError("EXPO_PUBLIC_SHINAIA_API_URL is not configured");
  const headers = await authHeader();

  const res = await fetch(`${API_BASE}/api/ai/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ query }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: AgentReply; error?: string };
  if (!res.ok || json.error)
    throw new VoiceAgentError(json.error ?? "Shinã não conseguiu responder");
  return json.data as AgentReply;
}

export async function recordAndAsk(
  audioUri: string,
): Promise<{ transcript: string; reply: AgentReply }> {
  const transcript = await transcribeVoice(audioUri);
  if (!transcript.trim()) throw new VoiceAgentError("Não entendi o áudio, tenta de novo.");
  const reply = await askAgent(transcript);
  return { transcript, reply };
}
