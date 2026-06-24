import type { Resource, ResourceQuery, MatchResult } from "./types.js";

export class CapabilityMatcher {
  match(resources: Resource[], query: ResourceQuery): MatchResult[] {
    const required = query.requiredCapabilities ?? [];

    return resources
      .filter((r) => {
        if (r.tenantId !== query.tenantId) return false;
        if (r.status === "inactive") return false;
        if (query.branchId && r.branchId !== query.branchId) return false;
        if (query.type && r.type !== query.type) return false;
        if (query.subtypes && query.subtypes.length > 0 && !query.subtypes.includes(r.subtype))
          return false;
        // Must satisfy all required capabilities
        return required.every((cap) => r.capabilities.includes(cap));
      })
      .map((r) => this.score(r, required))
      .sort((a, b) => b.score - a.score); // highest score first
  }

  findBestMatch(resources: Resource[], query: ResourceQuery): MatchResult | null {
    const results = this.match(resources, query);
    return results[0] ?? null;
  }

  private score(resource: Resource, requiredCapabilities: string[]): MatchResult {
    const matched = resource.capabilities.filter((c) => requiredCapabilities.includes(c));
    const missing = requiredCapabilities.filter((c) => !resource.capabilities.includes(c));

    // Score: base 100 + bonus for extra capabilities (matching spec exactly is slightly penalized)
    const base = 100;
    const extraCaps = resource.capabilities.length - matched.length;
    const score = base + matched.length * 10 - extraCaps; // prefer more focused resources

    return { resource, score, matchedCapabilities: matched, missingCapabilities: missing };
  }
}
