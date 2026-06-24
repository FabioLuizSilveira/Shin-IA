import type { ExportRequest, ExportResult, ReportColumn } from "./types.js";

/**
 * Produces exports as structured strings — CSV, JSON, and lightweight
 * representations for PDF/Excel. No external file generation libraries required.
 */
export class ExportEngine {
  export(request: ExportRequest): ExportResult {
    switch (request.format) {
      case "json":
        return this.exportJson(request);
      case "csv":
        return this.exportCsv(request);
      case "excel":
        return this.exportExcel(request);
      case "pdf":
        return this.exportPdf(request);
    }
  }

  private exportJson(request: ExportRequest): ExportResult {
    const data = request.rows.map((row) => this.projectRow(row, request.columns));
    const content = JSON.stringify({ title: request.title, data }, null, 2);
    return {
      format: "json",
      content,
      contentType: "application/json",
      rowCount: request.rows.length,
      byteSize: content.length,
    };
  }

  private exportCsv(request: ExportRequest): ExportResult {
    const header = request.columns.map((c) => this.csvEscape(c.label)).join(",");
    const dataRows = request.rows.map((row) =>
      request.columns.map((c) => this.csvEscape(String(row[c.key] ?? ""))).join(","),
    );
    const content = [header, ...dataRows].join("\n");
    return {
      format: "csv",
      content,
      contentType: "text/csv",
      rowCount: request.rows.length,
      byteSize: content.length,
    };
  }

  private exportExcel(request: ExportRequest): ExportResult {
    // Produce a tab-separated representation (real Excel needs a library).
    const header = request.columns.map((c) => c.label).join("\t");
    const dataRows = request.rows.map((row) =>
      request.columns.map((c) => String(row[c.key] ?? "")).join("\t"),
    );
    const content = [header, ...dataRows].join("\n");
    return {
      format: "excel",
      content,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rowCount: request.rows.length,
      byteSize: content.length,
    };
  }

  private exportPdf(request: ExportRequest): ExportResult {
    // Produce a structured text layout (real PDF needs a library).
    const header = request.title ? `# ${request.title}\n\n` : "";
    const colHeaders = request.columns.map((c) => c.label).join(" | ");
    const separator = request.columns.map(() => "---").join(" | ");
    const dataRows = request.rows.map((row) =>
      request.columns.map((c) => String(row[c.key] ?? "")).join(" | "),
    );
    const content = [header + colHeaders, separator, ...dataRows].join("\n");
    return {
      format: "pdf",
      content,
      contentType: "application/pdf",
      rowCount: request.rows.length,
      byteSize: content.length,
    };
  }

  private projectRow(
    row: Record<string, unknown>,
    columns: ReportColumn[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const col of columns) {
      result[col.key] = row[col.key] ?? null;
    }
    return result;
  }

  private csvEscape(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
