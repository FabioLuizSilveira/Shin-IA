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
  type: OrganizationType;
  email?: string;
}

export type ResourceType = "human" | "vehicle" | "equipment" | "virtual";
export type ResourceStatus = "available" | "busy" | "offline" | "suspended";

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
}

export interface AssetType {
  id: string;
  name: string;
  category: AssetCategory;
}
