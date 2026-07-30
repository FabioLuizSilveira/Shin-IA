import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SELECT =
  "id, name, serial_number, category, status, branch_id, asset_type_id, asset_types(name)";

function flattenType<T extends { asset_types: { name: string } | null }>(
  row: T,
): Omit<T, "asset_types"> & { type_name?: string } {
  const { asset_types, ...rest } = row;
  return { ...rest, type_name: asset_types?.name };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("assets")
    .select(SELECT)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: (data as unknown as { asset_types: { name: string } | null }[]).map(flattenType),
  });
}

const VALID_CATEGORIES = ["vehicle", "equipment", "tool", "property", "technology"];

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

  const body = (await req.json()) as {
    name?: string;
    category?: string;
    asset_type_id?: string;
    serial_number?: string;
  };

  if (
    !body.name?.trim() ||
    !body.category ||
    !VALID_CATEGORIES.includes(body.category) ||
    !body.asset_type_id
  ) {
    return NextResponse.json(
      { error: "name, category and asset_type_id are required" },
      { status: 422 },
    );
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
      { error: "Tenant has no branch to assign this asset to" },
      { status: 422 },
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("assets")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branch.id,
      asset_type_id: body.asset_type_id,
      name: body.name.trim(),
      serial_number: body.serial_number?.trim() || null,
      category: body.category,
    })
    .select(SELECT)
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json(
    { data: flattenType(created as unknown as { asset_types: { name: string } | null }) },
    { status: 201 },
  );
}
