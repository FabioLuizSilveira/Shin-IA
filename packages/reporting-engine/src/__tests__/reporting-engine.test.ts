import { describe, it, expect, vi } from "vitest";
import { AggregationEngine } from "../aggregation-engine.js";
import { ExportEngine } from "../export-engine.js";
import { KpiEngine, type KpiDataProvider } from "../kpi-engine.js";
import { ReportRuntime, type DataSourceProvider } from "../report-runtime.js";
import type {
  Dashboard,
  DashboardRepository,
  KpiType,
  ReportColumn,
  ReportDefinition,
  ReportDefinitionRepository,
  ReportRun,
  ReportRunRepository,
} from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeColumn = (overrides: Partial<ReportColumn> = {}): ReportColumn => ({
  key: "value",
  label: "Value",
  type: "number",
  aggregation: "sum",
  ...overrides,
});

const makeDefinition = (overrides: Partial<ReportDefinition> = {}): ReportDefinition => ({
  id: "def-1",
  tenantId: "tenant-1",
  name: "Monthly Revenue",
  description: "Revenue by month",
  dataSource: "revenue",
  columns: [makeColumn({ key: "amount", label: "Amount", aggregation: "sum" })],
  filters: [],
  groupBy: [],
  sortBy: [],
  format: "json",
  schedule: null,
  status: "draft",
  createdBy: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeRun = (overrides: Partial<ReportRun> = {}): ReportRun => ({
  id: "run-1",
  tenantId: "tenant-1",
  definitionId: "def-1",
  status: "completed",
  format: "json",
  rowCount: 10,
  error: null,
  startedAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:01.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// ─── Repo mocks ───────────────────────────────────────────────────────────────

function makeDefinitionRepo(
  def: ReportDefinition | null = makeDefinition(),
): ReportDefinitionRepository {
  return {
    findById: vi.fn().mockResolvedValue(def),
    findByTenantId: vi.fn().mockResolvedValue(def ? [def] : []),
    save: vi.fn().mockImplementation((d: ReportDefinition) => Promise.resolve(d)),
    update: vi.fn().mockImplementation((d: ReportDefinition) => Promise.resolve(d)),
  };
}

function makeRunRepo(run: ReportRun | null = null): ReportRunRepository {
  return {
    findById: vi.fn().mockResolvedValue(run),
    findByDefinitionId: vi.fn().mockResolvedValue(run ? [run] : []),
    save: vi.fn().mockImplementation((r: ReportRun) => Promise.resolve({ ...r, id: "run-1" })),
    update: vi.fn().mockImplementation((r: ReportRun) => Promise.resolve(r)),
  };
}

const sampleRows = [
  { id: "1", amount: 1000, category: "A", name: "Alpha" },
  { id: "2", amount: 2000, category: "B", name: "Beta" },
  { id: "3", amount: 1500, category: "A", name: "Gamma" },
  { id: "4", amount: 500, category: "C", name: "Delta" },
];

function makeDataSourceProvider(rows = sampleRows): DataSourceProvider {
  return { fetch: vi.fn().mockResolvedValue(rows) };
}

function makeRuntime(
  overrides: {
    definitionRepo?: ReportDefinitionRepository;
    runRepo?: ReportRunRepository;
    dataSourceProvider?: DataSourceProvider;
  } = {},
): ReportRuntime {
  return new ReportRuntime(
    overrides.definitionRepo ?? makeDefinitionRepo(),
    overrides.runRepo ?? makeRunRepo(),
    overrides.dataSourceProvider ?? makeDataSourceProvider(),
    new AggregationEngine(),
    new ExportEngine(),
  );
}

// ─── AggregationEngine tests ──────────────────────────────────────────────────

describe("AggregationEngine", () => {
  const engine = new AggregationEngine();

  it("computes sum", () => {
    const result = engine.aggregate(
      { dataSource: "x", metric: "amount", aggregation: "sum", filters: [], groupBy: [] },
      sampleRows,
    );
    expect(result.value).toBe(5000);
  });

  it("computes avg", () => {
    const result = engine.aggregate(
      { dataSource: "x", metric: "amount", aggregation: "avg", filters: [], groupBy: [] },
      sampleRows,
    );
    expect(result.value).toBe(1250);
  });

  it("computes min", () => {
    const result = engine.aggregate(
      { dataSource: "x", metric: "amount", aggregation: "min", filters: [], groupBy: [] },
      sampleRows,
    );
    expect(result.value).toBe(500);
  });

  it("computes max", () => {
    const result = engine.aggregate(
      { dataSource: "x", metric: "amount", aggregation: "max", filters: [], groupBy: [] },
      sampleRows,
    );
    expect(result.value).toBe(2000);
  });

  it("computes count", () => {
    const result = engine.aggregate(
      { dataSource: "x", metric: "amount", aggregation: "count", filters: [], groupBy: [] },
      sampleRows,
    );
    expect(result.value).toBe(4);
  });

  it("returns 0 for empty rows (non-count)", () => {
    const result = engine.computeAggregation([], "amount", "sum");
    expect(result).toBe(0);
  });

  it("groups by field", () => {
    const result = engine.aggregate(
      { dataSource: "x", metric: "amount", aggregation: "sum", filters: [], groupBy: ["category"] },
      sampleRows,
    );
    expect(result.groups).toHaveLength(3);
    const groupA = result.groups.find((g) => g.key === "A");
    expect(groupA?.value).toBe(2500);
  });

  it("applies eq filter", () => {
    const filtered = engine.applyFilters(sampleRows, [
      { field: "category", operator: "eq", value: "A" },
    ]);
    expect(filtered).toHaveLength(2);
  });

  it("applies neq filter", () => {
    const filtered = engine.applyFilters(sampleRows, [
      { field: "category", operator: "neq", value: "A" },
    ]);
    expect(filtered).toHaveLength(2);
  });

  it("applies gt filter", () => {
    const filtered = engine.applyFilters(sampleRows, [
      { field: "amount", operator: "gt", value: 1000 },
    ]);
    expect(filtered).toHaveLength(2);
  });

  it("applies gte filter", () => {
    const filtered = engine.applyFilters(sampleRows, [
      { field: "amount", operator: "gte", value: 1000 },
    ]);
    expect(filtered).toHaveLength(3);
  });

  it("applies lt filter", () => {
    const filtered = engine.applyFilters(sampleRows, [
      { field: "amount", operator: "lt", value: 1000 },
    ]);
    expect(filtered).toHaveLength(1);
  });

  it("applies lte filter", () => {
    const filtered = engine.applyFilters(sampleRows, [
      { field: "amount", operator: "lte", value: 1000 },
    ]);
    expect(filtered).toHaveLength(2);
  });

  it("applies in filter", () => {
    const filtered = engine.applyFilters(sampleRows, [
      { field: "category", operator: "in", value: ["A", "B"] },
    ]);
    expect(filtered).toHaveLength(3);
  });

  it("applies contains filter", () => {
    const filtered = engine.applyFilters(sampleRows, [
      { field: "name", operator: "contains", value: "ha" },
    ]);
    expect(filtered).toHaveLength(1); // Alpha
  });

  it("handles unknown operator (pass-through)", () => {
    const filtered = engine.applyFilters(sampleRows, [
      { field: "category", operator: "unknown" as never, value: "A" },
    ]);
    expect(filtered).toHaveLength(4);
  });

  it("includes period in result when provided", () => {
    const period = { start: "2026-01-01", end: "2026-01-31" };
    const result = engine.aggregate(
      { dataSource: "x", metric: "amount", aggregation: "count", filters: [], groupBy: [], period },
      sampleRows,
    );
    expect(result.period).toEqual(period);
  });
});

// ─── ExportEngine tests ───────────────────────────────────────────────────────

describe("ExportEngine", () => {
  const engine = new ExportEngine();
  const columns: ReportColumn[] = [
    { key: "name", label: "Name", type: "string" },
    { key: "amount", label: "Amount", type: "number" },
  ];
  const rows = [
    { name: "Alpha", amount: 1000 },
    { name: "Beta, Co.", amount: 2000 },
  ];

  it("exports JSON", () => {
    const result = engine.export({ format: "json", columns, rows, title: "Test" });
    expect(result.format).toBe("json");
    expect(result.contentType).toBe("application/json");
    const parsed = JSON.parse(result.content) as { title: string; data: unknown[] };
    expect(parsed.title).toBe("Test");
    expect(parsed.data).toHaveLength(2);
    expect(result.rowCount).toBe(2);
  });

  it("exports CSV with header", () => {
    const result = engine.export({ format: "csv", columns, rows });
    expect(result.format).toBe("csv");
    expect(result.contentType).toBe("text/csv");
    const lines = result.content.split("\n");
    expect(lines[0]).toBe("Name,Amount");
    expect(lines[1]).toContain("Alpha");
    expect(lines[2]).toContain('"Beta, Co."');
  });

  it("exports Excel (TSV representation)", () => {
    const result = engine.export({ format: "excel", columns, rows });
    expect(result.format).toBe("excel");
    expect(result.content).toContain("Name\tAmount");
  });

  it("exports PDF (markdown-table representation)", () => {
    const result = engine.export({ format: "pdf", columns, rows, title: "My Report" });
    expect(result.format).toBe("pdf");
    expect(result.content).toContain("# My Report");
    expect(result.content).toContain("Name | Amount");
  });

  it("escapes double quotes in CSV", () => {
    const quotedRows = [{ name: 'He said "hi"', amount: 0 }];
    const result = engine.export({ format: "csv", columns, rows: quotedRows });
    expect(result.content).toContain('"He said ""hi"""');
  });

  it("escapes newlines in CSV", () => {
    const newlineRows = [{ name: "Line1\nLine2", amount: 0 }];
    const result = engine.export({ format: "csv", columns, rows: newlineRows });
    expect(result.content).toContain('"Line1\nLine2"');
  });

  it("includes byteSize", () => {
    const result = engine.export({ format: "json", columns, rows });
    expect(result.byteSize).toBeGreaterThan(0);
  });

  it("exports PDF with no title", () => {
    const result = engine.export({ format: "pdf", columns, rows });
    expect(result.content).not.toContain("# undefined");
  });
});

// ─── KpiEngine tests ──────────────────────────────────────────────────────────

describe("KpiEngine", () => {
  const period = { start: "2026-01-01", end: "2026-01-31" };

  function makeProvider(value = 100, previousValue: number | null = 80): KpiDataProvider {
    return { fetchMetric: vi.fn().mockResolvedValue({ value, previousValue }) };
  }

  it("computes a KPI with change percent", async () => {
    const engine = new KpiEngine(makeProvider(100, 80));
    const kpi = await engine.compute("tenant-1", "revenue", period);

    expect(kpi.type).toBe("revenue");
    expect(kpi.value).toBe(100);
    expect(kpi.previousValue).toBe(80);
    expect(kpi.changePercent).toBe(25);
    expect(kpi.unit).toBe("BRL");
    expect(kpi.label).toBe("Total Revenue");
  });

  it("returns null changePercent when previousValue is null", async () => {
    const engine = new KpiEngine(makeProvider(100, null));
    const kpi = await engine.compute("tenant-1", "revenue", period);
    expect(kpi.changePercent).toBeNull();
  });

  it("returns null changePercent when previousValue is 0", async () => {
    const engine = new KpiEngine(makeProvider(100, 0));
    const kpi = await engine.compute("tenant-1", "revenue", period);
    expect(kpi.changePercent).toBeNull();
  });

  it("computes all 7 KPI types", async () => {
    const provider = makeProvider(50, 40);
    const engine = new KpiEngine(provider);
    const kpis = await engine.computeAll("tenant-1", period);

    expect(kpis).toHaveLength(7);
    const types: KpiType[] = [
      "operations",
      "assets",
      "revenue",
      "commissions",
      "utilization",
      "tracking",
      "infractions",
    ];
    for (const type of types) {
      expect(kpis.find((k) => k.type === type)).toBeDefined();
    }
  });

  it("rounds changePercent to 2 decimals", async () => {
    const engine = new KpiEngine(makeProvider(1, 3));
    const kpi = await engine.compute("tenant-1", "utilization", period);
    expect(kpi.changePercent).toBe(-66.67);
  });

  it("labels all KPI types correctly", async () => {
    const types: KpiType[] = [
      "operations",
      "assets",
      "revenue",
      "commissions",
      "utilization",
      "tracking",
      "infractions",
    ];
    const engine = new KpiEngine(makeProvider());
    for (const type of types) {
      const kpi = await engine.compute("tenant-1", type, period);
      expect(kpi.label).toBeTruthy();
      expect(kpi.unit).toBeTruthy();
    }
  });
});

// ─── ReportRuntime tests ──────────────────────────────────────────────────────

describe("ReportRuntime", () => {
  it("runs a simple report and returns JSON export", async () => {
    const runtime = makeRuntime();
    const result = await runtime.run("def-1", "tenant-1");

    expect(result.runId).toBe("run-1");
    expect(result.rowCount).toBe(4);
    expect(result.export.format).toBe("json");
    expect(result.export.contentType).toBe("application/json");
  });

  it("throws when definition not found", async () => {
    const runtime = makeRuntime({ definitionRepo: makeDefinitionRepo(null) });
    await expect(runtime.run("missing", "tenant-1")).rejects.toThrow("not found");
  });

  it("marks run as failed and re-throws on data source error", async () => {
    const dataSourceProvider: DataSourceProvider = {
      fetch: vi.fn().mockRejectedValue(new Error("DB unavailable")),
    };
    const runRepo = makeRunRepo();
    const runtime = makeRuntime({ dataSourceProvider, runRepo });

    await expect(runtime.run("def-1", "tenant-1")).rejects.toThrow("DB unavailable");
    expect(runRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error: "DB unavailable" }),
    );
  });

  it("runs report with groupBy aggregation", async () => {
    const definition = makeDefinition({ groupBy: ["category"] });
    const runtime = makeRuntime({ definitionRepo: makeDefinitionRepo(definition) });
    const result = await runtime.run("def-1", "tenant-1");

    expect(result.rowCount).toBe(3); // 3 distinct categories
  });

  it("runs report with sortBy", async () => {
    const definition = makeDefinition({ sortBy: [{ field: "amount", direction: "asc" }] });
    const runtime = makeRuntime({ definitionRepo: makeDefinitionRepo(definition) });
    const result = await runtime.run("def-1", "tenant-1");
    expect(result.rowCount).toBe(4);
  });

  it("runs report with sortBy descending", async () => {
    const definition = makeDefinition({ sortBy: [{ field: "name", direction: "desc" }] });
    const runtime = makeRuntime({ definitionRepo: makeDefinitionRepo(definition) });
    const result = await runtime.run("def-1", "tenant-1");
    expect(result.rowCount).toBe(4);
  });

  it("exports CSV format", async () => {
    const definition = makeDefinition({ format: "csv" });
    const runtime = makeRuntime({ definitionRepo: makeDefinitionRepo(definition) });
    const result = await runtime.run("def-1", "tenant-1");
    expect(result.export.format).toBe("csv");
  });

  it("exports Excel format", async () => {
    const definition = makeDefinition({ format: "excel" });
    const runtime = makeRuntime({ definitionRepo: makeDefinitionRepo(definition) });
    const result = await runtime.run("def-1", "tenant-1");
    expect(result.export.format).toBe("excel");
  });

  it("exports PDF format", async () => {
    const definition = makeDefinition({ format: "pdf" });
    const runtime = makeRuntime({ definitionRepo: makeDefinitionRepo(definition) });
    const result = await runtime.run("def-1", "tenant-1");
    expect(result.export.format).toBe("pdf");
  });

  it("getHistory returns run history for a definition", async () => {
    const runRepo = makeRunRepo(makeRun());
    const runtime = makeRuntime({ runRepo });
    const history = await runtime.getHistory("def-1");
    expect(history).toHaveLength(1);
  });

  it("applies filters defined in definition", async () => {
    const definition = makeDefinition({
      filters: [{ field: "category", operator: "eq", value: "A" }],
    });
    const runtime = makeRuntime({ definitionRepo: makeDefinitionRepo(definition) });
    const result = await runtime.run("def-1", "tenant-1");
    expect(result.rowCount).toBe(2);
  });
});

// ─── Dashboard type smoke test ────────────────────────────────────────────────

describe("Dashboard type", () => {
  it("constructs a dashboard object", () => {
    const dashboard: Dashboard = {
      id: "dash-1",
      tenantId: "tenant-1",
      name: "Operations Dashboard",
      description: "Main ops view",
      widgets: [
        {
          id: "w-1",
          type: "kpi",
          title: "Revenue",
          kpiType: "revenue",
          config: {},
          position: { x: 0, y: 0, w: 2, h: 1 },
        },
      ],
      isDefault: true,
      createdBy: "user-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(dashboard.widgets).toHaveLength(1);
    expect(dashboard.isDefault).toBe(true);
  });

  it("DashboardRepository interface can be mocked", async () => {
    const repo: DashboardRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findByTenantId: vi.fn().mockResolvedValue([]),
      findDefault: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      update: vi.fn(),
    };

    const result = await repo.findDefault("tenant-1");
    expect(result).toBeNull();
  });
});
