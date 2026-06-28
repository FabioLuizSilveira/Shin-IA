import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tenant, TenantPlan } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const tenantId = crypto.randomUUID();

  // 1. Insert Tenant
  const { data: tenantData, error: tenantError } = await admin
    .from("tenants")
    .insert({
      id: tenantId,
      name,
      slug,
      plan: plan ?? "starter",
      status: "active",
    })
    .select("id, name, slug, plan, status, created_at")
    .single();

  if (tenantError || !tenantData) {
    return NextResponse.json(
      { error: tenantError?.message ?? "Failed to create tenant" },
      { status: 400 },
    );
  }

  // 2. Create default main branch
  const { error: branchError } = await admin.from("branches").insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    name: `Sede ${name}`,
    code: "HQ-001",
    type: "headquarters",
    city: "São Paulo",
    state: "SP",
    country: "BR",
    is_active: true,
  });

  if (branchError) {
    console.error("[api/tenants] branch creation failed:", branchError);
  }

  // 3. Invite Admin user
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    adminEmail,
    {
      data: {
        full_name: adminFullName,
        tenant_id: tenantId,
        role: "tenant_admin",
        onboarding: true,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002"}/dashboard`,
    },
  );

  let authUserId = inviteData?.user?.id ?? null;

  if (inviteError) {
    console.error("[api/tenants] invite user failed:", inviteError);
    // If user already exists, try to get their ID to link them
    try {
      const { data: userList } = await admin.auth.admin.listUsers();
      const existingUser = userList?.users?.find((u) => u.email === adminEmail);
      if (existingUser) {
        authUserId = existingUser.id;
      }
    } catch (listErr) {
      console.error("[api/tenants] listing users failed:", listErr);
    }
  }

  // 4. Create user profile & assign role
  if (authUserId) {
    const profileId = crypto.randomUUID();
    const { error: profileError } = await admin.from("user_profiles").insert({
      id: profileId,
      tenant_id: tenantId,
      auth_user_id: authUserId,
      email: adminEmail,
      full_name: adminFullName,
      status: "active",
    });

    if (profileError) {
      console.error("[api/tenants] profile insert failed:", profileError);
    } else {
      const { error: roleError } = await admin.from("tenant_user_roles").insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        user_id: profileId,
        role_id: "f0000000-0000-0000-0000-000000000002", // tenant_admin role
      });
      if (roleError) {
        console.error("[api/tenants] role insert failed:", roleError);
      }
    }
  }

  return NextResponse.json({ data: tenantData as Tenant }, { status: 201 });
}
