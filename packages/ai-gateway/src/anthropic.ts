// Minimal Anthropic Messages API client (fetch-based, no SDK dependency).
// Moved verbatim from apps/mkt/src/lib/ai/anthropic.ts, plus an additive
// `tools`/`toolChoice` param and tool_use block parsing (needed by the
// Shinã Agent Platform's tool-calling loop — apps/mkt never passed tools,
// so this is new surface, not a behavior change for existing callers who
// omit it).

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

export interface AnthropicToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  toolUses: AnthropicToolUse[];
  stopReason: string | null;
}

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: unknown;
}

async function callAnthropic(options: {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  model?: string;
  apiKey?: string;
  tools?: AnthropicToolDefinition[];
}): Promise<AnthropicResult> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIProviderError(
      "ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente no servidor.",
      503,
    );
  }

  const model = options.model ?? DEFAULT_MODEL;
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 2048,
      system: options.system,
      messages: options.messages,
      ...(options.tools?.length ? { tools: options.tools } : {}),
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new AIProviderError(
      body?.error?.message ?? `Anthropic API error (${res.status})`,
      res.status === 429 ? 429 : 502,
    );
  }

  const json = (await res.json()) as {
    content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
    usage: { input_tokens: number; output_tokens: number };
    model: string;
    stop_reason?: string;
  };

  const text = json.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  const toolUses: AnthropicToolUse[] = json.content
    .filter((b) => b.type === "tool_use" && b.id && b.name)
    .map((b) => ({
      id: b.id as string,
      name: b.name as string,
      input: (b.input as Record<string, unknown>) ?? {},
    }));

  return {
    text,
    tokensIn: json.usage.input_tokens,
    tokensOut: json.usage.output_tokens,
    model: json.model,
    toolUses,
    stopReason: json.stop_reason ?? null,
  };
}

export async function generateText(options: {
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
  apiKey?: string;
  tools?: AnthropicToolDefinition[];
}): Promise<AnthropicResult> {
  return callAnthropic({
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
    maxTokens: options.maxTokens,
    model: options.model,
    apiKey: options.apiKey,
    tools: options.tools,
  });
}

/** Multi-turn variant, needed for a tool-calling loop (tool_result turns). */
export async function generateWithMessages(options: {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  model?: string;
  apiKey?: string;
  tools?: AnthropicToolDefinition[];
}): Promise<AnthropicResult> {
  return callAnthropic(options);
}

export async function analyzeImage(options: {
  system: string;
  prompt: string;
  imageUrl: string;
  maxTokens?: number;
  model?: string;
  apiKey?: string;
}): Promise<AnthropicResult> {
  return callAnthropic({
    system: options.system,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: options.imageUrl } },
          { type: "text", text: options.prompt },
        ],
      },
    ],
    maxTokens: options.maxTokens,
    model: options.model,
    apiKey: options.apiKey,
  });
}

/** Extracts the first JSON object from a model response (tolerates fences). */
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json object in model response");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
