import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import { parseCsv, suggestColumnMapping } from "@/lib/infraction-csv-import";

export const dynamic = "force-dynamic";

interface PreviewBody {
  csvText?: string;
}

const SAMPLE_ROWS = 5;

// POST /api/infractions/import/preview — item 34: the tenant sees the
// real headers/sample rows and a suggested mapping before anything is
// imported. Read-only (view of the raw text), never writes.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.infractions.import"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as PreviewBody;
  if (!body.csvText?.trim()) {
    return NextResponse.json({ error: "csvText is required" }, { status: 400 });
  }

  const table = parseCsv(body.csvText);
  if (table.headers.length === 0) {
    return NextResponse.json({ error: "CSV vazio ou sem cabeçalho" }, { status: 400 });
  }

  return NextResponse.json({
    data: {
      headers: table.headers,
      sampleRows: table.rows.slice(0, SAMPLE_ROWS),
      totalRows: table.rows.length,
      suggestedMapping: suggestColumnMapping(table.headers),
    },
  });
}
