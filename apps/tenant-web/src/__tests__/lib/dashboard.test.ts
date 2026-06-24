import { describe, it, expect } from "vitest";
import {
  filterVisibleWidgets,
  computeTrendIndicator,
  mergeDashboardData,
  sortWidgetsByOrder,
} from "../../lib/dashboard.js";
import type { DashboardWidget, DashboardData } from "../../lib/types.js";

function makeWidget(overrides: Partial<DashboardWidget> = {}): DashboardWidget {
  return {
    id: "w1",
    type: "metric",
    title: "Revenue",
    visible: true,
    order: 1,
    ...overrides,
  };
}

function makeData(overrides: Partial<DashboardData> = {}): DashboardData {
  return { widgets: [], metrics: {}, ...overrides };
}

describe("filterVisibleWidgets", () => {
  it("filters out hidden widgets", () => {
    const widgets = [makeWidget({ visible: true }), makeWidget({ id: "w2", visible: false })];
    expect(filterVisibleWidgets(widgets)).toHaveLength(1);
  });

  it("returns all visible widgets with no roles restriction", () => {
    const widgets = [makeWidget(), makeWidget({ id: "w2" })];
    expect(filterVisibleWidgets(widgets)).toHaveLength(2);
  });

  it("filters by role when widget has roles", () => {
    const widgets = [makeWidget({ roles: ["admin"] }), makeWidget({ id: "w2", roles: ["user"] })];
    expect(filterVisibleWidgets(widgets, "admin")).toHaveLength(1);
  });

  it("hides role-restricted widgets when no user role provided", () => {
    const widgets = [makeWidget({ roles: ["admin"] })];
    expect(filterVisibleWidgets(widgets)).toHaveLength(0);
  });

  it("shows widget with empty roles array to all", () => {
    const widgets = [makeWidget({ roles: [] })];
    expect(filterVisibleWidgets(widgets)).toHaveLength(1);
  });
});

describe("computeTrendIndicator", () => {
  it("returns stable when no previous", () => {
    expect(computeTrendIndicator({ current: 100 })).toBe("stable");
  });

  it("returns up when current > previous", () => {
    expect(computeTrendIndicator({ current: 200, previous: 100 })).toBe("up");
  });

  it("returns down when current < previous", () => {
    expect(computeTrendIndicator({ current: 50, previous: 100 })).toBe("down");
  });

  it("returns stable when current === previous", () => {
    expect(computeTrendIndicator({ current: 100, previous: 100 })).toBe("stable");
  });
});

describe("mergeDashboardData", () => {
  it("replaces widgets when patch has widgets", () => {
    const base = makeData({ widgets: [makeWidget()] });
    const newWidgets = [makeWidget({ id: "w-new" })];
    const merged = mergeDashboardData(base, { widgets: newWidgets });
    expect(merged.widgets[0]?.id).toBe("w-new");
  });

  it("keeps base widgets when patch has none", () => {
    const base = makeData({ widgets: [makeWidget()] });
    const merged = mergeDashboardData(base, {});
    expect(merged.widgets).toHaveLength(1);
  });

  it("merges metrics (patch wins on conflict)", () => {
    const base = makeData({ metrics: { rev: { current: 100 }, users: { current: 50 } } });
    const merged = mergeDashboardData(base, { metrics: { rev: { current: 200 } } });
    expect(merged.metrics["rev"]?.current).toBe(200);
    expect(merged.metrics["users"]?.current).toBe(50);
  });
});

describe("sortWidgetsByOrder", () => {
  it("sorts ascending by order", () => {
    const widgets = [
      makeWidget({ id: "w3", order: 3 }),
      makeWidget({ id: "w1", order: 1 }),
      makeWidget({ id: "w2", order: 2 }),
    ];
    const sorted = sortWidgetsByOrder(widgets);
    expect(sorted[0]?.id).toBe("w1");
    expect(sorted[2]?.id).toBe("w3");
  });

  it("does not mutate original array", () => {
    const widgets = [makeWidget({ order: 2 }), makeWidget({ id: "w2", order: 1 })];
    sortWidgetsByOrder(widgets);
    expect(widgets[0]?.order).toBe(2);
  });
});
