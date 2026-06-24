import type { DashboardWidget, DashboardData, MetricData, TrendDirection } from "./types.js";

export function filterVisibleWidgets(
  widgets: DashboardWidget[],
  userRole?: string,
): DashboardWidget[] {
  return widgets
    .filter((w) => w.visible)
    .filter((w) => {
      if (!w.roles || w.roles.length === 0) return true;
      return userRole ? w.roles.includes(userRole) : false;
    });
}

export function computeTrendIndicator(metric: MetricData): TrendDirection {
  if (metric.previous === undefined) return "stable";
  if (metric.current > metric.previous) return "up";
  if (metric.current < metric.previous) return "down";
  return "stable";
}

export function mergeDashboardData(
  base: DashboardData,
  patch: Partial<DashboardData>,
): DashboardData {
  return {
    widgets: patch.widgets ?? base.widgets,
    metrics: { ...base.metrics, ...(patch.metrics ?? {}) },
  };
}

export function sortWidgetsByOrder(widgets: DashboardWidget[]): DashboardWidget[] {
  return [...widgets].sort((a, b) => a.order - b.order);
}
