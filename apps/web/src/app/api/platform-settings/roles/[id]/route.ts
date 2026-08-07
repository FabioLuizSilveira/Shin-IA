import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: role, error: fetchError } = await admin
    .from("platform_roles")
    .select("is_system")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.is_system) {
    return NextResponse.json({ error: "system roles cannot be deleted" }, { status: 422 });
  }

  const { error } = await admin
    .from("platform_roles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
