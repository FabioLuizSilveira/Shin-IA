import type { AgentType, PromptTemplate } from "./types.js";

export class PromptRegistry {
  private prompts = new Map<string, PromptTemplate>();

  register(template: PromptTemplate): void {
    const key = this.key(template.agentType, template.name);
    this.prompts.set(key, template);
  }

  get(agentType: AgentType, name: string): PromptTemplate {
    const key = this.key(agentType, name);
    const template = this.prompts.get(key);
    if (!template) throw new Error(`prompt "${name}" not found for agent type "${agentType}"`);
    return template;
  }

  has(agentType: AgentType, name: string): boolean {
    return this.prompts.has(this.key(agentType, name));
  }

  list(agentType?: AgentType): PromptTemplate[] {
    const all = [...this.prompts.values()];
    return agentType ? all.filter((p) => p.agentType === agentType) : all;
  }

  render(template: PromptTemplate, variables: Record<string, unknown>): string {
    return template.userTemplate.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = variables[key];
      return value !== undefined ? String(value) : `{{${key}}}`;
    });
  }

  private key(agentType: AgentType, name: string): string {
    return `${agentType}:${name}`;
  }
}
