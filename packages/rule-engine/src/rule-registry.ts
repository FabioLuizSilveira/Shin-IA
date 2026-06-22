import type { Rule, RuleRepository } from "./types.js";

export interface RuleRegistryDeps {
  ruleRepository: RuleRepository;
}

export class RuleRegistry {
  private repo: RuleRepository;

  constructor(deps: RuleRegistryDeps) {
    this.repo = deps.ruleRepository;
  }

  async registerRule(rule: Omit<Rule, "id" | "createdAt" | "updatedAt">): Promise<Rule> {
    const now = new Date().toISOString();
    const newRule: Rule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.save(newRule);
  }

  async updateRule(id: string, patch: Partial<Omit<Rule, "id" | "createdAt">>): Promise<Rule> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error(`Rule '${id}' not found`);
    return this.repo.update({ ...existing, ...patch, updatedAt: new Date().toISOString() });
  }

  async enableRule(id: string): Promise<Rule> {
    return this.updateRule(id, { enabled: true });
  }

  async disableRule(id: string): Promise<Rule> {
    return this.updateRule(id, { enabled: false });
  }

  async deleteRule(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error(`Rule '${id}' not found`);
    return this.repo.delete(id);
  }

  async getRule(id: string): Promise<Rule | null> {
    return this.repo.findById(id);
  }

  async getRulesForTenant(tenantId: string): Promise<Rule[]> {
    return this.repo.findByTenant(tenantId);
  }

  async getRulesForEvent(tenantId: string, eventType: string): Promise<Rule[]> {
    const [tenantRules, platformRules] = await Promise.all([
      this.repo.findByTrigger(tenantId, eventType),
      this.repo.findPlatformRules(eventType),
    ]);
    // Merge: platform rules first (lower priority number = higher priority), then tenant rules
    return [...platformRules, ...tenantRules].sort((a, b) => a.priority - b.priority);
  }
}
