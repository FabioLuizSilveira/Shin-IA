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
