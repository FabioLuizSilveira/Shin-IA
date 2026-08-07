import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// M25 gap — no page ever let a tenant user edit their own profile. Scoped
// to the caller's own row via auth_user_id, not tenant_id — same posture
// as user_profiles' own RLS (users can only touch their own profile).
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("user_profiles")
    .select("id, email, full_name, phone_number, avatar_url")
    .eq("auth_user_id", scope.userId)
    .maybeSingle();
  if (error) return internalError(error);
  if (!data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const body = (await req.json()) as {
    full_name?: string;
    phone_number?: string;
    avatar_url?: string;
  };

  if (body.full_name !== undefined && !body.full_name.trim()) {
    return NextResponse.json({ error: "full_name cannot be empty" }, { status: 422 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.full_name !== undefined) update.full_name = body.full_name.trim();
  if (body.phone_number !== undefined) update.phone_number = body.phone_number.trim() || null;
  if (body.avatar_url !== undefined) update.avatar_url = body.avatar_url.trim() || null;

  const { data, error } = await scope.db
    .from("user_profiles")
    .update(update)
    .eq("auth_user_id", scope.userId)
    .select("id, email, full_name, phone_number, avatar_url")
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data });
}
