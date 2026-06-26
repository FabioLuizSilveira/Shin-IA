import type { AgentMemoryEntry, AgentMemoryRepository, AgentType, ModelMessage } from "./types.js";

export class AgentMemoryInterface {
  constructor(private repository: AgentMemoryRepository) {}

  async getHistory(sessionId: string): Promise<ModelMessage[]> {
    const entries = await this.repository.findBySession(sessionId);
    return entries.map((e) => ({ role: e.role, content: e.content }));
  }

  async append(
    sessionId: string,
    agentType: AgentType,
    role: ModelMessage["role"],
    content: string,
    metadata: Record<string, unknown> = {},
  ): Promise<AgentMemoryEntry> {
    return this.repository.save({
      id: crypto.randomUUID(),
      sessionId,
      agentType,
      role,
      content,
      metadata,
      createdAt: new Date().toISOString(),
    });
  }

  async clear(sessionId: string): Promise<void> {
    await this.repository.clearSession(sessionId);
  }

  async getEntries(sessionId: string): Promise<AgentMemoryEntry[]> {
    return this.repository.findBySession(sessionId);
  }
}
