import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// Matches ExportButtonProps["entity"] in components/ui/export-button.tsx —
// that component was built and tested but never wired to a route (M33 gap,
// see packages/ audit report). Columns mirror each entity's own list route.
const ENTITY_CONFIG: Record<string, { table: string; select: string; filename: string }> = {
  operations: {
    table: "operations",
    select: "id, type, status, scheduled_starts_at, scheduled_ends_at, created_at",
    filename: "operacoes",
  },
  assets: {
    table: "assets",
    select: "id, name, serial_number, category, status, created_at",
    filename: "ativos",
  },
  contracts: {
    table: "contracts",
    select:
      "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, created_at",
    filename: "contratos",
  },
  invoices: {
    table: "invoices",
    select: "id, status, total_amount, total_currency, due_date, paid_at, created_at",
    filename: "faturas",
  },
  resources: {
    table: "resources",
    select: "id, name, type, status, created_at",
    filename: "recursos",
  },
  organizations: {
    table: "organizations",
    select: "id, name, trade_name, document, type, email, phone, active, created_at",
    filename: "organizacoes",
  },
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get("entity") ?? "";
  const config = ENTITY_CONFIG[entity];
  if (!config) {
    return NextResponse.json(
      { error: `entity must be one of: ${Object.keys(ENTITY_CONFIG).join(", ")}` },
      { status: 422 },
    );
  }

  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from(config.table)
    .select(config.select)
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const csv = toCsv((data ?? []) as unknown as Record<string, unknown>[]);
  const filename = `${config.filename}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
