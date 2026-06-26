// Auto-generated from supabase/migrations — Shinã Platform M3
// Run `supabase gen types typescript --local` to regenerate after schema changes.
// This file mirrors what the Supabase CLI generates from the live database.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ── ENUM TYPES ────────────────────────────────────────────────────────────────

export type TenantPlan = "starter" | "professional" | "enterprise";
export type TenantStatus = "trialing" | "active" | "suspended" | "cancelled";

export type BranchScopeMode = "root" | "branch" | "branch_and_children" | "custom";

export type PersonStatus = "active" | "inactive" | "blocked";

export type OrganizationType = "customer" | "supplier" | "partner" | "internal";

export type AssetCategory = "vehicle" | "equipment" | "tool" | "property" | "technology";
export type AssetStatus = "available" | "in_use" | "maintenance" | "decommissioned";

export type ResourceType = "human" | "vehicle" | "equipment" | "virtual";
export type ResourceStatus = "available" | "busy" | "offline" | "suspended";

export type CapabilityScope = "global" | "tenant" | "branch" | "resource";

export type OperationType = "delivery" | "pickup" | "maintenance" | "inspection" | "transfer";
export type OperationStatus = "pending" | "in_progress" | "completed" | "cancelled" | "failed";

export type AllocationStatus = "reserved" | "active" | "completed" | "cancelled";

export type ContractType = "service" | "rental" | "lease" | "subscription" | "one_time";
export type ContractStatus = "draft" | "active" | "expired" | "terminated" | "suspended";

export type BillingCycle = "monthly" | "quarterly" | "annual" | "one_time";
export type BillingAccountStatus = "active" | "suspended" | "closed";

export type InvoiceStatus = "draft" | "issued" | "paid" | "overdue" | "cancelled" | "voided";

export type NotificationChannel = "email" | "sms" | "push" | "in_app" | "webhook";
export type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "read";
export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type WorkflowStatus = "draft" | "active" | "inactive" | "deprecated";

export type RuleSetStatus = "draft" | "active" | "inactive";

