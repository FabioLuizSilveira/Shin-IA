export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  events: {
    Tables: {
      domain_events: {
        Row: {
          aggregate_id: string;
          aggregate_type: string;
          event_type: string;
          id: string;
          occurred_at: string;
          payload: Json;
          published_at: string | null;
          tenant_id: string | null;
          version: number;
        };
        Insert: {
          aggregate_id: string;
          aggregate_type: string;
          event_type: string;
          id: string;
          occurred_at: string;
          payload: Json;
          published_at?: string | null;
          tenant_id?: string | null;
          version?: number;
        };
        Update: {
          aggregate_id?: string;
          aggregate_type?: string;
          event_type?: string;
          id?: string;
          occurred_at?: string;
          payload?: Json;
          published_at?: string | null;
          tenant_id?: string | null;
          version?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      allocations: {
        Row: {
          asset_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          period_ends_at: string;
          period_starts_at: string;
          resource_id: string;
          status: Database["public"]["Enums"]["allocation_status"];
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          period_ends_at: string;
          period_starts_at: string;
          resource_id: string;
          status?: Database["public"]["Enums"]["allocation_status"];
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          period_ends_at?: string;
          period_starts_at?: string;
          resource_id?: string;
          status?: Database["public"]["Enums"]["allocation_status"];
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "allocations_asset_fk";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_resource_fk";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_requests: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          expires_at: string;
          id: string;
          metadata: Json;
          reason: string | null;
          rejection_reason: string | null;
          status: string;
          subject_id: string;
          subject_type: string;
          submitted_by: string;
          tenant_id: string | null;
          updated_at: string;
          version: number;
          workflow_type: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          expires_at: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
          rejection_reason?: string | null;
          status?: string;
          subject_id: string;
          subject_type: string;
          submitted_by: string;
          tenant_id?: string | null;
          updated_at?: string;
          version?: number;
          workflow_type: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          expires_at?: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
          rejection_reason?: string | null;
          status?: string;
          subject_id?: string;
          subject_type?: string;
          submitted_by?: string;
          tenant_id?: string | null;
          updated_at?: string;
          version?: number;
          workflow_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_requests_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_steps: {
        Row: {
          acted_at: string | null;
          acted_by_id: string | null;
          approval_request_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          required_role: string | null;
          required_user_id: string | null;
          status: string;
          step_number: number;
          step_type: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          acted_at?: string | null;
          acted_by_id?: string | null;
          approval_request_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          required_role?: string | null;
          required_user_id?: string | null;
          status?: string;
          step_number: number;
          step_type: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          acted_at?: string | null;
          acted_by_id?: string | null;
          approval_request_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          required_role?: string | null;
          required_user_id?: string | null;
          status?: string;
          step_number?: number;
          step_type?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "approval_steps_acted_by_fk";
            columns: ["acted_by_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_steps_request_fk";
            columns: ["approval_request_id"];
            isOneToOne: false;
            referencedRelation: "approval_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_owner_settlements: {
        Row: {
          asset_id: string;
          contract_id: string | null;
          created_at: string;
          currency: string;
          gross_amount: number;
          id: string;
          invoice_id: string;
          owner_amount: number;
          owner_org_id: string;
          tenant_amount: number;
          tenant_id: string;
          tenant_share_pct: number;
        };
        Insert: {
          asset_id: string;
          contract_id?: string | null;
          created_at?: string;
          currency?: string;
          gross_amount: number;
          id?: string;
          invoice_id: string;
          owner_amount: number;
          owner_org_id: string;
          tenant_amount: number;
          tenant_id: string;
          tenant_share_pct: number;
        };
        Update: {
          asset_id?: string;
          contract_id?: string | null;
          created_at?: string;
          currency?: string;
          gross_amount?: number;
          id?: string;
          invoice_id?: string;
          owner_amount?: number;
          owner_org_id?: string;
          tenant_amount?: number;
          tenant_id?: string;
          tenant_share_pct?: number;
        };
        Relationships: [
          {
            foreignKeyName: "asset_owner_settlements_asset_fk";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_owner_settlements_contract_fk";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_owner_settlements_invoice_fk";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_owner_settlements_owner_org_fk";
            columns: ["owner_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_owner_settlements_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      asset_types: {
        Row: {
          active: boolean;
          attributes: Json;
          category: Database["public"]["Enums"]["asset_category"];
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          name: string;
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          attributes?: Json;
          category: Database["public"]["Enums"]["asset_category"];
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          name: string;
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          attributes?: Json;
          category?: Database["public"]["Enums"]["asset_category"];
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "asset_types_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          acquisition_cost_cents: number | null;
          asset_type_id: string;
          branch_id: string;
          category: Database["public"]["Enums"]["asset_category"];
          created_at: string;
          deleted_at: string | null;
          hour_meter: number | null;
          id: string;
          metadata: Json;
          name: string;
          odometer: number | null;
          owner_org_id: string | null;
          ownership_type: Database["public"]["Enums"]["asset_ownership_type"];
          plate: string | null;
          renavam: string | null;
          serial_number: string | null;
          status: Database["public"]["Enums"]["asset_status"];
          tenant_id: string;
          tenant_share_pct: number;
          updated_at: string;
          version: number;
        };
        Insert: {
          acquisition_cost_cents?: number | null;
          asset_type_id: string;
          branch_id: string;
          category: Database["public"]["Enums"]["asset_category"];
          created_at?: string;
          deleted_at?: string | null;
          hour_meter?: number | null;
          id: string;
          metadata?: Json;
          name: string;
          odometer?: number | null;
          owner_org_id?: string | null;
          ownership_type?: Database["public"]["Enums"]["asset_ownership_type"];
          plate?: string | null;
          renavam?: string | null;
          serial_number?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          tenant_id: string;
          tenant_share_pct?: number;
          updated_at?: string;
          version?: number;
        };
        Update: {
          acquisition_cost_cents?: number | null;
          asset_type_id?: string;
          branch_id?: string;
          category?: Database["public"]["Enums"]["asset_category"];
          created_at?: string;
          deleted_at?: string | null;
          hour_meter?: number | null;
          id?: string;
          metadata?: Json;
          name?: string;
          odometer?: number | null;
          owner_org_id?: string | null;
          ownership_type?: Database["public"]["Enums"]["asset_ownership_type"];
          plate?: string | null;
          renavam?: string | null;
          serial_number?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          tenant_id?: string;
          tenant_share_pct?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_fk";
            columns: ["asset_type_id"];
            isOneToOne: false;
            referencedRelation: "asset_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_branch_fk";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_owner_org_id_fkey";
            columns: ["owner_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_accounts: {
        Row: {
          balance_amount: number;
          balance_currency: string;
          created_at: string;
          credit_limit_amount: number;
          credit_limit_currency: string;
          cycle: Database["public"]["Enums"]["billing_cycle"];
          deleted_at: string | null;
          gateway_customer_id: string | null;
          id: string;
          metadata: Json;
          organization_id: string;
          status: Database["public"]["Enums"]["billing_account_status"];
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          balance_amount?: number;
          balance_currency: string;
          created_at?: string;
          credit_limit_amount: number;
          credit_limit_currency: string;
          cycle: Database["public"]["Enums"]["billing_cycle"];
          deleted_at?: string | null;
          gateway_customer_id?: string | null;
          id: string;
          metadata?: Json;
          organization_id: string;
          status?: Database["public"]["Enums"]["billing_account_status"];
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          balance_amount?: number;
          balance_currency?: string;
          created_at?: string;
          credit_limit_amount?: number;
          credit_limit_currency?: string;
          cycle?: Database["public"]["Enums"]["billing_cycle"];
          deleted_at?: string | null;
          gateway_customer_id?: string | null;
          id?: string;
          metadata?: Json;
          organization_id?: string;
          status?: Database["public"]["Enums"]["billing_account_status"];
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "billing_accounts_organization_fk";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_accounts_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      blueprint_contract_mappings: {
        Row: {
          blueprint_id: string;
          contract_template_key: string;
          created_at: string;
          id: string;
          is_default: boolean;
        };
        Insert: {
          blueprint_id: string;
          contract_template_key: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
        };
        Update: {
          blueprint_id?: string;
          contract_template_key?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
        };
        Relationships: [];
      };
      blueprint_inspection_mappings: {
        Row: {
          ai_damage_detection_enabled: boolean;
          ai_requires_human_approval: boolean;
          blueprint_id: string;
          created_at: string;
          id: string;
          is_default: boolean;
          purpose: Database["public"]["Enums"]["inspection_purpose"];
          required: boolean;
          template_id: string;
        };
        Insert: {
          ai_damage_detection_enabled?: boolean;
          ai_requires_human_approval?: boolean;
          blueprint_id: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          purpose: Database["public"]["Enums"]["inspection_purpose"];
          required?: boolean;
          template_id: string;
        };
        Update: {
          ai_damage_detection_enabled?: boolean;
          ai_requires_human_approval?: boolean;
          blueprint_id?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          purpose?: Database["public"]["Enums"]["inspection_purpose"];
          required?: boolean;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blueprint_inspection_mappings_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "inspection_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      blueprint_instances: {
        Row: {
          blueprint_id: string;
          blueprint_version: string;
          config: Json;
          id: string;
          installed_at: string;
          installed_by: string;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          blueprint_id: string;
          blueprint_version: string;
          config?: Json;
          id?: string;
          installed_at?: string;
          installed_by: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          blueprint_id?: string;
          blueprint_version?: string;
          config?: Json;
          id?: string;
          installed_at?: string;
          installed_by?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blueprint_instances_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      branches: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          name: string;
          parent_id: string | null;
          scope_mode: Database["public"]["Enums"]["branch_scope_mode"];
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          name: string;
          parent_id?: string | null;
          scope_mode?: Database["public"]["Enums"]["branch_scope_mode"];
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          parent_id?: string | null;
          scope_mode?: Database["public"]["Enums"]["branch_scope_mode"];
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "branches_parent_fk";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "branches_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      capabilities: {
        Row: {
          active: boolean;
          created_at: string;
          deleted_at: string | null;
          id: string;
          key: string;
          metadata: Json;
          name: string;
          scope: Database["public"]["Enums"]["capability_scope"];
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          key: string;
          metadata?: Json;
          name: string;
          scope: Database["public"]["Enums"]["capability_scope"];
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          key?: string;
          metadata?: Json;
          name?: string;
          scope?: Database["public"]["Enums"]["capability_scope"];
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "capabilities_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      checkout_session_references: {
        Row: {
          commercial_terms_snapshot_id: string;
          contract_acceptance_id: string;
          created_at: string;
          id: string;
          plan_version_id: string;
          product: Database["public"]["Enums"]["subscription_product"];
          provider: string;
          provider_session_id: string | null;
          status: string;
          tenant_id: string | null;
          user_id: string;
        };
        Insert: {
          commercial_terms_snapshot_id: string;
          contract_acceptance_id: string;
          created_at?: string;
          id?: string;
          plan_version_id: string;
          product: Database["public"]["Enums"]["subscription_product"];
          provider?: string;
          provider_session_id?: string | null;
          status?: string;
          tenant_id?: string | null;
          user_id: string;
        };
        Update: {
          commercial_terms_snapshot_id?: string;
          contract_acceptance_id?: string;
          created_at?: string;
          id?: string;
          plan_version_id?: string;
          product?: Database["public"]["Enums"]["subscription_product"];
          provider?: string;
          provider_session_id?: string | null;
          status?: string;
          tenant_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "checkout_session_references_commercial_terms_snapshot_id_fkey";
            columns: ["commercial_terms_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "commercial_terms_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkout_session_references_contract_acceptance_id_fkey";
            columns: ["contract_acceptance_id"];
            isOneToOne: false;
            referencedRelation: "contract_acceptances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkout_session_references_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "checkout_session_references_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      commercial_terms_snapshots: {
        Row: {
          accepted_at: string;
          billing_cycle: string;
          commitment_period_months: number | null;
          contract_version_id: string;
          created_at: string;
          currency: string;
          discount_rules: Json;
          id: string;
          included_features: Json;
          overage_rules: Json;
          plan_id: string;
          plan_version_id: string;
          price_cents: number;
          product: Database["public"]["Enums"]["subscription_product"];
          revenue_share: Json;
          tenant_id: string | null;
          trial_days: number;
          usage_limits: Json;
          user_id: string;
        };
        Insert: {
          accepted_at?: string;
          billing_cycle: string;
          commitment_period_months?: number | null;
          contract_version_id: string;
          created_at?: string;
          currency: string;
          discount_rules?: Json;
          id?: string;
          included_features?: Json;
          overage_rules?: Json;
          plan_id: string;
          plan_version_id: string;
          price_cents: number;
          product: Database["public"]["Enums"]["subscription_product"];
          revenue_share?: Json;
          tenant_id?: string | null;
          trial_days?: number;
          usage_limits?: Json;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          billing_cycle?: string;
          commitment_period_months?: number | null;
          contract_version_id?: string;
          created_at?: string;
          currency?: string;
          discount_rules?: Json;
          id?: string;
          included_features?: Json;
          overage_rules?: Json;
          plan_id?: string;
          plan_version_id?: string;
          price_cents?: number;
          product?: Database["public"]["Enums"]["subscription_product"];
          revenue_share?: Json;
          tenant_id?: string | null;
          trial_days?: number;
          usage_limits?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commercial_terms_snapshots_contract_version_id_fkey";
            columns: ["contract_version_id"];
            isOneToOne: false;
            referencedRelation: "contract_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commercial_terms_snapshots_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commercial_terms_snapshots_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commercial_terms_snapshots_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_approvals: {
        Row: {
          created_at: string;
          decision: Database["public"]["Enums"]["commission_approval_decision"] | null;
          id: string;
          notes: string | null;
          requested_at: string;
          requested_by: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["commission_approval_status"];
          tenant_id: string;
          transaction_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          decision?: Database["public"]["Enums"]["commission_approval_decision"] | null;
          id?: string;
          notes?: string | null;
          requested_at?: string;
          requested_by: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["commission_approval_status"];
          tenant_id: string;
          transaction_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          decision?: Database["public"]["Enums"]["commission_approval_decision"] | null;
          id?: string;
          notes?: string | null;
          requested_at?: string;
          requested_by?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["commission_approval_status"];
          tenant_id?: string;
          transaction_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_approvals_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_approvals_transaction_fk";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "commission_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_campaigns: {
        Row: {
          bonus_rate: number;
          created_at: string;
          description: string | null;
          eligible_branch_ids: string[];
          end_date: string;
          id: string;
          max_payout: number | null;
          name: string;
          plan_id: string;
          start_date: string;
          status: Database["public"]["Enums"]["commission_campaign_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          bonus_rate?: number;
          created_at?: string;
          description?: string | null;
          eligible_branch_ids?: string[];
          end_date: string;
          id?: string;
          max_payout?: number | null;
          name: string;
          plan_id: string;
          start_date: string;
          status?: Database["public"]["Enums"]["commission_campaign_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          bonus_rate?: number;
          created_at?: string;
          description?: string | null;
          eligible_branch_ids?: string[];
          end_date?: string;
          id?: string;
          max_payout?: number | null;
          name?: string;
          plan_id?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["commission_campaign_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_campaigns_plan_fk";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "commission_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_campaigns_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_plans: {
        Row: {
          base_rate: number;
          calculation_type: Database["public"]["Enums"]["commission_calculation_type"];
          created_at: string;
          currency: string;
          deleted_at: string | null;
          description: string | null;
          effective_from: string;
          effective_until: string | null;
          id: string;
          name: string;
          period: Database["public"]["Enums"]["commission_period"];
          status: Database["public"]["Enums"]["commission_plan_status"];
          tenant_id: string;
          tiers: Json;
          updated_at: string;
          version: number;
        };
        Insert: {
          base_rate?: number;
          calculation_type?: Database["public"]["Enums"]["commission_calculation_type"];
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          description?: string | null;
          effective_from?: string;
          effective_until?: string | null;
          id?: string;
          name: string;
          period?: Database["public"]["Enums"]["commission_period"];
          status?: Database["public"]["Enums"]["commission_plan_status"];
          tenant_id: string;
          tiers?: Json;
          updated_at?: string;
          version?: number;
        };
        Update: {
          base_rate?: number;
          calculation_type?: Database["public"]["Enums"]["commission_calculation_type"];
          created_at?: string;
          currency?: string;
          deleted_at?: string | null;
          description?: string | null;
          effective_from?: string;
          effective_until?: string | null;
          id?: string;
          name?: string;
          period?: Database["public"]["Enums"]["commission_period"];
          status?: Database["public"]["Enums"]["commission_plan_status"];
          tenant_id?: string;
          tiers?: Json;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "commission_plans_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_rules: {
        Row: {
          bonus_amount: number | null;
          condition_type: Database["public"]["Enums"]["commission_rule_condition_type"];
          condition_value: Json;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          plan_id: string;
          priority: number;
          rate_override: number | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          bonus_amount?: number | null;
          condition_type?: Database["public"]["Enums"]["commission_rule_condition_type"];
          condition_value?: Json;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          plan_id: string;
          priority?: number;
          rate_override?: number | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          bonus_amount?: number | null;
          condition_type?: Database["public"]["Enums"]["commission_rule_condition_type"];
          condition_value?: Json;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          plan_id?: string;
          priority?: number;
          rate_override?: number | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_rules_plan_fk";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "commission_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_rules_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_settlements: {
        Row: {
          branch_id: string;
          created_at: string;
          currency: string;
          external_reference: string | null;
          failed_at: string | null;
          failure_reason: string | null;
          id: string;
          processed_at: string | null;
          scheduled_at: string;
          status: Database["public"]["Enums"]["commission_settlement_status"];
          tenant_id: string;
          total_amount: number;
          transaction_ids: string[];
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          currency?: string;
          external_reference?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          processed_at?: string | null;
          scheduled_at: string;
          status?: Database["public"]["Enums"]["commission_settlement_status"];
          tenant_id: string;
          total_amount?: number;
          transaction_ids?: string[];
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          currency?: string;
          external_reference?: string | null;
          failed_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          processed_at?: string | null;
          scheduled_at?: string;
          status?: Database["public"]["Enums"]["commission_settlement_status"];
          tenant_id?: string;
          total_amount?: number;
          transaction_ids?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_settlements_branch_fk";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_settlements_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_targets: {
        Row: {
          achieved_operations: number;
          achieved_revenue: number;
          branch_id: string;
          created_at: string;
          currency: string;
          id: string;
          period: Database["public"]["Enums"]["commission_period"];
          period_end: string;
          period_start: string;
          plan_id: string;
          status: Database["public"]["Enums"]["commission_target_status"];
          target_operations: number | null;
          target_revenue: number;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          achieved_operations?: number;
          achieved_revenue?: number;
          branch_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          period: Database["public"]["Enums"]["commission_period"];
          period_end: string;
          period_start: string;
          plan_id: string;
          status?: Database["public"]["Enums"]["commission_target_status"];
          target_operations?: number | null;
          target_revenue: number;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          achieved_operations?: number;
          achieved_revenue?: number;
          branch_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          period?: Database["public"]["Enums"]["commission_period"];
          period_end?: string;
          period_start?: string;
          plan_id?: string;
          status?: Database["public"]["Enums"]["commission_target_status"];
          target_operations?: number | null;
          target_revenue?: number;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_targets_branch_fk";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_targets_plan_fk";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "commission_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_targets_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_transactions: {
        Row: {
          bonus_amount: number;
          branch_id: string;
          campaign_id: string | null;
          commission_amount: number;
          commission_rate: number;
          created_at: string;
          currency: string;
          gross_revenue: number;
          id: string;
          notes: string | null;
          operation_id: string | null;
          period: Database["public"]["Enums"]["commission_period"];
          period_end: string;
          period_start: string;
          plan_id: string;
          status: Database["public"]["Enums"]["commission_transaction_status"];
          target_id: string | null;
          tenant_id: string;
          total_amount: number;
          type: Database["public"]["Enums"]["commission_transaction_type"];
          updated_at: string;
        };
        Insert: {
          bonus_amount?: number;
          branch_id: string;
          campaign_id?: string | null;
          commission_amount?: number;
          commission_rate?: number;
          created_at?: string;
          currency?: string;
          gross_revenue?: number;
          id?: string;
          notes?: string | null;
          operation_id?: string | null;
          period: Database["public"]["Enums"]["commission_period"];
          period_end: string;
          period_start: string;
          plan_id: string;
          status?: Database["public"]["Enums"]["commission_transaction_status"];
          target_id?: string | null;
          tenant_id: string;
          total_amount?: number;
          type?: Database["public"]["Enums"]["commission_transaction_type"];
          updated_at?: string;
        };
        Update: {
          bonus_amount?: number;
          branch_id?: string;
          campaign_id?: string | null;
          commission_amount?: number;
          commission_rate?: number;
          created_at?: string;
          currency?: string;
          gross_revenue?: number;
          id?: string;
          notes?: string | null;
          operation_id?: string | null;
          period?: Database["public"]["Enums"]["commission_period"];
          period_end?: string;
          period_start?: string;
          plan_id?: string;
          status?: Database["public"]["Enums"]["commission_transaction_status"];
          target_id?: string | null;
          tenant_id?: string;
          total_amount?: number;
          type?: Database["public"]["Enums"]["commission_transaction_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_transactions_branch_fk";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_transactions_campaign_fk";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "commission_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_transactions_operation_fk";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_transactions_plan_fk";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "commission_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_transactions_target_fk";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "commission_targets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_transactions_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_acceptances: {
        Row: {
          accepted_at: string;
          commercial_terms_snapshot_id: string;
          contract_version_id: string;
          declared_authority: boolean;
          document_hash: string;
          id: string;
          ip_address: unknown;
          metadata: Json;
          plan_id: string;
          plan_version_id: string;
          product: Database["public"]["Enums"]["subscription_product"];
          representative_document: string | null;
          representative_name: string;
          representative_role: string;
          session_id: string | null;
          tenant_id: string | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          accepted_at?: string;
          commercial_terms_snapshot_id: string;
          contract_version_id: string;
          declared_authority: boolean;
          document_hash: string;
          id?: string;
          ip_address?: unknown;
          metadata?: Json;
          plan_id: string;
          plan_version_id: string;
          product: Database["public"]["Enums"]["subscription_product"];
          representative_document?: string | null;
          representative_name: string;
          representative_role: string;
          session_id?: string | null;
          tenant_id?: string | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          commercial_terms_snapshot_id?: string;
          contract_version_id?: string;
          declared_authority?: boolean;
          document_hash?: string;
          id?: string;
          ip_address?: unknown;
          metadata?: Json;
          plan_id?: string;
          plan_version_id?: string;
          product?: Database["public"]["Enums"]["subscription_product"];
          representative_document?: string | null;
          representative_name?: string;
          representative_role?: string;
          session_id?: string | null;
          tenant_id?: string | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contract_acceptances_commercial_terms_snapshot_id_fkey";
            columns: ["commercial_terms_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "commercial_terms_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_acceptances_contract_version_id_fkey";
            columns: ["contract_version_id"];
            isOneToOne: false;
            referencedRelation: "contract_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_acceptances_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_acceptances_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_acceptances_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_assets: {
        Row: {
          asset_id: string;
          contract_id: string;
          created_at: string;
          id: string;
          notes: string | null;
          quantity: number;
          tenant_id: string;
        };
        Insert: {
          asset_id: string;
          contract_id: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          quantity?: number;
          tenant_id: string;
        };
        Update: {
          asset_id?: string;
          contract_id?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          quantity?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contract_assets_asset_fk";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_assets_contract_fk";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_assets_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_deposits: {
        Row: {
          amount: number;
          contract_id: string;
          created_at: string;
          currency: string;
          held_at: string | null;
          id: string;
          invoice_line_item_id: string | null;
          metadata: Json;
          notes: string | null;
          refunded_amount: number | null;
          refunded_at: string | null;
          status: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          contract_id: string;
          created_at?: string;
          currency?: string;
          held_at?: string | null;
          id?: string;
          invoice_line_item_id?: string | null;
          metadata?: Json;
          notes?: string | null;
          refunded_amount?: number | null;
          refunded_at?: string | null;
          status?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          contract_id?: string;
          created_at?: string;
          currency?: string;
          held_at?: string | null;
          id?: string;
          invoice_line_item_id?: string | null;
          metadata?: Json;
          notes?: string | null;
          refunded_amount?: number | null;
          refunded_at?: string | null;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contract_deposits_contract_fk";
            columns: ["contract_id"];
            isOneToOne: true;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_deposits_invoice_line_item_fk";
            columns: ["invoice_line_item_id"];
            isOneToOne: false;
            referencedRelation: "invoice_line_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_deposits_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_document_requirements: {
        Row: {
          created_at: string;
          id: string;
          is_mandatory: boolean;
          key: string;
          label: string;
          template_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_mandatory?: boolean;
          key: string;
          label: string;
          template_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_mandatory?: boolean;
          key?: string;
          label?: string;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contract_document_requirements_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_documents: {
        Row: {
          contract_id: string | null;
          customer_id: string | null;
          id: string;
          operator_id: string | null;
          original_filename: string;
          party_type: Database["public"]["Enums"]["contract_party_type"];
          requirement_id: string;
          review_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["contract_document_status"];
          storage_path: string;
          tenant_id: string;
          uploaded_at: string;
        };
        Insert: {
          contract_id?: string | null;
          customer_id?: string | null;
          id?: string;
          operator_id?: string | null;
          original_filename: string;
          party_type: Database["public"]["Enums"]["contract_party_type"];
          requirement_id: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["contract_document_status"];
          storage_path: string;
          tenant_id: string;
          uploaded_at?: string;
        };
        Update: {
          contract_id?: string | null;
          customer_id?: string | null;
          id?: string;
          operator_id?: string | null;
          original_filename?: string;
          party_type?: Database["public"]["Enums"]["contract_party_type"];
          requirement_id?: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["contract_document_status"];
          storage_path?: string;
          tenant_id?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_operator_fk";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_requirement_id_fkey";
            columns: ["requirement_id"];
            isOneToOne: false;
            referencedRelation: "contract_document_requirements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_templates: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          name: string;
          product: Database["public"]["Enums"]["subscription_product"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          name: string;
          product: Database["public"]["Enums"]["subscription_product"];
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          name?: string;
          product?: Database["public"]["Enums"]["subscription_product"];
        };
        Relationships: [];
      };
      contract_versions: {
        Row: {
          content: string;
          content_hash: string;
          contract_template_id: string;
          created_at: string;
          effective_at: string;
          id: string;
          material_change: boolean;
          published_at: string | null;
          status: string;
          title: string;
          version: number;
        };
        Insert: {
          content: string;
          content_hash: string;
          contract_template_id: string;
          created_at?: string;
          effective_at?: string;
          id?: string;
          material_change?: boolean;
          published_at?: string | null;
          status?: string;
          title: string;
          version: number;
        };
        Update: {
          content?: string;
          content_hash?: string;
          contract_template_id?: string;
          created_at?: string;
          effective_at?: string;
          id?: string;
          material_change?: boolean;
          published_at?: string | null;
          status?: string;
          title?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "contract_versions_contract_template_id_fkey";
            columns: ["contract_template_id"];
            isOneToOne: false;
            referencedRelation: "contract_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      contracts: {
        Row: {
          billing_requirement: Json;
          created_at: string;
          deleted_at: string | null;
          id: string;
          marketplace_transaction_id: string | null;
          metadata: Json;
          organization_id: string | null;
          period_ends_at: string;
          period_starts_at: string;
          provider_tenant_id: string | null;
          requester_id: string | null;
          snapshot_id: string | null;
          status: Database["public"]["Enums"]["contract_status"];
          template_id: string | null;
          template_version_id: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["contract_type"];
          updated_at: string;
          value_amount: number;
          value_currency: string;
          version: number;
        };
        Insert: {
          billing_requirement?: Json;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          marketplace_transaction_id?: string | null;
          metadata?: Json;
          organization_id?: string | null;
          period_ends_at: string;
          period_starts_at: string;
          provider_tenant_id?: string | null;
          requester_id?: string | null;
          snapshot_id?: string | null;
          status?: Database["public"]["Enums"]["contract_status"];
          template_id?: string | null;
          template_version_id?: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["contract_type"];
          updated_at?: string;
          value_amount: number;
          value_currency: string;
          version?: number;
        };
        Update: {
          billing_requirement?: Json;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          marketplace_transaction_id?: string | null;
          metadata?: Json;
          organization_id?: string | null;
          period_ends_at?: string;
          period_starts_at?: string;
          provider_tenant_id?: string | null;
          requester_id?: string | null;
          snapshot_id?: string | null;
          status?: Database["public"]["Enums"]["contract_status"];
          template_id?: string | null;
          template_version_id?: string | null;
          tenant_id?: string;
          type?: Database["public"]["Enums"]["contract_type"];
          updated_at?: string;
          value_amount?: number;
          value_currency?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_organization_fk";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_template_version_id_fkey";
            columns: ["template_version_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_lead_activities: {
        Row: {
          created_at: string;
          created_by: string;
          description: string;
          from_status: Database["public"]["Enums"]["crm_lead_status"] | null;
          id: string;
          lead_id: string;
          to_status: Database["public"]["Enums"]["crm_lead_status"] | null;
          type: Database["public"]["Enums"]["crm_activity_type"];
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description: string;
          from_status?: Database["public"]["Enums"]["crm_lead_status"] | null;
          id?: string;
          lead_id: string;
          to_status?: Database["public"]["Enums"]["crm_lead_status"] | null;
          type: Database["public"]["Enums"]["crm_activity_type"];
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string;
          from_status?: Database["public"]["Enums"]["crm_lead_status"] | null;
          id?: string;
          lead_id?: string;
          to_status?: Database["public"]["Enums"]["crm_lead_status"] | null;
          type?: Database["public"]["Enums"]["crm_activity_type"];
        };
        Relationships: [
          {
            foreignKeyName: "crm_lead_activities_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "crm_leads";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_leads: {
        Row: {
          assigned_to: string | null;
          company_name: string;
          contact_email: string | null;
          contact_name: string;
          contact_phone: string | null;
          converted_at: string | null;
          converted_by: string | null;
          converted_tenant_id: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          estimated_fleet_size: number | null;
          estimated_mrr_cents: number | null;
          id: string;
          lost_reason: string | null;
          segment: string | null;
          source: Database["public"]["Enums"]["crm_lead_source"];
          status: Database["public"]["Enums"]["crm_lead_status"];
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          company_name: string;
          contact_email?: string | null;
          contact_name: string;
          contact_phone?: string | null;
          converted_at?: string | null;
          converted_by?: string | null;
          converted_tenant_id?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          estimated_fleet_size?: number | null;
          estimated_mrr_cents?: number | null;
          id?: string;
          lost_reason?: string | null;
          segment?: string | null;
          source?: Database["public"]["Enums"]["crm_lead_source"];
          status?: Database["public"]["Enums"]["crm_lead_status"];
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          company_name?: string;
          contact_email?: string | null;
          contact_name?: string;
          contact_phone?: string | null;
          converted_at?: string | null;
          converted_by?: string | null;
          converted_tenant_id?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          estimated_fleet_size?: number | null;
          estimated_mrr_cents?: number | null;
          id?: string;
          lost_reason?: string | null;
          segment?: string | null;
          source?: Database["public"]["Enums"]["crm_lead_source"];
          status?: Database["public"]["Enums"]["crm_lead_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_leads_converted_tenant_id_fkey";
            columns: ["converted_tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      delegated_access_requests: {
        Row: {
          branch_ids: string[] | null;
          created_at: string;
          deleted_at: string | null;
          expires_at: string;
          granted_at: string;
          grantee_id: string;
          grantor_id: string;
          id: string;
          metadata: Json;
          permissions: string[];
          reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          status: string;
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          branch_ids?: string[] | null;
          created_at?: string;
          deleted_at?: string | null;
          expires_at: string;
          granted_at?: string;
          grantee_id: string;
          grantor_id: string;
          id?: string;
          metadata?: Json;
          permissions: string[];
          reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: string;
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          branch_ids?: string[] | null;
          created_at?: string;
          deleted_at?: string | null;
          expires_at?: string;
          granted_at?: string;
          grantee_id?: string;
          grantor_id?: string;
          id?: string;
          metadata?: Json;
          permissions?: string[];
          reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "delegated_access_grantee_fk";
            columns: ["grantee_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delegated_access_grantor_fk";
            columns: ["grantor_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delegated_access_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      external_identities: {
        Row: {
          created_at: string;
          id: string;
          last_authenticated_at: string | null;
          metadata: Json;
          provider: string;
          provider_subject: string;
          shina_user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_authenticated_at?: string | null;
          metadata?: Json;
          provider: string;
          provider_subject: string;
          shina_user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_authenticated_at?: string | null;
          metadata?: Json;
          provider?: string;
          provider_subject?: string;
          shina_user_id?: string;
        };
        Relationships: [];
      };
      fleet_integrations: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          is_active: boolean;
          last_received_at: string | null;
          provider_name: string | null;
          tenant_id: string;
          updated_at: string;
          version: number;
          webhook_secret: string;
          webhook_token: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          last_received_at?: string | null;
          provider_name?: string | null;
          tenant_id: string;
          updated_at?: string;
          version?: number;
          webhook_secret?: string;
          webhook_token: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          last_received_at?: string | null;
          provider_name?: string | null;
          tenant_id?: string;
          updated_at?: string;
          version?: number;
          webhook_secret?: string;
          webhook_token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fleet_integrations_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      geofences: {
        Row: {
          center_lat: number | null;
          center_lng: number | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          polygon_coordinates: Json | null;
          radius_meters: number | null;
          resource_ids: string[];
          shape: Database["public"]["Enums"]["geofence_shape"];
          status: Database["public"]["Enums"]["geofence_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          polygon_coordinates?: Json | null;
          radius_meters?: number | null;
          resource_ids?: string[];
          shape: Database["public"]["Enums"]["geofence_shape"];
          status?: Database["public"]["Enums"]["geofence_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          polygon_coordinates?: Json | null;
          radius_meters?: number | null;
          resource_ids?: string[];
          shape?: Database["public"]["Enums"]["geofence_shape"];
          status?: Database["public"]["Enums"]["geofence_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "geofences_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      impersonation_sessions: {
        Row: {
          access_mode: string;
          created_at: string;
          deleted_at: string | null;
          ended_at: string | null;
          id: string;
          max_duration_minutes: number | null;
          metadata: Json;
          platform_actor_id: string;
          reason: string;
          secondary_auth_by: string | null;
          started_at: string;
          status: string;
          target_tenant_id: string;
          target_user_id: string;
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          access_mode: string;
          created_at?: string;
          deleted_at?: string | null;
          ended_at?: string | null;
          id?: string;
          max_duration_minutes?: number | null;
          metadata?: Json;
          platform_actor_id: string;
          reason: string;
          secondary_auth_by?: string | null;
          started_at?: string;
          status?: string;
          target_tenant_id: string;
          target_user_id: string;
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          access_mode?: string;
          created_at?: string;
          deleted_at?: string | null;
          ended_at?: string | null;
          id?: string;
          max_duration_minutes?: number | null;
          metadata?: Json;
          platform_actor_id?: string;
          reason?: string;
          secondary_auth_by?: string | null;
          started_at?: string;
          status?: string;
          target_tenant_id?: string;
          target_user_id?: string;
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "impersonation_target_user_fk";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "impersonation_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infraction_cases: {
        Row: {
          allocation_id: string | null;
          asset_id: string | null;
          closed_at: string | null;
          contract_id: string | null;
          created_at: string;
          customer_id: string | null;
          id: string;
          infraction_id: string;
          match_confidence: Database["public"]["Enums"]["infraction_match_confidence"] | null;
          operation_id: string | null;
          operator_id: string | null;
          responsibility_confidence: number | null;
          responsibility_confirmed_at: string | null;
          responsibility_confirmed_by: string | null;
          responsibility_reasons: Json;
          responsibility_rejected_at: string | null;
          responsibility_rejected_by: string | null;
          responsible_party_id: string | null;
          responsible_party_type:
            | Database["public"]["Enums"]["infraction_responsible_party_type"]
            | null;
          status: Database["public"]["Enums"]["infraction_case_status"];
          tenant_id: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          allocation_id?: string | null;
          asset_id?: string | null;
          closed_at?: string | null;
          contract_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          infraction_id: string;
          match_confidence?: Database["public"]["Enums"]["infraction_match_confidence"] | null;
          operation_id?: string | null;
          operator_id?: string | null;
          responsibility_confidence?: number | null;
          responsibility_confirmed_at?: string | null;
          responsibility_confirmed_by?: string | null;
          responsibility_reasons?: Json;
          responsibility_rejected_at?: string | null;
          responsibility_rejected_by?: string | null;
          responsible_party_id?: string | null;
          responsible_party_type?:
            | Database["public"]["Enums"]["infraction_responsible_party_type"]
            | null;
          status?: Database["public"]["Enums"]["infraction_case_status"];
          tenant_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          allocation_id?: string | null;
          asset_id?: string | null;
          closed_at?: string | null;
          contract_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          id?: string;
          infraction_id?: string;
          match_confidence?: Database["public"]["Enums"]["infraction_match_confidence"] | null;
          operation_id?: string | null;
          operator_id?: string | null;
          responsibility_confidence?: number | null;
          responsibility_confirmed_at?: string | null;
          responsibility_confirmed_by?: string | null;
          responsibility_reasons?: Json;
          responsibility_rejected_at?: string | null;
          responsibility_rejected_by?: string | null;
          responsible_party_id?: string | null;
          responsible_party_type?:
            | Database["public"]["Enums"]["infraction_responsible_party_type"]
            | null;
          status?: Database["public"]["Enums"]["infraction_case_status"];
          tenant_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "infraction_cases_allocation_id_fkey";
            columns: ["allocation_id"];
            isOneToOne: false;
            referencedRelation: "allocations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_cases_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_cases_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_cases_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_cases_infraction_id_fkey";
            columns: ["infraction_id"];
            isOneToOne: false;
            referencedRelation: "infractions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_cases_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_cases_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_cases_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infraction_deadlines: {
        Row: {
          alerted_thresholds: Json;
          base_date: string | null;
          case_id: string;
          completed_at: string | null;
          created_at: string;
          deadline_type: Database["public"]["Enums"]["infraction_deadline_type"];
          due_at: string;
          id: string;
          notes: string | null;
          rule_version: string | null;
          source: string;
          starts_at: string | null;
          status: Database["public"]["Enums"]["infraction_deadline_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          alerted_thresholds?: Json;
          base_date?: string | null;
          case_id: string;
          completed_at?: string | null;
          created_at?: string;
          deadline_type: Database["public"]["Enums"]["infraction_deadline_type"];
          due_at: string;
          id?: string;
          notes?: string | null;
          rule_version?: string | null;
          source?: string;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["infraction_deadline_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          alerted_thresholds?: Json;
          base_date?: string | null;
          case_id?: string;
          completed_at?: string | null;
          created_at?: string;
          deadline_type?: Database["public"]["Enums"]["infraction_deadline_type"];
          due_at?: string;
          id?: string;
          notes?: string | null;
          rule_version?: string | null;
          source?: string;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["infraction_deadline_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "infraction_deadlines_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "infraction_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_deadlines_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infraction_defenses: {
        Row: {
          case_id: string;
          created_at: string;
          created_by: string | null;
          external_protocol: string | null;
          id: string;
          kind: Database["public"]["Enums"]["infraction_defense_kind"];
          notes: string | null;
          result: string | null;
          status: Database["public"]["Enums"]["infraction_defense_status"];
          submitted_at: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          created_by?: string | null;
          external_protocol?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["infraction_defense_kind"];
          notes?: string | null;
          result?: string | null;
          status?: Database["public"]["Enums"]["infraction_defense_status"];
          submitted_at?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          created_by?: string | null;
          external_protocol?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["infraction_defense_kind"];
          notes?: string | null;
          result?: string | null;
          status?: Database["public"]["Enums"]["infraction_defense_status"];
          submitted_at?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "infraction_defenses_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "infraction_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_defenses_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infraction_disputes: {
        Row: {
          case_id: string;
          created_at: string;
          decision: string | null;
          description: string;
          id: string;
          party_id: string | null;
          party_type: Database["public"]["Enums"]["infraction_responsible_party_type"];
          reason: string | null;
          resolution: string | null;
          resolved_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["infraction_dispute_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          decision?: string | null;
          description: string;
          id?: string;
          party_id?: string | null;
          party_type: Database["public"]["Enums"]["infraction_responsible_party_type"];
          reason?: string | null;
          resolution?: string | null;
          resolved_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["infraction_dispute_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          decision?: string | null;
          description?: string;
          id?: string;
          party_id?: string | null;
          party_type?: Database["public"]["Enums"]["infraction_responsible_party_type"];
          reason?: string | null;
          resolution?: string | null;
          resolved_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["infraction_dispute_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "infraction_disputes_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "infraction_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_disputes_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infraction_documents: {
        Row: {
          case_id: string;
          checksum_sha256: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["infraction_document_kind"];
          mime_type: string | null;
          original_filename: string | null;
          size_bytes: number | null;
          storage_path: string;
          tenant_id: string;
          uploaded_by: string | null;
        };
        Insert: {
          case_id: string;
          checksum_sha256?: string | null;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["infraction_document_kind"];
          mime_type?: string | null;
          original_filename?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          tenant_id: string;
          uploaded_by?: string | null;
        };
        Update: {
          case_id?: string;
          checksum_sha256?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["infraction_document_kind"];
          mime_type?: string | null;
          original_filename?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          tenant_id?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "infraction_documents_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "infraction_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infraction_driver_identifications: {
        Row: {
          case_id: string;
          created_at: string;
          driver_document: string | null;
          driver_name: string | null;
          external_protocol: string | null;
          id: string;
          notes: string | null;
          operator_id: string | null;
          status: Database["public"]["Enums"]["infraction_driver_identification_status"];
          submitted_at: string | null;
          submitted_by: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          driver_document?: string | null;
          driver_name?: string | null;
          external_protocol?: string | null;
          id?: string;
          notes?: string | null;
          operator_id?: string | null;
          status?: Database["public"]["Enums"]["infraction_driver_identification_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          driver_document?: string | null;
          driver_name?: string | null;
          external_protocol?: string | null;
          id?: string;
          notes?: string | null;
          operator_id?: string | null;
          status?: Database["public"]["Enums"]["infraction_driver_identification_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "infraction_driver_identifications_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "infraction_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_driver_identifications_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_driver_identifications_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infraction_evidence: {
        Row: {
          case_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          metadata: Json;
          reference: string | null;
          source: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["infraction_evidence_type"];
        };
        Insert: {
          case_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          metadata?: Json;
          reference?: string | null;
          source?: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["infraction_evidence_type"];
        };
        Update: {
          case_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          metadata?: Json;
          reference?: string | null;
          source?: string | null;
          tenant_id?: string;
          type?: Database["public"]["Enums"]["infraction_evidence_type"];
        };
        Relationships: [
          {
            foreignKeyName: "infraction_evidence_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "infraction_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_evidence_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infraction_payments: {
        Row: {
          amount_discounted_cents: number | null;
          amount_original_cents: number | null;
          amount_paid_cents: number | null;
          billing_reference: string | null;
          case_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          kind: Database["public"]["Enums"]["infraction_payment_kind"];
          notes: string | null;
          paid_at: string | null;
          payment_method: string | null;
          tenant_id: string;
        };
        Insert: {
          amount_discounted_cents?: number | null;
          amount_original_cents?: number | null;
          amount_paid_cents?: number | null;
          billing_reference?: string | null;
          case_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          kind: Database["public"]["Enums"]["infraction_payment_kind"];
          notes?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          tenant_id: string;
        };
        Update: {
          amount_discounted_cents?: number | null;
          amount_original_cents?: number | null;
          amount_paid_cents?: number | null;
          billing_reference?: string | null;
          case_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["infraction_payment_kind"];
          notes?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "infraction_payments_billing_reference_fkey";
            columns: ["billing_reference"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_payments_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "infraction_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "infraction_payments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infraction_provider_sync_runs: {
        Row: {
          created_count: number;
          duplicated_count: number;
          error_log: Json;
          failed_count: number;
          finished_at: string | null;
          id: string;
          provider: Database["public"]["Enums"]["infraction_source"];
          received_count: number;
          started_at: string;
          status: Database["public"]["Enums"]["infraction_sync_status"];
          tenant_id: string | null;
          triggered_by: string | null;
          updated_count: number;
        };
        Insert: {
          created_count?: number;
          duplicated_count?: number;
          error_log?: Json;
          failed_count?: number;
          finished_at?: string | null;
          id?: string;
          provider: Database["public"]["Enums"]["infraction_source"];
          received_count?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["infraction_sync_status"];
          tenant_id?: string | null;
          triggered_by?: string | null;
          updated_count?: number;
        };
        Update: {
          created_count?: number;
          duplicated_count?: number;
          error_log?: Json;
          failed_count?: number;
          finished_at?: string | null;
          id?: string;
          provider?: Database["public"]["Enums"]["infraction_source"];
          received_count?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["infraction_sync_status"];
          tenant_id?: string | null;
          triggered_by?: string | null;
          updated_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "infraction_provider_sync_runs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      infractions: {
        Row: {
          amount_cents: number | null;
          amount_currency: string;
          authority_code: string | null;
          authority_name: string | null;
          auto_number: string | null;
          created_at: string;
          created_by: string | null;
          defense_deadline: string | null;
          description: string | null;
          discount_deadline: string | null;
          driver_identification_deadline: string | null;
          due_date: string | null;
          external_id: string | null;
          external_status: string | null;
          id: string;
          infraction_code: string | null;
          location: string | null;
          municipality: string | null;
          occurred_at: string;
          payment_deadline: string | null;
          plate: string;
          raw_payload: Json;
          renavam: string | null;
          source: Database["public"]["Enums"]["infraction_source"];
          state: string | null;
          tenant_id: string | null;
        };
        Insert: {
          amount_cents?: number | null;
          amount_currency?: string;
          authority_code?: string | null;
          authority_name?: string | null;
          auto_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          defense_deadline?: string | null;
          description?: string | null;
          discount_deadline?: string | null;
          driver_identification_deadline?: string | null;
          due_date?: string | null;
          external_id?: string | null;
          external_status?: string | null;
          id?: string;
          infraction_code?: string | null;
          location?: string | null;
          municipality?: string | null;
          occurred_at: string;
          payment_deadline?: string | null;
          plate: string;
          raw_payload?: Json;
          renavam?: string | null;
          source: Database["public"]["Enums"]["infraction_source"];
          state?: string | null;
          tenant_id?: string | null;
        };
        Update: {
          amount_cents?: number | null;
          amount_currency?: string;
          authority_code?: string | null;
          authority_name?: string | null;
          auto_number?: string | null;
          created_at?: string;
          created_by?: string | null;
          defense_deadline?: string | null;
          description?: string | null;
          discount_deadline?: string | null;
          driver_identification_deadline?: string | null;
          due_date?: string | null;
          external_id?: string | null;
          external_status?: string | null;
          id?: string;
          infraction_code?: string | null;
          location?: string | null;
          municipality?: string | null;
          occurred_at?: string;
          payment_deadline?: string | null;
          plate?: string;
          raw_payload?: Json;
          renavam?: string | null;
          source?: Database["public"]["Enums"]["infraction_source"];
          state?: string | null;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "infractions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_comparisons: {
        Row: {
          after_inspection_id: string;
          after_value: Json | null;
          ai_analysis: Json | null;
          before_inspection_id: string;
          before_value: Json | null;
          created_at: string;
          differs: boolean;
          id: string;
          item_id: string;
          tenant_id: string;
        };
        Insert: {
          after_inspection_id: string;
          after_value?: Json | null;
          ai_analysis?: Json | null;
          before_inspection_id: string;
          before_value?: Json | null;
          created_at?: string;
          differs?: boolean;
          id?: string;
          item_id: string;
          tenant_id: string;
        };
        Update: {
          after_inspection_id?: string;
          after_value?: Json | null;
          ai_analysis?: Json | null;
          before_inspection_id?: string;
          before_value?: Json | null;
          created_at?: string;
          differs?: boolean;
          id?: string;
          item_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_comparisons_after_inspection_id_fkey";
            columns: ["after_inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_comparisons_before_inspection_id_fkey";
            columns: ["before_inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_comparisons_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inspection_template_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_comparisons_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_disputes: {
        Row: {
          created_at: string;
          customer_id: string;
          description: string;
          id: string;
          inspection_id: string;
          item_id: string | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["inspection_dispute_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          description: string;
          id?: string;
          inspection_id: string;
          item_id?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["inspection_dispute_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          description?: string;
          id?: string;
          inspection_id?: string;
          item_id?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["inspection_dispute_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_disputes_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_disputes_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_disputes_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inspection_template_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_disputes_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_findings: {
        Row: {
          ai_confidence: number | null;
          ai_suggested: boolean;
          approved_cost_amount: number | null;
          approved_cost_currency: string | null;
          asset_id: string;
          category: string | null;
          created_at: string;
          decision_notes: string | null;
          description: string;
          estimated_cost_amount: number | null;
          estimated_cost_currency: string | null;
          id: string;
          inspection_id: string;
          item_id: string | null;
          location_on_asset: string | null;
          maintenance_order_id: string | null;
          overlay_region: Json | null;
          preexisting_finding_id: string | null;
          responsible_user_id: string | null;
          severity: Database["public"]["Enums"]["inspection_finding_severity"];
          status: Database["public"]["Enums"]["inspection_finding_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          ai_confidence?: number | null;
          ai_suggested?: boolean;
          approved_cost_amount?: number | null;
          approved_cost_currency?: string | null;
          asset_id: string;
          category?: string | null;
          created_at?: string;
          decision_notes?: string | null;
          description: string;
          estimated_cost_amount?: number | null;
          estimated_cost_currency?: string | null;
          id?: string;
          inspection_id: string;
          item_id?: string | null;
          location_on_asset?: string | null;
          maintenance_order_id?: string | null;
          overlay_region?: Json | null;
          preexisting_finding_id?: string | null;
          responsible_user_id?: string | null;
          severity?: Database["public"]["Enums"]["inspection_finding_severity"];
          status?: Database["public"]["Enums"]["inspection_finding_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          ai_confidence?: number | null;
          ai_suggested?: boolean;
          approved_cost_amount?: number | null;
          approved_cost_currency?: string | null;
          asset_id?: string;
          category?: string | null;
          created_at?: string;
          decision_notes?: string | null;
          description?: string;
          estimated_cost_amount?: number | null;
          estimated_cost_currency?: string | null;
          id?: string;
          inspection_id?: string;
          item_id?: string | null;
          location_on_asset?: string | null;
          maintenance_order_id?: string | null;
          overlay_region?: Json | null;
          preexisting_finding_id?: string | null;
          responsible_user_id?: string | null;
          severity?: Database["public"]["Enums"]["inspection_finding_severity"];
          status?: Database["public"]["Enums"]["inspection_finding_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_findings_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_findings_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_findings_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inspection_template_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_findings_maintenance_order_id_fkey";
            columns: ["maintenance_order_id"];
            isOneToOne: false;
            referencedRelation: "maintenance_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_findings_preexisting_finding_id_fkey";
            columns: ["preexisting_finding_id"];
            isOneToOne: false;
            referencedRelation: "inspection_findings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_findings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_media: {
        Row: {
          capture_source: string;
          captured_at: string;
          captured_by: string;
          checksum_sha256: string;
          created_at: string;
          finding_id: string | null;
          id: string;
          inspection_id: string;
          item_id: string | null;
          latitude: number | null;
          longitude: number | null;
          media_type: Database["public"]["Enums"]["inspection_media_type"];
          mime_type: string;
          original_filename: string;
          size_bytes: number;
          sort_order: number;
          storage_path: string;
          tenant_id: string;
        };
        Insert: {
          capture_source?: string;
          captured_at?: string;
          captured_by: string;
          checksum_sha256: string;
          created_at?: string;
          finding_id?: string | null;
          id?: string;
          inspection_id: string;
          item_id?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          media_type: Database["public"]["Enums"]["inspection_media_type"];
          mime_type: string;
          original_filename: string;
          size_bytes: number;
          sort_order?: number;
          storage_path: string;
          tenant_id: string;
        };
        Update: {
          capture_source?: string;
          captured_at?: string;
          captured_by?: string;
          checksum_sha256?: string;
          created_at?: string;
          finding_id?: string | null;
          id?: string;
          inspection_id?: string;
          item_id?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          media_type?: Database["public"]["Enums"]["inspection_media_type"];
          mime_type?: string;
          original_filename?: string;
          size_bytes?: number;
          sort_order?: number;
          storage_path?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_media_finding_id_fkey";
            columns: ["finding_id"];
            isOneToOne: false;
            referencedRelation: "inspection_findings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_media_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_media_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inspection_template_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_media_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_report_shares: {
        Row: {
          access_count: number;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          inspection_id: string;
          last_accessed_at: string | null;
          report_id: string;
          revoked_at: string | null;
          tenant_id: string;
          token_hash: string;
        };
        Insert: {
          access_count?: number;
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          inspection_id: string;
          last_accessed_at?: string | null;
          report_id: string;
          revoked_at?: string | null;
          tenant_id: string;
          token_hash: string;
        };
        Update: {
          access_count?: number;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          inspection_id?: string;
          last_accessed_at?: string | null;
          report_id?: string;
          revoked_at?: string | null;
          tenant_id?: string;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_report_shares_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_report_shares_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "inspection_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_report_shares_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_reports: {
        Row: {
          content_hash: string;
          generated_at: string;
          generated_by: string;
          id: string;
          inspection_id: string;
          rendered_content: Json;
          tenant_id: string;
          verification_token: string;
          version: number;
        };
        Insert: {
          content_hash: string;
          generated_at?: string;
          generated_by: string;
          id?: string;
          inspection_id: string;
          rendered_content: Json;
          tenant_id: string;
          verification_token?: string;
          version?: number;
        };
        Update: {
          content_hash?: string;
          generated_at?: string;
          generated_by?: string;
          id?: string;
          inspection_id?: string;
          rendered_content?: Json;
          tenant_id?: string;
          verification_token?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_reports_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_reports_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_responses: {
        Row: {
          created_at: string;
          id: string;
          inspection_id: string;
          item_id: string;
          notes: string | null;
          tenant_id: string;
          updated_at: string;
          value_boolean: boolean | null;
          value_json: Json | null;
          value_number: number | null;
          value_text: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          inspection_id: string;
          item_id: string;
          notes?: string | null;
          tenant_id: string;
          updated_at?: string;
          value_boolean?: boolean | null;
          value_json?: Json | null;
          value_number?: number | null;
          value_text?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          inspection_id?: string;
          item_id?: string;
          notes?: string | null;
          tenant_id?: string;
          updated_at?: string;
          value_boolean?: boolean | null;
          value_json?: Json | null;
          value_number?: number | null;
          value_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_responses_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_responses_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inspection_template_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_responses_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_signatures: {
        Row: {
          acceptance_method: Database["public"]["Enums"]["contract_acceptance_method"];
          customer_id: string | null;
          document_hash: string;
          id: string;
          inspection_id: string;
          ip_address: unknown;
          metadata: Json;
          operator_id: string | null;
          report_id: string | null;
          session_id: string | null;
          signed_at: string;
          signer_type: Database["public"]["Enums"]["inspection_signer_type"];
          tenant_id: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          acceptance_method: Database["public"]["Enums"]["contract_acceptance_method"];
          customer_id?: string | null;
          document_hash: string;
          id?: string;
          inspection_id: string;
          ip_address?: unknown;
          metadata?: Json;
          operator_id?: string | null;
          report_id?: string | null;
          session_id?: string | null;
          signed_at?: string;
          signer_type: Database["public"]["Enums"]["inspection_signer_type"];
          tenant_id: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          acceptance_method?: Database["public"]["Enums"]["contract_acceptance_method"];
          customer_id?: string | null;
          document_hash?: string;
          id?: string;
          inspection_id?: string;
          ip_address?: unknown;
          metadata?: Json;
          operator_id?: string | null;
          report_id?: string | null;
          session_id?: string | null;
          signed_at?: string;
          signer_type?: Database["public"]["Enums"]["inspection_signer_type"];
          tenant_id?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_signatures_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_signatures_inspection_id_fkey";
            columns: ["inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_signatures_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_signatures_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "inspection_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_signatures_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_template_items: {
        Row: {
          approval_gate: boolean;
          condition: Json | null;
          created_at: string;
          field_type: Database["public"]["Enums"]["inspection_field_type"];
          id: string;
          instructions: string | null;
          key: string;
          label: string;
          max_photos: number | null;
          min_photos: number | null;
          reference_image_url: string | null;
          required: boolean;
          section_id: string;
          select_options: Json | null;
          sort_order: number;
          template_id: string;
          tenant_id: string | null;
        };
        Insert: {
          approval_gate?: boolean;
          condition?: Json | null;
          created_at?: string;
          field_type: Database["public"]["Enums"]["inspection_field_type"];
          id?: string;
          instructions?: string | null;
          key: string;
          label: string;
          max_photos?: number | null;
          min_photos?: number | null;
          reference_image_url?: string | null;
          required?: boolean;
          section_id: string;
          select_options?: Json | null;
          sort_order?: number;
          template_id: string;
          tenant_id?: string | null;
        };
        Update: {
          approval_gate?: boolean;
          condition?: Json | null;
          created_at?: string;
          field_type?: Database["public"]["Enums"]["inspection_field_type"];
          id?: string;
          instructions?: string | null;
          key?: string;
          label?: string;
          max_photos?: number | null;
          min_photos?: number | null;
          reference_image_url?: string | null;
          required?: boolean;
          section_id?: string;
          select_options?: Json | null;
          sort_order?: number;
          template_id?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_template_items_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "inspection_template_sections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_template_items_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "inspection_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_template_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_template_sections: {
        Row: {
          created_at: string;
          id: string;
          instructions: string | null;
          key: string;
          sort_order: number;
          template_id: string;
          tenant_id: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          instructions?: string | null;
          key: string;
          sort_order?: number;
          template_id: string;
          tenant_id?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          instructions?: string | null;
          key?: string;
          sort_order?: number;
          template_id?: string;
          tenant_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_template_sections_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "inspection_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_template_sections_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_templates: {
        Row: {
          asset_type_id: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          key: string;
          metadata: Json;
          name: string;
          status: Database["public"]["Enums"]["inspection_template_status"];
          tenant_id: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          asset_type_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          key: string;
          metadata?: Json;
          name: string;
          status?: Database["public"]["Enums"]["inspection_template_status"];
          tenant_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          asset_type_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          key?: string;
          metadata?: Json;
          name?: string;
          status?: Database["public"]["Enums"]["inspection_template_status"];
          tenant_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_templates_asset_type_id_fkey";
            columns: ["asset_type_id"];
            isOneToOne: false;
            referencedRelation: "asset_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_templates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      inspections: {
        Row: {
          asset_id: string;
          asset_type_id: string | null;
          branch_id: string | null;
          completed_at: string | null;
          contract_id: string | null;
          created_at: string;
          customer_id: string | null;
          deleted_at: string | null;
          id: string;
          linked_inspection_id: string | null;
          metadata: Json;
          operation_id: string | null;
          operator_id: string | null;
          responsible_user_id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["inspection_status"];
          template_id: string;
          tenant_id: string;
          type: Database["public"]["Enums"]["inspection_type"];
          updated_at: string;
          version: number;
        };
        Insert: {
          asset_id: string;
          asset_type_id?: string | null;
          branch_id?: string | null;
          completed_at?: string | null;
          contract_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          linked_inspection_id?: string | null;
          metadata?: Json;
          operation_id?: string | null;
          operator_id?: string | null;
          responsible_user_id: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["inspection_status"];
          template_id: string;
          tenant_id: string;
          type: Database["public"]["Enums"]["inspection_type"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          asset_id?: string;
          asset_type_id?: string | null;
          branch_id?: string | null;
          completed_at?: string | null;
          contract_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          linked_inspection_id?: string | null;
          metadata?: Json;
          operation_id?: string | null;
          operator_id?: string | null;
          responsible_user_id?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["inspection_status"];
          template_id?: string;
          tenant_id?: string;
          type?: Database["public"]["Enums"]["inspection_type"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inspections_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_asset_type_id_fkey";
            columns: ["asset_type_id"];
            isOneToOne: false;
            referencedRelation: "asset_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_linked_inspection_id_fkey";
            columns: ["linked_inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "inspection_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_line_items: {
        Row: {
          description: string;
          id: string;
          infraction_case_id: string | null;
          inspection_finding_id: string | null;
          invoice_id: string;
          quantity: number;
          sort_order: number;
          tenant_id: string;
          unit_price_amount: number;
          unit_price_currency: string;
        };
        Insert: {
          description: string;
          id: string;
          infraction_case_id?: string | null;
          inspection_finding_id?: string | null;
          invoice_id: string;
          quantity: number;
          sort_order?: number;
          tenant_id: string;
          unit_price_amount: number;
          unit_price_currency: string;
        };
        Update: {
          description?: string;
          id?: string;
          infraction_case_id?: string | null;
          inspection_finding_id?: string | null;
          invoice_id?: string;
          quantity?: number;
          sort_order?: number;
          tenant_id?: string;
          unit_price_amount?: number;
          unit_price_currency?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_infraction_case_id_fkey";
            columns: ["infraction_case_id"];
            isOneToOne: false;
            referencedRelation: "infraction_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_line_items_inspection_finding_id_fkey";
            columns: ["inspection_finding_id"];
            isOneToOne: false;
            referencedRelation: "inspection_findings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_line_items_invoice_fk";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_line_items_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          billing_account_id: string;
          contract_id: string | null;
          created_at: string;
          deleted_at: string | null;
          due_date: string;
          gateway_checkout_id: string | null;
          gateway_payment_intent_id: string | null;
          id: string;
          metadata: Json;
          paid_at: string | null;
          previous_status: Database["public"]["Enums"]["invoice_status"] | null;
          status: Database["public"]["Enums"]["invoice_status"];
          tenant_id: string;
          total_amount: number;
          total_currency: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          billing_account_id: string;
          contract_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          due_date: string;
          gateway_checkout_id?: string | null;
          gateway_payment_intent_id?: string | null;
          id: string;
          metadata?: Json;
          paid_at?: string | null;
          previous_status?: Database["public"]["Enums"]["invoice_status"] | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          tenant_id: string;
          total_amount: number;
          total_currency: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          billing_account_id?: string;
          contract_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          due_date?: string;
          gateway_checkout_id?: string | null;
          gateway_payment_intent_id?: string | null;
          id?: string;
          metadata?: Json;
          paid_at?: string | null;
          previous_status?: Database["public"]["Enums"]["invoice_status"] | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          tenant_id?: string;
          total_amount?: number;
          total_currency?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_billing_account_fk";
            columns: ["billing_account_id"];
            isOneToOne: false;
            referencedRelation: "billing_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      landing_events: {
        Row: {
          created_at: string;
          event: string;
          id: string;
          label: string | null;
          locale: string | null;
          section: string | null;
          value: number | null;
        };
        Insert: {
          created_at?: string;
          event: string;
          id?: string;
          label?: string | null;
          locale?: string | null;
          section?: string | null;
          value?: number | null;
        };
        Update: {
          created_at?: string;
          event?: string;
          id?: string;
          label?: string | null;
          locale?: string | null;
          section?: string | null;
          value?: number | null;
        };
        Relationships: [];
      };
      landing_leads: {
        Row: {
          created_at: string;
          email: string;
          fleet_size: string | null;
          id: string;
          locale: string;
          name: string;
          phone: string | null;
          plan: string | null;
          profile: string | null;
          source: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          fleet_size?: string | null;
          id?: string;
          locale?: string;
          name: string;
          phone?: string | null;
          plan?: string | null;
          profile?: string | null;
          source?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          fleet_size?: string | null;
          id?: string;
          locale?: string;
          name?: string;
          phone?: string | null;
          plan?: string | null;
          profile?: string | null;
          source?: string | null;
        };
        Relationships: [];
      };
      maintenance_documents: {
        Row: {
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          extracted_at: string | null;
          extraction_confidence: number | null;
          extraction_draft: Json | null;
          extraction_error: string | null;
          extraction_model: string | null;
          extraction_status: string;
          id: string;
          kind: Database["public"]["Enums"]["maintenance_document_kind"];
          maintenance_order_id: string;
          mime_type: string | null;
          original_filename: string | null;
          storage_path: string;
          tenant_id: string;
          uploaded_by: string;
        };
        Insert: {
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          extracted_at?: string | null;
          extraction_confidence?: number | null;
          extraction_draft?: Json | null;
          extraction_error?: string | null;
          extraction_model?: string | null;
          extraction_status?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["maintenance_document_kind"];
          maintenance_order_id: string;
          mime_type?: string | null;
          original_filename?: string | null;
          storage_path: string;
          tenant_id: string;
          uploaded_by: string;
        };
        Update: {
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          extracted_at?: string | null;
          extraction_confidence?: number | null;
          extraction_draft?: Json | null;
          extraction_error?: string | null;
          extraction_model?: string | null;
          extraction_status?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["maintenance_document_kind"];
          maintenance_order_id?: string;
          mime_type?: string | null;
          original_filename?: string | null;
          storage_path?: string;
          tenant_id?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_documents_maintenance_order_id_fkey";
            columns: ["maintenance_order_id"];
            isOneToOne: false;
            referencedRelation: "maintenance_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_documents_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_insights: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          asset_id: string | null;
          created_at: string;
          id: string;
          insight_key: string;
          message: string;
          severity: Database["public"]["Enums"]["maintenance_insight_severity"];
          status: Database["public"]["Enums"]["maintenance_insight_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["maintenance_insight_type"];
          updated_at: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          asset_id?: string | null;
          created_at?: string;
          id?: string;
          insight_key: string;
          message: string;
          severity: Database["public"]["Enums"]["maintenance_insight_severity"];
          status?: Database["public"]["Enums"]["maintenance_insight_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["maintenance_insight_type"];
          updated_at?: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          asset_id?: string | null;
          created_at?: string;
          id?: string;
          insight_key?: string;
          message?: string;
          severity?: Database["public"]["Enums"]["maintenance_insight_severity"];
          status?: Database["public"]["Enums"]["maintenance_insight_status"];
          tenant_id?: string;
          type?: Database["public"]["Enums"]["maintenance_insight_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_insights_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_insights_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_items: {
        Row: {
          component: string;
          created_at: string;
          description: string;
          id: string;
          labor_cost_cents: number | null;
          maintenance_order_id: string;
          part_number: string | null;
          quantity: number | null;
          service_type: string;
          tenant_id: string;
          unit_cost_cents: number | null;
          warranty_hours: number | null;
          warranty_km: number | null;
          warranty_until: string | null;
        };
        Insert: {
          component: string;
          created_at?: string;
          description: string;
          id?: string;
          labor_cost_cents?: number | null;
          maintenance_order_id: string;
          part_number?: string | null;
          quantity?: number | null;
          service_type: string;
          tenant_id: string;
          unit_cost_cents?: number | null;
          warranty_hours?: number | null;
          warranty_km?: number | null;
          warranty_until?: string | null;
        };
        Update: {
          component?: string;
          created_at?: string;
          description?: string;
          id?: string;
          labor_cost_cents?: number | null;
          maintenance_order_id?: string;
          part_number?: string | null;
          quantity?: number | null;
          service_type?: string;
          tenant_id?: string;
          unit_cost_cents?: number | null;
          warranty_hours?: number | null;
          warranty_km?: number | null;
          warranty_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_items_maintenance_order_id_fkey";
            columns: ["maintenance_order_id"];
            isOneToOne: false;
            referencedRelation: "maintenance_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_orders: {
        Row: {
          approved_by: string | null;
          asset_id: string;
          branch_id: string | null;
          cause: string | null;
          completed_at: string | null;
          completed_by: string | null;
          contract_id: string | null;
          created_at: string;
          created_by: string;
          customer_id: string | null;
          deleted_at: string | null;
          description: string;
          diagnosis: string | null;
          downtime_end: string | null;
          downtime_start: string | null;
          hour_meter: number | null;
          id: string;
          labor_cost_cents: number;
          odometer: number | null;
          opened_at: string;
          operator_id: string | null;
          other_cost_cents: number;
          parts_cost_cents: number;
          resolution: string | null;
          scheduled_at: string | null;
          source_id: string | null;
          source_type: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["maintenance_order_status"];
          supplier_id: string | null;
          tenant_id: string;
          total_cost_cents: number | null;
          type: Database["public"]["Enums"]["maintenance_order_type"];
          updated_at: string;
        };
        Insert: {
          approved_by?: string | null;
          asset_id: string;
          branch_id?: string | null;
          cause?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          contract_id?: string | null;
          created_at?: string;
          created_by: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          description: string;
          diagnosis?: string | null;
          downtime_end?: string | null;
          downtime_start?: string | null;
          hour_meter?: number | null;
          id?: string;
          labor_cost_cents?: number;
          odometer?: number | null;
          opened_at?: string;
          operator_id?: string | null;
          other_cost_cents?: number;
          parts_cost_cents?: number;
          resolution?: string | null;
          scheduled_at?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["maintenance_order_status"];
          supplier_id?: string | null;
          tenant_id: string;
          total_cost_cents?: number | null;
          type: Database["public"]["Enums"]["maintenance_order_type"];
          updated_at?: string;
        };
        Update: {
          approved_by?: string | null;
          asset_id?: string;
          branch_id?: string | null;
          cause?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          contract_id?: string | null;
          created_at?: string;
          created_by?: string;
          customer_id?: string | null;
          deleted_at?: string | null;
          description?: string;
          diagnosis?: string | null;
          downtime_end?: string | null;
          downtime_start?: string | null;
          hour_meter?: number | null;
          id?: string;
          labor_cost_cents?: number;
          odometer?: number | null;
          opened_at?: string;
          operator_id?: string | null;
          other_cost_cents?: number;
          parts_cost_cents?: number;
          resolution?: string | null;
          scheduled_at?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["maintenance_order_status"];
          supplier_id?: string | null;
          tenant_id?: string;
          total_cost_cents?: number | null;
          type?: Database["public"]["Enums"]["maintenance_order_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_orders_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_orders_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_orders_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_orders_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_plans: {
        Row: {
          active: boolean;
          asset_id: string | null;
          asset_type_id: string | null;
          condition_notes: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          interval_days: number | null;
          interval_hour_meter: number | null;
          interval_odometer: number | null;
          last_triggered_at: string | null;
          last_triggered_hour_meter: number | null;
          last_triggered_odometer: number | null;
          name: string;
          tenant_id: string;
          trigger_type: Database["public"]["Enums"]["maintenance_plan_trigger_type"];
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          asset_id?: string | null;
          asset_type_id?: string | null;
          condition_notes?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          id?: string;
          interval_days?: number | null;
          interval_hour_meter?: number | null;
          interval_odometer?: number | null;
          last_triggered_at?: string | null;
          last_triggered_hour_meter?: number | null;
          last_triggered_odometer?: number | null;
          name: string;
          tenant_id: string;
          trigger_type: Database["public"]["Enums"]["maintenance_plan_trigger_type"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          asset_id?: string | null;
          asset_type_id?: string | null;
          condition_notes?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          interval_days?: number | null;
          interval_hour_meter?: number | null;
          interval_odometer?: number | null;
          last_triggered_at?: string | null;
          last_triggered_hour_meter?: number | null;
          last_triggered_odometer?: number | null;
          name?: string;
          tenant_id?: string;
          trigger_type?: Database["public"]["Enums"]["maintenance_plan_trigger_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_plans_asset_type_id_fkey";
            columns: ["asset_type_id"];
            isOneToOne: false;
            referencedRelation: "asset_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_plans_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_recommendations: {
        Row: {
          asset_id: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          dedupe_key: string;
          id: string;
          message: string;
          priority: Database["public"]["Enums"]["maintenance_recommendation_priority"];
          source_id: string | null;
          source_type: string | null;
          status: Database["public"]["Enums"]["maintenance_recommendation_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["maintenance_recommendation_type"];
          updated_at: string;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          dedupe_key: string;
          id?: string;
          message: string;
          priority: Database["public"]["Enums"]["maintenance_recommendation_priority"];
          source_id?: string | null;
          source_type?: string | null;
          status?: Database["public"]["Enums"]["maintenance_recommendation_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["maintenance_recommendation_type"];
          updated_at?: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          dedupe_key?: string;
          id?: string;
          message?: string;
          priority?: Database["public"]["Enums"]["maintenance_recommendation_priority"];
          source_id?: string | null;
          source_type?: string | null;
          status?: Database["public"]["Enums"]["maintenance_recommendation_status"];
          tenant_id?: string;
          type?: Database["public"]["Enums"]["maintenance_recommendation_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_recommendations_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_recommendations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      mfa_enrollments: {
        Row: {
          backup_enabled: boolean;
          created_at: string;
          credential: string;
          deleted_at: string | null;
          id: string;
          is_primary: boolean;
          last_used_at: string | null;
          metadata: Json;
          method: string;
          status: string;
          tenant_id: string;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
        };
        Insert: {
          backup_enabled?: boolean;
          created_at?: string;
          credential: string;
          deleted_at?: string | null;
          id?: string;
          is_primary?: boolean;
          last_used_at?: string | null;
          metadata?: Json;
          method: string;
          status?: string;
          tenant_id: string;
          updated_at?: string;
          user_id: string;
          verified_at?: string | null;
        };
        Update: {
          backup_enabled?: boolean;
          created_at?: string;
          credential?: string;
          deleted_at?: string | null;
          id?: string;
          is_primary?: boolean;
          last_used_at?: string | null;
          metadata?: Json;
          method?: string;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
          user_id?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mfa_enrollments_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mfa_enrollments_user_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      mfa_recovery_codes: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          mfa_enrollment_id: string;
          tenant_id: string;
          used: boolean;
          used_at: string | null;
          used_session_id: string | null;
          user_id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          mfa_enrollment_id: string;
          tenant_id: string;
          used?: boolean;
          used_at?: string | null;
          used_session_id?: string | null;
          user_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          mfa_enrollment_id?: string;
          tenant_id?: string;
          used?: boolean;
          used_at?: string | null;
          used_session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mfa_recovery_codes_enrollment_fk";
            columns: ["mfa_enrollment_id"];
            isOneToOne: false;
            referencedRelation: "mfa_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mfa_recovery_codes_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mfa_recovery_codes_user_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_ad_integrations: {
        Row: {
          access_token_enc: string | null;
          account_id: string | null;
          account_name: string | null;
          created_at: string;
          created_by: string;
          id: string;
          last_synced_at: string | null;
          metadata: Json;
          platform: string;
          refresh_token_enc: string | null;
          scopes: string[];
          status: string;
          tenant_id: string;
          token_expires_at: string | null;
          workspace_id: string;
        };
        Insert: {
          access_token_enc?: string | null;
          account_id?: string | null;
          account_name?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          last_synced_at?: string | null;
          metadata?: Json;
          platform: string;
          refresh_token_enc?: string | null;
          scopes?: string[];
          status?: string;
          tenant_id: string;
          token_expires_at?: string | null;
          workspace_id: string;
        };
        Update: {
          access_token_enc?: string | null;
          account_id?: string | null;
          account_name?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          last_synced_at?: string | null;
          metadata?: Json;
          platform?: string;
          refresh_token_enc?: string | null;
          scopes?: string[];
          status?: string;
          tenant_id?: string;
          token_expires_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_integrations_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_integrations_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_ad_library_entries: {
        Row: {
          body_copy: string | null;
          brand_domain: string | null;
          brand_name: string;
          country: string | null;
          created_at: string;
          created_by: string;
          creative_type: string;
          creative_url: string | null;
          cta: string | null;
          duration_days: number | null;
          headline: string | null;
          id: string;
          landing_url: string | null;
          language: string | null;
          last_seen_at: string | null;
          platform: string;
          raw_data: Json;
          started_at: string | null;
          tenant_id: string;
          workspace_id: string;
        };
        Insert: {
          body_copy?: string | null;
          brand_domain?: string | null;
          brand_name: string;
          country?: string | null;
          created_at?: string;
          created_by: string;
          creative_type?: string;
          creative_url?: string | null;
          cta?: string | null;
          duration_days?: number | null;
          headline?: string | null;
          id?: string;
          landing_url?: string | null;
          language?: string | null;
          last_seen_at?: string | null;
          platform: string;
          raw_data?: Json;
          started_at?: string | null;
          tenant_id: string;
          workspace_id: string;
        };
        Update: {
          body_copy?: string | null;
          brand_domain?: string | null;
          brand_name?: string;
          country?: string | null;
          created_at?: string;
          created_by?: string;
          creative_type?: string;
          creative_url?: string | null;
          cta?: string | null;
          duration_days?: number | null;
          headline?: string | null;
          id?: string;
          landing_url?: string | null;
          language?: string | null;
          last_seen_at?: string | null;
          platform?: string;
          raw_data?: Json;
          started_at?: string | null;
          tenant_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_ad_library_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ad_library_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_ads: {
        Row: {
          body_copy: string | null;
          campaign_id: string;
          cloned_ad_id: string | null;
          created_at: string;
          created_by: string;
          creative_url: string | null;
          cta: string | null;
          destination_url: string | null;
          generated_ad_id: string | null;
          headline: string | null;
          id: string;
          performance: Json;
          platform_id: string | null;
          status: string;
          synced_at: string | null;
          tenant_id: string;
          workspace_id: string;
        };
        Insert: {
          body_copy?: string | null;
          campaign_id: string;
          cloned_ad_id?: string | null;
          created_at?: string;
          created_by: string;
          creative_url?: string | null;
          cta?: string | null;
          destination_url?: string | null;
          generated_ad_id?: string | null;
          headline?: string | null;
          id?: string;
          performance?: Json;
          platform_id?: string | null;
          status?: string;
          synced_at?: string | null;
          tenant_id: string;
          workspace_id: string;
        };
        Update: {
          body_copy?: string | null;
          campaign_id?: string;
          cloned_ad_id?: string | null;
          created_at?: string;
          created_by?: string;
          creative_url?: string | null;
          cta?: string | null;
          destination_url?: string | null;
          generated_ad_id?: string | null;
          headline?: string | null;
          id?: string;
          performance?: Json;
          platform_id?: string | null;
          status?: string;
          synced_at?: string | null;
          tenant_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_ads_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "mkt_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ads_cloned_ad_id_fkey";
            columns: ["cloned_ad_id"];
            isOneToOne: false;
            referencedRelation: "mkt_cloned_ads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ads_generated_ad_id_fkey";
            columns: ["generated_ad_id"];
            isOneToOne: false;
            referencedRelation: "mkt_generated_ads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ads_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ads_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_ai_credit_balances: {
        Row: {
          balance: number;
          tenant_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          balance?: number;
          tenant_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          balance?: number;
          tenant_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_ai_credit_balances_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ai_credit_balances_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_ai_credits: {
        Row: {
          balance_after: number;
          created_at: string;
          credits_delta: number;
          event_type: string;
          id: string;
          metadata: Json;
          tenant_id: string;
          usage_id: string | null;
          workspace_id: string;
        };
        Insert: {
          balance_after: number;
          created_at?: string;
          credits_delta: number;
          event_type: string;
          id?: string;
          metadata?: Json;
          tenant_id: string;
          usage_id?: string | null;
          workspace_id: string;
        };
        Update: {
          balance_after?: number;
          created_at?: string;
          credits_delta?: number;
          event_type?: string;
          id?: string;
          metadata?: Json;
          tenant_id?: string;
          usage_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_ai_credits_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ai_credits_usage_id_fkey";
            columns: ["usage_id"];
            isOneToOne: false;
            referencedRelation: "mkt_ai_usage";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ai_credits_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_ai_policy: {
        Row: {
          allow_shina_fallback: boolean;
          mode: string;
          preferred_source: string | null;
          tenant_id: string;
          updated_at: string;
          updated_by: string | null;
          workspace_id: string;
        };
        Insert: {
          allow_shina_fallback?: boolean;
          mode?: string;
          preferred_source?: string | null;
          tenant_id: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id: string;
        };
        Update: {
          allow_shina_fallback?: boolean;
          mode?: string;
          preferred_source?: string | null;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_ai_policy_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ai_policy_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_ai_providers: {
        Row: {
          api_key_enc: string | null;
          base_url: string | null;
          created_at: string;
          default_model: string | null;
          id: string;
          is_active: boolean;
          is_default: boolean;
          last_validated_at: string | null;
          monthly_limit_usd: number | null;
          provider: string;
          tenant_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          api_key_enc?: string | null;
          base_url?: string | null;
          created_at?: string;
          default_model?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          last_validated_at?: string | null;
          monthly_limit_usd?: number | null;
          provider: string;
          tenant_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          api_key_enc?: string | null;
          base_url?: string | null;
          created_at?: string;
          default_model?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          last_validated_at?: string | null;
          monthly_limit_usd?: number | null;
          provider?: string;
          tenant_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_ai_providers_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ai_providers_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_ai_usage: {
        Row: {
          agent_id: string | null;
          billing_source: string | null;
          cost_usd: number | null;
          created_at: string;
          credential_source: string | null;
          credits_consumed: number | null;
          duration_ms: number | null;
          entity_id: string | null;
          entity_type: string | null;
          estimated_cost_usd: number | null;
          id: string;
          idempotency_key: string | null;
          model: string;
          operation: string;
          provider: string;
          request_id: string;
          tenant_id: string;
          tokens_in: number;
          tokens_out: number;
          user_id: string | null;
          workspace_id: string;
        };
        Insert: {
          agent_id?: string | null;
          billing_source?: string | null;
          cost_usd?: number | null;
          created_at?: string;
          credential_source?: string | null;
          credits_consumed?: number | null;
          duration_ms?: number | null;
          entity_id?: string | null;
          entity_type?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          idempotency_key?: string | null;
          model: string;
          operation: string;
          provider: string;
          request_id?: string;
          tenant_id: string;
          tokens_in?: number;
          tokens_out?: number;
          user_id?: string | null;
          workspace_id: string;
        };
        Update: {
          agent_id?: string | null;
          billing_source?: string | null;
          cost_usd?: number | null;
          created_at?: string;
          credential_source?: string | null;
          credits_consumed?: number | null;
          duration_ms?: number | null;
          entity_id?: string | null;
          entity_type?: string | null;
          estimated_cost_usd?: number | null;
          id?: string;
          idempotency_key?: string | null;
          model?: string;
          operation?: string;
          provider?: string;
          request_id?: string;
          tenant_id?: string;
          tokens_in?: number;
          tokens_out?: number;
          user_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_ai_usage_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_ai_usage_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_audit_trail: {
        Row: {
          action: string;
          agent_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          ip: string | null;
          payload: Json | null;
          tenant_id: string;
          user_agent: string | null;
          user_id: string | null;
          workspace_id: string;
        };
        Insert: {
          action: string;
          agent_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          ip?: string | null;
          payload?: Json | null;
          tenant_id: string;
          user_agent?: string | null;
          user_id?: string | null;
          workspace_id: string;
        };
        Update: {
          action?: string;
          agent_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          ip?: string | null;
          payload?: Json | null;
          tenant_id?: string;
          user_agent?: string | null;
          user_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_audit_trail_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_audit_trail_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_brand_kits: {
        Row: {
          created_at: string;
          description: string | null;
          fonts: Json;
          id: string;
          is_default: boolean;
          logo_dark_url: string | null;
          logo_url: string | null;
          name: string;
          palette: Json;
          product_images: string[];
          tagline: string | null;
          tenant_id: string;
          tone_of_voice: string | null;
          updated_at: string;
          website_url: string | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          fonts?: Json;
          id?: string;
          is_default?: boolean;
          logo_dark_url?: string | null;
          logo_url?: string | null;
          name: string;
          palette?: Json;
          product_images?: string[];
          tagline?: string | null;
          tenant_id: string;
          tone_of_voice?: string | null;
          updated_at?: string;
          website_url?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          fonts?: Json;
          id?: string;
          is_default?: boolean;
          logo_dark_url?: string | null;
          logo_url?: string | null;
          name?: string;
          palette?: Json;
          product_images?: string[];
          tagline?: string | null;
          tenant_id?: string;
          tone_of_voice?: string | null;
          updated_at?: string;
          website_url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_brand_kits_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_brand_kits_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_campaigns: {
        Row: {
          ai_strategy: Json | null;
          approved_at: string | null;
          approved_by: string | null;
          brand_kit_id: string | null;
          budget_currency: string;
          budget_daily: number | null;
          budget_total: number | null;
          created_at: string;
          created_by: string;
          end_date: string | null;
          id: string;
          name: string;
          objective: string | null;
          platform: string;
          platform_id: string | null;
          published_at: string | null;
          start_date: string | null;
          status: string;
          targeting: Json;
          tenant_id: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          ai_strategy?: Json | null;
          approved_at?: string | null;
          approved_by?: string | null;
          brand_kit_id?: string | null;
          budget_currency?: string;
          budget_daily?: number | null;
          budget_total?: number | null;
          created_at?: string;
          created_by: string;
          end_date?: string | null;
          id?: string;
          name: string;
          objective?: string | null;
          platform: string;
          platform_id?: string | null;
          published_at?: string | null;
          start_date?: string | null;
          status?: string;
          targeting?: Json;
          tenant_id: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          ai_strategy?: Json | null;
          approved_at?: string | null;
          approved_by?: string | null;
          brand_kit_id?: string | null;
          budget_currency?: string;
          budget_daily?: number | null;
          budget_total?: number | null;
          created_at?: string;
          created_by?: string;
          end_date?: string | null;
          id?: string;
          name?: string;
          objective?: string | null;
          platform?: string;
          platform_id?: string | null;
          published_at?: string | null;
          start_date?: string | null;
          status?: string;
          targeting?: Json;
          tenant_id?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_campaigns_brand_kit_id_fkey";
            columns: ["brand_kit_id"];
            isOneToOne: false;
            referencedRelation: "mkt_brand_kits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_campaigns_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_campaigns_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_cloned_ads: {
        Row: {
          adapted_body: string | null;
          adapted_cta: string | null;
          adapted_headline: string | null;
          brand_kit_id: string | null;
          created_at: string;
          created_by: string;
          detected_layout: Json;
          id: string;
          image_prompt: string | null;
          model_used: string | null;
          notes: string | null;
          source_ad_id: string | null;
          source_type: string;
          source_url: string | null;
          status: string;
          tenant_id: string;
          tokens_used: number | null;
          workspace_id: string;
        };
        Insert: {
          adapted_body?: string | null;
          adapted_cta?: string | null;
          adapted_headline?: string | null;
          brand_kit_id?: string | null;
          created_at?: string;
          created_by: string;
          detected_layout?: Json;
          id?: string;
          image_prompt?: string | null;
          model_used?: string | null;
          notes?: string | null;
          source_ad_id?: string | null;
          source_type?: string;
          source_url?: string | null;
          status?: string;
          tenant_id: string;
          tokens_used?: number | null;
          workspace_id: string;
        };
        Update: {
          adapted_body?: string | null;
          adapted_cta?: string | null;
          adapted_headline?: string | null;
          brand_kit_id?: string | null;
          created_at?: string;
          created_by?: string;
          detected_layout?: Json;
          id?: string;
          image_prompt?: string | null;
          model_used?: string | null;
          notes?: string | null;
          source_ad_id?: string | null;
          source_type?: string;
          source_url?: string | null;
          status?: string;
          tenant_id?: string;
          tokens_used?: number | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_cloned_ads_brand_kit_id_fkey";
            columns: ["brand_kit_id"];
            isOneToOne: false;
            referencedRelation: "mkt_brand_kits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_cloned_ads_source_ad_id_fkey";
            columns: ["source_ad_id"];
            isOneToOne: false;
            referencedRelation: "mkt_ad_library_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_cloned_ads_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_cloned_ads_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_competitor_monitors: {
        Row: {
          alert_new_ads: boolean;
          brand_domain: string | null;
          brand_name: string;
          created_at: string;
          created_by: string;
          id: string;
          last_checked_at: string | null;
          platforms: string[];
          tenant_id: string;
          workspace_id: string;
        };
        Insert: {
          alert_new_ads?: boolean;
          brand_domain?: string | null;
          brand_name: string;
          created_at?: string;
          created_by: string;
          id?: string;
          last_checked_at?: string | null;
          platforms?: string[];
          tenant_id: string;
          workspace_id: string;
        };
        Update: {
          alert_new_ads?: boolean;
          brand_domain?: string | null;
          brand_name?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          last_checked_at?: string | null;
          platforms?: string[];
          tenant_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_competitors_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_competitors_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_drafts: {
        Row: {
          action: string;
          agent_id: string | null;
          applied_at: string | null;
          created_at: string;
          diff: Json | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          payload: Json;
          requested_by: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          tenant_id: string;
          workspace_id: string;
        };
        Insert: {
          action: string;
          agent_id?: string | null;
          applied_at?: string | null;
          created_at?: string;
          diff?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          payload: Json;
          requested_by: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          tenant_id: string;
          workspace_id: string;
        };
        Update: {
          action?: string;
          agent_id?: string | null;
          applied_at?: string | null;
          created_at?: string;
          diff?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          payload?: Json;
          requested_by?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          tenant_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_drafts_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_drafts_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_generated_ads: {
        Row: {
          body_copy: string | null;
          brand_kit_id: string | null;
          brief: string | null;
          created_at: string;
          created_by: string;
          cta: string | null;
          format: string;
          headline: string | null;
          id: string;
          image_prompt: string | null;
          model_used: string | null;
          objective: string | null;
          platform: string | null;
          status: string;
          tenant_id: string;
          tokens_used: number | null;
          type: string;
          variations: Json;
          workspace_id: string;
        };
        Insert: {
          body_copy?: string | null;
          brand_kit_id?: string | null;
          brief?: string | null;
          created_at?: string;
          created_by: string;
          cta?: string | null;
          format?: string;
          headline?: string | null;
          id?: string;
          image_prompt?: string | null;
          model_used?: string | null;
          objective?: string | null;
          platform?: string | null;
          status?: string;
          tenant_id: string;
          tokens_used?: number | null;
          type?: string;
          variations?: Json;
          workspace_id: string;
        };
        Update: {
          body_copy?: string | null;
          brand_kit_id?: string | null;
          brief?: string | null;
          created_at?: string;
          created_by?: string;
          cta?: string | null;
          format?: string;
          headline?: string | null;
          id?: string;
          image_prompt?: string | null;
          model_used?: string | null;
          objective?: string | null;
          platform?: string | null;
          status?: string;
          tenant_id?: string;
          tokens_used?: number | null;
          type?: string;
          variations?: Json;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_generated_ads_brand_kit_id_fkey";
            columns: ["brand_kit_id"];
            isOneToOne: false;
            referencedRelation: "mkt_brand_kits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_generated_ads_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_generated_ads_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_model_cost_policy: {
        Row: {
          capability: string;
          cost_basis: Json;
          created_at: string;
          credit_multiplier: number;
          effective_from: string;
          id: string;
          model: string;
          provider: string;
          status: string;
        };
        Insert: {
          capability?: string;
          cost_basis?: Json;
          created_at?: string;
          credit_multiplier?: number;
          effective_from?: string;
          id?: string;
          model: string;
          provider: string;
          status?: string;
        };
        Update: {
          capability?: string;
          cost_basis?: Json;
          created_at?: string;
          credit_multiplier?: number;
          effective_from?: string;
          id?: string;
          model?: string;
          provider?: string;
          status?: string;
        };
        Relationships: [];
      };
      mkt_swipe_files: {
        Row: {
          ad_library_id: string | null;
          created_at: string;
          created_by: string;
          custom_ad_url: string | null;
          folder: string | null;
          id: string;
          notes: string | null;
          tags: string[];
          tenant_id: string;
          title: string | null;
          workspace_id: string;
        };
        Insert: {
          ad_library_id?: string | null;
          created_at?: string;
          created_by: string;
          custom_ad_url?: string | null;
          folder?: string | null;
          id?: string;
          notes?: string | null;
          tags?: string[];
          tenant_id: string;
          title?: string | null;
          workspace_id: string;
        };
        Update: {
          ad_library_id?: string | null;
          created_at?: string;
          created_by?: string;
          custom_ad_url?: string | null;
          folder?: string | null;
          id?: string;
          notes?: string | null;
          tags?: string[];
          tenant_id?: string;
          title?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_swipe_files_ad_library_id_fkey";
            columns: ["ad_library_id"];
            isOneToOne: false;
            referencedRelation: "mkt_ad_library_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_swipe_files_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mkt_swipe_files_workspace_fk";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "mkt_workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      mkt_workspaces: {
        Row: {
          created_at: string;
          credits_limit: number;
          credits_used: number;
          id: string;
          mode: string;
          name: string;
          plan: string;
          settings: Json;
          slug: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          credits_limit?: number;
          credits_used?: number;
          id?: string;
          mode?: string;
          name: string;
          plan?: string;
          settings?: Json;
          slug: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          credits_limit?: number;
          credits_used?: number;
          id?: string;
          mode?: string;
          name?: string;
          plan?: string;
          settings?: Json;
          slug?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mkt_workspaces_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      mobile_devices: {
        Row: {
          app_version: string | null;
          created_at: string;
          device_id: string;
          enabled: boolean;
          id: string;
          last_seen_at: string;
          platform: string;
          push_token: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          app_version?: string | null;
          created_at?: string;
          device_id: string;
          enabled?: boolean;
          id?: string;
          last_seen_at?: string;
          platform: string;
          push_token?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          app_version?: string | null;
          created_at?: string;
          device_id?: string;
          enabled?: boolean;
          id?: string;
          last_seen_at?: string;
          platform?: string;
          push_token?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          person_id: string | null;
          priority: Database["public"]["Enums"]["notification_priority"];
          read_at: string | null;
          recipient_external_ref: string | null;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_status"];
          subject: string;
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          body: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          person_id?: string | null;
          priority?: Database["public"]["Enums"]["notification_priority"];
          read_at?: string | null;
          recipient_external_ref?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          subject: string;
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          body?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          person_id?: string | null;
          priority?: Database["public"]["Enums"]["notification_priority"];
          read_at?: string | null;
          recipient_external_ref?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_status"];
          subject?: string;
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_person_fk";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "persons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      operations: {
        Row: {
          asset_id: string | null;
          branch_id: string;
          completed_at: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          metadata: Json;
          resource_id: string | null;
          scheduled_ends_at: string;
          scheduled_starts_at: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["operation_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["operation_type"];
          updated_at: string;
          version: number;
        };
        Insert: {
          asset_id?: string | null;
          branch_id: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id: string;
          metadata?: Json;
          resource_id?: string | null;
          scheduled_ends_at: string;
          scheduled_starts_at: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["operation_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["operation_type"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          asset_id?: string | null;
          branch_id?: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json;
          resource_id?: string | null;
          scheduled_ends_at?: string;
          scheduled_starts_at?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["operation_status"];
          tenant_id?: string;
          type?: Database["public"]["Enums"]["operation_type"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "operations_asset_fk";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operations_branch_fk";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operations_resource_fk";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operations_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      operator_assignments: {
        Row: {
          asset_id: string | null;
          assigned_at: string;
          id: string;
          operation_id: string | null;
          operator_id: string;
          role: string | null;
          status: Database["public"]["Enums"]["operator_assignment_status"];
          tenant_id: string;
        };
        Insert: {
          asset_id?: string | null;
          assigned_at?: string;
          id?: string;
          operation_id?: string | null;
          operator_id: string;
          role?: string | null;
          status?: Database["public"]["Enums"]["operator_assignment_status"];
          tenant_id: string;
        };
        Update: {
          asset_id?: string | null;
          assigned_at?: string;
          id?: string;
          operation_id?: string | null;
          operator_id?: string;
          role?: string | null;
          status?: Database["public"]["Enums"]["operator_assignment_status"];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operator_assignments_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operator_assignments_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operator_assignments_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operator_assignments_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      operators: {
        Row: {
          auth_user_id: string | null;
          certifications: Json;
          created_at: string;
          document: string | null;
          email: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          status: Database["public"]["Enums"]["operator_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id?: string | null;
          certifications?: Json;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          phone?: string | null;
          status?: Database["public"]["Enums"]["operator_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string | null;
          certifications?: Json;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          status?: Database["public"]["Enums"]["operator_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operators_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          active: boolean;
          address_city: string;
          address_country: string;
          address_neighborhood: string | null;
          address_number: string | null;
          address_postal_code: string | null;
          address_state: string;
          address_street: string | null;
          created_at: string;
          deleted_at: string | null;
          document: string;
          email: string | null;
          id: string;
          metadata: Json;
          name: string;
          phone: string | null;
          phone_country_code: string | null;
          tenant_id: string;
          trade_name: string | null;
          type: Database["public"]["Enums"]["organization_type"];
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          address_city: string;
          address_country?: string;
          address_neighborhood?: string | null;
          address_number?: string | null;
          address_postal_code?: string | null;
          address_state: string;
          address_street?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          document: string;
          email?: string | null;
          id: string;
          metadata?: Json;
          name: string;
          phone?: string | null;
          phone_country_code?: string | null;
          tenant_id: string;
          trade_name?: string | null;
          type: Database["public"]["Enums"]["organization_type"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          address_city?: string;
          address_country?: string;
          address_neighborhood?: string | null;
          address_number?: string | null;
          address_postal_code?: string | null;
          address_state?: string;
          address_street?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          document?: string;
          email?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          phone?: string | null;
          phone_country_code?: string | null;
          tenant_id?: string;
          trade_name?: string | null;
          type?: Database["public"]["Enums"]["organization_type"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      persons: {
        Row: {
          auth_user_id: string | null;
          created_at: string;
          deleted_at: string | null;
          document: string | null;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          metadata: Json;
          phone: string | null;
          phone_country_code: string | null;
          status: Database["public"]["Enums"]["person_status"];
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          auth_user_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          document?: string | null;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          metadata?: Json;
          phone?: string | null;
          phone_country_code?: string | null;
          status?: Database["public"]["Enums"]["person_status"];
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          auth_user_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          document?: string | null;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          metadata?: Json;
          phone?: string | null;
          phone_country_code?: string | null;
          status?: Database["public"]["Enums"]["person_status"];
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "persons_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_change_acceptances: {
        Row: {
          accepted_at: string;
          commercial_terms_snapshot_id: string;
          from_plan_version_id: string | null;
          id: string;
          ip_address: unknown;
          product: Database["public"]["Enums"]["subscription_product"];
          tenant_id: string | null;
          to_plan_version_id: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          accepted_at?: string;
          commercial_terms_snapshot_id: string;
          from_plan_version_id?: string | null;
          id?: string;
          ip_address?: unknown;
          product: Database["public"]["Enums"]["subscription_product"];
          tenant_id?: string | null;
          to_plan_version_id: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          commercial_terms_snapshot_id?: string;
          from_plan_version_id?: string | null;
          id?: string;
          ip_address?: unknown;
          product?: Database["public"]["Enums"]["subscription_product"];
          tenant_id?: string | null;
          to_plan_version_id?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_change_acceptances_commercial_terms_snapshot_id_fkey";
            columns: ["commercial_terms_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "commercial_terms_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_change_acceptances_from_plan_version_id_fkey";
            columns: ["from_plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_change_acceptances_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_change_acceptances_to_plan_version_id_fkey";
            columns: ["to_plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_versions: {
        Row: {
          active_from: string;
          active_until: string | null;
          billing_cycle: string;
          commitment_period_months: number | null;
          created_at: string;
          currency: string;
          discount_rules: Json;
          gateway_price_id: string | null;
          id: string;
          included_features: Json;
          metadata: Json;
          name: string;
          overage_rules: Json;
          plan_id: string;
          price_cents: number;
          published_at: string | null;
          revenue_share: Json;
          status: string;
          trial_days: number;
          usage_limits: Json;
          version: number;
        };
        Insert: {
          active_from?: string;
          active_until?: string | null;
          billing_cycle: string;
          commitment_period_months?: number | null;
          created_at?: string;
          currency?: string;
          discount_rules?: Json;
          gateway_price_id?: string | null;
          id?: string;
          included_features?: Json;
          metadata?: Json;
          name: string;
          overage_rules?: Json;
          plan_id: string;
          price_cents: number;
          published_at?: string | null;
          revenue_share?: Json;
          status?: string;
          trial_days?: number;
          usage_limits?: Json;
          version: number;
        };
        Update: {
          active_from?: string;
          active_until?: string | null;
          billing_cycle?: string;
          commitment_period_months?: number | null;
          created_at?: string;
          currency?: string;
          discount_rules?: Json;
          gateway_price_id?: string | null;
          id?: string;
          included_features?: Json;
          metadata?: Json;
          name?: string;
          overage_rules?: Json;
          plan_id?: string;
          price_cents?: number;
          published_at?: string | null;
          revenue_share?: Json;
          status?: string;
          trial_days?: number;
          usage_limits?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "plan_versions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          key: string;
          name: string;
          product: Database["public"]["Enums"]["subscription_product"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          key: string;
          name: string;
          product: Database["public"]["Enums"]["subscription_product"];
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          key?: string;
          name?: string;
          product?: Database["public"]["Enums"]["subscription_product"];
        };
        Relationships: [];
      };
      platform_billing_events: {
        Row: {
          created_at: string;
          event_type: string;
          gateway_event_id: string | null;
          id: string;
          payload: Json;
          processed_at: string | null;
          provider: string;
          subscription_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          gateway_event_id?: string | null;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          subscription_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          gateway_event_id?: string | null;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_billing_events_subscription_fk";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "platform_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_customers: {
        Row: {
          auth_user_id: string;
          created_at: string;
          email: string | null;
          gateway_customer_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          created_at?: string;
          email?: string | null;
          gateway_customer_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          created_at?: string;
          email?: string | null;
          gateway_customer_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_permissions: {
        Row: {
          action: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_system: boolean;
          key: string;
          metadata: Json;
          name: string;
          resource: string;
          scope: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          action: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key: string;
          metadata?: Json;
          name: string;
          resource: string;
          scope?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          action?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key?: string;
          metadata?: Json;
          name?: string;
          resource?: string;
          scope?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      platform_role_permissions: {
        Row: {
          created_at: string;
          permission_id: string;
          role_id: string;
        };
        Insert: {
          created_at?: string;
          permission_id: string;
          role_id: string;
        };
        Update: {
          created_at?: string;
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_role_permissions_permission_fk";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "platform_permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_role_permissions_role_fk";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "platform_roles";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_roles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_system: boolean;
          key: string;
          metadata: Json;
          name: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key: string;
          metadata?: Json;
          name: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key?: string;
          metadata?: Json;
          name?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      platform_subscriptions: {
        Row: {
          billing_mode: string;
          cancel_at_period_end: boolean;
          cancelled_at: string | null;
          commercial_terms_snapshot_id: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          customer_id: string;
          gateway_subscription_id: string | null;
          id: string;
          metadata: Json;
          plan_key: string;
          plan_version_id: string | null;
          product: Database["public"]["Enums"]["subscription_product"];
          status: Database["public"]["Enums"]["platform_subscription_status"];
          tenant_id: string | null;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          billing_mode?: string;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          commercial_terms_snapshot_id?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          customer_id: string;
          gateway_subscription_id?: string | null;
          id?: string;
          metadata?: Json;
          plan_key: string;
          plan_version_id?: string | null;
          product: Database["public"]["Enums"]["subscription_product"];
          status?: Database["public"]["Enums"]["platform_subscription_status"];
          tenant_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          billing_mode?: string;
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          commercial_terms_snapshot_id?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          customer_id?: string;
          gateway_subscription_id?: string | null;
          id?: string;
          metadata?: Json;
          plan_key?: string;
          plan_version_id?: string | null;
          product?: Database["public"]["Enums"]["subscription_product"];
          status?: Database["public"]["Enums"]["platform_subscription_status"];
          tenant_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_subscriptions_commercial_terms_snapshot_id_fkey";
            columns: ["commercial_terms_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "commercial_terms_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_subscriptions_customer_fk";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "platform_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_subscriptions_plan_version_id_fkey";
            columns: ["plan_version_id"];
            isOneToOne: false;
            referencedRelation: "plan_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_subscriptions_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_user_roles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          expires_at: string | null;
          granted_at: string;
          granted_by: string | null;
          id: string;
          metadata: Json;
          role_id: string;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          metadata?: Json;
          role_id: string;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          metadata?: Json;
          role_id?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "platform_user_roles_role_fk";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "platform_roles";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_customer_organizations: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          rental_customer_id: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          rental_customer_id: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          rental_customer_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_customer_organizations_customer_fk";
            columns: ["rental_customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_customer_organizations_organization_fk";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_customer_organizations_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_customers: {
        Row: {
          auth_user_id: string;
          created_at: string;
          document: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          created_at?: string;
          document?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      rental_reservations: {
        Row: {
          asset_id: string;
          balance_amount: number;
          balance_invoice_id: string | null;
          contract_id: string | null;
          created_at: string;
          deposit_amount: number;
          deposit_invoice_id: string | null;
          id: string;
          organization_id: string;
          period_ends_at: string;
          period_starts_at: string;
          rental_customer_id: string;
          status: string;
          tenant_id: string;
          total_amount: number;
          total_currency: string;
          updated_at: string;
        };
        Insert: {
          asset_id: string;
          balance_amount: number;
          balance_invoice_id?: string | null;
          contract_id?: string | null;
          created_at?: string;
          deposit_amount: number;
          deposit_invoice_id?: string | null;
          id?: string;
          organization_id: string;
          period_ends_at: string;
          period_starts_at: string;
          rental_customer_id: string;
          status?: string;
          tenant_id: string;
          total_amount: number;
          total_currency?: string;
          updated_at?: string;
        };
        Update: {
          asset_id?: string;
          balance_amount?: number;
          balance_invoice_id?: string | null;
          contract_id?: string | null;
          created_at?: string;
          deposit_amount?: number;
          deposit_invoice_id?: string | null;
          id?: string;
          organization_id?: string;
          period_ends_at?: string;
          period_starts_at?: string;
          rental_customer_id?: string;
          status?: string;
          tenant_id?: string;
          total_amount?: number;
          total_currency?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_reservations_asset_fk";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_reservations_balance_invoice_fk";
            columns: ["balance_invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_reservations_contract_fk";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_reservations_customer_fk";
            columns: ["rental_customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_reservations_deposit_invoice_fk";
            columns: ["deposit_invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_reservations_organization_fk";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_reservations_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_service_requests: {
        Row: {
          contract_id: string;
          created_at: string;
          id: string;
          message: string;
          rental_customer_id: string;
          review_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["rental_service_request_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["rental_service_request_type"];
          updated_at: string;
        };
        Insert: {
          contract_id: string;
          created_at?: string;
          id?: string;
          message: string;
          rental_customer_id: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["rental_service_request_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["rental_service_request_type"];
          updated_at?: string;
        };
        Update: {
          contract_id?: string;
          created_at?: string;
          id?: string;
          message?: string;
          rental_customer_id?: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["rental_service_request_status"];
          tenant_id?: string;
          type?: Database["public"]["Enums"]["rental_service_request_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_service_requests_contract_fk";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_service_requests_customer_fk";
            columns: ["rental_customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_service_requests_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_locations: {
        Row: {
          created_at: string;
          id: string;
          latitude: number;
          longitude: number;
          raw_payload: Json;
          recorded_at: string;
          resource_id: string;
          source: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          latitude: number;
          longitude: number;
          raw_payload?: Json;
          recorded_at?: string;
          resource_id: string;
          source?: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          raw_payload?: Json;
          recorded_at?: string;
          resource_id?: string;
          source?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_locations_resource_fk";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_locations_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      resources: {
        Row: {
          asset_id: string | null;
          branch_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          name: string;
          person_id: string | null;
          status: Database["public"]["Enums"]["resource_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["resource_type"];
          updated_at: string;
          version: number;
        };
        Insert: {
          asset_id?: string | null;
          branch_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          name: string;
          person_id?: string | null;
          status?: Database["public"]["Enums"]["resource_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["resource_type"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          asset_id?: string | null;
          branch_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          person_id?: string | null;
          status?: Database["public"]["Enums"]["resource_status"];
          tenant_id?: string;
          type?: Database["public"]["Enums"]["resource_type"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "resources_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_branch_fk";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_person_fk";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "persons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_set_rules: {
        Row: {
          action: string;
          condition: string;
          id: string;
          priority: number;
          rule_set_id: string;
          tenant_id: string;
        };
        Insert: {
          action: string;
          condition: string;
          id: string;
          priority?: number;
          rule_set_id: string;
          tenant_id: string;
        };
        Update: {
          action?: string;
          condition?: string;
          id?: string;
          priority?: number;
          rule_set_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rule_set_rules_rule_set_fk";
            columns: ["rule_set_id"];
            isOneToOne: false;
            referencedRelation: "rule_sets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rule_set_rules_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      rule_sets: {
        Row: {
          context: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          name: string;
          status: Database["public"]["Enums"]["rule_set_status"];
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          context: string;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          name: string;
          status?: Database["public"]["Enums"]["rule_set_status"];
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          context?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          status?: Database["public"]["Enums"]["rule_set_status"];
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rule_sets_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      shina_totp_credentials: {
        Row: {
          created_at: string;
          encrypted_secret: string;
          id: string;
          last_used_at: string | null;
          shina_user_id: string;
          status: string;
          verified_at: string | null;
        };
        Insert: {
          created_at?: string;
          encrypted_secret: string;
          id?: string;
          last_used_at?: string | null;
          shina_user_id: string;
          status?: string;
          verified_at?: string | null;
        };
        Update: {
          created_at?: string;
          encrypted_secret?: string;
          id?: string;
          last_used_at?: string | null;
          shina_user_id?: string;
          status?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      signature_artifacts: {
        Row: {
          content_type: string;
          created_at: string;
          filename: string;
          hash: string;
          id: string;
          kind: Database["public"]["Enums"]["signature_artifact_kind"];
          signature_request_id: string;
          storage_path: string;
          tenant_id: string;
        };
        Insert: {
          content_type: string;
          created_at?: string;
          filename: string;
          hash: string;
          id?: string;
          kind: Database["public"]["Enums"]["signature_artifact_kind"];
          signature_request_id: string;
          storage_path: string;
          tenant_id: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          filename?: string;
          hash?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["signature_artifact_kind"];
          signature_request_id?: string;
          storage_path?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signature_artifacts_request_fk";
            columns: ["signature_request_id"];
            isOneToOne: false;
            referencedRelation: "signature_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_artifacts_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      signature_requests: {
        Row: {
          contract_id: string;
          contract_version_id: string;
          created_at: string;
          created_by: string | null;
          document_name: string;
          id: string;
          provider: string;
          provider_document_id: string | null;
          provider_request_id: string | null;
          snapshot_id: string;
          status: Database["public"]["Enums"]["signature_status"];
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          contract_id: string;
          contract_version_id: string;
          created_at?: string;
          created_by?: string | null;
          document_name: string;
          id?: string;
          provider: string;
          provider_document_id?: string | null;
          provider_request_id?: string | null;
          snapshot_id: string;
          status?: Database["public"]["Enums"]["signature_status"];
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          contract_id?: string;
          contract_version_id?: string;
          created_at?: string;
          created_by?: string | null;
          document_name?: string;
          id?: string;
          provider?: string;
          provider_document_id?: string | null;
          provider_request_id?: string | null;
          snapshot_id?: string;
          status?: Database["public"]["Enums"]["signature_status"];
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signature_requests_contract_fk";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_requests_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      signature_signers: {
        Row: {
          created_at: string;
          customer_id: string | null;
          email: string;
          id: string;
          name: string;
          operator_id: string | null;
          party_type: string | null;
          provider_external_id: string | null;
          role: Database["public"]["Enums"]["signer_role"];
          signature_request_id: string;
          signed_at: string | null;
          status: Database["public"]["Enums"]["signer_status"];
          tenant_id: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          email: string;
          id?: string;
          name: string;
          operator_id?: string | null;
          party_type?: string | null;
          provider_external_id?: string | null;
          role: Database["public"]["Enums"]["signer_role"];
          signature_request_id: string;
          signed_at?: string | null;
          status?: Database["public"]["Enums"]["signer_status"];
          tenant_id: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          email?: string;
          id?: string;
          name?: string;
          operator_id?: string | null;
          party_type?: string | null;
          provider_external_id?: string | null;
          role?: Database["public"]["Enums"]["signer_role"];
          signature_request_id?: string;
          signed_at?: string | null;
          status?: Database["public"]["Enums"]["signer_status"];
          tenant_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "signature_signers_request_fk";
            columns: ["signature_request_id"];
            isOneToOne: false;
            referencedRelation: "signature_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signature_signers_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      signature_webhook_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          provider: string;
          provider_event_id: string;
          signature_request_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider: string;
          provider_event_id: string;
          signature_request_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          provider_event_id?: string;
          signature_request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "signature_webhook_events_request_fk";
            columns: ["signature_request_id"];
            isOneToOne: false;
            referencedRelation: "signature_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      studio_drafts: {
        Row: {
          config: Json;
          id: string;
          studio_type: string;
          tenant_id: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          config?: Json;
          id?: string;
          studio_type: string;
          tenant_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          config?: Json;
          id?: string;
          studio_type?: string;
          tenant_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "studio_drafts_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      studio_versions: {
        Row: {
          changelog: string | null;
          config: Json;
          id: string;
          published_at: string;
          published_by: string;
          studio_type: string;
          tenant_id: string;
          version: number;
        };
        Insert: {
          changelog?: string | null;
          config?: Json;
          id?: string;
          published_at?: string;
          published_by: string;
          studio_type: string;
          tenant_id: string;
          version: number;
        };
        Update: {
          changelog?: string | null;
          config?: Json;
          id?: string;
          published_at?: string;
          published_by?: string;
          studio_type?: string;
          tenant_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "studio_versions_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      support_messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          read_by_platform_at: string | null;
          read_by_tenant_at: string | null;
          sender_role: string;
          sender_user_id: string | null;
          tenant_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          read_by_platform_at?: string | null;
          read_by_tenant_at?: string | null;
          sender_role: string;
          sender_user_id?: string | null;
          tenant_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          read_by_platform_at?: string | null;
          read_by_tenant_at?: string | null;
          sender_role?: string;
          sender_user_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_messages_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_activity_log: {
        Row: {
          action: string;
          actor_id: string;
          created_at: string;
          entity_id: string;
          entity_type: string;
          id: string;
          metadata: Json;
          tenant_id: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          metadata?: Json;
          tenant_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_activity_log_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_contract_acceptances: {
        Row: {
          acceptance_method: Database["public"]["Enums"]["contract_acceptance_method"];
          accepted_at: string;
          consented_data_processing: boolean;
          contract_id: string;
          contract_version_id: string;
          customer_id: string | null;
          document_hash: string;
          id: string;
          ip_address: unknown;
          metadata: Json;
          operation_id: string | null;
          operator_id: string | null;
          party_type: Database["public"]["Enums"]["contract_party_type"];
          session_id: string | null;
          snapshot_id: string;
          tenant_id: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          acceptance_method: Database["public"]["Enums"]["contract_acceptance_method"];
          accepted_at?: string;
          consented_data_processing?: boolean;
          contract_id: string;
          contract_version_id: string;
          customer_id?: string | null;
          document_hash: string;
          id?: string;
          ip_address?: unknown;
          metadata?: Json;
          operation_id?: string | null;
          operator_id?: string | null;
          party_type: Database["public"]["Enums"]["contract_party_type"];
          session_id?: string | null;
          snapshot_id: string;
          tenant_id: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          acceptance_method?: Database["public"]["Enums"]["contract_acceptance_method"];
          accepted_at?: string;
          consented_data_processing?: boolean;
          contract_id?: string;
          contract_version_id?: string;
          customer_id?: string | null;
          document_hash?: string;
          id?: string;
          ip_address?: unknown;
          metadata?: Json;
          operation_id?: string | null;
          operator_id?: string | null;
          party_type?: Database["public"]["Enums"]["contract_party_type"];
          session_id?: string | null;
          snapshot_id?: string;
          tenant_id?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_contract_acceptances_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_acceptances_contract_version_id_fkey";
            columns: ["contract_version_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_acceptances_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_acceptances_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_acceptances_operator_fk";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_acceptances_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_acceptances_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_contract_clauses: {
        Row: {
          category: Database["public"]["Enums"]["contract_clause_category"];
          content: string;
          created_at: string;
          id: string;
          key: string;
          status: string;
          tenant_id: string | null;
          title: string;
          version: number;
        };
        Insert: {
          category: Database["public"]["Enums"]["contract_clause_category"];
          content: string;
          created_at?: string;
          id?: string;
          key: string;
          status?: string;
          tenant_id?: string | null;
          title: string;
          version?: number;
        };
        Update: {
          category?: Database["public"]["Enums"]["contract_clause_category"];
          content?: string;
          created_at?: string;
          id?: string;
          key?: string;
          status?: string;
          tenant_id?: string | null;
          title?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_contract_clauses_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_contract_requirements: {
        Row: {
          asset_type_id: string | null;
          blueprint_id: string;
          consumer_relationship: Database["public"]["Enums"]["consumer_relationship_type"];
          contract_id: string | null;
          customer_id: string | null;
          data_processing_legal_basis:
            | Database["public"]["Enums"]["data_processing_legal_basis"]
            | null;
          id: string;
          insurance_type: string | null;
          jurisdiction: string | null;
          operation_id: string | null;
          operation_type: string | null;
          operator_id: string | null;
          operator_included: boolean;
          operator_required: boolean;
          party_type: Database["public"]["Enums"]["contract_party_type"];
          pricing_model: string | null;
          required_clause_keys: string[];
          resolved_at: string;
          resolved_template_id: string | null;
          resolved_version_id: string | null;
          tenant_id: string;
          tracking_enabled: boolean;
        };
        Insert: {
          asset_type_id?: string | null;
          blueprint_id: string;
          consumer_relationship?: Database["public"]["Enums"]["consumer_relationship_type"];
          contract_id?: string | null;
          customer_id?: string | null;
          data_processing_legal_basis?:
            | Database["public"]["Enums"]["data_processing_legal_basis"]
            | null;
          id?: string;
          insurance_type?: string | null;
          jurisdiction?: string | null;
          operation_id?: string | null;
          operation_type?: string | null;
          operator_id?: string | null;
          operator_included?: boolean;
          operator_required?: boolean;
          party_type: Database["public"]["Enums"]["contract_party_type"];
          pricing_model?: string | null;
          required_clause_keys?: string[];
          resolved_at?: string;
          resolved_template_id?: string | null;
          resolved_version_id?: string | null;
          tenant_id: string;
          tracking_enabled?: boolean;
        };
        Update: {
          asset_type_id?: string | null;
          blueprint_id?: string;
          consumer_relationship?: Database["public"]["Enums"]["consumer_relationship_type"];
          contract_id?: string | null;
          customer_id?: string | null;
          data_processing_legal_basis?:
            | Database["public"]["Enums"]["data_processing_legal_basis"]
            | null;
          id?: string;
          insurance_type?: string | null;
          jurisdiction?: string | null;
          operation_id?: string | null;
          operation_type?: string | null;
          operator_id?: string | null;
          operator_included?: boolean;
          operator_required?: boolean;
          party_type?: Database["public"]["Enums"]["contract_party_type"];
          pricing_model?: string | null;
          required_clause_keys?: string[];
          resolved_at?: string;
          resolved_template_id?: string | null;
          resolved_version_id?: string | null;
          tenant_id?: string;
          tracking_enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_contract_requirements_asset_type_id_fkey";
            columns: ["asset_type_id"];
            isOneToOne: false;
            referencedRelation: "asset_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_requirements_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_requirements_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "rental_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_requirements_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_requirements_operator_fk";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "operators";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_requirements_resolved_template_id_fkey";
            columns: ["resolved_template_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_requirements_resolved_version_id_fkey";
            columns: ["resolved_version_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_requirements_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_contract_snapshots: {
        Row: {
          content_hash: string;
          contract_id: string;
          created_at: string;
          id: string;
          rendered_content: string;
          template_version_id: string;
          tenant_id: string;
        };
        Insert: {
          content_hash: string;
          contract_id: string;
          created_at?: string;
          id?: string;
          rendered_content: string;
          template_version_id: string;
          tenant_id: string;
        };
        Update: {
          content_hash?: string;
          contract_id?: string;
          created_at?: string;
          id?: string;
          rendered_content?: string;
          template_version_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_contract_snapshots_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_snapshots_template_version_id_fkey";
            columns: ["template_version_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_snapshots_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_contract_template_clauses: {
        Row: {
          clause_id: string;
          condition: Json | null;
          id: string;
          is_mandatory: boolean;
          sort_order: number;
          template_id: string;
        };
        Insert: {
          clause_id: string;
          condition?: Json | null;
          id?: string;
          is_mandatory?: boolean;
          sort_order?: number;
          template_id: string;
        };
        Update: {
          clause_id?: string;
          condition?: Json | null;
          id?: string;
          is_mandatory?: boolean;
          sort_order?: number;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_contract_template_clauses_clause_id_fkey";
            columns: ["clause_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_clauses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_contract_template_clauses_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_contract_templates: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          name: string;
          party_type: Database["public"]["Enums"]["contract_party_type"];
          status: string;
          tenant_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          name: string;
          party_type: Database["public"]["Enums"]["contract_party_type"];
          status?: string;
          tenant_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          name?: string;
          party_type?: Database["public"]["Enums"]["contract_party_type"];
          status?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_contract_templates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_contract_versions: {
        Row: {
          content_hash: string | null;
          created_at: string;
          effective_at: string;
          id: string;
          resolved_clauses: Json;
          status: string;
          template_id: string;
          version: number;
        };
        Insert: {
          content_hash?: string | null;
          created_at?: string;
          effective_at?: string;
          id?: string;
          resolved_clauses?: Json;
          status?: string;
          template_id: string;
          version: number;
        };
        Update: {
          content_hash?: string | null;
          created_at?: string;
          effective_at?: string;
          id?: string;
          resolved_clauses?: Json;
          status?: string;
          template_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_contract_versions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "tenant_contract_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_permissions: {
        Row: {
          action: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_system: boolean;
          key: string;
          metadata: Json;
          name: string;
          resource: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          action: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key: string;
          metadata?: Json;
          name: string;
          resource: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          action?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key?: string;
          metadata?: Json;
          name?: string;
          resource?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      tenant_role_permissions: {
        Row: {
          created_at: string;
          permission_id: string;
          role_id: string;
        };
        Insert: {
          created_at?: string;
          permission_id: string;
          role_id: string;
        };
        Update: {
          created_at?: string;
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_role_permissions_permission_fk";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "tenant_permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_role_permissions_role_fk";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "tenant_roles";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_roles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_system: boolean;
          key: string | null;
          metadata: Json;
          name: string;
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key?: string | null;
          metadata?: Json;
          name: string;
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          key?: string | null;
          metadata?: Json;
          name?: string;
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_roles_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_user_roles: {
        Row: {
          branch_id: string | null;
          branch_scope_mode: string | null;
          created_at: string;
          deleted_at: string | null;
          expires_at: string | null;
          granted_at: string;
          granted_by: string | null;
          id: string;
          metadata: Json;
          role_id: string;
          tenant_id: string;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          branch_id?: string | null;
          branch_scope_mode?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          metadata?: Json;
          role_id: string;
          tenant_id: string;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          branch_id?: string | null;
          branch_scope_mode?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          metadata?: Json;
          role_id?: string;
          tenant_id?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_user_roles_role_fk";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "tenant_roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_user_roles_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenant_user_roles_user_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          created_at: string;
          customer_self_inspection_enabled: boolean;
          default_currency: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          name: string;
          plan: Database["public"]["Enums"]["tenant_plan"];
          slug: string;
          status: Database["public"]["Enums"]["tenant_status"];
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          customer_self_inspection_enabled?: boolean;
          default_currency?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          name: string;
          plan?: Database["public"]["Enums"]["tenant_plan"];
          slug: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          customer_self_inspection_enabled?: boolean;
          default_currency?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          plan?: Database["public"]["Enums"]["tenant_plan"];
          slug?: string;
          status?: Database["public"]["Enums"]["tenant_status"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          auth_user_id: string;
          avatar_url: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string;
          failed_login_attempts: number;
          full_name: string;
          id: string;
          last_login_at: string | null;
          locked_until: string | null;
          metadata: Json;
          mfa_method: string | null;
          mfa_required: boolean;
          phone_number: string | null;
          status: string;
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          auth_user_id: string;
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          failed_login_attempts?: number;
          full_name: string;
          id: string;
          last_login_at?: string | null;
          locked_until?: string | null;
          metadata?: Json;
          mfa_method?: string | null;
          mfa_required?: boolean;
          phone_number?: string | null;
          status?: string;
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          auth_user_id?: string;
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          failed_login_attempts?: number;
          full_name?: string;
          id?: string;
          last_login_at?: string | null;
          locked_until?: string | null;
          metadata?: Json;
          mfa_method?: string | null;
          mfa_required?: boolean;
          phone_number?: string | null;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      user_sessions: {
        Row: {
          auth_session_id: string;
          created_at: string;
          delegation_id: string | null;
          expires_at: string;
          id: string;
          impersonation_id: string | null;
          ip_address: string | null;
          is_impersonated: boolean;
          last_activity_at: string;
          metadata: Json;
          mfa_method: string | null;
          mfa_verified: boolean;
          mfa_verified_at: string | null;
          status: string;
          tenant_id: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth_session_id: string;
          created_at?: string;
          delegation_id?: string | null;
          expires_at: string;
          id?: string;
          impersonation_id?: string | null;
          ip_address?: string | null;
          is_impersonated?: boolean;
          last_activity_at?: string;
          metadata?: Json;
          mfa_method?: string | null;
          mfa_verified?: boolean;
          mfa_verified_at?: string | null;
          status?: string;
          tenant_id: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth_session_id?: string;
          created_at?: string;
          delegation_id?: string | null;
          expires_at?: string;
          id?: string;
          impersonation_id?: string | null;
          ip_address?: string | null;
          is_impersonated?: boolean;
          last_activity_at?: string;
          metadata?: Json;
          mfa_method?: string | null;
          mfa_verified?: boolean;
          mfa_verified_at?: string | null;
          status?: string;
          tenant_id?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_sessions_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_sessions_user_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "user_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_definitions: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          name: string;
          status: Database["public"]["Enums"]["workflow_status"];
          tenant_id: string;
          trigger: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          name: string;
          status?: Database["public"]["Enums"]["workflow_status"];
          tenant_id: string;
          trigger: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          status?: Database["public"]["Enums"]["workflow_status"];
          tenant_id?: string;
          trigger?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_definitions_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_steps: {
        Row: {
          action: string;
          id: string;
          name: string;
          next_step_id: string | null;
          sort_order: number;
          tenant_id: string;
          workflow_definition_id: string;
        };
        Insert: {
          action: string;
          id: string;
          name: string;
          next_step_id?: string | null;
          sort_order?: number;
          tenant_id: string;
          workflow_definition_id: string;
        };
        Update: {
          action?: string;
          id?: string;
          name?: string;
          next_step_id?: string | null;
          sort_order?: number;
          tenant_id?: string;
          workflow_definition_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_steps_definition_fk";
            columns: ["workflow_definition_id"];
            isOneToOne: false;
            referencedRelation: "workflow_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_steps_next_step_fk";
            columns: ["next_step_id"];
            isOneToOne: false;
            referencedRelation: "workflow_steps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_steps_tenant_fk";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      mkt_apply_ai_credit_event: {
        Args: {
          p_delta: number;
          p_event_type: string;
          p_metadata?: Json;
          p_tenant_id: string;
          p_usage_id?: string;
          p_workspace_id: string;
        };
        Returns: number;
      };
      mkt_current_tenant_id: { Args: never; Returns: string };
      resolve_shina_authorization_context: {
        Args: { p_user_id: string };
        Returns: Json;
      };
    };
    Enums: {
      allocation_status: "reserved" | "active" | "completed" | "cancelled";
      asset_category: "vehicle" | "equipment" | "tool" | "property" | "technology";
      asset_ownership_type: "own" | "shared" | "third_party_managed";
      asset_status: "available" | "in_use" | "maintenance" | "decommissioned";
      billing_account_status: "active" | "suspended" | "closed";
      billing_cycle: "monthly" | "quarterly" | "annual" | "one_time";
      branch_scope_mode: "root" | "branch" | "branch_and_children" | "custom";
      capability_scope: "global" | "tenant" | "branch" | "resource";
      commission_approval_decision: "approve" | "reject";
      commission_approval_status: "pending" | "approved" | "rejected";
      commission_calculation_type: "flat" | "percentage" | "tiered";
      commission_campaign_status: "draft" | "active" | "paused" | "completed" | "cancelled";
      commission_period: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
      commission_plan_status: "active" | "inactive" | "archived";
      commission_rule_condition_type:
        | "revenue_threshold"
        | "operation_count"
        | "resource_type"
        | "branch"
        | "always";
      commission_settlement_status: "pending" | "processing" | "completed" | "failed";
      commission_target_status: "pending" | "achieved" | "missed" | "partial";
      commission_transaction_status: "pending" | "approved" | "rejected" | "paid";
      commission_transaction_type: "earned" | "bonus" | "adjustment" | "reversal";
      consumer_relationship_type: "consumer" | "business" | "undetermined";
      contract_acceptance_method:
        | "clickwrap"
        | "otp"
        | "electronic_signature_provider"
        | "digital_signature"
        | "operator_acknowledgement";
      contract_clause_category:
        | "general"
        | "payment"
        | "cancellation"
        | "delivery"
        | "return"
        | "damage"
        | "insurance"
        | "tracking"
        | "telemetry"
        | "fuel"
        | "mileage"
        | "hour_meter"
        | "fines"
        | "operator"
        | "certification"
        | "safety"
        | "maintenance"
        | "security_deposit"
        | "transport"
        | "mobilization"
        | "demobilization"
        | "overtime"
        | "liability"
        | "privacy"
        | "data_processing"
        | "consumer_rights";
      contract_document_status: "pending" | "approved" | "rejected";
      contract_party_type: "customer" | "operator";
      contract_status: "draft" | "active" | "expired" | "terminated" | "suspended";
      contract_type: "service" | "rental" | "lease" | "subscription" | "one_time";
      crm_activity_type: "note" | "call" | "email" | "meeting" | "status_change";
      crm_lead_source:
        | "website"
        | "referral"
        | "outbound"
        | "event"
        | "social"
        | "partner"
        | "other";
      crm_lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost";
      data_processing_legal_basis:
        | "consent"
        | "contract_performance"
        | "legitimate_interest"
        | "legal_obligation"
        | "not_applicable";
      geofence_shape: "circle" | "polygon";
      geofence_status: "active" | "inactive";
      infraction_case_status:
        | "received"
        | "matching"
        | "matched"
        | "unmatched"
        | "responsibility_pending"
        | "responsibility_suggested"
        | "responsibility_confirmed"
        | "notified"
        | "action_pending"
        | "disputed"
        | "driver_identification_pending"
        | "driver_identified"
        | "defense_pending"
        | "appealed"
        | "payment_pending"
        | "paid"
        | "overdue"
        | "waived"
        | "cancelled"
        | "closed";
      infraction_deadline_status: "open" | "due_soon" | "overdue" | "completed" | "cancelled";
      infraction_deadline_type:
        | "driver_identification"
        | "defense"
        | "appeal"
        | "discount"
        | "due"
        | "internal";
      infraction_defense_kind: "defense" | "appeal";
      infraction_defense_status:
        | "draft"
        | "submitted"
        | "under_analysis"
        | "accepted"
        | "rejected"
        | "expired";
      infraction_dispute_status: "open" | "under_review" | "accepted" | "rejected" | "resolved";
      infraction_document_kind:
        | "notification"
        | "auto"
        | "invoice_slip"
        | "receipt"
        | "defense"
        | "appeal"
        | "decision"
        | "driver_identification"
        | "other";
      infraction_driver_identification_status:
        | "not_required"
        | "pending"
        | "ready"
        | "submitted"
        | "accepted"
        | "rejected"
        | "expired";
      infraction_evidence_type:
        | "contract"
        | "allocation"
        | "operation"
        | "operator_assignment"
        | "tracking"
        | "document"
        | "customer_statement"
        | "authority_document"
        | "other";
      infraction_match_confidence: "exact_renavam" | "exact_plate" | "ambiguous" | "not_found";
      infraction_payment_kind: "to_authority" | "reimbursement_from_responsible";
      infraction_responsible_party_type: "operator" | "customer" | "tenant" | "unknown";
      infraction_source:
        | "manual"
        | "csv_import"
        | "senatran"
        | "renainf"
        | "serpro"
        | "detran"
        | "authority"
        | "partner";
      infraction_sync_status: "running" | "completed" | "failed" | "partial";
      inspection_dispute_status: "open" | "under_review" | "accepted" | "rejected" | "resolved";
      inspection_field_type:
        | "text"
        | "textarea"
        | "number"
        | "boolean"
        | "single_select"
        | "multi_select"
        | "condition"
        | "odometer"
        | "hour_meter"
        | "percentage"
        | "signature"
        | "photo"
        | "multi_photo"
        | "video"
        | "document";
      inspection_finding_severity: "low" | "medium" | "high" | "critical";
      inspection_finding_status:
        | "detected"
        | "under_review"
        | "confirmed"
        | "rejected"
        | "chargeable"
        | "waived"
        | "resolved";
      inspection_media_type: "photo" | "video" | "document";
      inspection_purpose: "check_in" | "check_out";
      inspection_signer_type: "customer" | "operator" | "tenant_staff";
      inspection_status:
        | "draft"
        | "in_progress"
        | "pending_review"
        | "completed"
        | "rejected"
        | "abandoned";
      inspection_template_status: "draft" | "published" | "archived";
      inspection_type:
        | "pre_delivery"
        | "check_in"
        | "check_out"
        | "return"
        | "periodic"
        | "maintenance"
        | "damage"
        | "custom";
      invoice_status: "draft" | "issued" | "paid" | "overdue" | "cancelled" | "voided";
      maintenance_document_kind:
        | "budget"
        | "invoice"
        | "work_order"
        | "report"
        | "receipt"
        | "image"
        | "warranty"
        | "other";
      maintenance_insight_severity: "medium" | "high";
      maintenance_insight_status: "open" | "acknowledged" | "dismissed";
      maintenance_insight_type:
        | "critical_health_asset"
        | "high_risk_cluster"
        | "low_fleet_health"
        | "stale_recommendations";
      maintenance_order_status:
        | "scheduled"
        | "awaiting_approval"
        | "approved"
        | "in_progress"
        | "completed"
        | "cancelled";
      maintenance_order_type:
        | "preventive"
        | "corrective"
        | "predictive"
        | "inspection_generated"
        | "emergency";
      maintenance_plan_trigger_type: "date" | "odometer" | "hour_meter" | "condition" | "combined";
      maintenance_recommendation_priority: "low" | "medium" | "high";
      maintenance_recommendation_status: "pending" | "accepted" | "dismissed";
      maintenance_recommendation_type:
        | "schedule_preventive"
        | "investigate_anomaly"
        | "asset_review"
        | "revisit_preventive_plan";
      notification_channel: "email" | "sms" | "push" | "in_app" | "webhook";
      notification_priority: "low" | "normal" | "high" | "critical";
      notification_status: "pending" | "sent" | "delivered" | "failed" | "read";
      operation_status: "pending" | "in_progress" | "completed" | "cancelled" | "failed";
      operation_type: "delivery" | "pickup" | "maintenance" | "inspection" | "transfer";
      operator_assignment_status: "assigned" | "confirmed" | "declined" | "completed";
      operator_status: "active" | "inactive";
      organization_type: "customer" | "supplier" | "partner" | "internal";
      person_status: "active" | "inactive" | "blocked";
      platform_subscription_status:
        | "pending"
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
        | "pending_payment";
      rental_service_request_status: "pending" | "approved" | "rejected" | "resolved";
      rental_service_request_type: "extension" | "issue";
      resource_status: "available" | "busy" | "offline" | "suspended";
      resource_type: "human" | "vehicle" | "equipment" | "virtual";
      rule_set_status: "draft" | "active" | "inactive";
      signature_artifact_kind: "original" | "signed" | "evidence" | "certificate";
      signature_status:
        | "draft"
        | "sent"
        | "in_progress"
        | "signed"
        | "cancelled"
        | "expired"
        | "failed";
      signer_role:
        | "customer"
        | "operator"
        | "guarantor"
        | "witness"
        | "tenant_representative"
        | "other";
      signer_status: "pending" | "viewed" | "signed" | "refused";
      subscription_product: "platform" | "mkt";
      tenant_plan: "starter" | "professional" | "enterprise";
      tenant_status: "trialing" | "active" | "suspended" | "cancelled" | "pending_payment";
      workflow_status: "draft" | "active" | "inactive" | "deprecated";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  events: {
    Enums: {},
  },
  public: {
    Enums: {
      allocation_status: ["reserved", "active", "completed", "cancelled"],
      asset_category: ["vehicle", "equipment", "tool", "property", "technology"],
      asset_ownership_type: ["own", "shared", "third_party_managed"],
      asset_status: ["available", "in_use", "maintenance", "decommissioned"],
      billing_account_status: ["active", "suspended", "closed"],
      billing_cycle: ["monthly", "quarterly", "annual", "one_time"],
      branch_scope_mode: ["root", "branch", "branch_and_children", "custom"],
      capability_scope: ["global", "tenant", "branch", "resource"],
      commission_approval_decision: ["approve", "reject"],
      commission_approval_status: ["pending", "approved", "rejected"],
      commission_calculation_type: ["flat", "percentage", "tiered"],
      commission_campaign_status: ["draft", "active", "paused", "completed", "cancelled"],
      commission_period: ["daily", "weekly", "monthly", "quarterly", "annual"],
      commission_plan_status: ["active", "inactive", "archived"],
      commission_rule_condition_type: [
        "revenue_threshold",
        "operation_count",
        "resource_type",
        "branch",
        "always",
      ],
      commission_settlement_status: ["pending", "processing", "completed", "failed"],
      commission_target_status: ["pending", "achieved", "missed", "partial"],
      commission_transaction_status: ["pending", "approved", "rejected", "paid"],
      commission_transaction_type: ["earned", "bonus", "adjustment", "reversal"],
      consumer_relationship_type: ["consumer", "business", "undetermined"],
      contract_acceptance_method: [
        "clickwrap",
        "otp",
        "electronic_signature_provider",
        "digital_signature",
        "operator_acknowledgement",
      ],
      contract_clause_category: [
        "general",
        "payment",
        "cancellation",
        "delivery",
        "return",
        "damage",
        "insurance",
        "tracking",
        "telemetry",
        "fuel",
        "mileage",
        "hour_meter",
        "fines",
        "operator",
        "certification",
        "safety",
        "maintenance",
        "security_deposit",
        "transport",
        "mobilization",
        "demobilization",
        "overtime",
        "liability",
        "privacy",
        "data_processing",
        "consumer_rights",
      ],
      contract_document_status: ["pending", "approved", "rejected"],
      contract_party_type: ["customer", "operator"],
      contract_status: ["draft", "active", "expired", "terminated", "suspended"],
      contract_type: ["service", "rental", "lease", "subscription", "one_time"],
      crm_activity_type: ["note", "call", "email", "meeting", "status_change"],
      crm_lead_source: ["website", "referral", "outbound", "event", "social", "partner", "other"],
      crm_lead_status: ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"],
      data_processing_legal_basis: [
        "consent",
        "contract_performance",
        "legitimate_interest",
        "legal_obligation",
        "not_applicable",
      ],
      geofence_shape: ["circle", "polygon"],
      geofence_status: ["active", "inactive"],
      infraction_case_status: [
        "received",
        "matching",
        "matched",
        "unmatched",
        "responsibility_pending",
        "responsibility_suggested",
        "responsibility_confirmed",
        "notified",
        "action_pending",
        "disputed",
        "driver_identification_pending",
        "driver_identified",
        "defense_pending",
        "appealed",
        "payment_pending",
        "paid",
        "overdue",
        "waived",
        "cancelled",
        "closed",
      ],
      infraction_deadline_status: ["open", "due_soon", "overdue", "completed", "cancelled"],
      infraction_deadline_type: [
        "driver_identification",
        "defense",
        "appeal",
        "discount",
        "due",
        "internal",
      ],
      infraction_defense_kind: ["defense", "appeal"],
      infraction_defense_status: [
        "draft",
        "submitted",
        "under_analysis",
        "accepted",
        "rejected",
        "expired",
      ],
      infraction_dispute_status: ["open", "under_review", "accepted", "rejected", "resolved"],
      infraction_document_kind: [
        "notification",
        "auto",
        "invoice_slip",
        "receipt",
        "defense",
        "appeal",
        "decision",
        "driver_identification",
        "other",
      ],
      infraction_driver_identification_status: [
        "not_required",
        "pending",
        "ready",
        "submitted",
        "accepted",
        "rejected",
        "expired",
      ],
      infraction_evidence_type: [
        "contract",
        "allocation",
        "operation",
        "operator_assignment",
        "tracking",
        "document",
        "customer_statement",
        "authority_document",
        "other",
      ],
      infraction_match_confidence: ["exact_renavam", "exact_plate", "ambiguous", "not_found"],
      infraction_payment_kind: ["to_authority", "reimbursement_from_responsible"],
      infraction_responsible_party_type: ["operator", "customer", "tenant", "unknown"],
      infraction_source: [
        "manual",
        "csv_import",
        "senatran",
        "renainf",
        "serpro",
        "detran",
        "authority",
        "partner",
      ],
      infraction_sync_status: ["running", "completed", "failed", "partial"],
      inspection_dispute_status: ["open", "under_review", "accepted", "rejected", "resolved"],
      inspection_field_type: [
        "text",
        "textarea",
        "number",
        "boolean",
        "single_select",
        "multi_select",
        "condition",
        "odometer",
        "hour_meter",
        "percentage",
        "signature",
        "photo",
        "multi_photo",
        "video",
        "document",
      ],
      inspection_finding_severity: ["low", "medium", "high", "critical"],
      inspection_finding_status: [
        "detected",
        "under_review",
        "confirmed",
        "rejected",
        "chargeable",
        "waived",
        "resolved",
      ],
      inspection_media_type: ["photo", "video", "document"],
      inspection_purpose: ["check_in", "check_out"],
      inspection_signer_type: ["customer", "operator", "tenant_staff"],
      inspection_status: [
        "draft",
        "in_progress",
        "pending_review",
        "completed",
        "rejected",
        "abandoned",
      ],
      inspection_template_status: ["draft", "published", "archived"],
      inspection_type: [
        "pre_delivery",
        "check_in",
        "check_out",
        "return",
        "periodic",
        "maintenance",
        "damage",
        "custom",
      ],
      invoice_status: ["draft", "issued", "paid", "overdue", "cancelled", "voided"],
      maintenance_document_kind: [
        "budget",
        "invoice",
        "work_order",
        "report",
        "receipt",
        "image",
        "warranty",
        "other",
      ],
      maintenance_insight_severity: ["medium", "high"],
      maintenance_insight_status: ["open", "acknowledged", "dismissed"],
      maintenance_insight_type: [
        "critical_health_asset",
        "high_risk_cluster",
        "low_fleet_health",
        "stale_recommendations",
      ],
      maintenance_order_status: [
        "scheduled",
        "awaiting_approval",
        "approved",
        "in_progress",
        "completed",
        "cancelled",
      ],
      maintenance_order_type: [
        "preventive",
        "corrective",
        "predictive",
        "inspection_generated",
        "emergency",
      ],
      maintenance_plan_trigger_type: ["date", "odometer", "hour_meter", "condition", "combined"],
      maintenance_recommendation_priority: ["low", "medium", "high"],
      maintenance_recommendation_status: ["pending", "accepted", "dismissed"],
      maintenance_recommendation_type: [
        "schedule_preventive",
        "investigate_anomaly",
        "asset_review",
        "revisit_preventive_plan",
      ],
      notification_channel: ["email", "sms", "push", "in_app", "webhook"],
      notification_priority: ["low", "normal", "high", "critical"],
      notification_status: ["pending", "sent", "delivered", "failed", "read"],
      operation_status: ["pending", "in_progress", "completed", "cancelled", "failed"],
      operation_type: ["delivery", "pickup", "maintenance", "inspection", "transfer"],
      operator_assignment_status: ["assigned", "confirmed", "declined", "completed"],
      operator_status: ["active", "inactive"],
      organization_type: ["customer", "supplier", "partner", "internal"],
      person_status: ["active", "inactive", "blocked"],
      platform_subscription_status: [
        "pending",
        "trialing",
        "active",
        "past_due",
        "suspended",
        "cancelled",
        "pending_payment",
      ],
      rental_service_request_status: ["pending", "approved", "rejected", "resolved"],
      rental_service_request_type: ["extension", "issue"],
      resource_status: ["available", "busy", "offline", "suspended"],
      resource_type: ["human", "vehicle", "equipment", "virtual"],
      rule_set_status: ["draft", "active", "inactive"],
      signature_artifact_kind: ["original", "signed", "evidence", "certificate"],
      signature_status: [
        "draft",
        "sent",
        "in_progress",
        "signed",
        "cancelled",
        "expired",
        "failed",
      ],
      signer_role: [
        "customer",
        "operator",
        "guarantor",
        "witness",
        "tenant_representative",
        "other",
      ],
      signer_status: ["pending", "viewed", "signed", "refused"],
      subscription_product: ["platform", "mkt"],
      tenant_plan: ["starter", "professional", "enterprise"],
      tenant_status: ["trialing", "active", "suspended", "cancelled", "pending_payment"],
      workflow_status: ["draft", "active", "inactive", "deprecated"],
    },
  },
} as const;
