import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Invoice } from "@/types/domain";

export const dynamic = "force-dynamic";

const SELECT =
  "id, billing_account_id, status, total_amount, total_currency, due_date, paid_at, created_at, billing_accounts(id, cycle, organizations(id, name))";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = new URL(req.url).searchParams.get("scope");

  if (scope === "platform") {
    const appMeta = user.app_metadata as { platform_role?: string };
    if (!appMeta.platform_role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("invoices")
      .select(SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data as unknown as Invoice[] });
  }

  const { data, error } = await supabase
    .from("invoices")
    .select(SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data as unknown as Invoice[] });
}
