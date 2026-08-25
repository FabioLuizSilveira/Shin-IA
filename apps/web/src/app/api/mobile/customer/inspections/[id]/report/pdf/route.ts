import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { buildInspectionPdfInput } from "@/lib/inspection-report-data";
import { renderInspectionReportPdf } from "@/lib/inspection-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/mobile/customer/inspections/:id/report/pdf — customer download
// (item 10 of the spec). Ownership re-verified via customer_id, same as
// every other customer inspection route.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await context.db
    .from("inspections")
    .select("id")
    .eq("id", id)
    .eq("customer_id", context.customerId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const { data: report, error } = await context.db
    .from("inspection_reports")
    .select("id")
    .eq("inspection_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return internalError(error);
  if (!report)
    return NextResponse.json({ error: "Nenhum laudo gerado para esta vistoria." }, { status: 404 });

  const pdfInput = await buildInspectionPdfInput(context.db, report.id);
  if (!pdfInput) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const buffer = await renderInspectionReportPdf(pdfInput);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vistoria-${id.slice(0, 8)}.pdf"`,
    },
  });
}
