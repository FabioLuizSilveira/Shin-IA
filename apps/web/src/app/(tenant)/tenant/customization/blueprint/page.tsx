"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { StudioAreaShell } from "@/components/ui/studio-area-shell";
import { useStudioConfig } from "@/hooks/use-studio-config";
import { Plus, X } from "lucide-react";
import type { BlueprintStudioConfig } from "@shina/studio";
import type { BlueprintManifest } from "@shina/blueprint-runtime";

interface InstalledInstance {
  id: string;
  blueprintId: string;
  manifest: BlueprintManifest | null;
}

const EMPTY: BlueprintStudioConfig = {
  blueprintId: "",
  blueprintName: "",
  fieldOverrides: [],
  workflowOverrides: [],
  kpiOverrides: [],
  customCapabilities: [],
};

const inputClass =
  "w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100";

export default function BlueprintStudioPage() {
  const studio = useStudioConfig<BlueprintStudioConfig>("blueprint", EMPTY);
  const { config, setConfig } = studio;

  const [installed, setInstalled] = useState<InstalledInstance[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(true);

  const [fieldId, setFieldId] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldHidden, setFieldHidden] = useState(false);

  const [kpiType, setKpiType] = useState("");
  const [kpiLabel, setKpiLabel] = useState("");

  const [capabilityInput, setCapabilityInput] = useState("");

  useEffect(() => {
    fetch("/api/blueprints/installed")
      .then((r) => r.json())
      .then((json) => setInstalled(json.data ?? []))
      .finally(() => setLoadingInstalled(false));
  }, []);

  const selectedManifest =
    installed.find((i) => i.blueprintId === config.blueprintId)?.manifest ?? null;

  function selectBlueprint(blueprintId: string) {
    const instance = installed.find((i) => i.blueprintId === blueprintId);
    setConfig({
      ...config,
      blueprintId,
      blueprintName: instance?.manifest?.displayName ?? blueprintId,
    });
  }

  function addFieldOverride() {
    if (!fieldId) return;
    setConfig({
      ...config,
      fieldOverrides: [
        ...config.fieldOverrides.filter((f) => f.fieldId !== fieldId),
        {
          fieldId,
          label: fieldLabel.trim() || undefined,
          required: fieldRequired,
          hidden: fieldHidden,
        },
      ],
    });
    setFieldId("");
    setFieldLabel("");
    setFieldRequired(false);
    setFieldHidden(false);
  }

  function removeFieldOverride(id: string) {
    setConfig({ ...config, fieldOverrides: config.fieldOverrides.filter((f) => f.fieldId !== id) });
  }

  function addKpiOverride() {
    if (!kpiType.trim() || !kpiLabel.trim()) return;
    setConfig({
      ...config,
      kpiOverrides: [
        ...config.kpiOverrides,
        { kpiType: kpiType.trim(), label: kpiLabel.trim(), visible: true },
      ],
    });
    setKpiType("");
    setKpiLabel("");
  }

  function toggleKpiVisible(index: number) {
    setConfig({
      ...config,
      kpiOverrides: config.kpiOverrides.map((k, i) =>
        i === index ? { ...k, visible: !k.visible } : k,
      ),
    });
  }

  function removeKpiOverride(index: number) {
    setConfig({ ...config, kpiOverrides: config.kpiOverrides.filter((_, i) => i !== index) });
  }

  function addCapability() {
    if (!capabilityInput.trim() || config.customCapabilities.includes(capabilityInput.trim()))
      return;
    setConfig({
      ...config,
      customCapabilities: [...config.customCapabilities, capabilityInput.trim()],
    });
    setCapabilityInput("");
  }

  function removeCapability(cap: string) {
    setConfig({
      ...config,
      customCapabilities: config.customCapabilities.filter((c) => c !== cap),
    });
  }

  return (
    <AppShell title="Blueprint">
      <StudioAreaShell
        title="Blueprint"
        description="Ajustes por tenant sobre um blueprint instalado — campos, KPIs e capacidades extras."
        publishedVersion={studio.publishedVersion}
        saving={studio.saving}
        publishing={studio.publishing}
        saved={studio.saved}
        error={studio.error}
        onSaveDraft={() => void studio.saveDraft(config)}
        onPublish={() => void studio.publish()}
      >
        {studio.loading || loadingInstalled ? (
          <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : installed.length === 0 ? (
          <div className="max-w-xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum blueprint instalado ainda.{" "}
              <Link
                href="/tenant/customization/blueprints"
                className="text-shina-blue hover:underline"
              >
                Instale um template de tipo de ativo
              </Link>{" "}
              antes de ajustar overrides.
            </p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Blueprint instalado
              </label>
              <select
                value={config.blueprintId}
                onChange={(e) => selectBlueprint(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione...</option>
                {installed.map((i) => (
                  <option key={i.blueprintId} value={i.blueprintId}>
                    {i.manifest?.displayName ?? i.blueprintId}
                  </option>
                ))}
              </select>
            </div>

            {config.blueprintId && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                    Overrides de campo
                  </p>
                  {selectedManifest && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      <select
                        value={fieldId}
                        onChange={(e) => setFieldId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Campo...</option>
                        {selectedManifest.customFields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <input
                        placeholder="Novo label (opcional)"
                        value={fieldLabel}
                        onChange={(e) => setFieldLabel(e.target.value)}
                        className={inputClass}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={fieldRequired}
                          onChange={(e) => setFieldRequired(e.target.checked)}
                        />
                        Obrigatório
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={fieldHidden}
                          onChange={(e) => setFieldHidden(e.target.checked)}
                        />
                        Oculto
                      </label>
                      <button
                        type="button"
                        onClick={addFieldOverride}
                        className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {config.fieldOverrides.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">
                      Nenhum override de campo.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {config.fieldOverrides.map((f) => (
                        <li
                          key={f.fieldId}
                          className="py-2 flex items-center justify-between gap-2"
                        >
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {f.fieldId}
                            {f.label && (
                              <span className="text-slate-400"> → &quot;{f.label}&quot;</span>
                            )}
                            {f.required && (
                              <span className="text-amber-500 text-xs"> · obrigatório</span>
                            )}
                            {f.hidden && <span className="text-slate-400 text-xs"> · oculto</span>}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeFieldOverride(f.fieldId)}
                            className="p-1 text-slate-300 hover:text-red-500 bg-transparent border-0 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                    Overrides de KPI
                  </p>
                  <div className="flex gap-2 mb-3">
                    <input
                      placeholder="Tipo do KPI"
                      value={kpiType}
                      onChange={(e) => setKpiType(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      placeholder="Label"
                      value={kpiLabel}
                      onChange={(e) => setKpiLabel(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={addKpiOverride}
                      className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {config.kpiOverrides.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">
                      Nenhum override de KPI.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {config.kpiOverrides.map((k, i) => (
                        <li key={i} className="py-2 flex items-center justify-between gap-2">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {k.kpiType} — {k.label}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleKpiVisible(i)}
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded-lg border-0 cursor-pointer ${
                                k.visible
                                  ? "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {k.visible ? "Visível" : "Oculto"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeKpiOverride(i)}
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

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                    Capacidades extras
                  </p>
                  <div className="flex gap-2 mb-3">
                    <input
                      placeholder="Nome da capacidade"
                      value={capabilityInput}
                      onChange={(e) => setCapabilityInput(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={addCapability}
                      className="px-3 py-1.5 text-xs font-semibold bg-shina-blue hover:bg-blue-600 text-white rounded-lg border-0 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {config.customCapabilities.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-2">
                      Nenhuma capacidade extra.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {config.customCapabilities.map((c) => (
                        <span
                          key={c}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full"
                        >
                          {c}
                          <button
                            type="button"
                            onClick={() => removeCapability(c)}
                            className="bg-transparent border-0 cursor-pointer text-slate-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </StudioAreaShell>
    </AppShell>
  );
}
