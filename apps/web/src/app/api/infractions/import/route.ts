import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { ingestInfraction } from "@/lib/infraction-ingest";
import { createDeadlinesForCase } from "@/lib/infraction-deadlines";
import { parseCsv, mapCsvRows, type ColumnMapping } from "@/lib/infraction-csv-import";
import { CsvInfractionProvider } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

interface ImportBody {
  csvText?: string;
  columnMapping?: ColumnMapping;
}

// POST /api/infractions/import — item 6/34: the actual CSV import, after
// the tenant confirmed a column mapping via /import/preview. Every row
// goes through the exact same ingestInfraction() path manual entry and a
// future official adapter use (via CsvInfractionProvider, a pure
// pass-through here -- the real normalization already happened in
// mapCsvRows). One bad row never blocks the batch (item 34) -- it's
// counted in failedCount with its own message, everything else still
// imports. The whole run is tracked in infraction_provider_sync_runs
// (item 30/31), unused by any other path until now.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.import"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as ImportBody;
  if (!body.csvText?.trim() || !body.columnMapping) {
    return NextResponse.json({ error: "csvText and columnMapping are required" }, { status: 400 });
  }
  if (!body.columnMapping.plate || !body.columnMapping.occurredAt) {
    return NextResponse.json(
      { error: "columnMapping must map at least plate and occurredAt" },
      { status: 400 },
    );
  }

  const table = parseCsv(body.csvText);
  const mapped = mapCsvRows(table, body.columnMapping);
  const provider = new CsvInfractionProvider();

  const runId = crypto.randomUUID();
  const { error: runInsertError } = await scope.db.from("infraction_provider_sync_runs").insert({
    id: runId,
    tenant_id: scope.tenantId,
    provider: "csv_import",
    status: "running",
    received_count: mapped.length,
    triggered_by: scope.userId,
  });
  if (runInsertError) return internalError(runInsertError);

  let createdCount = 0;
  let duplicatedCount = 0;
  let failedCount = 0;
  const errorLog: { rowIndex: number; message: string }[] = [];

  for (const row of mapped) {
    if (!row.infraction) {
      failedCount += 1;
      errorLog.push({ rowIndex: row.rowIndex, message: row.errors.join("; ") });
      continue;
    }
    try {
      const [normalized] = await provider.fetchInfractions([row.infraction]);
      const result = await ingestInfraction(scope.db, normalized, scope.userId, scope.tenantId);
      if (result.deduplicated) {
        duplicatedCount += 1;
      } else {
        createdCount += 1;
        const { data: infractionRow } = await scope.db
          .from("infractions")
          .select(
            "driver_identification_deadline, defense_deadline, discount_deadline, payment_deadline",
          )
          .eq("id", result.infractionId)
          .maybeSingle();
        if (infractionRow) {
          await createDeadlinesForCase(
            scope.db,
            scope.tenantId,
            result.caseId,
            infractionRow,
          ).catch(() => {});
        }
      }
      if (row.errors.length > 0) {
        // Row imported despite a non-fatal warning (e.g. unparseable
        // amount) -- logged, but not counted as failed since a real case
        // was created.
        errorLog.push({ rowIndex: row.rowIndex, message: `aviso: ${row.errors.join("; ")}` });
      }
    } catch (err) {
      failedCount += 1;
      errorLog.push({
        rowIndex: row.rowIndex,
        message: err instanceof Error ? err.message : "erro desconhecido",
      });
    }
  }

  await scope.db
    .from("infraction_provider_sync_runs")
    .update({
      status: "completed",
      finished_at: new Date().toISOString(),
      created_count: createdCount,
      duplicated_count: duplicatedCount,
      failed_count: failedCount,
      error_log: errorLog,
    })
    .eq("id", runId);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_provider_sync_run",
    entityId: runId,
    action: "csv_import_completed",
    metadata: { createdCount, duplicatedCount, failedCount, receivedCount: mapped.length },
  });

  return NextResponse.json({
    data: {
      runId,
      receivedCount: mapped.length,
      createdCount,
      duplicatedCount,
      failedCount,
      errors: errorLog,
    },
  });
}
