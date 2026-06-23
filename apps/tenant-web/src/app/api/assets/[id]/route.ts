import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant-id";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["available", "in_use", "maintenance", "decommissioned"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { status?: string };
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assets")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
