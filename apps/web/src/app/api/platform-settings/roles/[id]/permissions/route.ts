import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_role_permissions")
    .select("permission_id")
    .eq("role_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: (data ?? []).map((r) => r.permission_id) });
}

// Toggles a single permission on/off for a role — simpler and safer than
// replacing the whole set from the client on every checkbox click.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json()) as { permission_id?: string; grant?: boolean };
  if (!body.permission_id || typeof body.grant !== "boolean") {
    return NextResponse.json({ error: "permission_id and grant are required" }, { status: 422 });
  }

  const admin = createAdminClient();
  if (body.grant) {
    const { error } = await admin
      .from("platform_role_permissions")
      .insert({ role_id: id, permission_id: body.permission_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("platform_role_permissions")
      .delete()
      .eq("role_id", id)
      .eq("permission_id", body.permission_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { ok: true } });
}
