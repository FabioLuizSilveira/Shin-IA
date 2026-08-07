import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformRole } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_permissions")
    .select("id, key, resource, action, name, description, scope, is_system")
    .is("deleted_at", null)
    .order("resource", { ascending: true })
    .order("action", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

const VALID_SCOPES = ["platform", "tenant"];

export async function POST(req: NextRequest) {
  const guard = await requirePlatformRole();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json()) as {
    resource?: string;
    action?: string;
    name?: string;
    description?: string;
    scope?: string;
  };

  if (!body.resource?.trim() || !body.action?.trim() || !body.name?.trim()) {
    return NextResponse.json({ error: "resource, action and name are required" }, { status: 422 });
  }
  const scope = body.scope && VALID_SCOPES.includes(body.scope) ? body.scope : "platform";
  const key = `platform.${body.resource.trim()}:${body.action.trim()}`;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_permissions")
    .insert({
      key,
      resource: body.resource.trim(),
      action: body.action.trim(),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      scope,
      is_system: false,
    })
    .select("id, key, resource, action, name, description, scope, is_system")
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data }, { status: 201 });
}
