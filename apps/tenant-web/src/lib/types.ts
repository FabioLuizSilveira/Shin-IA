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
