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

export interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
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

export async function generateWithMessagesOpenAI(options: {
  system: string;
  messages: OpenAiMessage[];
  maxTokens?: number;
  model?: string;
  apiKey?: string;
  tools?: OpenAiToolDefinition[];
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
