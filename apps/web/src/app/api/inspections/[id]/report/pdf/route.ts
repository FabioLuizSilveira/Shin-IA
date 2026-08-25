import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";
import { buildInspectionPdfInput } from "@/lib/inspection-report-data";
import { renderInspectionReportPdf } from "@/lib/inspection-pdf";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/inspections/:id/report/pdf — staff download (item 10 of the
// spec: "Visualizar laudo" / "Baixar PDF" in Tenant Web). Always the
// latest version's snapshot, never regenerated from live data.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: report, error } = await scope.db
    .from("inspection_reports")
    .select("id")
    .eq("inspection_id", id)
    .eq("tenant_id", scope.tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return internalError(error);
  if (!report)
    return NextResponse.json({ error: "Nenhum laudo gerado para esta vistoria." }, { status: 404 });

  const pdfInput = await buildInspectionPdfInput(scope.db, report.id);
  if (!pdfInput) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const buffer = await renderInspectionReportPdf(pdfInput);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection",
    entityId: id,
    action: "report_downloaded",
    metadata: { reportId: report.id },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vistoria-${id.slice(0, 8)}.pdf"`,
    },
  });
}
