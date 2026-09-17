// Agent Runtime v3, Wave 5 ("UX + Channels") — crypto.randomUUID() is not
// reliably available on Hermes in this app's RN/Expo version (same
// finding already documented in inspection-offline-queue.ts, which only
// ever polyfills crypto.getRandomValues) — generate the conversationId
// from that same polyfilled primitive, formatted as a real UUID v4
// string so it's unambiguous to the server's `uuid`-typed columns.
import "react-native-get-random-values";
import { supabase } from "./supabase";

const API_BASE = (process.env.EXPO_PUBLIC_SHINAIA_API_URL ?? "").replace(/\/$/, "");

class VoiceAgentError extends Error {}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function randomConversationId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

// One id for the lifetime of this app process (VoiceRecordButton mounts
// once at the root) — mirrors the web drawer's own "one conversationId
// per session" scope (apps/web/src/components/ai/shina-drawer.tsx).
// Before this, every voice turn was a stateless, independent call with
// no conversationId at all, so the Agent's goal/entity memory (Waves
// 1-4) never applied on mobile — "aluga o Mobi pro Eduardo amanhã"
// followed by "o Onix" would have re-asked everything from scratch.
let conversationId: string | null = null;
function getConversationId(): string {
  if (!conversationId) conversationId = randomConversationId();
  return conversationId;
}

export interface OfferedOption {
  id: string;
  name: string;
}
export interface OfferedOptionsPayload {
  field: string;
  options: OfferedOption[];
}
export interface GoalProgressField {
  key: string;
  label: string;
  required: boolean;
  known: boolean;
}
export interface GoalProgress {
  type: string;
  fields: GoalProgressField[];
}

export interface AgentReply {
  text: string;
  toolsUsed: string[];
  creditsConsumed: number;
  goalProgress?: GoalProgress;
  offeredOptions?: OfferedOptionsPayload;
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

export async function askAgent(query: string, selectedOptionId?: string): Promise<AgentReply> {
  if (!API_BASE) throw new VoiceAgentError("EXPO_PUBLIC_SHINAIA_API_URL is not configured");
  const headers = await authHeader();

  const res = await fetch(`${API_BASE}/api/ai/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ query, conversationId: getConversationId(), selectedOptionId }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: AgentReply; error?: string };
  if (!res.ok || json.error)
    throw new VoiceAgentError(json.error ?? "Shinã não conseguiu responder");
  return json.data as AgentReply;
}

/** Selecting an offered option (spec section 39: send the real id, never
 * make the LLM re-interpret a spoken/typed option name) — the option's
 * own name is still sent as `query` for a sane transcript. */
export async function selectOfferedOption(option: OfferedOption): Promise<AgentReply> {
  return askAgent(option.name, option.id);
}

export async function recordAndAsk(
  audioUri: string,
): Promise<{ transcript: string; reply: AgentReply }> {
  const transcript = await transcribeVoice(audioUri);
  if (!transcript.trim()) throw new VoiceAgentError("Não entendi o áudio, tenta de novo.");
  const reply = await askAgent(transcript);
  return { transcript, reply };
}
