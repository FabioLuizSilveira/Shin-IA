import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

const TENANT_ID = process.env.DEMO_TENANT_ID!;

export async function GET(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2)
    return NextResponse.json({
      data: { operations: [], assets: [], contracts: [], organizations: [] },
    });

  const admin = createAdminClient();
  const pattern = `%${q}%`;

  const [ops, assets, contracts, orgs] = await Promise.all([
    admin
      .from("operations")
      .select("id, type, status, scheduled_starts_at, resources(name)")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .ilike("type", pattern)
      .limit(4),

    admin
      .from("assets")
      .select("id, name, category, status, serial_number")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .or(`name.ilike.${pattern},serial_number.ilike.${pattern}`)
      .limit(4),

    admin
      .from("contracts")
      .select(
        "id, type, status, value_amount, value_currency, organizations(name)",
      )
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .ilike("type", pattern)
      .limit(4),

    admin
      .from("organizations")
      .select("id, name, type, document, address_city")
      .eq("tenant_id", TENANT_ID)
      .is("deleted_at", null)
      .or(`name.ilike.${pattern},document.ilike.${pattern}`)
      .limit(4),
  ]);

  return NextResponse.json({
    data: {
      operations: ops.data ?? [],
      assets: assets.data ?? [],
      contracts: contracts.data ?? [],
      organizations: orgs.data ?? [],
    },
  });
}
