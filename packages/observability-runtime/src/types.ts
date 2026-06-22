export type MetricType = "counter" | "gauge" | "histogram";
export type SpanStatus = "ok" | "error" | "unset";
export type HealthStatus = "healthy" | "degraded" | "down";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertState = "ok" | "firing" | "acknowledged";

export interface MetricSample {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: string;
}

export interface TraceSpan {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  startTime: string;
  endTime?: string;
  status: SpanStatus;
  tags?: Record<string, string>;
  events?: string[];
  durationMs?: number;
}

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  checkedAt: string;
}

export interface SLODefinition {
  name: string;
  targetPercent: number;
  windowDays: number;
}

export interface SLOStatus {
  slo: SLODefinition;
  currentPercent: number;
  errorBudgetRemaining: number;
  isBreaching: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  metricName: string;
  threshold: number;
  severity: AlertSeverity;
  state: AlertState;
}
