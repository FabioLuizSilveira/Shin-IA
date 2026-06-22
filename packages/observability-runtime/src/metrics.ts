import type { MetricSample, MetricType } from "./types.js";

export class ObservabilityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ObservabilityError";
  }
}

export class MetricsCollector {
  private readonly samples: MetricSample[] = [];

  record(sample: MetricSample): void {
    this.samples.push({ ...sample, timestamp: sample.timestamp || new Date().toISOString() });
  }

  increment(name: string, labels?: Record<string, string>): void {
    const existing = this.getLatest(name, labels);
    this.record({
      name,
      type: "counter",
      value: (existing?.value ?? 0) + 1,
      labels,
      timestamp: new Date().toISOString(),
    });
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.record({ name, type: "gauge", value, labels, timestamp: new Date().toISOString() });
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.record({ name, type: "histogram", value, labels, timestamp: new Date().toISOString() });
  }

  getLatest(name: string, labels?: Record<string, string>): MetricSample | undefined {
    const matching = this.samples.filter((s) => {
      if (s.name !== name) return false;
      if (!labels) return true;
      return Object.entries(labels).every(([k, v]) => s.labels?.[k] === v);
    });
    return matching[matching.length - 1];
  }

  getSummary(name: string): { count: number; sum: number; min: number; max: number; avg: number } {
    const matching = this.samples.filter((s) => s.name === name);
    if (matching.length === 0) return { count: 0, sum: 0, min: 0, max: 0, avg: 0 };
    const values = matching.map((s) => s.value);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      sum,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
    };
  }

  listByType(type: MetricType): MetricSample[] {
    return this.samples.filter((s) => s.type === type);
  }

  flush(): MetricSample[] {
    const copy = [...this.samples];
    this.samples.splice(0, this.samples.length);
    return copy;
  }

  count(): number {
    return this.samples.length;
  }
}
