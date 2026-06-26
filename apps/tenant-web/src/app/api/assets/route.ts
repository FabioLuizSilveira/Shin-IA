import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantId } from "@/lib/auth/get-tenant-id";
import { createNotification } from "@/lib/notifications/create-notification";
import type { Asset, AssetCategory } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("assets")
    .select(
      `id, name, serial_number, category, status,
       asset_types!inner(name)`,
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assets: Asset[] = (
    data as unknown as Array<{
      id: string;
      name: string;
      serial_number: string | null;
      category: AssetCategory;
      status: Asset["status"];
      asset_types: { name: string };
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name,
    serial_number: row.serial_number ?? undefined,
    category: row.category,
    status: row.status,
    type_name: row.asset_types?.name,
  }));

  return NextResponse.json({ data: assets });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    serial_number?: string;
    category?: AssetCategory;
    asset_type_id?: string;
    branch_id?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, category, asset_type_id } = body;
  if (!name || !category || !asset_type_id) {
    return NextResponse.json(
      { error: "name, category, asset_type_id are required" },
      { status: 400 },
    );
  }

  const tenantId = await getTenantId();
  const admin = createAdminClient();

  let branchId = body.branch_id;
  if (!branchId) {
    const { data: branch } = await admin
      .from("branches")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .limit(1)
      .single();
    branchId = (branch?.id as string | undefined) ?? undefined;
  }

  if (!branchId) {
    return NextResponse.json({ error: "No branch found for tenant" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("assets")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      branch_id: branchId,
      asset_type_id,
      name,
      serial_number: body.serial_number ?? null,
      category,
    })
    .select("id, name, serial_number, category, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await createNotification({
    tenantId,
    subject: "Novo ativo registrado",
    body: `Ativo "${name}" foi cadastrado com sucesso.`,
    priority: "low",
  });

  return NextResponse.json({ data }, { status: 201 });
}
