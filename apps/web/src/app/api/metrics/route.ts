import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const [tenants, invoices, operations] = await Promise.all([
      admin.from("tenants").select("id, status"),
      admin.from("invoices").select("total_amount, status").is("deleted_at", null),
      admin.from("operations").select("id, status").is("deleted_at", null),
    ]);

    if (tenants.error || invoices.error || operations.error) {
      console.error("Database fetch error:", {
        tenants: tenants.error,
        invoices: invoices.error,
        operations: operations.error,
      });
      return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
    }

    const totalTenants = tenants.data?.length ?? 0;
    const activeTenants = tenants.data
      ? tenants.data.filter((t) => t.status === "active").length
      : 0;

    const totalRevenue = invoices.data
      ? invoices.data
          .filter((i) => i.status === "paid")
          .reduce((sum, i) => sum + Number(i.total_amount), 0)
      : 0;

    const activeOperations = operations.data
      ? operations.data.filter((o) => o.status === "in_progress").length
      : 0;

    return NextResponse.json({ totalTenants, activeTenants, totalRevenue, activeOperations });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
