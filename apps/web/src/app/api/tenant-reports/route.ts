import { NextResponse } from "next/server";
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

  const [opsRes, assetsRes, contractsRes, invoicesRes] = await Promise.all([
    supabase.from("operations").select("status").is("deleted_at", null),
    supabase.from("assets").select("category").is("deleted_at", null),
    supabase.from("contracts").select("status, value_amount").is("deleted_at", null),
    supabase.from("invoices").select("status, total_amount").is("deleted_at", null),
  ]);

  const errors = [opsRes, assetsRes, contractsRes, invoicesRes].map((r) => r.error).filter(Boolean);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0]?.message }, { status: 500 });
  }

  const ops = opsRes.data ?? [];
  const assets = assetsRes.data ?? [];
  const contracts = contractsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];

  const countBy = <T extends string>(
    rows: { status?: T; category?: T }[],
    key: "status" | "category",
  ) => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const value = (row[key] as string | undefined) ?? "unknown";
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  };

  const contractsValueByStatus: Record<string, number> = {};
  for (const c of contracts) {
    contractsValueByStatus[c.status] =
      (contractsValueByStatus[c.status] ?? 0) + Number(c.value_amount);
  }

  const invoicesAmountByStatus: Record<string, number> = {};
  for (const i of invoices) {
    invoicesAmountByStatus[i.status] =
      (invoicesAmountByStatus[i.status] ?? 0) + Number(i.total_amount);
  }

  return NextResponse.json({
    data: {
      operationsByStatus: countBy(ops, "status"),
      assetsByCategory: countBy(assets, "category"),
      contractsValueByStatus,
      invoicesAmountByStatus,
    },
  });
}
