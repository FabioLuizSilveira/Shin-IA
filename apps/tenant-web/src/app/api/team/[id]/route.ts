import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import type { UserProfileStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

const VALID_STATUSES: UserProfileStatus[] = ["active", "inactive", "suspended"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { full_name?: string; phone_number?: string; status?: UserProfileStatus };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.full_name !== undefined) updates.full_name = body.full_name;
  if (body.phone_number !== undefined) updates.phone_number = body.phone_number;
  if (body.status !== undefined) updates.status = body.status;

  const { data, error } = await admin
    .from("user_profiles")
    .update(updates)
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .select("id, email, full_name, status, phone_number, last_login_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { error } = await admin
    .from("user_profiles")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
