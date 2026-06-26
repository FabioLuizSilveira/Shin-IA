// ─── Report Definition ────────────────────────────────────────────────────────

export type ReportFormat = "pdf" | "excel" | "csv" | "json";

export type ReportStatus = "draft" | "scheduled" | "running" | "completed" | "failed";

export type KpiType =
  | "operations"
  | "assets"
  | "revenue"
  | "commissions"
  | "utilization"
  | "tracking";

export interface ReportFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "currency";
  aggregation?: "sum" | "avg" | "min" | "max" | "count";
  format?: string;
}

export interface ReportDefinition {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  dataSource: string;
  columns: ReportColumn[];
  filters: ReportFilter[];
  groupBy: string[];
  sortBy: Array<{ field: string; direction: "asc" | "desc" }>;
  format: ReportFormat;
  schedule: string | null;
  status: ReportStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Report Run ───────────────────────────────────────────────────────────────

export interface ReportRun {
  id: string;
  tenantId: string;
  definitionId: string;
  status: ReportStatus;
  format: ReportFormat;
  rowCount: number | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ─── Dashboard & KPI ──────────────────────────────────────────────────────────

export interface KpiValue {
  type: KpiType;
  label: string;
  value: number;
  unit: string;
  previousValue: number | null;
  changePercent: number | null;
  period: string;
  computedAt: string;
}

export interface DashboardWidget {
  id: string;
  type: "kpi" | "chart" | "table" | "map";
  title: string;
  kpiType?: KpiType;
  dataSource?: string;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

export interface Dashboard {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

export interface AggregationRequest {
  dataSource: string;
  metric: string;
  aggregation: "sum" | "avg" | "min" | "max" | "count";
  filters: ReportFilter[];
  groupBy: string[];
  period?: { start: string; end: string };
}

export interface AggregationResult {
  dataSource: string;
  metric: string;
  aggregation: string;
  value: number;
  groups: Array<{ key: string; value: number }>;
  period: { start: string; end: string } | null;
  computedAt: string;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportRequest {
  format: ReportFormat;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ExportResult {
  format: ReportFormat;
  content: string;
  contentType: string;
  rowCount: number;
  byteSize: number;
}

// ─── Repository interfaces ────────────────────────────────────────────────────

export interface ReportDefinitionRepository {
  findById(id: string): Promise<ReportDefinition | null>;
  findByTenantId(tenantId: string): Promise<ReportDefinition[]>;
  save(def: ReportDefinition): Promise<ReportDefinition>;
  update(def: ReportDefinition): Promise<ReportDefinition>;
}

export interface ReportRunRepository {
  findById(id: string): Promise<ReportRun | null>;
  findByDefinitionId(definitionId: string): Promise<ReportRun[]>;
  save(run: ReportRun): Promise<ReportRun>;
  update(run: ReportRun): Promise<ReportRun>;
}

export interface DashboardRepository {
  findById(id: string): Promise<Dashboard | null>;
  findByTenantId(tenantId: string): Promise<Dashboard[]>;
  findDefault(tenantId: string): Promise<Dashboard | null>;
  save(dashboard: Dashboard): Promise<Dashboard>;
  update(dashboard: Dashboard): Promise<Dashboard>;
}
