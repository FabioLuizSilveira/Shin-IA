export type WidgetType = "metric" | "chart" | "table" | "map" | "timeline";
export type TrendDirection = "up" | "down" | "stable";
export type OperationStatus = "pending" | "in_progress" | "completed" | "cancelled" | "overdue";
export type AssetStatus = "available" | "rented" | "maintenance" | "retired";
export type ContractStatus = "draft" | "active" | "expired" | "cancelled";
export type CommissionStatus = "pending" | "approved" | "paid" | "disputed";

export interface WhiteLabelTheme {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  companyName: string;
  fontFamily?: string;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  visible: boolean;
  roles?: string[];
  order: number;
}

export interface MetricData {
  current: number;
  previous?: number;
  unit?: string;
}

export interface DashboardData {
  widgets: DashboardWidget[];
  metrics: Record<string, MetricData>;
}

export interface Operation {
  id: string;
  title: string;
  status: OperationStatus;
  priority: number;
  dueDate?: string;
  assignedTo?: string;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  status: AssetStatus;
  utilizationPercent: number;
  lastMaintenanceAt?: string;
}

export interface Contract {
  id: string;
  clientName: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  totalValue: number;
}

export interface RevenueEntry {
  period: string;
  gross: number;
  costs: number;
  commissions: number;
}

export interface Commission {
  id: string;
  agentName: string;
  amount: number;
  period: string;
  status: CommissionStatus;
}
export type TenantStatus = "active" | "suspended" | "trial" | "churned";
export type LeadStage =
  | "prospect"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";
export type LeadStatus = "new" | "contacted" | "active" | "inactive";
export type CheckStatus = "healthy" | "degraded" | "down";

export interface TenantInput {
  name: string;
  email: string;
  plan: string;
  country: string;
}

export interface TenantMetrics {
  totalUsers: number;
  activeDevices: number;
  monthlyRevenue: number;
  storageUsedGb: number;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  country?: string;
  status: TenantStatus;
  metrics: TenantMetrics;
  createdAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  items: InvoiceItem[];
  total: number;
  paid: number;
  dueDate: string;
  status: "draft" | "issued" | "paid" | "overdue";
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  company?: string;
  stage: LeadStage;
  status: LeadStatus;
  estimatedRevenue: number;
  createdAt: string;
}

export interface HealthCheck {
  id?: string;
  name: string;
  status: CheckStatus;
  latencyMs?: number;
  lastCheckedAt?: string;
}

export interface MetricPoint {
  id?: string;
  name?: string;
  timestamp: string;
  value: number;
  labels?: Record<string, string>;
}
