import type {
  ReportDefinition,
  ReportDefinitionRepository,
  ReportFormat,
  ReportRun,
  ReportRunRepository,
} from "./types.js";
import { AggregationEngine } from "./aggregation-engine.js";
import { ExportEngine } from "./export-engine.js";

export interface DataSourceProvider {
  fetch(
    dataSource: string,
    tenantId: string,
    filters: ReportDefinition["filters"],
  ): Promise<Record<string, unknown>[]>;
}

export interface BuildResult {
  runId: string;
  rowCount: number;
  export: {
    format: ReportFormat;
    content: string;
    contentType: string;
    byteSize: number;
  };
}

export class ReportRuntime {
  constructor(
    private definitions: ReportDefinitionRepository,
    private runs: ReportRunRepository,
    private dataSourceProvider: DataSourceProvider,
    private aggregationEngine: AggregationEngine,
    private exportEngine: ExportEngine,
  ) {}

  async run(definitionId: string, tenantId: string): Promise<BuildResult> {
    const definition = await this.definitions.findById(definitionId);
    if (!definition) throw new Error(`report definition ${definitionId} not found`);

    const now = new Date().toISOString();
    let run = await this.runs.save({
      id: crypto.randomUUID(),
      tenantId,
      definitionId,
      status: "running",
      format: definition.format,
      rowCount: null,
      error: null,
      startedAt: now,
      completedAt: null,
      createdAt: now,
    });

    try {
      const rawRows = await this.dataSourceProvider.fetch(
        definition.dataSource,
        tenantId,
        definition.filters,
      );

      // Apply filters and (if groupBy present) aggregate
      let rows: Record<string, unknown>[];
      if (definition.groupBy.length > 0) {
        const result = this.aggregationEngine.aggregate(
          {
            dataSource: definition.dataSource,
            metric: definition.columns[0]?.key ?? "value",
            aggregation: definition.columns[0]?.aggregation ?? "count",
            filters: definition.filters,
            groupBy: definition.groupBy,
          },
          rawRows,
        );
        rows = result.groups.map((g) => ({ key: g.key, value: g.value }));
      } else {
        rows = this.aggregationEngine.applyFilters(rawRows, definition.filters);
      }

      // Sort
      if (definition.sortBy.length > 0) {
        rows = this.sortRows(rows, definition.sortBy);
      }

      const exported = this.exportEngine.export({
        format: definition.format,
        columns: definition.columns,
        rows,
        title: definition.name,
      });

      run = await this.runs.update({
        ...run,
        status: "completed",
        rowCount: rows.length,
        completedAt: new Date().toISOString(),
      });

      return {
        runId: run.id,
        rowCount: rows.length,
        export: {
          format: exported.format,
          content: exported.content,
          contentType: exported.contentType,
          byteSize: exported.byteSize,
        },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.runs.update({ ...run, status: "failed", error });
      throw err;
    }
  }

  async getHistory(definitionId: string): Promise<ReportRun[]> {
    return this.runs.findByDefinitionId(definitionId);
  }

  private sortRows(
    rows: Record<string, unknown>[],
    sortBy: ReportDefinition["sortBy"],
  ): Record<string, unknown>[] {
    return [...rows].sort((a, b) => {
      for (const { field, direction } of sortBy) {
        const av = a[field];
        const bv = b[field];
        const cmp =
          String(av ?? "") < String(bv ?? "") ? -1 : String(av ?? "") > String(bv ?? "") ? 1 : 0;
        if (cmp !== 0) return direction === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }
}
