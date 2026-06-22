import { describe, it, expect, vi } from "vitest";
import { PromptRegistry } from "../prompt-registry.js";
import { ToolRegistry } from "../tool-registry.js";
import { ModelProviderRegistry } from "../model-provider-registry.js";
import { AgentMemoryInterface } from "../agent-memory.js";
import { AgentRuntime } from "../agent-runtime.js";
import { defaultAgentConfig, AGENT_TYPES } from "../agents.js";
import type {
  AgentContext,
  AgentMemoryEntry,
  AgentMemoryRepository,
  AgentSession,
  AgentSessionRepository,
  AgentType,
  ModelProvider,
  ModelResponse,
  PromptTemplate,
  Tool,
  ToolResult,
} from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeContext = (overrides: Partial<AgentContext> = {}): AgentContext => ({
  tenantId: "tenant-1",
  userId: "user-1",
  sessionId: "session-1",
  locale: "en",
  metadata: {},
  ...overrides,
});

const makeSession = (overrides: Partial<AgentSession> = {}): AgentSession => ({
  id: "session-1",
  tenantId: "tenant-1",
  userId: "user-1",
  agentType: "analytics",
  status: "active",
  turnCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makePromptTemplate = (overrides: Partial<PromptTemplate> = {}): PromptTemplate => ({
  id: "prompt-1",
  name: "analytics_system",
  agentType: "analytics",
  system: "You are an analytics agent.",
  userTemplate: "Analyze {{metric}} for {{period}}.",
  variables: ["metric", "period"],
  version: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeModelResponse = (overrides: Partial<ModelResponse> = {}): ModelResponse => ({
  id: "resp-1",
  model: "test-model",
  content: "Here is the analysis.",
  role: "assistant",
  toolCalls: undefined,
  usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  finishReason: "stop",
  ...overrides,
});

// ─── Repo mocks ───────────────────────────────────────────────────────────────

function makeSessionRepo(session: AgentSession | null = makeSession()): AgentSessionRepository {
  return {
    findById: vi.fn().mockResolvedValue(session),
    findByUser: vi.fn().mockResolvedValue(session ? [session] : []),
    save: vi.fn().mockImplementation((s: AgentSession) => Promise.resolve(s)),
    update: vi.fn().mockImplementation((s: AgentSession) => Promise.resolve(s)),
  };
}

function makeMemoryRepo(entries: AgentMemoryEntry[] = []): AgentMemoryRepository {
  const store: AgentMemoryEntry[] = [...entries];
  return {
    findBySession: vi.fn().mockImplementation(() => Promise.resolve([...store])),
    save: vi.fn().mockImplementation((e: AgentMemoryEntry) => {
      store.push(e);
      return Promise.resolve(e);
    }),
    clearSession: vi.fn().mockImplementation(() => {
      store.length = 0;
      return Promise.resolve();
    }),
  };
}

function makeModelProvider(response: ModelResponse = makeModelResponse()): ModelProvider {
  return {
    name: "custom",
    complete: vi.fn().mockResolvedValue(response),
  };
}

function makeRuntime(
  overrides: {
    sessionRepo?: AgentSessionRepository;
    memoryRepo?: AgentMemoryRepository;
    provider?: ModelProvider;
  } = {},
) {
  const memoryRepo = overrides.memoryRepo ?? makeMemoryRepo();
  const provider = overrides.provider ?? makeModelProvider();

  const modelRegistry = new ModelProviderRegistry();
  modelRegistry.register(provider);

  const promptRegistry = new PromptRegistry();
  promptRegistry.register(makePromptTemplate());

  const toolRegistry = new ToolRegistry();
  const memory = new AgentMemoryInterface(memoryRepo);

  return new AgentRuntime(
    overrides.sessionRepo ?? makeSessionRepo(),
    memory,
    modelRegistry,
    promptRegistry,
    toolRegistry,
  );
}

// ─── PromptRegistry tests ─────────────────────────────────────────────────────

describe("PromptRegistry", () => {
  it("registers and retrieves a prompt", () => {
    const registry = new PromptRegistry();
    const template = makePromptTemplate();
    registry.register(template);
    expect(registry.get("analytics", "analytics_system")).toBe(template);
  });

  it("throws for unknown prompt", () => {
    const registry = new PromptRegistry();
    expect(() => registry.get("analytics", "missing")).toThrow("not found");
  });

  it("has returns correct boolean", () => {
    const registry = new PromptRegistry();
    registry.register(makePromptTemplate());
    expect(registry.has("analytics", "analytics_system")).toBe(true);
    expect(registry.has("support", "analytics_system")).toBe(false);
  });

  it("lists all prompts", () => {
    const registry = new PromptRegistry();
    registry.register(makePromptTemplate({ agentType: "analytics" }));
    registry.register(makePromptTemplate({ name: "support_system", agentType: "support" }));
    expect(registry.list()).toHaveLength(2);
  });

  it("lists prompts filtered by agentType", () => {
    const registry = new PromptRegistry();
    registry.register(makePromptTemplate({ agentType: "analytics" }));
    registry.register(makePromptTemplate({ name: "support_system", agentType: "support" }));
    expect(registry.list("analytics")).toHaveLength(1);
    expect(registry.list("support")).toHaveLength(1);
  });

  it("renders template variables", () => {
    const registry = new PromptRegistry();
    const template = makePromptTemplate();
    const rendered = registry.render(template, { metric: "revenue", period: "Q1" });
    expect(rendered).toBe("Analyze revenue for Q1.");
  });

  it("preserves unknown variables in render", () => {
    const registry = new PromptRegistry();
    const template = makePromptTemplate();
    const rendered = registry.render(template, { metric: "revenue" });
    expect(rendered).toContain("{{period}}");
  });
});

// ─── ToolRegistry tests ───────────────────────────────────────────────────────

describe("ToolRegistry", () => {
  const echoTool: Tool = {
    definition: {
      name: "echo",
      description: "Echoes the input",
      parameters: { type: "object", properties: { message: { type: "string" } } },
    },
    execute: vi.fn().mockImplementation(async (args) => ({
      callId: "call-1",
      name: "echo",
      output: args["message"],
    })),
  };

  it("registers and retrieves a tool", () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);
    expect(registry.get("echo")).toBe(echoTool);
  });

  it("throws for unregistered tool", () => {
    const registry = new ToolRegistry();
    expect(() => registry.get("missing")).toThrow("not registered");
  });

  it("has returns correct boolean", () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);
    expect(registry.has("echo")).toBe(true);
    expect(registry.has("other")).toBe(false);
  });

  it("lists tool definitions", () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);
    const defs = registry.list();
    expect(defs).toHaveLength(1);
    expect(defs[0]?.name).toBe("echo");
  });

  it("executes a tool", async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);
    const context = makeContext();
    const result = await registry.execute("echo", { message: "hello" }, context);
    expect(result.output).toBe("hello");
  });
});

