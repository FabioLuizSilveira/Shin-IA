"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import { Plus, X } from "lucide-react";
import type { DashboardConfig, WidgetType, RefreshInterval } from "@shina/studio";

const WIDGET_TYPES: WidgetType[] = ["kpi", "chart", "table", "map", "alert", "custom"];
const REFRESH_OPTIONS: RefreshInterval[] = [0, 30, 60, 300, 900, 3600];
const REFRESH_LABEL: Record<RefreshInterval, string> = {
  0: "Manual",
  30: "30s",
  60: "1min",
  300: "5min",
  900: "15min",
  3600: "1h",
};

const EMPTY: DashboardConfig = {
  name: "",
  columns: 4,
  widgets: [],
  isDefault: false,
  allowedRoles: [],
};

const inputClass =
  "w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function DashboardStudioPage() {
  const studio = useStudioConfig<DashboardConfig>("dashboard", EMPTY);
  const { config, setConfig } = studio;
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WidgetType>("kpi");
  const [metric, setMetric] = useState("");
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(60);

  function addWidget() {
    if (!title.trim() || !metric.trim()) return;
    setConfig({
      ...config,
      widgets: [
        ...config.widgets,
        {
          id: crypto.randomUUID(),
          type,
          title: title.trim(),
          dataSource: { engine: "reporting-engine", metric: metric.trim() },
          refreshInterval,
          position: { col: 0, row: config.widgets.length, colSpan: 1, rowSpan: 1 },
          visible: true,
        },
      ],
    });
    setTitle("");
    setMetric("");
    setShowForm(false);
  }

  function removeWidget(id: string) {
    setConfig({ ...config, widgets: config.widgets.filter((w) => w.id !== id) });
  }

  function toggleWidget(id: string) {
    setConfig({
      ...config,
      widgets: config.widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
    });
  }

  return (
    <AppShell title="Dashboard">
      <StudioAreaShell
        title="Dashboard"
        description="Widgets e layout do painel do tenant."
        publishedVersion={studio.publishedVersion}
        saving={studio.saving}
        publishing={studio.publishing}
        saved={studio.saved}
        error={studio.error}
        onSaveDraft={() => void studio.saveDraft(config)}
        onPublish={() => void studio.publish()}
      >
        {studio.loading ? (
          <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Nome</label>
                <input
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Colunas</label>
                <input
                  type="number"
                  value={config.columns}
                  onChange={(e) => setConfig({ ...config, columns: Number(e.target.value) })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Widgets
                </p>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-shina-blue hover:text-blue-700 bg-transparent border-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>

              {showForm && (
                <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <input
                    placeholder="Título"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                  />
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as WidgetType)}
                    className={inputClass}
                  >
                    {WIDGET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Métrica"
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                    className={inputClass}
                  />
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value) as RefreshInterval)}
                    className={inputClass}
                  >
                    {REFRESH_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {REFRESH_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addWidget}
                    className="col-span-2 sm:col-span-4 px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>
              )}

              {config.widgets.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum widget ainda.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {config.widgets.map((widget) => (
                    <li key={widget.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {widget.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          {widget.type} · {widget.dataSource.metric} · atualiza a cada{" "}
                          {REFRESH_LABEL[widget.refreshInterval]}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleWidget(widget.id)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border-0 cursor-pointer ${
                            widget.visible
                              ? "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {widget.visible ? "Visível" : "Oculto"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWidget(widget.id)}
                          className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
