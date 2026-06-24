import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/iam/delegations — list active delegations for current user's tenant
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("iam_delegated_access")
    .select("id, grantee_id, permission, expires_at, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with grantee name (from user_profiles)
  const granteeIds = [...new Set((data ?? []).map((d) => d.grantee_id))];
  let profileMap = new Map<string, string>();

  if (granteeIds.length > 0) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("user_id, full_name")
      .in("user_id", granteeIds);
    profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? p.user_id]));
  }

  const enriched = (data ?? []).map((d) => ({
    ...d,
    grantee_name: profileMap.get(d.grantee_id) ?? d.grantee_id,
  }));

  return NextResponse.json({ data: enriched });
}

// POST /api/iam/delegations — create a delegation
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.app_metadata?.tenant_role as string | undefined;
  if (!role || !["owner", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Forbidden: only owner/admin can delegate" },
      { status: 403 },
    );
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  let body: { granteeId?: string; permission?: string; expiresAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.granteeId || !body.permission) {
    return NextResponse.json({ error: "granteeId and permission are required" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("iam_delegated_access")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      grantor_id: user.id,
      grantee_id: body.granteeId,
      permission: body.permission,
      expires_at: body.expiresAt ?? null,
      is_active: true,
    })
    .select("id, grantee_id, permission, expires_at, is_active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}

// DELETE /api/iam/delegations?id= — revoke a delegation
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 422 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("iam_delegated_access")
    .update({ is_active: false })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