// ─── ModelProviderRegistry tests ─────────────────────────────────────────────

describe("ModelProviderRegistry", () => {
  it("registers and retrieves provider", () => {
    const registry = new ModelProviderRegistry();
    const provider = makeModelProvider();
    registry.register(provider);
    expect(registry.get("custom")).toBe(provider);
  });

  it("throws for unregistered provider", () => {
    const registry = new ModelProviderRegistry();
    expect(() => registry.get("openai")).toThrow("not registered");
  });

  it("has returns correct boolean", () => {
    const registry = new ModelProviderRegistry();
    registry.register(makeModelProvider());
    expect(registry.has("custom")).toBe(true);
    expect(registry.has("openai")).toBe(false);
  });

  it("lists registered provider names", () => {
    const registry = new ModelProviderRegistry();
    registry.register(makeModelProvider());
    expect(registry.list()).toContain("custom");
  });
});

// ─── AgentMemoryInterface tests ───────────────────────────────────────────────

describe("AgentMemoryInterface", () => {
  it("appends and retrieves history", async () => {
    const memoryInterface = new AgentMemoryInterface(makeMemoryRepo());
    await memoryInterface.append("session-1", "analytics", "user", "Hello");
    const history = await memoryInterface.getHistory("session-1");
    expect(history).toHaveLength(1);
    expect(history[0]?.content).toBe("Hello");
  });

  it("clears session memory", async () => {
    const repo = makeMemoryRepo();
    const memoryInterface = new AgentMemoryInterface(repo);
    await memoryInterface.append("session-1", "analytics", "user", "Hello");
    await memoryInterface.clear("session-1");
    const history = await memoryInterface.getHistory("session-1");
    expect(history).toHaveLength(0);
  });

  it("getEntries returns full entries", async () => {
    const repo = makeMemoryRepo();
    const memoryInterface = new AgentMemoryInterface(repo);
    await memoryInterface.append("session-1", "analytics", "assistant", "Reply", { key: "v" });
    const entries = await memoryInterface.getEntries("session-1");
    expect(entries[0]?.metadata).toEqual({ key: "v" });
  });
});

// ─── AgentRuntime tests ───────────────────────────────────────────────────────

