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
          asset_type_id: string;
          branch_id: string;
          category: Database["public"]["Enums"]["asset_category"];
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          name: string;
          serial_number: string | null;
          status: Database["public"]["Enums"]["asset_status"];
          tenant_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          asset_type_id: string;
          branch_id: string;
          category: Database["public"]["Enums"]["asset_category"];
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          name: string;
          serial_number?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          tenant_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          asset_type_id?: string;
          branch_id?: string;
          category?: Database["public"]["Enums"]["asset_category"];
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          name?: string;
          serial_number?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          tenant_id?: string;
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
          id: string;
          metadata: Json;
          organization_id: string;
          status: Database["public"]["Enums"]["billing_account_status"];
          stripe_customer_id: string | null;
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
          id: string;
          metadata?: Json;
          organization_id: string;
          status?: Database["public"]["Enums"]["billing_account_status"];
          stripe_customer_id?: string | null;
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
          id?: string;
          metadata?: Json;
          organization_id?: string;
          status?: Database["public"]["Enums"]["billing_account_status"];
          stripe_customer_id?: string | null;
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
      contracts: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          organization_id: string;
          period_ends_at: string;
          period_starts_at: string;
          status: Database["public"]["Enums"]["contract_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["contract_type"];
          updated_at: string;
          value_amount: number;
          value_currency: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          organization_id: string;
          period_ends_at: string;
          period_starts_at: string;
          status?: Database["public"]["Enums"]["contract_status"];
          tenant_id: string;
          type: Database["public"]["Enums"]["contract_type"];
          updated_at?: string;
          value_amount: number;
          value_currency: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          organization_id?: string;
          period_ends_at?: string;
          period_starts_at?: string;
          status?: Database["public"]["Enums"]["contract_status"];
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
            foreignKeyName: "contracts_tenant_fk";
            columns: ["tenant_id"];
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
      invoice_line_items: {
        Row: {
          description: string;
          id: string;
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
          invoice_id?: string;
          quantity?: number;
          sort_order?: number;
          tenant_id?: string;
          unit_price_amount?: number;
          unit_price_currency?: string;
        };
        Relationships: [
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
          created_at: string;
          deleted_at: string | null;
          due_date: string;
          id: string;
          metadata: Json;
          paid_at: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          tenant_id: string;
          total_amount: number;
          total_currency: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          billing_account_id: string;
          created_at?: string;
          deleted_at?: string | null;
          due_date: string;
          id: string;
          metadata?: Json;
          paid_at?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          tenant_id: string;
          total_amount: number;
          total_currency: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          billing_account_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          due_date?: string;
          id?: string;
          metadata?: Json;
          paid_at?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
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
            foreignKeyName: "invoices_tenant_fk";
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
      mkt_ai_providers: {
        Row: {
          api_key_enc: string | null;
          base_url: string | null;
          created_at: string;
          default_model: string | null;
          id: string;
          is_active: boolean;
          is_default: boolean;
          monthly_limit_usd: number | null;
          provider: string;
          tenant_id: string;
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
          monthly_limit_usd?: number | null;
          provider: string;
          tenant_id: string;
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
          monthly_limit_usd?: number | null;
          provider?: string;
          tenant_id?: string;
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
          cost_usd: number | null;
          created_at: string;
          duration_ms: number | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          model: string;
          operation: string;
          provider: string;
          tenant_id: string;
          tokens_in: number;
          tokens_out: number;
          user_id: string | null;
          workspace_id: string;
        };
        Insert: {
          agent_id?: string | null;
          cost_usd?: number | null;
          created_at?: string;
          duration_ms?: number | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          model: string;
          operation: string;
          provider: string;
          tenant_id: string;
          tokens_in?: number;
          tokens_out?: number;
          user_id?: string | null;
          workspace_id: string;
        };
        Update: {
          agent_id?: string | null;
          cost_usd?: number | null;
          created_at?: string;
          duration_ms?: number | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          model?: string;
          operation?: string;
          provider?: string;
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
          branch_id: string;
          completed_at: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          metadata: Json;
          resource_id: string;
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
          branch_id: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          metadata?: Json;
          resource_id: string;
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
          branch_id?: string;
          completed_at?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          metadata?: Json;
          resource_id?: string;
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
      platform_billing_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          provider: string;
          stripe_event_id: string | null;
          subscription_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          stripe_event_id?: string | null;
          subscription_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          stripe_event_id?: string | null;
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
          id: string;
          stripe_customer_id: string | null;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          stripe_customer_id?: string | null;
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
          cancel_at_period_end: boolean;
          cancelled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          customer_id: string;
          id: string;
          metadata: Json;
          plan_key: string;
          product: Database["public"]["Enums"]["subscription_product"];
          status: Database["public"]["Enums"]["platform_subscription_status"];
          stripe_subscription_id: string | null;
          tenant_id: string | null;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          customer_id: string;
          id?: string;
          metadata?: Json;
          plan_key: string;
          product: Database["public"]["Enums"]["subscription_product"];
          status?: Database["public"]["Enums"]["platform_subscription_status"];
          stripe_subscription_id?: string | null;
          tenant_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          customer_id?: string;
          id?: string;
          metadata?: Json;
          plan_key?: string;
          product?: Database["public"]["Enums"]["subscription_product"];
          status?: Database["public"]["Enums"]["platform_subscription_status"];
          stripe_subscription_id?: string | null;
          tenant_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_subscriptions_customer_fk";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "platform_customers";
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
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
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
      mkt_current_tenant_id: { Args: never; Returns: string };
    };
    Enums: {
      allocation_status: "reserved" | "active" | "completed" | "cancelled";
      asset_category: "vehicle" | "equipment" | "tool" | "property" | "technology";
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
      contract_status: "draft" | "active" | "expired" | "terminated" | "suspended";
      contract_type: "service" | "rental" | "lease" | "subscription" | "one_time";
      invoice_status: "draft" | "issued" | "paid" | "overdue" | "cancelled" | "voided";
      notification_channel: "email" | "sms" | "push" | "in_app" | "webhook";
      notification_priority: "low" | "normal" | "high" | "critical";
      notification_status: "pending" | "sent" | "delivered" | "failed" | "read";
      operation_status: "pending" | "in_progress" | "completed" | "cancelled" | "failed";
      operation_type: "delivery" | "pickup" | "maintenance" | "inspection" | "transfer";
      organization_type: "customer" | "supplier" | "partner" | "internal";
      person_status: "active" | "inactive" | "blocked";
      platform_subscription_status:
        | "pending"
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled";
      rental_service_request_status: "pending" | "approved" | "rejected" | "resolved";
      rental_service_request_type: "extension" | "issue";
      resource_status: "available" | "busy" | "offline" | "suspended";
      resource_type: "human" | "vehicle" | "equipment" | "virtual";
      rule_set_status: "draft" | "active" | "inactive";
      subscription_product: "platform" | "mkt";
      tenant_plan: "starter" | "professional" | "enterprise";
      tenant_status: "trialing" | "active" | "suspended" | "cancelled";
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
      contract_status: ["draft", "active", "expired", "terminated", "suspended"],
      contract_type: ["service", "rental", "lease", "subscription", "one_time"],
      invoice_status: ["draft", "issued", "paid", "overdue", "cancelled", "voided"],
      notification_channel: ["email", "sms", "push", "in_app", "webhook"],
      notification_priority: ["low", "normal", "high", "critical"],
      notification_status: ["pending", "sent", "delivered", "failed", "read"],
      operation_status: ["pending", "in_progress", "completed", "cancelled", "failed"],
      operation_type: ["delivery", "pickup", "maintenance", "inspection", "transfer"],
      organization_type: ["customer", "supplier", "partner", "internal"],
      person_status: ["active", "inactive", "blocked"],
      platform_subscription_status: [
        "pending",
        "trialing",
        "active",
        "past_due",
        "suspended",
        "cancelled",
      ],
      rental_service_request_status: ["pending", "approved", "rejected", "resolved"],
      rental_service_request_type: ["extension", "issue"],
      resource_status: ["available", "busy", "offline", "suspended"],
      resource_type: ["human", "vehicle", "equipment", "virtual"],
      rule_set_status: ["draft", "active", "inactive"],
      subscription_product: ["platform", "mkt"],
      tenant_plan: ["starter", "professional", "enterprise"],
      tenant_status: ["trialing", "active", "suspended", "cancelled"],
      workflow_status: ["draft", "active", "inactive", "deprecated"],
    },
  },
} as const;
