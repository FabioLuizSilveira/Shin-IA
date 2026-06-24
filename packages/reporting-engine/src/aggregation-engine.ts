import type { AggregationRequest, AggregationResult, ReportFilter } from "./types.js";

/**
 * In-memory aggregation engine. Operates on data already loaded into memory
 * as plain objects — no DB queries or external services here.
 */
export class AggregationEngine {
  aggregate(request: AggregationRequest, rows: Record<string, unknown>[]): AggregationResult {
    const filtered = this.applyFilters(rows, request.filters);
    const grouped = this.groupRows(filtered, request.groupBy, request.metric, request.aggregation);
    const overall = this.computeAggregation(filtered, request.metric, request.aggregation);

    return {
      dataSource: request.dataSource,
      metric: request.metric,
      aggregation: request.aggregation,
      value: overall,
      groups: grouped,
      period: request.period ?? null,
      computedAt: new Date().toISOString(),
    };
  }

  applyFilters(
    rows: Record<string, unknown>[],
    filters: ReportFilter[],
  ): Record<string, unknown>[] {
    return rows.filter((row) => filters.every((f) => this.matchFilter(row, f)));
  }

  private matchFilter(row: Record<string, unknown>, filter: ReportFilter): boolean {
    const value = row[filter.field];
    const fv = filter.value;

    switch (filter.operator) {
      case "eq":
        return value === fv;
      case "neq":
        return value !== fv;
      case "gt":
        return Number(value) > Number(fv);
      case "gte":
        return Number(value) >= Number(fv);
      case "lt":
        return Number(value) < Number(fv);
      case "lte":
        return Number(value) <= Number(fv);
      case "in":
        return Array.isArray(fv) && fv.includes(value);
      case "contains":
        return typeof value === "string" && value.includes(String(fv));
      default:
        return true;
    }
  }

  private groupRows(
    rows: Record<string, unknown>[],
    groupBy: string[],
    metric: string,
    aggregation: AggregationRequest["aggregation"],
  ): Array<{ key: string; value: number }> {
    if (groupBy.length === 0) return [];

    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const key = groupBy.map((g) => String(row[g] ?? "")).join("|");
      const existing = groups.get(key) ?? [];
      existing.push(row);
      groups.set(key, existing);
    }

    return [...groups.entries()].map(([key, groupRows]) => ({
      key,
      value: this.computeAggregation(groupRows, metric, aggregation),
    }));
  }

  computeAggregation(
    rows: Record<string, unknown>[],
    metric: string,
    aggregation: AggregationRequest["aggregation"],
  ): number {
    if (aggregation === "count") return rows.length;
    if (rows.length === 0) return 0;

    const values = rows.map((r) => Number(r[metric] ?? 0));

    switch (aggregation) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
    }
  }
}
