// Minimal OpenAI Chat Completions client (fetch-based, no SDK dependency) —
// same posture as anthropic.ts. Added so the Shinã Agent Platform can run
// exclusively on OpenAI (explicit product decision, 2026-09) instead of
// needing a separate ANTHROPIC_API_KEY configured on apps/web's own Vercel
// project. apps/mkt's own AI Gateway usage (credentialMode: "auto",
// SHINA/BYOK/HYBRID) is untouched — it still uses Anthropic via anthropic.ts.

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export interface OpenAiToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface OpenAiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// A user message's content can be plain text or, for vision-capable models
// (gpt-4o-mini included), a mix of text + inline image parts — added for
// the Shinã Agent's document/image attachment support. `image_url.url`
// accepts a base64 data: URL directly (no hosting needed), same posture as
// the voice transcription route: the image bytes are never persisted
// anywhere, only passed through this one request.
export type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | OpenAiContentPart[] | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface OpenAiResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  toolCalls: OpenAiToolCall[];
  stopReason: string | null;
}

export class OpenAIProviderError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Agent Runtime Architecture v2, Wave 2 (spec section 12, "Forced Tool
// Policy") — passed straight through as OpenAI's own `tool_choice` field.
// `{ name }` forces that exact function (only sound when the Capability
// Router narrowed candidates to exactly one unambiguous tool — the model
// still extracts the arguments, it just can't pick a different tool);
// "required" forces some tool call without picking which; "auto" (or
// omitted) is today's unchanged default.
export type OpenAiToolChoice = "auto" | "required" | { name: string };

export async function generateWithMessagesOpenAI(options: {
  system: string;
  messages: OpenAiMessage[];
  maxTokens?: number;
  model?: string;
  apiKey?: string;
  tools?: OpenAiToolDefinition[];
  toolChoice?: OpenAiToolChoice;
}): Promise<OpenAiResult> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAIProviderError(
      "OPENAI_API_KEY não configurada. Configure a variável de ambiente no servidor.",
      503,
    );
  }

  const model = options.model ?? DEFAULT_MODEL;
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: options.maxTokens ?? 2048,
      messages: [{ role: "system", content: options.system }, ...options.messages],
      ...(options.tools?.length ? { tools: options.tools } : {}),
      ...(options.toolChoice && options.tools?.length
        ? {
            tool_choice:
              typeof options.toolChoice === "string"
                ? options.toolChoice
                : { type: "function", function: { name: options.toolChoice.name } },
          }
        : {}),
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new OpenAIProviderError(
      body?.error?.message ?? `OpenAI API error (${res.status})`,
      res.status === 429 ? 429 : 502,
    );
  }

  const json = (await res.json()) as {
    model: string;
    choices: {
      finish_reason: string;
      message: {
        content: string | null;
        tool_calls?: { id: string; function: { name: string; arguments: string } }[];
      };
    }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const choice = json.choices[0];
  const toolCalls: OpenAiToolCall[] = (choice?.message.tool_calls ?? []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>,
  }));

  return {
    text: choice?.message.content ?? "",
    tokensIn: json.usage.prompt_tokens,
    tokensOut: json.usage.completion_tokens,
    model: json.model,
    toolCalls,
    stopReason: choice?.finish_reason ?? null,
  };
}

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export interface OpenAiEmbeddingResult {
  embeddings: number[][];
  tokensIn: number;
  model: string;
}

// Wave 5 (Tenant Knowledge) — a separate endpoint/response shape from chat
// completions, so its own function rather than overloading
// generateWithMessagesOpenAI. Batches all inputs into one request (OpenAI's
// embeddings endpoint accepts an array natively) — callers chunking a
// document should pass every chunk at once, not one call per chunk.
export async function generateEmbeddingsOpenAI(options: {
  input: string[];
  model?: string;
  apiKey?: string;
}): Promise<OpenAiEmbeddingResult> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAIProviderError(
      "OPENAI_API_KEY não configurada. Configure a variável de ambiente no servidor.",
      503,
    );
  }
  if (options.input.length === 0)
    return { embeddings: [], tokensIn: 0, model: options.model ?? DEFAULT_EMBEDDING_MODEL };

  const model = options.model ?? DEFAULT_EMBEDDING_MODEL;
  const res = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, input: options.input }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new OpenAIProviderError(
      body?.error?.message ?? `OpenAI embeddings API error (${res.status})`,
      res.status === 429 ? 429 : 502,
    );
  }

  const json = (await res.json()) as {
    model: string;
    data: { embedding: number[]; index: number }[];
    usage: { prompt_tokens: number };
  };
  const embeddings = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  return { embeddings, tokensIn: json.usage.prompt_tokens, model: json.model };
}
