import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("resources")
    .select("id, name, type, status, created_at")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

const VALID_TYPES = ["human", "vehicle", "equipment", "virtual"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant associated with this user" }, { status: 403 });
  }

  const body = (await req.json()) as { name?: string; type?: string };
  if (!body.name?.trim() || !body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "name and type are required" }, { status: 422 });
  }

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (branchError) return NextResponse.json({ error: branchError.message }, { status: 500 });
  if (!branch) {
    return NextResponse.json(
      { error: "Tenant has no branch to assign this resource to" },
      { status: 422 },
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("resources")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branch.id,
      name: body.name.trim(),
      type: body.type,
    })
    .select("id, name, type, status, created_at")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ data: created }, { status: 201 });
}
