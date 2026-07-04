// Minimal Anthropic Messages API client (fetch-based, no SDK dependency).
// Platform-level key for now; per-workspace BYOK arrives in M-MKT-11.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

export interface AnthropicResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function generateText(options: {
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<AnthropicResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
      messages: [{ role: "user", content: options.prompt }],
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
    content: { type: string; text?: string }[];
    usage: { input_tokens: number; output_tokens: number };
    model: string;
  };

  const text = json.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  return {
    text,
    tokensIn: json.usage.input_tokens,
    tokensOut: json.usage.output_tokens,
    model: json.model,
  };
}

/** Extracts the first JSON object from a model response (tolerates fences). */
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json object in model response");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
