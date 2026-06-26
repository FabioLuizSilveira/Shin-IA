// Supabase Tenant Adapter
// Loads tenant context and validates tenant membership

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { JWTClaims, TenantContext } from "../../types.js";
import { TenantContextResolver } from "../../tenant-context.js";

export interface SupabaseTenantAdapterConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export class SupabaseTenantAdapter {
  private supabase: SupabaseClient;
  private tenantContextResolver: TenantContextResolver;

  constructor(config: SupabaseTenantAdapterConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    this.tenantContextResolver = new TenantContextResolver();
  }

  // Resolve tenant context from JWT claims and load from database
  async resolveTenantContext(claims: JWTClaims): Promise<TenantContext> {
    // Extract base context from JWT
    const baseContext = this.tenantContextResolver.resolveTenantContext(claims);

    // Validate tenant exists in database
    const tenant = await this.getTenant(baseContext.tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${baseContext.tenantId}`);
    }

    // Load user roles and branch scope from database
    const userRoles = await this.getUserRoles(baseContext.userId, baseContext.tenantId);

    // Combine with JWT claims
    return {
      tenantId: baseContext.tenantId,
      userId: baseContext.userId,
      platformRole: baseContext.platformRole,
      tenantRole: baseContext.tenantRole || userRoles.tenantRole,
      branchIds: baseContext.branchIds || userRoles.branchIds,
      capabilities:
        baseContext.capabilities || (await this.getTenantCapabilities(baseContext.tenantId)),
    };
  }

  // Get tenant by ID
  async getTenant(tenantId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .eq("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  // Get user roles in tenant
  async getUserRoles(
    userId: string,
    tenantId: string,
  ): Promise<{
    tenantRole?: string;
    branchIds: string[];
  }> {
    const { data, error } = await this.supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .is("expires_at", null);

    if (error || !data || data.length === 0) {
      return { branchIds: [] };
    }

    // Get primary role
    const primaryRole = data[0];
    const branchIds = data.filter((r) => r.branch_id).map((r) => r.branch_id);

    return {
      tenantRole: primaryRole.role_id,
      branchIds,
    };
  }

  // Get tenant capabilities (features enabled for this plan)
  async getTenantCapabilities(tenantId: string): Promise<string[]> {
    // Get tenant plan
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return [];
    }

    // Map plan to capabilities
    const capabilities: Record<string, string[]> = {
      starter: ["tracking.basic", "tracking.history", "commission.basic"],
      professional: [
        "tracking.basic",
        "tracking.geofence",
        "tracking.history",
        "commission.basic",
        "commission.plans",
        "commission.campaigns",
        "iam.delegation",
        "studio.access_control",
        "studio.commercial",
      ],
      enterprise: [
        "tracking.basic",
        "tracking.geofence",
        "tracking.telemetry",
        "tracking.history",
        "commission.basic",
        "commission.plans",
        "commission.campaigns",
        "commission.settlements",
        "iam.delegation",
        "iam.advanced_policies",
        "studio.access_control",
        "studio.commercial",
        "ai.route_optimization",
        "ai.predictive_maintenance",
      ],
    };

    return capabilities[tenant.plan] || [];
  }

  // Validate user belongs to tenant
  async validateUserBelongsToTenant(userId: string, tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .eq("tenant_id", tenantId)
      .eq("deleted_at", null)
      .single();

    return !error && !!data;
  }

  // Get tenant context resolver
  getTenantContextResolver(): TenantContextResolver {
    return this.tenantContextResolver;
  }
}
