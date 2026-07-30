import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data: roles, error } = await admin
    .from("platform_roles")
    .select("id, key, name, description, is_system, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: counts, error: countsError } = await admin
    .from("platform_role_permissions")
    .select("role_id");
  if (countsError) return NextResponse.json({ error: countsError.message }, { status: 500 });

  const permCountByRole = new Map<string, number>();
  for (const row of counts ?? []) {
    permCountByRole.set(row.role_id, (permCountByRole.get(row.role_id) ?? 0) + 1);
  }

  return NextResponse.json({
    data: (roles ?? []).map((r) => ({ ...r, permission_count: permCountByRole.get(r.id) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json()) as { key?: string; name?: string; description?: string };
  if (!body.key?.trim() || !body.name?.trim()) {
    return NextResponse.json({ error: "key and name are required" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_roles")
    .insert({
      key: body.key.trim(),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      is_system: false,
    })
    .select("id, key, name, description, is_system, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { ...data, permission_count: 0 } }, { status: 201 });
}
