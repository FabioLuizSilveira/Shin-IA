import type { AgentContext, Tool, ToolDefinition, ToolResult } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  get(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`tool "${name}" not registered`);
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: AgentContext,
  ): Promise<ToolResult> {
    const tool = this.get(name);
    return tool.execute(args, context);
  }
}