describe("AgentRuntime", () => {
  it("startSession creates a session", async () => {
    const sessionRepo = makeSessionRepo();
    const runtime = makeRuntime({ sessionRepo });
    const session = await runtime.startSession("analytics", makeContext());
    expect(session.agentType).toBe("analytics");
    expect(sessionRepo.save).toHaveBeenCalledOnce();
  });

  it("chat returns response from model provider", async () => {
    const runtime = makeRuntime();
    const config = defaultAgentConfig("analytics");
    const response = await runtime.chat(config, makeContext(), "What is revenue?");

    expect(response.content).toBe("Here is the analysis.");
    expect(response.agentType).toBe("analytics");
    expect(response.finishReason).toBe("stop");
  });

  it("chat uses system prompt from registry", async () => {
    const provider = makeModelProvider();
    const runtime = makeRuntime({ provider });
    const config = defaultAgentConfig("analytics");

    await runtime.chat(config, makeContext(), "Hello");

    expect(provider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system", content: "You are an analytics agent." }),
        ]),
      }),
    );
  });

  it("chat uses default system prompt when no prompt name set", async () => {
    const provider = makeModelProvider();
    const runtime = makeRuntime({ provider });

    await runtime.chat(
      { agentType: "support", providerName: "custom", model: "test" },
      makeContext(),
      "Hello",
    );

    expect(provider.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system", content: expect.stringContaining("support") }),
        ]),
      }),
    );
  });

  it("chat executes tool calls in agentic loop", async () => {
    const toolResponse = makeModelResponse({
      content: "",
      finishReason: "tool_use",
      toolCalls: [{ id: "tc-1", name: "echo", arguments: { message: "test" } }],
    });
    const finalResponse = makeModelResponse({ content: "Done after tool." });

    const provider: ModelProvider = {
      name: "custom",
      complete: vi.fn().mockResolvedValueOnce(toolResponse).mockResolvedValueOnce(finalResponse),
    };

    const modelRegistry = new ModelProviderRegistry();
    modelRegistry.register(provider);

    const toolRegistry = new ToolRegistry();
    const echoTool: Tool = {
      definition: { name: "echo", description: "echo", parameters: {} },
      execute: vi.fn().mockResolvedValue({
        callId: "tc-1",
        name: "echo",
        output: "echoed",
      } as ToolResult),
    };
    toolRegistry.register(echoTool);

    const memoryRepo = makeMemoryRepo();
    const runtime = new AgentRuntime(
      makeSessionRepo(),
      new AgentMemoryInterface(memoryRepo),
      modelRegistry,
      new PromptRegistry(),
      toolRegistry,
    );

    const response = await runtime.chat(
      { agentType: "analytics", providerName: "custom", model: "test" },
      makeContext(),
      "Run echo tool",
    );

    expect(response.toolCallsExecuted).toContain("echo");
    expect(response.content).toBe("Done after tool.");
    expect(echoTool.execute).toHaveBeenCalledOnce();
  });

  it("chat updates session turn count", async () => {
    const sessionRepo = makeSessionRepo();
    const runtime = makeRuntime({ sessionRepo });
    const config = defaultAgentConfig("analytics");

    await runtime.chat(config, makeContext(), "Hello");

    expect(sessionRepo.update).toHaveBeenCalledWith(expect.objectContaining({ turnCount: 1 }));
  });

  it("chat does not update turn count when session not found", async () => {
    const sessionRepo = makeSessionRepo(null);
    const runtime = makeRuntime({ sessionRepo });
    const config = defaultAgentConfig("analytics");

    const response = await runtime.chat(config, makeContext(), "Hello");
    expect(response.content).toBeTruthy();
    expect(sessionRepo.update).not.toHaveBeenCalled();
  });

  it("endSession marks session as completed", async () => {
    const sessionRepo = makeSessionRepo();
    const runtime = makeRuntime({ sessionRepo });

    const ended = await runtime.endSession("session-1");
    expect(ended.status).toBe("completed");
  });

  it("endSession throws when session not found", async () => {
    const sessionRepo = makeSessionRepo(null);
    const runtime = makeRuntime({ sessionRepo });
    await expect(runtime.endSession("missing")).rejects.toThrow("not found");
  });
});

// ─── defaultAgentConfig tests ─────────────────────────────────────────────────

describe("defaultAgentConfig", () => {
  it("returns config for all agent types", () => {
    for (const type of AGENT_TYPES) {
      const config = defaultAgentConfig(type as AgentType);
      expect(config.agentType).toBe(type);
      expect(config.maxTokens).toBeGreaterThan(0);
    }
  });

  it("accepts custom provider and model", () => {
    const config = defaultAgentConfig("analytics", "anthropic", "claude-3");
    expect(config.providerName).toBe("anthropic");
    expect(config.model).toBe("claude-3");
  });

  it("AGENT_TYPES contains all 5 types", () => {
    expect(AGENT_TYPES).toHaveLength(5);
    expect(AGENT_TYPES).toContain("analytics");
    expect(AGENT_TYPES).toContain("support");
    expect(AGENT_TYPES).toContain("scheduling");
    expect(AGENT_TYPES).toContain("commercial");
    expect(AGENT_TYPES).toContain("ocr");
  });
});
