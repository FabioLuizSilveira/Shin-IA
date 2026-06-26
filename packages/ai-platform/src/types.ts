// ─── Model Provider (abstraction — NO real SDK imports) ───────────────────────

export type ModelProviderName = "openai" | "anthropic" | "gemini" | "mistral" | "custom";

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ModelRequest {
  model: string;
  messages: ModelMessage[];
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}

export interface ModelResponse {
  id: string;
  model: string;
  content: string;
  role: "assistant";
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: "stop" | "tool_use" | "length" | "error";
}

export interface ModelProvider {
  readonly name: ModelProviderName;
  complete(request: ModelRequest): Promise<ModelResponse>;
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  output: unknown;
  error?: string;
}

export interface Tool {
  readonly definition: ToolDefinition;
  execute(args: Record<string, unknown>, context: AgentContext): Promise<ToolResult>;
}

// ─── Prompt Registry ──────────────────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  name: string;
  agentType: AgentType;
  system: string;
  userTemplate: string;
  variables: string[];
  version: number;
  createdAt: string;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export type AgentType = "analytics" | "support" | "scheduling" | "commercial" | "ocr";

export interface AgentContext {
  tenantId: string;
  userId: string;
  sessionId: string;
  locale: string;
  metadata: Record<string, unknown>;
}

export interface AgentMemoryEntry {
  id: string;
  sessionId: string;
  agentType: AgentType;
  role: ModelMessage["role"];
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentSession {
  id: string;
  tenantId: string;
  userId: string;
  agentType: AgentType;
  status: "active" | "completed" | "error";
  turnCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentResponse {
  sessionId: string;
  agentType: AgentType;
  content: string;
  toolCallsExecuted: string[];
  usage: ModelResponse["usage"];
  finishReason: ModelResponse["finishReason"];
}

// ─── Repository interfaces ────────────────────────────────────────────────────

export interface AgentSessionRepository {
  findById(id: string): Promise<AgentSession | null>;
  findByUser(tenantId: string, userId: string): Promise<AgentSession[]>;
  save(session: AgentSession): Promise<AgentSession>;
  update(session: AgentSession): Promise<AgentSession>;
}

export interface AgentMemoryRepository {
  findBySession(sessionId: string): Promise<AgentMemoryEntry[]>;
  save(entry: AgentMemoryEntry): Promise<AgentMemoryEntry>;
  clearSession(sessionId: string): Promise<void>;
}
