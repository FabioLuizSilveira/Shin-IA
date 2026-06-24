import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [tenants, invoices, operations] = await Promise.all([
    admin.from("tenants").select("id, status"),
    admin.from("invoices").select("total_amount, status").is("deleted_at", null),
    admin.from("operations").select("id, status").is("deleted_at", null),
  ]);

  const totalTenants = tenants.data?.length ?? 0;
  const activeTenants = tenants.data?.filter((t) => t.status === "active").length ?? 0;
  const totalRevenue =
    invoices.data
      ?.filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + Number(i.total_amount), 0) ?? 0;
  const activeOperations = operations.data?.filter((o) => o.status === "in_progress").length ?? 0;

  return NextResponse.json({ totalTenants, activeTenants, totalRevenue, activeOperations });
}
