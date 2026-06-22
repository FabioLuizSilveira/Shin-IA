import type { OperatorProfile, OperatorStatus } from "./types.js";
import { MarketplaceError } from "./partner-registry.js";

export function computeOperatorScore(operator: OperatorProfile): number {
  const ratingWeight = operator.rating * 10;
  const experienceWeight = Math.min(operator.jobsCompleted * 0.5, 30);
  return Math.min(ratingWeight + experienceWeight, 100);
}

export class OperatorNetwork {
  private readonly operators = new Map<string, OperatorProfile>();

  register(operator: OperatorProfile): void {
    if (this.operators.has(operator.id)) {
      throw new MarketplaceError(
        `Operator already registered: ${operator.id}`,
        "DUPLICATE_OPERATOR",
      );
    }
    this.operators.set(operator.id, { ...operator });
  }

  get(id: string): OperatorProfile {
    const o = this.operators.get(id);
    if (!o) throw new MarketplaceError(`Operator not found: ${id}`, "OPERATOR_NOT_FOUND");
    return { ...o };
  }

  updateStatus(id: string, status: OperatorStatus): void {
    const o = this.operators.get(id);
    if (!o) throw new MarketplaceError(`Operator not found: ${id}`, "OPERATOR_NOT_FOUND");
    this.operators.set(id, { ...o, status });
  }

  recordJobCompletion(id: string): void {
    const o = this.operators.get(id);
    if (!o) throw new MarketplaceError(`Operator not found: ${id}`, "OPERATOR_NOT_FOUND");
    if (o.status !== "active") {
      throw new MarketplaceError(`Operator is not active: ${id}`, "OPERATOR_NOT_ACTIVE");
    }
    this.operators.set(id, { ...o, jobsCompleted: o.jobsCompleted + 1 });
  }

  updateRating(id: string, rating: number): void {
    const o = this.operators.get(id);
    if (!o) throw new MarketplaceError(`Operator not found: ${id}`, "OPERATOR_NOT_FOUND");
    if (rating < 0 || rating > 5) {
      throw new MarketplaceError(`Rating must be between 0 and 5`, "INVALID_RATING");
    }
    this.operators.set(id, { ...o, rating });
  }

  listByRegion(region: string): OperatorProfile[] {
    return [...this.operators.values()].filter((o) => o.region === region);
  }

  listBySkill(skill: string): OperatorProfile[] {
    return [...this.operators.values()].filter((o) => o.skills.includes(skill));
  }

  listActive(): OperatorProfile[] {
    return [...this.operators.values()].filter((o) => o.status === "active");
  }

  listByTenant(tenantId: string): OperatorProfile[] {
    return [...this.operators.values()].filter((o) => o.tenantId === tenantId);
  }

  getTopOperators(limit: number): OperatorProfile[] {
    return [...this.operators.values()]
      .filter((o) => o.status === "active")
      .sort((a, b) => computeOperatorScore(b) - computeOperatorScore(a))
      .slice(0, limit);
  }

  count(): number {
    return this.operators.size;
  }
}
