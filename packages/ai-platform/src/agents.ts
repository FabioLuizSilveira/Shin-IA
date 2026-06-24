import type { AgentType } from "./types.js";
import type { AgentConfig } from "./agent-runtime.js";

/**
 * Default configurations for the 5 built-in agents.
 * Concrete model names and providers are injected at runtime by the application.
 */
export function defaultAgentConfig(
  agentType: AgentType,
  providerName: AgentConfig["providerName"] = "custom",
  model = "default",
): AgentConfig {
  const configs: Record<AgentType, Omit<AgentConfig, "providerName" | "model">> = {
    analytics: {
      agentType: "analytics",
      systemPromptName: "analytics_system",
      maxTokens: 2048,
      temperature: 0.2,
      maxToolRounds: 5,
    },
    support: {
      agentType: "support",
      systemPromptName: "support_system",
      maxTokens: 1024,
      temperature: 0.7,
      maxToolRounds: 3,
    },
    scheduling: {
      agentType: "scheduling",
      systemPromptName: "scheduling_system",
      maxTokens: 1024,
      temperature: 0.1,
      maxToolRounds: 5,
    },
    commercial: {
      agentType: "commercial",
      systemPromptName: "commercial_system",
      maxTokens: 2048,
      temperature: 0.5,
      maxToolRounds: 5,
    },
    ocr: {
      agentType: "ocr",
      systemPromptName: "ocr_system",
      maxTokens: 512,
      temperature: 0.0,
      maxToolRounds: 1,
    },
  };

  return { ...configs[agentType], providerName, model };
}

export const AGENT_TYPES: AgentType[] = ["analytics", "support", "scheduling", "commercial", "ocr"];