// ── DATABASE ROW TYPES ────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: TenantPlan;
          status: TenantStatus;
          default_currency: string;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          name: string;
          slug: string;
          plan?: TenantPlan;
          status?: TenantStatus;
          default_currency?: string;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          plan?: TenantPlan;
          status?: TenantStatus;
          default_currency?: string;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          id: string;
          tenant_id: string;
          parent_id: string | null;
          name: string;
          code: string;
          active: boolean;
          scope_mode: BranchScopeMode;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          parent_id?: string | null;
          name: string;
          code: string;
          active?: boolean;
          scope_mode?: BranchScopeMode;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          parent_id?: string | null;
          name?: string;
          code?: string;
          active?: boolean;
          scope_mode?: BranchScopeMode;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "branches_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "branches_parent_fk";
            columns: ["parent_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      persons: {
        Row: {
          id: string;
          tenant_id: string;
          auth_user_id: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          phone_country_code: string | null;
          document: string | null;
          status: PersonStatus;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          auth_user_id?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          phone?: string | null;
          phone_country_code?: string | null;
          document?: string | null;
          status?: PersonStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          auth_user_id?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone?: string | null;
          phone_country_code?: string | null;
          document?: string | null;
          status?: PersonStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "persons_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          trade_name: string | null;
          document: string;
          type: OrganizationType;
          email: string | null;
          phone: string | null;
          phone_country_code: string | null;
          address_street: string | null;
          address_number: string | null;
          address_neighborhood: string | null;
          address_city: string;
          address_state: string;
          address_country: string;
          address_postal_code: string | null;
          active: boolean;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          name: string;
          trade_name?: string | null;
          document: string;
          type: OrganizationType;
          email?: string | null;
          phone?: string | null;
          phone_country_code?: string | null;
          address_street?: string | null;
          address_number?: string | null;
          address_neighborhood?: string | null;
          address_city: string;
          address_state: string;
          address_country?: string;
          address_postal_code?: string | null;
          active?: boolean;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          trade_name?: string | null;
          document?: string;
          type?: OrganizationType;
          email?: string | null;
          phone?: string | null;
          phone_country_code?: string | null;
          address_street?: string | null;
          address_number?: string | null;
          address_neighborhood?: string | null;
          address_city?: string;
          address_state?: string;
          address_country?: string;
          address_postal_code?: string | null;
          active?: boolean;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_types: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          category: AssetCategory;
          attributes: Json;
          active: boolean;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          name: string;
          category: AssetCategory;
          attributes?: Json;
          active?: boolean;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          category?: AssetCategory;
          attributes?: Json;
          active?: boolean;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "asset_types_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string;
          asset_type_id: string;
          name: string;
          serial_number: string | null;
          category: AssetCategory;
          status: AssetStatus;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          branch_id: string;
          asset_type_id: string;
          name: string;
          serial_number?: string | null;
          category: AssetCategory;
          status?: AssetStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          branch_id?: string;
          asset_type_id?: string;
          name?: string;
          serial_number?: string | null;
          category?: AssetCategory;
          status?: AssetStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_branch_fk";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_asset_type_fk";
            columns: ["asset_type_id"];
            referencedRelation: "asset_types";
            referencedColumns: ["id"];
          },
        ];
      };
      resources: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string;
          person_id: string | null;
          name: string;
          type: ResourceType;
          status: ResourceStatus;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          branch_id: string;
          person_id?: string | null;
          name: string;
          type: ResourceType;
          status?: ResourceStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          branch_id?: string;
          person_id?: string | null;
          name?: string;
          type?: ResourceType;
          status?: ResourceStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "resources_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_branch_fk";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_person_fk";
            columns: ["person_id"];
            referencedRelation: "persons";
            referencedColumns: ["id"];
          },
        ];
      };
      capabilities: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          key: string;
          scope: CapabilityScope;
          active: boolean;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          name: string;
          key: string;
          scope: CapabilityScope;
          active?: boolean;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          key?: string;
          scope?: CapabilityScope;
          active?: boolean;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "capabilities_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      operations: {
        Row: {
          id: string;
          tenant_id: string;
          branch_id: string;
          resource_id: string;
          type: OperationType;
          status: OperationStatus;
          scheduled_starts_at: string;
          scheduled_ends_at: string;
          started_at: string | null;
          completed_at: string | null;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          branch_id: string;
          resource_id: string;
          type: OperationType;
          status?: OperationStatus;
          scheduled_starts_at: string;
          scheduled_ends_at: string;
          started_at?: string | null;
          completed_at?: string | null;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          branch_id?: string;
          resource_id?: string;
          type?: OperationType;
          status?: OperationStatus;
          scheduled_starts_at?: string;
          scheduled_ends_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "operations_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operations_branch_fk";
            columns: ["branch_id"];
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operations_resource_fk";
            columns: ["resource_id"];
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      allocations: {
        Row: {
          id: string;
          tenant_id: string;
          resource_id: string;
          asset_id: string;
          period_starts_at: string;
          period_ends_at: string;
          status: AllocationStatus;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          resource_id: string;
          asset_id: string;
          period_starts_at: string;
          period_ends_at: string;
          status?: AllocationStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          resource_id?: string;
          asset_id?: string;
          period_starts_at?: string;
          period_ends_at?: string;
          status?: AllocationStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "allocations_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_resource_fk";
            columns: ["resource_id"];
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_asset_fk";
            columns: ["asset_id"];
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      contracts: {
        Row: {
          id: string;
          tenant_id: string;
          organization_id: string;
          type: ContractType;
          status: ContractStatus;
          value_amount: number;
          value_currency: string;
          period_starts_at: string;
          period_ends_at: string;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          organization_id: string;
          type: ContractType;
          status?: ContractStatus;
          value_amount: number;
          value_currency: string;
          period_starts_at: string;
          period_ends_at: string;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          organization_id?: string;
          type?: ContractType;
          status?: ContractStatus;
          value_amount?: number;
          value_currency?: string;
          period_starts_at?: string;
          period_ends_at?: string;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_organization_fk";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_accounts: {
        Row: {
          id: string;
          tenant_id: string;
          organization_id: string;
          cycle: BillingCycle;
          status: BillingAccountStatus;
          credit_limit_amount: number;
          credit_limit_currency: string;
          balance_amount: number;
          balance_currency: string;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          organization_id: string;
          cycle: BillingCycle;
          status?: BillingAccountStatus;
          credit_limit_amount: number;
          credit_limit_currency: string;
          balance_amount?: number;
          balance_currency: string;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          organization_id?: string;
          cycle?: BillingCycle;
          status?: BillingAccountStatus;
          credit_limit_amount?: number;
          credit_limit_currency?: string;
          balance_amount?: number;
          balance_currency?: string;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "billing_accounts_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_accounts_organization_fk";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          tenant_id: string;
          billing_account_id: string;
          status: InvoiceStatus;
          total_amount: number;
          total_currency: string;
          due_date: string;
          paid_at: string | null;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          billing_account_id: string;
          status?: InvoiceStatus;
          total_amount: number;
          total_currency: string;
          due_date: string;
          paid_at?: string | null;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          billing_account_id?: string;
          status?: InvoiceStatus;
          total_amount?: number;
          total_currency?: string;
          due_date?: string;
          paid_at?: string | null;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_billing_account_fk";
            columns: ["billing_account_id"];
            referencedRelation: "billing_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          tenant_id: string;
          description: string;
          quantity: number;
          unit_price_amount: number;
          unit_price_currency: string;
          sort_order: number;
        };
        Insert: {
          id: string;
          invoice_id: string;
          tenant_id: string;
          description: string;
          quantity: number;
          unit_price_amount: number;
          unit_price_currency: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          tenant_id?: string;
          description?: string;
          quantity?: number;
          unit_price_amount?: number;
          unit_price_currency?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_fk";
            columns: ["invoice_id"];
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_line_items_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          tenant_id: string;
          person_id: string | null;
          recipient_external_ref: string | null;
          channel: NotificationChannel;
          priority: NotificationPriority;
          subject: string;
          body: string;
          status: NotificationStatus;
          sent_at: string | null;
          read_at: string | null;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          person_id?: string | null;
          recipient_external_ref?: string | null;
          channel: NotificationChannel;
          priority?: NotificationPriority;
          subject: string;
          body: string;
          status?: NotificationStatus;
          sent_at?: string | null;
          read_at?: string | null;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          person_id?: string | null;
          recipient_external_ref?: string | null;
          channel?: NotificationChannel;
          priority?: NotificationPriority;
          subject?: string;
          body?: string;
          status?: NotificationStatus;
          sent_at?: string | null;
          read_at?: string | null;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_person_fk";
            columns: ["person_id"];
            referencedRelation: "persons";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_definitions: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          trigger: string;
          status: WorkflowStatus;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          name: string;
          trigger: string;
          status?: WorkflowStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          trigger?: string;
          status?: WorkflowStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_definitions_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_steps: {
        Row: {
          id: string;
          workflow_definition_id: string;
          tenant_id: string;
          name: string;
          action: string;
          next_step_id: string | null;
          sort_order: number;
        };
        Insert: {
          id: string;
          workflow_definition_id: string;
          tenant_id: string;
          name: string;
          action: string;
          next_step_id?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          workflow_definition_id?: string;
          tenant_id?: string;
          name?: string;
          action?: string;
          next_step_id?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_steps_definition_fk";
            columns: ["workflow_definition_id"];
            referencedRelation: "workflow_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_steps_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_steps_next_step_fk";
            columns: ["next_step_id"];
            referencedRelation: "workflow_steps";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_sets: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          context: string;
          status: RuleSetStatus;
          version: number;
          metadata: Json;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          tenant_id: string;
          name: string;
          context: string;
          status?: RuleSetStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          context?: string;
          status?: RuleSetStatus;
          version?: number;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rule_sets_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_set_rules: {
        Row: {
          id: string;
          rule_set_id: string;
          tenant_id: string;
          condition: string;
          action: string;
          priority: number;
        };
        Insert: {
          id: string;
          rule_set_id: string;
          tenant_id: string;
          condition: string;
          action: string;
          priority?: number;
        };
        Update: {
          id?: string;
          rule_set_id?: string;
          tenant_id?: string;
          condition?: string;
          action?: string;
          priority?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rule_set_rules_rule_set_fk";
            columns: ["rule_set_id"];
            referencedRelation: "rule_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_set_rules_tenant_fk";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      tenant_plan: TenantPlan;
      tenant_status: TenantStatus;
      branch_scope_mode: BranchScopeMode;
      person_status: PersonStatus;
      organization_type: OrganizationType;
      asset_category: AssetCategory;
      asset_status: AssetStatus;
      resource_type: ResourceType;
      resource_status: ResourceStatus;
      capability_scope: CapabilityScope;
      operation_type: OperationType;
      operation_status: OperationStatus;
      allocation_status: AllocationStatus;
      contract_type: ContractType;
      contract_status: ContractStatus;
      billing_cycle: BillingCycle;
      billing_account_status: BillingAccountStatus;
      invoice_status: InvoiceStatus;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      notification_priority: NotificationPriority;
      workflow_status: WorkflowStatus;
      rule_set_status: RuleSetStatus;
    };
    CompositeTypes: Record<string, never>;
  };
  events: {
    Tables: {
      domain_events: {
        Row: {
          id: string;
          event_type: string;
          aggregate_id: string;
          aggregate_type: string;
          tenant_id: string | null;
          version: number;
          payload: Json;
          occurred_at: string;
          published_at: string | null;
        };
        Insert: {
          id: string;
          event_type: string;
          aggregate_id: string;
          aggregate_type: string;
          tenant_id?: string | null;
          version?: number;
          payload: Json;
          occurred_at: string;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          event_type?: string;
          aggregate_id?: string;
          aggregate_type?: string;
          tenant_id?: string | null;
          version?: number;
          payload?: Json;
          occurred_at?: string;
          published_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ── HELPER TYPES ──────────────────────────────────────────────────────────────

// Schema-specific helpers (concrete — no generic schema param, avoids TS2536)
export type PublicTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type PublicTablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type PublicTablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type EventTables<T extends keyof Database["events"]["Tables"]> =
  Database["events"]["Tables"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

// Generic helpers using conditional types for cross-schema usage
type ExtractRow<T> = T extends { Row: infer R } ? R : never;
type ExtractInsert<T> = T extends { Insert: infer I } ? I : never;
type ExtractUpdate<T> = T extends { Update: infer U } ? U : never;

export type Tables<S extends keyof Database, T extends keyof Database[S]["Tables"]> = ExtractRow<
  Database[S]["Tables"][T]
>;

export type TablesInsert<
  S extends keyof Database,
  T extends keyof Database[S]["Tables"],
> = ExtractInsert<Database[S]["Tables"][T]>;

export type TablesUpdate<
  S extends keyof Database,
  T extends keyof Database[S]["Tables"],
> = ExtractUpdate<Database[S]["Tables"][T]>;
