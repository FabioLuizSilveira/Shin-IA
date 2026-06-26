export type TenantPlan = "starter" | "professional" | "enterprise";
export type TenantStatus = "trialing" | "active" | "suspended" | "cancelled";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  created_at: string;
}

export type OperationType = "delivery" | "pickup" | "maintenance" | "inspection" | "transfer";
export type OperationStatus = "pending" | "in_progress" | "completed" | "cancelled" | "failed";

export interface Operation {
  id: string;
  type: OperationType;
  status: OperationStatus;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
  resource_name?: string;
  resource_type?: string;
}

export interface OperationDetail {
  id: string;
  type: OperationType;
  status: OperationStatus;
  scheduled_starts_at: string;
  scheduled_ends_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  resources: {
    id: string;
    name: string;
    type: string;
    status: string;
  } | null;
}

export type AssetCategory = "vehicle" | "equipment" | "tool" | "property" | "technology";
export type AssetStatus = "available" | "in_use" | "maintenance" | "decommissioned";

export interface Asset {
  id: string;
  name: string;
  serial_number?: string;
  category: AssetCategory;
  status: AssetStatus;
  type_name?: string;
  branch_id?: string;
  asset_type_id?: string;
}

export type ContractType = "service" | "rental" | "lease" | "subscription" | "one_time";
export type ContractStatus = "draft" | "active" | "expired" | "terminated" | "suspended";

export interface Contract {
  id: string;
  type: ContractType;
  status: ContractStatus;
  value_amount: number;
  value_currency: string;
  period_starts_at: string;
  period_ends_at: string;
  organization_name?: string;
  organization_id?: string;
}

export type OrganizationType = "customer" | "supplier" | "partner" | "internal";

export interface Organization {
  id: string;
  name: string;
  trade_name?: string;
  document: string;
  type: OrganizationType;
  email?: string;
  phone?: string;
  address_city: string;
  address_state: string;
  address_country: string;
  active: boolean;
  created_at: string;
}

export interface ContractDetail {
  id: string;
  type: ContractType;
  status: ContractStatus;
  value_amount: number;
  value_currency: string;
  period_starts_at: string;
  period_ends_at: string;
  created_at: string;
  organizations: {
    id: string;
    name: string;
    type: OrganizationType;
    document: string;
    email?: string;
  } | null;
}

export type ResourceType = "human" | "vehicle" | "equipment" | "virtual";
export type ResourceStatus = "available" | "busy" | "offline" | "maintenance";

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  branch_id: string;
  created_at: string;
}

export interface ResourceDetail extends Resource {
  recent_operations: {
    id: string;
    type: string;
    status: string;
    scheduled_starts_at: string;
    scheduled_ends_at: string;
  }[];
}

export interface AssetType {
  id: string;
  name: string;
  category: AssetCategory;
}

export interface AnalyticsData {
  operations: {
    total: number;
    byStatus: {
      pending: number;
      in_progress: number;
      completed: number;
      cancelled: number;
      failed: number;
    };
    completionRate: number;
  };
  assets: {
    total: number;
    byStatus: {
      available: number;
      in_use: number;
      maintenance: number;
      decommissioned: number;
    };
    byCategory: Record<string, number>;
    utilizationRate: number;
  };
  contracts: {
    total: number;
    byStatus: {
      draft: number;
      active: number;
      expired: number;
      terminated: number;
    };
    totalRevenue: number;
    avgContractValue: number;
    activeCount: number;
  };
}

export type BillingCycle = "monthly" | "quarterly" | "annual" | "one_time";
export type BillingAccountStatus = "active" | "suspended" | "closed";
export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled" | "voided";

export interface BillingAccount {
  id: string;
  organization_id: string;
  cycle: BillingCycle;
  status: BillingAccountStatus;
  credit_limit_amount: number;
  credit_limit_currency: string;
  balance_amount: number;
  balance_currency: string;
  created_at: string;
  organizations?: { id: string; name: string; type: string };
}

export interface Invoice {
  id: string;
  billing_account_id: string;
  status: InvoiceStatus;
  total_amount: number;
  total_currency: string;
  due_date: string;
  paid_at?: string;
  created_at: string;
  billing_accounts?: {
    id: string;
    cycle: BillingCycle;
    organizations?: { id: string; name: string };
  };
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price_amount: number;
  unit_price_currency: string;
  sort_order: number;
}

export interface InvoiceDetail extends Invoice {
  invoice_line_items: InvoiceLineItem[];
}
