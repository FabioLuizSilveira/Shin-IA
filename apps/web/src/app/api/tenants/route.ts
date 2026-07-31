import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";
import { provisionTenant } from "@/lib/tenant-provisioning";
import { appUrl } from "@/lib/domain";
import type { Tenant, TenantPlan } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("id, name, slug, plan, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data as Tenant[] });
}

// Platform-staff-assisted tenant creation. Shares provisionTenant() with the
// public onboarding wizard (/api/onboarding/complete) — previously this
// route hand-rolled its own tenant/branch/role/subscription inserts, which
// is how it ended up pointing every new tenant's admin role at the demo
// tenant's own tenant_admin row (tenant_roles is per-tenant, and nothing
// seeded a fresh set for tenants created here). Staff-assisted tenants start
// "active" (already vetted) rather than "trialing"; the admin is invited by
// email like every other Shinã Identity signup, not given a direct password.
export async function POST(req: NextRequest) {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: {
    name?: string;
    slug?: string;
    plan?: TenantPlan;
    adminEmail?: string;
    adminFullName?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, slug, plan, adminEmail, adminFullName } = body;
  if (!name || !slug || !adminEmail || !adminFullName) {
    return NextResponse.json(
      { error: "name, slug, adminEmail and adminFullName are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  try {
    const result = await provisionTenant(admin, {
      name,
      slug,
      plan: plan ?? "starter",
      status: "active",
      branchName: `Sede ${name}`,
      branchCode: "HQ-001",
      branchMetadata: { type: "headquarters", country: "BR" },
      adminEmail,
      adminFullName,
      inviteRedirectTo: appUrl("/dashboard"),
    });

    const { data: tenantData } = await admin
      .from("tenants")
      .select("id, name, slug, plan, status, created_at")
      .eq("id", result.tenantId)
      .single();

    return NextResponse.json({ data: tenantData as Tenant }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create tenant";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
