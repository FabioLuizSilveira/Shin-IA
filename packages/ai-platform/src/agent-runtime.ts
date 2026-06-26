import type {
  AgentContext,
  AgentResponse,
  AgentSession,
  AgentSessionRepository,
  AgentType,
  ModelMessage,
  ModelProviderName,
  ModelRequest,
  ModelResponse,
} from "./types.js";
import { AgentMemoryInterface } from "./agent-memory.js";
import { ModelProviderRegistry } from "./model-provider-registry.js";
import { PromptRegistry } from "./prompt-registry.js";
import { ToolRegistry } from "./tool-registry.js";

export interface AgentConfig {
  agentType: AgentType;
  providerName: ModelProviderName;
  model: string;
  systemPromptName?: string;
  maxTokens?: number;
  temperature?: number;
  maxToolRounds?: number;
}

const DEFAULT_MAX_TOOL_ROUNDS = 5;

export class AgentRuntime {
  constructor(
    private sessions: AgentSessionRepository,
    private memory: AgentMemoryInterface,
    private modelProviders: ModelProviderRegistry,
    private prompts: PromptRegistry,
    private tools: ToolRegistry,
  ) {}

  async startSession(agentType: AgentType, context: AgentContext): Promise<AgentSession> {
    const now = new Date().toISOString();
    return this.sessions.save({
      id: context.sessionId,
      tenantId: context.tenantId,
      userId: context.userId,
      agentType,
      status: "active",
      turnCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async chat(
    config: AgentConfig,
    context: AgentContext,
    userMessage: string,
  ): Promise<AgentResponse> {
    const provider = this.modelProviders.get(config.providerName);

    // Load session memory
    const history = await this.memory.getHistory(context.sessionId);

    // Build system prompt
    const systemContent = config.systemPromptName
      ? this.prompts.get(config.agentType, config.systemPromptName).system
      : `You are a helpful ${config.agentType} agent for the Shinã platform.`;

    // Append user message to memory
    await this.memory.append(context.sessionId, config.agentType, "user", userMessage);

    const messages: ModelMessage[] = [
      { role: "system", content: systemContent },
      ...history,
      { role: "user", content: userMessage },
    ];

    // Tool-use agentic loop
    const toolCallsExecuted: string[] = [];
    let lastResponse: ModelResponse | null = null;
    let round = 0;
    const maxRounds = config.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;

    while (round < maxRounds) {
      round++;
      const request: ModelRequest = {
        model: config.model,
        messages,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        tools: this.tools.list(),
      };

      lastResponse = await provider.complete(request);

      if (!lastResponse.toolCalls || lastResponse.toolCalls.length === 0) break;

      // Execute tool calls
      for (const toolCall of lastResponse.toolCalls) {
        const result = await this.tools.execute(toolCall.name, toolCall.arguments, context);
        toolCallsExecuted.push(toolCall.name);

        messages.push({
          role: "assistant",
          content: lastResponse.content,
          toolName: toolCall.name,
        });
        messages.push({
          role: "tool",
          content: JSON.stringify(result.output),
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });
      }

      if (lastResponse.finishReason !== "tool_use") break;
    }

    if (!lastResponse) throw new Error("no response from model provider");

    // Persist assistant response
    await this.memory.append(
      context.sessionId,
      config.agentType,
      "assistant",
      lastResponse.content,
    );

    // Update session turn count
    const session = await this.sessions.findById(context.sessionId);
    if (session) {
      await this.sessions.update({
        ...session,
        turnCount: session.turnCount + 1,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      sessionId: context.sessionId,
      agentType: config.agentType,
      content: lastResponse.content,
      toolCallsExecuted,
      usage: lastResponse.usage,
      finishReason: lastResponse.finishReason,
    };
  }

  async endSession(sessionId: string): Promise<AgentSession> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new Error(`session ${sessionId} not found`);
    return this.sessions.update({
      ...session,
      status: "completed",
      updatedAt: new Date().toISOString(),
    });
  }
}
